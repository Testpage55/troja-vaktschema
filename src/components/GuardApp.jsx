import { useState, useEffect, useRef } from 'react'
import TimeInput from './TimeInput'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import '../guard.css'
import { downloadIcs } from '../utils/icalExport'
import { iceBurst, effectsEnabled, setEffectsEnabled, EFFECTS_EVENT } from '../effects/iceEffects'
import HockeyBannerEffects from './HockeyBannerEffects'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeToMinutes(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function minutesToTime(mins) {
  const total = ((mins % 1440) + 1440) % 1440
  return `${Math.floor(total/60).toString().padStart(2,'0')}:${(total%60).toString().padStart(2,'0')}`
}
function calcHours(start, end) {
  if (!start || !end) return 0
  let diff = timeToMinutes(end) - timeToMinutes(start)
  if (diff <= 0) diff += 1440
  return parseFloat((diff / 60).toFixed(1))
}
function fmtTime(t) {
  if (!t) return 'N/A'
  return t.split(':').slice(0,2).join(':')
}
function fmtDate(dateStr, short = false) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(dateStr); d.setHours(0,0,0,0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1)
  if (d.getTime() === today.getTime()) return 'Idag'
  if (d.getTime() === tomorrow.getTime()) return 'Imorgon'
  if (short) return date.toLocaleDateString('sv-SE', { day:'numeric', month:'short' })
  return date.toLocaleDateString('sv-SE', { weekday:'long', day:'numeric', month:'long' })
}

const fmtH = (h) => (Math.round(h * 10) / 10).toLocaleString('sv-SE')
const fmtShortDate = (d) => d ? new Date(d + 'T12:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '') : ''

// ─── Countdown ───────────────────────────────────────────────────────────────

function Countdown({ cd }) {
  if (!cd) return null
  if (cd.live) return (
    <div className="cd-wrap">
      <div className="cd-live"><span className="cd-dot" />Passet pågår</div>
    </div>
  )
  const units = cd.d > 0
    ? [[cd.d, cd.d === 1 ? 'dag' : 'dagar'], [cd.h, 'tim'], [cd.m, 'min']]
    : [[cd.h, 'tim'], [cd.m, 'min'], [cd.s, 'sek']]
  return (
    <div className="cd-wrap" role="timer" aria-label={`${units.map(([v, l]) => `${v} ${l}`).join(' ')} kvar till vaktstart`}>
      <div className="cd-row">
        {units.map(([v, l], i) => (
          <div key={l} className="cd-group">
            {i > 0 && <span className="cd-sep" aria-hidden="true">:</span>}
            <div className="cd-unit">
              <div className="cd-tile">{String(v).padStart(2, '0')}</div>
              <div className="cd-lbl">{l}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="cd-caption">kvar till vaktstart</div>
    </div>
  )
}

// ─── NextMatch ────────────────────────────────────────────────────────────────

function NextMatch({ personnelId }) {
  const [next, setNext] = useState(null)
  const [countdown, setCountdown] = useState(null)
  const [loading, setLoading] = useState(true)
  const fxRef = useRef(null)
  const wasLive = useRef(null)

  useEffect(() => { fetchNext() }, [personnelId])

  // Hockey-effekter i bannern (PixiJS) – slås av/på med knappen i headern
  const [fxOn, setFxOn] = useState(effectsEnabled())
  useEffect(() => {
    const h = (e) => setFxOn(e.detail)
    window.addEventListener(EFFECTS_EVENT, h)
    return () => window.removeEventListener(EFFECTS_EVENT, h)
  }, [])

  // Fyrverkeri när nedräkningen når 00:00:00
  useEffect(() => {
    const live = !!countdown?.live
    if (live && wasLive.current === false) fxRef.current?.celebrate()
    if (countdown) wasLive.current = live
  }, [countdown])

  useEffect(() => {
    if (!next) return
    const iv = setInterval(() => tickWith(next), 1000)
    tickWith(next)
    return () => clearInterval(iv)
  }, [next])

  const fetchNext = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('assignments')
      .select('*, matches(*)')
      .eq('personnel_id', personnelId)
      .eq('is_working', true)

    const upcoming = (data || [])
      .filter(a => a.matches?.date >= today)
      .sort((a,b) => new Date(a.matches.date) - new Date(b.matches.date))

    if (upcoming.length > 0) {
      const a = upcoming[0]
      const { data: wh } = await supabase
        .from('work_hours')
        .select('*')
        .eq('match_id', a.match_id)
        .eq('personnel_id', personnelId)
        .single()
      setNext({ match: a.matches, workHours: wh || null })
    } else {
      setNext(null)
    }
    setLoading(false)
  }

  const tickWith = (n) => {
    if (!n?.match) return
    const wt = n.workHours?.start_time || (n.match.time ? minutesToTime(timeToMinutes(n.match.time)-120) : '17:00')
    const timeStr = wt.length === 5 ? wt + ':00' : wt
    const dt = new Date(`${n.match.date}T${timeStr}`)
    const diff = dt - new Date()
    if (diff <= 0) { setCountdown({ live: true }); return }
    setCountdown({
      d: Math.floor(diff/86400000),
      h: Math.floor((diff%86400000)/3600000),
      m: Math.floor((diff%3600000)/60000),
      s: Math.floor((diff%60000)/1000),
    })
  }

  if (loading) return null
  if (!next) return (
    <div className="guard-card">
      <h2 className="guard-card-title">Kommande arbetspass</h2>
      <div className="guard-empty">
        <p>Inga kommande pass schemalagda</p>
      </div>
    </div>
  )

  const guardStart = (next.workHours?.start_time || (next.match.time ? minutesToTime(timeToMinutes(next.match.time)-120) : null))?.slice(0,5)

  return (
    <div className="guard-card">
      <h2 className="guard-card-title">Kommande arbetspass</h2>
      <div className={`next-match-banner${fxOn ? ' has-fx' : ''}`}>
        {fxOn && <HockeyBannerEffects ref={fxRef} intensity={0.7} respectReducedMotion={false} />}
        <div className="next-match-title">
          IF Troja-Ljungby – {next.match.opponent}
        </div>
        <Countdown cd={countdown} />
        <div className="next-match-meta">
          <span>{fmtDate(next.match.date)}</span>
          <span>·</span>
          <span>Match {next.match.time}</span>
          {guardStart && <><span>·</span><span>Vaktstart {guardStart}</span></>}
          <span>·</span>
          <span>{next.match.match_type === 'away' ? 'Bortamatch' : 'Hemmamatch'}</span>
        </div>
      </div>
    </div>
  )
}

// ─── MatchPersonnelModal ──────────────────────────────────────────────────────

function MatchPersonnelModal({ match, onClose, personnelId, isAdmin }) {
  const [personnel, setPersonnel] = useState([])
  const [securityId, setSecurityId] = useState(null)
  const [deputyId, setDeputyId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [attendance, setAttendance] = useState(null)
  const [attendanceInput, setAttendanceInput] = useState('')
  const [editingAttendance, setEditingAttendance] = useState(false)
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [policeContact, setPoliceContact] = useState(null)

  useEffect(() => { if (match) fetchPersonnel() }, [match])

  const fetchPersonnel = async () => {
    const [{ data: asgn }, { data: hours }, { data: matchData }] = await Promise.all([
      supabase.from('assignments').select('*, personnel(*)').eq('match_id', match.id).eq('is_working', true),
      supabase.from('work_hours').select('*').eq('match_id', match.id),
      supabase.from('matches').select('*').eq('id', match.id).single(),
    ])
    setSecurityId(matchData?.security_responsible_id || null)
    setDeputyId(matchData?.deputy_security_responsible_id || null)
    setAttendance(matchData?.attendance || null)
    setAttendanceInput(matchData?.attendance ? String(matchData.attendance) : '')
    setEditingAttendance(!matchData?.attendance)
    setPoliceContact(matchData?.police_contact || null)
    const list = (asgn || [])
      .filter(a => a.personnel)
      .map(a => ({
        id: a.personnel.id,
        personnelId: a.personnel_id,
        name: a.personnel.name,
        workHours: (hours || []).find(wh => wh.personnel_id === a.personnel_id) || null,
      }))
      .sort((a,b) => a.name.localeCompare(b.name, 'sv-SE'))
    setPersonnel(list)
    setLoading(false)
  }

  const saveAttendance = async () => {
    const val = parseInt(attendanceInput)
    if (isNaN(val) || val < 0) return
    setSavingAttendance(true)
    await supabase.from('matches').update({ attendance: val }).eq('id', match.id)
    setAttendance(val)
    setAttendanceInput(String(val))
    setEditingAttendance(false)
    setSavingAttendance(false)
  }

  function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }
  function avatarColor(name) {
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return `hsl(${Math.abs(hash) % 360}, 65%, 45%)`
  }

  const guardStart = match?.time ? minutesToTime(timeToMinutes(match.time) - 120) : null
  const setCount = personnel.filter(p => p.workHours).length

  if (!match) return null
  return createPortal(
    <div className="mob-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mob-modal-sheet">
        {/* Handle bar */}
        <div className="mob-modal-handle" />

        {/* Header */}
        <div className="mob-modal-header">
          <div>
            <div className="mob-modal-eyebrow">Vakter</div>
            <div className="mob-modal-title">IF Troja – {match.opponent}</div>
            <div className="mob-modal-subtitle">
              {fmtDate(match.date)}
              {match.time && ` · Match ${match.time}`}
              {guardStart && ` · Vaktstart ${guardStart}`}
            </div>
          </div>
          <button className="mob-modal-close" onClick={onClose}>×</button>
        </div>

        {/* Progress */}
        {!loading && personnel.length > 0 && (
          <div style={{ padding: '0 20px 12px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
              <span style={{ fontSize:'12px', fontWeight:'600', color:'#4a5568' }}>Tider registrerade</span>
              <span style={{ fontSize:'12px', fontWeight:'700', color: setCount === personnel.length ? '#059669' : '#d97706' }}>
                {setCount} / {personnel.length}
              </span>
            </div>
            <div style={{ height:'5px', background:'rgba(0,0,0,0.08)', borderRadius:'99px', overflow:'hidden' }}>
              <div style={{
                height:'100%',
                width:`${(setCount / personnel.length) * 100}%`,
                background: setCount === personnel.length ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,#f59e0b,#d97706)',
                borderRadius:'99px', transition:'width 0.4s ease'
              }} />
            </div>
          </div>
        )}

        {/* Publik */}
        <div style={{ margin:'0 20px 16px', padding:'12px 14px', background:'#f8fafc', borderRadius:'14px', border:'1px solid #e2e8f0' }}>
          <div style={{ fontSize:'11px', fontWeight:'700', color:'#4a5568', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px' }}>Publik</div>
          {!editingAttendance && attendance !== null ? (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'18px', fontWeight:'700', color:'#1a202c' }}>{attendance.toLocaleString('sv-SE')} åskådare</span>
              <button onClick={() => { setAttendanceInput(String(attendance)); setEditingAttendance(true) }} style={{ fontSize:'12px', color:'#ef4444', background:'none', border:'none', cursor:'pointer', fontWeight:'600' }}>Ändra</button>
            </div>
          ) : (
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              <input type="number" min="0" value={attendanceInput} onChange={e => setAttendanceInput(e.target.value)}
                placeholder="Ange publiksiffra..."
                style={{ flex:1, minWidth:0, width:0, padding:'8px 12px', border:'1px solid #e2e8f0', borderRadius:'10px', fontSize:'16px', outline:'none' }}
                onKeyDown={e => e.key === 'Enter' && saveAttendance()} />
              <button onClick={saveAttendance} disabled={savingAttendance || !attendanceInput}
                style={{ padding:'8px 16px', background:'#ef4444', color:'white', border:'none', borderRadius:'10px', fontWeight:'600', fontSize:'14px', cursor:'pointer', flexShrink:0, opacity:!attendanceInput?0.5:1 }}>
                {savingAttendance ? '...' : 'Spara'}
              </button>
            </div>
          )}
        </div>

        {/* Poliskontakt */}
        {policeContact && (
          <div style={{ margin:'0 20px 16px', padding:'12px 14px', background:'#eff6ff', borderRadius:'14px', border:'1px solid #bfdbfe' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:'#1d4ed8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>
              🚔 Polis på plats
            </div>
            <div style={{ fontSize:'15px', fontWeight:'600', color:'#1e3a8a' }}>{policeContact}</div>
          </div>
        )}

        {/* Personnel list */}
        <div style={{ padding:'0 20px 32px', overflowY:'auto', flex:1 }}>
          {loading ? (
            <div style={{ textAlign:'center', padding:'32px', color:'#718096' }}>Laddar...</div>
          ) : personnel.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px', color:'#718096', background:'rgba(0,0,0,0.04)', borderRadius:'16px' }}>Inga vakter tilldelade</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {personnel.map(p => {
                const isSecurity = p.personnelId === securityId
                const wh = p.workHours
                return (
                  <div key={p.id} style={{
                    display:'flex', alignItems:'center', gap:'12px',
                    padding:'12px 14px', borderRadius:'14px', background:'white',
                    border:`1.5px solid ${wh ? '#bbf7d0' : '#fde68a'}`,
                    boxShadow:'0 1px 3px rgba(0,0,0,0.06)'
                  }}>
                    <div style={{
                      width:'38px', height:'38px', borderRadius:'50%', flexShrink:0,
                      background: avatarColor(p.name), color:'white',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontWeight:'700', fontSize:'13px'
                    }}>
                      {getInitials(p.name)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                        <span style={{ fontWeight:'700', fontSize:'15px', color:'#1a202c' }}>{p.name}</span>
                        {isSecurity && (
                          <span style={{ fontSize:'10px', fontWeight:'700', background:'#1d4ed8', color:'white', padding:'2px 7px', borderRadius:'99px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Säk.ansvarig</span>
                        )}
                        {p.personnelId === deputyId && (
                          <span style={{ fontSize:'10px', fontWeight:'700', background:'#0284c7', color:'white', padding:'2px 7px', borderRadius:'99px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Ställföreträdande</span>
                        )}
                      </div>
                      {wh ? (
                        <div style={{ fontSize:'12px', color:'#059669', fontWeight:'600', marginTop:'1px' }}>
                          {fmtTime(wh.start_time)} – {fmtTime(wh.end_time)} · {calcHours(wh.start_time, wh.end_time)}h
                        </div>
                      ) : (
                        <div style={{ fontSize:'12px', color:'#d97706', fontWeight:'500', marginTop:'1px' }}>Tider ej registrerade</div>
                      )}
                    </div>
                    <div style={{ width:'8px', height:'8px', borderRadius:'50%', flexShrink:0, background: wh ? '#10b981' : '#f59e0b' }} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── TimeModal ────────────────────────────────────────────────────────────────

function TimeModal({ assignment, personnelId, onClose, onSave }) {
  const wh = assignment.workHours
  const matchTime = assignment.matches?.time
  const guardStart = matchTime ? minutesToTime(timeToMinutes(matchTime)-120) : '17:00'
  const guardEnd   = matchTime ? minutesToTime(timeToMinutes(matchTime)+150) : '21:30'

  const [start, setStart] = useState(wh?.start_time?.slice(0,5) || guardStart)
  const [end,   setEnd]   = useState(wh?.end_time?.slice(0,5)   || guardEnd)
  const [notes, setNotes] = useState(wh?.notes || '')
  const [saving, setSaving] = useState(false)
  const [attendance, setAttendance] = useState(null)
  const [attendanceInput, setAttendanceInput] = useState('')

  useEffect(() => {
    supabase.from('matches').select('attendance').eq('id', assignment.match_id).single()
      .then(({ data }) => {
        setAttendance(data?.attendance || null)
        setAttendanceInput(data?.attendance ? String(data.attendance) : '')
      })
  }, [assignment.match_id])

  const hours = calcHours(start, end)
  const isStandard = hours === 4.5

  const adjustTime = (which, delta) => {
    const current = which === 'start' ? start : end
    const newTime = minutesToTime(timeToMinutes(current) + delta)
    which === 'start' ? setStart(newTime) : setEnd(newTime)
  }

  const handleSave = async () => {
    if (!start || !end) return
    setSaving(true)
    try {
      const payload = { match_id: assignment.match_id, personnel_id: personnelId, start_time: start, end_time: end, work_date: assignment.matches.date, notes: notes.trim()||null }
      if (wh?.id) await supabase.from('work_hours').update(payload).eq('id', wh.id)
      else await supabase.from('work_hours').insert([payload])
      if (attendanceInput) {
        const val = parseInt(attendanceInput)
        if (!isNaN(val) && val >= 0) {
          await supabase.from('matches').update({ attendance: val }).eq('id', assignment.match_id)
        }
      }
      onSave()
    } catch { alert('Fel vid sparande') }
    finally { setSaving(false) }
  }

  const adjBtn = {
    width:'48px', height:'48px', border:'none', borderRadius:'14px',
    background:'linear-gradient(135deg,#e02020,#b91c1c)',
    fontSize:'22px', fontWeight:'700', cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'white', flexShrink:0, boxShadow:'0 3px 10px rgba(185,28,28,0.3)',
    touchAction:'manipulation'
  }

  return (
    <div className="mob-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mob-modal-sheet mob-modal-sheet--time">
        <div className="mob-modal-handle" />

        {/* Header */}
        <div className="mob-modal-header">
          <div style={{ display:'flex', alignItems:'center', gap:'12px', flex:1, minWidth:0 }}>
            <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <img src="/images/troja-logo.png" alt="" style={{ width:'28px', height:'28px', objectFit:'contain' }} />
            </div>
            <div style={{ minWidth:0 }}>
              <div className="mob-modal-eyebrow">{wh ? 'Ändra arbetstider' : 'Sätt arbetstider'}</div>
              <div className="mob-modal-title" style={{ fontSize:'16px' }}>{assignment.matches?.opponent}</div>
              <div className="mob-modal-subtitle">{fmtDate(assignment.matches?.date)}{matchTime && ` · Match ${matchTime} · Vaktstart ${guardStart}`}</div>
            </div>
          </div>
          <button className="mob-modal-close" onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:'14px', overflowY:'auto', flex:1 }}>

          {/* Starttid / Sluttid */}
          {[['start','Starttid',start,setStart],['end','Sluttid',end,setEnd]].map(([which,label,val,setter])=>(
            <div key={which}>
              <div style={{ fontSize:'10px', fontWeight:'800', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'8px' }}>{label}</div>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <button style={adjBtn} onClick={()=>adjustTime(which,-15)}>−</button>
                <TimeInput value={val} onChange={e=>setter(e.target.value)}
                  style={{ flex:1, minWidth:0, width:0, height:'52px', border:'2px solid #e5e7eb', borderRadius:'14px', fontSize:'22px', fontWeight:'800', textAlign:'center', outline:'none', color:'#111827', background:'white', fontVariantNumeric:'tabular-nums' }} />
                <button style={adjBtn} onClick={()=>adjustTime(which,15)}>+</button>
              </div>
            </div>
          ))}

          {/* Totalt */}
          <div style={{ textAlign:'center', padding:'4px 0' }}>
            <span style={{ fontSize:'15px', fontWeight:'700', color: isStandard ? '#059669' : '#d97706' }}>
              {hours}h totalt{!isStandard && ' · Avviker från standard'}
            </span>
          </div>

          {/* Publik */}
          <div>
            <div style={{ fontSize:'10px', fontWeight:'800', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'8px' }}>Publik (valfritt)</div>
            <input type="number" min="0" value={attendanceInput} onChange={e=>setAttendanceInput(e.target.value)}
              placeholder={attendance ? `Nuvarande: ${attendance.toLocaleString('sv-SE')}` : 'Antal åskådare...'}
              style={{ width:'100%', height:'48px', border:'2px solid #e5e7eb', borderRadius:'14px', fontSize:'16px', fontWeight:'600', padding:'0 14px', outline:'none', color:'#111827', background:'white', boxSizing:'border-box' }} />
          </div>

          {/* Anteckningar */}
          <div>
            <div style={{ fontSize:'10px', fontWeight:'800', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'8px' }}>Anteckningar (valfritt)</div>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="T.ex. övertid, paus..." rows={2}
              style={{ width:'100%', border:'2px solid #e5e7eb', borderRadius:'14px', fontSize:'14px', padding:'10px 14px', fontFamily:'inherit', resize:'none', outline:'none', color:'#111827', background:'white', boxSizing:'border-box' }} />
          </div>

          {/* Knappar */}
          <div style={{ display:'flex', gap:'10px', paddingBottom:'8px' }}>
            <button onClick={onClose} style={{ flex:1, height:'52px', background:'white', border:'2px solid #e5e7eb', borderRadius:'16px', fontSize:'15px', fontWeight:'600', cursor:'pointer', color:'#374151', touchAction:'manipulation' }}>Avbryt</button>
            <button onClick={handleSave} disabled={saving||!start||!end}
              style={{ flex:2, height:'52px', background:saving?'#d1d5db':'linear-gradient(135deg,#e02020,#b91c1c)', border:'none', borderRadius:'16px', fontSize:'15px', fontWeight:'700', cursor:saving?'not-allowed':'pointer', color:'white', boxShadow:'0 4px 16px rgba(185,28,28,0.35)', touchAction:'manipulation' }}>
              {saving ? 'Sparar...' : wh ? 'Uppdatera' : 'Spara tider'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ScheduleModal ───────────────────────────────────────────────────────────

function ScheduleModal({ assignments, onClose, personnelId, personnelName }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const upcoming = assignments
    .filter(a => {
      const d = new Date(a.matches?.date); d.setHours(0,0,0,0)
      return d >= today
    })
    .sort((a,b) => new Date(a.matches.date) - new Date(b.matches.date))

  const weekdays = ['Sön','Mån','Tis','Ons','Tor','Fre','Lör']

  return createPortal(
    <div className="mob-modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="mob-modal-sheet">
        <div className="mob-modal-handle" />
        <div className="mob-modal-header">
          <div>
            <div className="mob-modal-eyebrow">Kommande pass</div>
            <div className="mob-modal-title">{upcoming.length} schemalagda</div>
          </div>
          <button className="mob-modal-close" onClick={onClose}>×</button>
        </div>
        {upcoming.length > 0 && (
          <div style={{ padding:'12px 16px 0' }}>
            <button
              onClick={() => downloadIcs(
                upcoming.map(a => ({ match: a.matches, workHours: a.workHours, personnelId })),
                `troja-vaktschema-${(personnelName || 'mina-pass').toLowerCase().replace(/\s+/g, '-')}.ics`,
                'Troja vaktpass'
              )}
              style={{ width:'100%', padding:'12px', borderRadius:'12px', border:'1px solid #e5e7eb', background:'#f8fafc', color:'#111827', fontWeight:'700', fontSize:'14px', cursor:'pointer', touchAction:'manipulation' }}>
              📅 Lägg till i kalendern
            </button>
            <div style={{ fontSize:'11px', color:'#9ca3af', textAlign:'center', marginTop:'6px' }}>
              Laddar ner en kalenderfil med dina {upcoming.length} kommande pass. Öppna den för att lägga in passen.
            </div>
          </div>
        )}
        <div style={{ overflowY:'auto', flex:1, padding:'12px 16px 32px' }}>
          {upcoming.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px', color:'#9ca3af', fontSize:'14px' }}>Inga kommande pass</div>
          ) : upcoming.map(a => {
            const match = a.matches
            const d = new Date(match.date)
            const guardStart = match.time ? minutesToTime(timeToMinutes(match.time) - 120) : '–'
            const isToday = new Date(match.date).setHours(0,0,0,0) === today.getTime()
            return (
              <div key={a.id} style={{ display:'grid', gridTemplateColumns:'48px 1fr', gap:'10px', alignItems:'center', padding:'10px 8px', borderRadius:'12px', marginBottom:'4px', background: isToday ? '#fef2f2' : 'transparent' }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'11px', fontWeight:'700', color:'#9ca3af', textTransform:'uppercase' }}>{weekdays[d.getDay()]}</div>
                  <div style={{ fontSize:'20px', fontWeight:'800', color: isToday ? '#e02020' : '#111827', lineHeight:1 }}>{d.getDate()}</div>
                  <div style={{ fontSize:'10px', color:'#9ca3af' }}>{d.toLocaleDateString('sv-SE', { month:'short' })}</div>
                </div>
                <div style={{ borderLeft:'2px solid #f1f5f9', paddingLeft:'10px' }}>
                  <div style={{ fontWeight:'700', fontSize:'14px', color:'#111827' }}>{match.opponent}</div>
                  <div style={{ fontSize:'12px', color:'#9ca3af', marginTop:'1px' }}>Start {guardStart} · Match {match.time || '–'}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── MyHours ─────────────────────────────────────────────────────────────────

function MyHours({ personnelId, onEdit, refreshKey }) {
  const [allHours, setAllHours] = useState([])
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(null) // 'unpaid' | 'payout:<id>' | 'season:<s>'
  const [selectedMonths, setSelectedMonths] = useState([]) // flera månader kan väljas
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')

  useEffect(() => { fetchHours() }, [personnelId, refreshKey])

  const fetchHours = async () => {
    const todayStr = new Date().toISOString().split('T')[0]
    const [{ data }, { data: activeAssignments }, { data: pays }] = await Promise.all([
      supabase.from('work_hours').select('*, matches(id,date,opponent,time,match_type,season,attendance)').eq('personnel_id', personnelId).lt('work_date', todayStr).order('work_date', { ascending: true }),
      supabase.from('assignments').select('match_id').eq('personnel_id', personnelId).eq('is_working', true),
      supabase.from('payouts').select('*').order('period_end', { ascending: false }),
    ])
    const activeMatchIds = new Set((activeAssignments || []).map(a => a.match_id))
    const all = (data || []).filter(wh => activeMatchIds.has(wh.match_id))
    setAllHours(all)
    setPayouts(pays || [])
    setLoading(false)
  }

  // Vilken utbetalning ett pass hör till (null = ej utbetalt)
  const payoutFor = (date) => payouts.find(p => date <= p.period_end && (!p.period_start || date >= p.period_start)) || null
  const hoursOf = (wh) => parseFloat(wh.total_hours) || calcHours(wh.start_time, wh.end_time)
  const enriched = allHours.map(wh => ({ ...wh, payout: payoutFor(wh.work_date), h: hoursOf(wh) }))

  const seasons = [...new Set(enriched.map(wh => wh.matches?.season).filter(Boolean))].sort().reverse()
  const unpaidCount = enriched.filter(wh => !wh.payout).length
  const activeFilter = filter || (payouts.length && unpaidCount ? 'unpaid' : seasons[0] ? `season:${seasons[0]}` : 'all')

  const shown = enriched.filter(wh => {
    if (activeFilter === 'unpaid') return !wh.payout
    if (activeFilter.startsWith('payout:')) return wh.payout && String(wh.payout.id) === activeFilter.slice(7)
    if (activeFilter.startsWith('season:')) return wh.matches?.season === activeFilter.slice(7)
    if (activeFilter === 'custom') return (!periodFrom || wh.work_date >= periodFrom) && (!periodTo || wh.work_date <= periodTo)
    return true
  })

  // Månader för staplarna (C) och grupperingen (A)
  const monthKey = (d) => d.slice(0, 7)
  const monthName = (k, long = false) => new Date(k + '-15T12:00').toLocaleDateString('sv-SE', long ? { month: 'long', year: 'numeric' } : { month: 'short' }).replace('.', '')
  const months = Object.values(shown.reduce((acc, wh) => {
    const k = monthKey(wh.work_date)
    acc[k] ??= { key: k, items: [], hours: 0, paid: 0 }
    acc[k].items.push(wh); acc[k].hours += wh.h; if (wh.payout) acc[k].paid += wh.h
    return acc
  }, {})).sort((a, b) => a.key.localeCompare(b.key))
  const maxH = Math.max(1, ...months.map(m => m.hours))
  const validSel = selectedMonths.filter(k => months.some(m => m.key === k))
  const hasSel = validSel.length > 0
  const listMonths = [...months].reverse().filter(m => !hasSel || validSel.includes(m.key))
  const inView = listMonths.flatMap(m => m.items)
  const total = inView.reduce((s, wh) => s + wh.h, 0)
  const toggleMonth = (k) => setSelectedMonths(sel => sel.includes(k) ? sel.filter(x => x !== k) : [...sel, k])
  const selLabel = [...validSel].sort().map(k => monthName(k)).join(' + ')
  const passTxt = (n) => `${n} pass`

  // Utbetalningsmarkering i listan: visas ovanför det senaste passet som ingår i utbetalningen
  const payoutMarkerBefore = new Map()
  ;[...shown].sort((a, b) => b.work_date.localeCompare(a.work_date)).forEach(wh => {
    if (wh.payout && !payoutMarkerBefore.has(wh.payout.id)) payoutMarkerBefore.set(wh.payout.id, wh.id)
  })

  const chips = [
    ...(payouts.length ? [{ key: 'unpaid', label: `Ej utbetalt${unpaidCount ? ` (${unpaidCount})` : ''}` }] : []),
    ...payouts.slice(0, 3).map(p => ({ key: `payout:${p.id}`, label: `Lön ${fmtShortDate(p.paid_on)}` })),
    ...seasons.map(s => ({ key: `season:${s}`, label: `Säsong ${s}` })),
    { key: 'custom', label: 'Egen period' },
  ]

  const isoDay = (d) => d.toISOString().split('T')[0]
  const openCustom = () => {
    if (!periodFrom && !periodTo) {
      const last = payouts[0]?.period_end
      setPeriodFrom(last ? isoDay(new Date(new Date(last + 'T12:00').getTime() + 86400000)) : (enriched[0]?.work_date || ''))
      setPeriodTo(isoDay(new Date()))
    }
    setFilter('custom'); setSelectedMonths([])
  }
  const fmtLong = (d) => d ? new Date(d + 'T12:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '') : '…'

  return (
    <div className="guard-card">
      <h2 className="guard-card-title" style={{ margin:'0 0 10px' }}>Mina arbetstider</h2>
      <div className="mh-stats" aria-live="polite">
        <div className="mh-stat"><span className="mh-stat-val">{inView.length}</span><span className="mh-stat-lbl">pass</span></div>
        <div className="mh-stat"><span className="mh-stat-val">{fmtH(total)}</span><span className="mh-stat-lbl">timmar</span></div>
        <div className="mh-stat"><span className="mh-stat-val">{inView.length ? fmtH(total / inView.length) : '–'}</span><span className="mh-stat-lbl">h per pass</span></div>
      </div>
      <div className="mh-sub">
        <span>{hasSel ? <>Visar <strong>{selLabel}</strong></> : activeFilter === 'unpaid' ? 'Pass som inte är utbetalda än' : activeFilter.startsWith('season:') ? `Hela säsongen ${activeFilter.slice(7)}` : activeFilter.startsWith('payout:') ? 'Pass som ingick i lönen' : activeFilter === 'custom' ? <>Visar <strong>{fmtLong(periodFrom)} – {fmtLong(periodTo)}</strong></> : 'Alla pass'}</span>
        {hasSel && <button className="mh-clear" onClick={() => setSelectedMonths([])}>Visa alla månader</button>}
      </div>

      {chips.length > 1 && (
        <div className="mh-chips">
          {chips.map(c => (
            <button key={c.key} className={`mh-chip${activeFilter === c.key ? ' is-active' : ''}`} aria-pressed={activeFilter === c.key}
              onClick={() => c.key === 'custom' ? openCustom() : (setFilter(c.key), setSelectedMonths([]))}>
              {c.label}
            </button>
          ))}
        </div>
      )}

      {activeFilter === 'custom' && (
        <div className="mh-period">
          <label>Från<input type="date" value={periodFrom} max={periodTo || undefined} onChange={e => { setPeriodFrom(e.target.value); setSelectedMonths([]) }} /></label>
          <label>Till och med<input type="date" value={periodTo} min={periodFrom || undefined} onChange={e => { setPeriodTo(e.target.value); setSelectedMonths([]) }} /></label>
          {payouts.length > 0 && (
            <div className="mh-period-quick">
              {payouts.slice(0, 2).map(p => (
                <button key={p.id} onClick={() => { setPeriodFrom(isoDay(new Date(new Date(p.period_end + 'T12:00').getTime() + 86400000))); setPeriodTo(isoDay(new Date())) }}>
                  Efter {fmtLong(p.period_end)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="tl-empty">Hämtar arbetstider…</div>
      ) : shown.length === 0 ? (
        <div className="tl-empty">
          <strong>{activeFilter === 'unpaid' ? 'Allt är utbetalt' : 'Inga pass här'}</strong>
          {activeFilter === 'unpaid' ? 'Nya pass hamnar här tills nästa löneutbetalning.' : 'Genomförda pass visas här efter matchdagen.'}
        </div>
      ) : (
        <>
          {months.length > 1 && (
            <div className="mh-chart" role="group" aria-label="Timmar per månad">
              {months.map(m => {
                const sel = validSel.includes(m.key)
                const paidPct = m.hours ? (m.paid / m.hours) * 100 : 0
                return (
                  <button key={m.key} className={`mh-bar${sel ? ' is-selected' : ''}${hasSel && !sel ? ' is-dim' : ''}`}
                    onClick={() => toggleMonth(m.key)} aria-pressed={sel}
                    aria-label={`${monthName(m.key, true)}: ${passTxt(m.items.length)}, ${fmtH(m.hours)} timmar`}>
                    <span className="mh-bar-val">{fmtH(m.hours)}</span>
                    <span className="mh-bar-col" style={{ height: `${Math.max(6, (m.hours / maxH) * 64)}px` }}>
                      <span className="mh-bar-paid" style={{ height: `${paidPct}%` }} />
                    </span>
                    <span className="mh-bar-lbl">{monthName(m.key)}</span>
                    <span className="mh-bar-cnt">{m.items.length} st</span>
                  </button>
                )
              })}
            </div>
          )}
          {months.length > 1 && (
            <div className="mh-legend">
              {payouts.length > 0 && <><span className="mh-dot is-unpaid" />Ej utbetalt <span className="mh-dot is-paid" />Utbetalt</>}
              <span className="mh-legend-tip">{hasSel ? 'Tryck på fler månader för att lägga ihop' : 'Tryck på månader för att räkna ihop dem'}</span>
            </div>
          )}

          <div className="mh-list">
            {listMonths.map(m => (
              <div key={m.key}>
                <div className="mh-month">
                  <span>{monthName(m.key, true)}</span>
                  <span>{passTxt(m.items.length)}, {fmtH(m.hours)} h</span>
                </div>
                {[...m.items].reverse().map(wh => (
                  <div key={wh.id}>
                    {wh.payout && payoutMarkerBefore.get(wh.payout.id) === wh.id && (
                      <div className="mh-payout">
                        Lön utbetald {fmtShortDate(wh.payout.paid_on)}, pass t.o.m. {fmtShortDate(wh.payout.period_end)}
                      </div>
                    )}
                    <button className={`mh-row${wh.payout ? ' is-paid' : ''}`}
                      onClick={() => !wh.payout && onEdit?.({ id: `wh-${wh.id}`, match_id: wh.match_id, matches: wh.matches, workHours: wh })}
                      disabled={!!wh.payout}
                      title={wh.payout ? 'Passet är utbetalt och kan inte ändras' : 'Ändra tider'}>
                      <span className="mh-date">{new Date(wh.work_date + 'T12:00').getDate()}/{new Date(wh.work_date + 'T12:00').getMonth() + 1}</span>
                      <span className="mh-body">
                        <span className="mh-opp">{wh.matches?.opponent || 'Uppdrag'}</span>
                        <span className="mh-time">{fmtTime(wh.start_time)}–{fmtTime(wh.end_time)}{wh.matches?.attendance ? `, ${wh.matches.attendance.toLocaleString('sv-SE')} åskådare` : ''}</span>
                      </span>
                      <span className="mh-h">{fmtH(wh.h)} h</span>
                      <span className="mh-go" aria-hidden="true">{wh.payout ? '✓' : '›'}</span>
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {unpaidCount > 0 && <div className="mh-hint">Tryck på ett pass för att ändra tiderna. Utbetalda pass är låsta.</div>}
        </>
      )}
    </div>
  )
}

// ─── AssignedMatches ──────────────────────────────────────────────────────────

function AssignedMatches({ assignments, onEditTimes, personnelId, isAdmin }) {
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [showAll, setShowAll] = useState(false)

  const today = new Date(); today.setHours(0,0,0,0)

  const filtered = assignments
    .filter(a => {
      if (!a.matches?.date) return false
      const d = new Date(a.matches.date); d.setHours(0,0,0,0)
      return d >= today
    })
    .sort((a,b) => new Date(a.matches.date)-new Date(b.matches.date))

  const shown = showAll ? filtered : filtered.slice(0,3)

  return (
    <div className="guard-card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', gap:'12px' }}>
        <h2 className="guard-card-title" style={{ margin:0 }}>Kommande matcher</h2>
        {filtered.length > 3 && (
          <button onClick={()=>setShowAll(v=>!v)} className="tl-toggle">
            {showAll ? 'Visa färre' : `Visa alla ${filtered.length}`}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="tl-empty">
          <strong>Inga kommande matcher</strong>
          När du schemaläggs på en match dyker den upp här.
        </div>
      ) : (
        <ol className="tl">
          {shown.map((a, idx) => {
            const match = a.matches
            const wh = a.workHours
            const d0 = new Date(match.date); d0.setHours(0,0,0,0)
            const days = Math.round((d0 - today) / 86400000)
            const isToday = days === 0
            const isNext = idx === 0
            const guardStart = match.time ? minutesToTime(timeToMinutes(match.time)-120) : null
            const dateLabel = d0.toLocaleDateString('sv-SE', { weekday:'short', day:'numeric', month:'short' }).replace(/\./g, '')
            const rel = isToday ? 'Idag' : days === 1 ? 'Imorgon' : days < 7 ? `om ${days} dagar` : days < 14 ? 'om 1 vecka' : `om ${Math.floor(days / 7)} veckor`

            return (
              <li key={a.id} className={`tl-item${isToday ? ' is-today' : ''}${isNext ? ' is-next' : ''}`}>
                <span className="tl-dot" aria-hidden="true" />
                <div className="tl-date">
                  {isToday ? `Idag, ${dateLabel}` : `${dateLabel}, ${rel}`}
                </div>
                <div className="tl-row">
                  <button className="tl-title" onClick={() => setSelectedMatch(match)} title="Visa vilka som jobbar">
                    {match.opponent}
                    {match.match_type === 'away' && <span className="tl-away">Borta</span>}
                  </button>
                  <button className={`tl-edit${wh ? '' : ' is-needed'}`} onClick={() => onEditTimes(a)}>
                    {wh ? 'Ändra' : 'Sätt tider'}
                  </button>
                </div>
                <div className="tl-chips">
                  {wh ? (
                    <span className="tl-chip is-ok">Vakt {fmtTime(wh.start_time)}–{fmtTime(wh.end_time)}</span>
                  ) : (
                    <span className="tl-chip is-warn">Tider saknas{guardStart ? `, start ca ${guardStart}` : ''}</span>
                  )}
                  {match.time && <span className="tl-chip">Match {match.time}</span>}
                  {match.attendance && <span className="tl-chip">{match.attendance.toLocaleString('sv-SE')} åskådare</span>}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {selectedMatch && <MatchPersonnelModal match={selectedMatch} onClose={()=>setSelectedMatch(null)} personnelId={personnelId} isAdmin={isAdmin} />}
    </div>
  )
}

// ─── GuardApp (main) ──────────────────────────────────────────────────────────

export default function GuardApp({ personnelId, personnelName, onSignOut, isAdmin = false, embedded = false }) {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingAssignment, setEditingAssignment] = useState(null)
  const [hoursRefresh, setHoursRefresh] = useState(0)
  const [showSchedule, setShowSchedule] = useState(false)
  const [fxOn, setFxOn] = useState(effectsEnabled())
  const toggleFx = () => {
    const on = !fxOn
    setFxOn(on)
    setEffectsEnabled(on)
    if (on) iceBurst(window.innerWidth / 2, 120, { pucks: 1 })
  }

  useEffect(() => { if (personnelId) fetchAssignments() }, [personnelId])

  const fetchAssignments = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('assignments')
      .select('*, matches(id,date,time,opponent,match_type,season,required_guards,attendance)')
      .eq('personnel_id', personnelId)
      .eq('is_working', true)

    const withHours = await Promise.all((data||[]).map(async a => {
      const { data: wh } = await supabase.from('work_hours').select('*').eq('match_id', a.match_id).eq('personnel_id', personnelId).single()
      return { ...a, workHours: wh||null }
    }))

    setAssignments(withHours)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#ef4444 0%,#dc2626 100%)' }}>
      <div style={{ textAlign:'center', background:'rgba(255,255,255,0.1)', padding:'40px', borderRadius:'24px', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.2)' }}>
        <div style={{ width:'48px', height:'48px', border:'4px solid rgba(255,255,255,0.3)', borderTop:'4px solid white', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 16px' }} />
        <div style={{ color:'white', fontWeight:'700', fontSize:'18px' }}>Laddar...</div>
      </div>
    </div>
  )

  return (
    <div className="guard-app">
      {/* Header */}
      <div className="guard-header">
        <div className="guard-header-left">
          <img src="/images/troja-logo.png" alt="Troja" className="guard-header-logo" />
          <div>
            <h1 className="guard-header-title">Välkommen {personnelName}!</h1>
            <p className="guard-header-sub">Översikt för kommande uppdrag</p>
          </div>
        </div>
        {onSignOut && (
          <div className="guard-header-actions">
            <button onClick={() => setShowSchedule(true)} className="guard-schedule-btn">
              <span style={{ fontSize:'18px' }}>📋</span>
              <span>Mitt schema</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => window.location.href = '/'}
                className="guard-schedule-btn"
                title="Till adminvyn"
              >
                <span style={{ fontSize:'18px' }}>⚙️</span>
                <span>Admin</span>
              </button>
            )}
            <button onClick={toggleFx} className="guard-schedule-btn" title={fxOn ? 'Stäng av iseffekter' : 'Slå på iseffekter'} aria-pressed={fxOn}
              style={fxOn ? undefined : { opacity: 0.6 }}>
              <span style={{ fontSize:'18px' }}>{fxOn ? '❄️' : '🚫'}</span>
              <span>Effekter</span>
            </button>
            <button className="logout-btn" onClick={onSignOut}>Logga ut</button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="guard-content">
        <NextMatch personnelId={personnelId} />
        <AssignedMatches assignments={assignments} onEditTimes={setEditingAssignment} personnelId={personnelId} isAdmin={isAdmin} />
        <MyHours personnelId={personnelId} onEdit={setEditingAssignment} refreshKey={hoursRefresh} />
      </div>

      {showSchedule && <ScheduleModal assignments={assignments} personnelId={personnelId} personnelName={personnelName} onClose={() => setShowSchedule(false)} />}
      {editingAssignment && (
        <TimeModal
          assignment={editingAssignment}
          personnelId={personnelId}
          onClose={()=>setEditingAssignment(null)}
          onSave={()=>{ setEditingAssignment(null); fetchAssignments(); setHoursRefresh(n => n + 1); iceBurst(window.innerWidth / 2, window.innerHeight * 0.65) }}
        />
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}