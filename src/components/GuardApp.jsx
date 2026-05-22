import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import '../guard.css'

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

// ─── NextMatch ────────────────────────────────────────────────────────────────

function NextMatch({ personnelId }) {
  const [next, setNext] = useState(null)
  const [countdown, setCountdown] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchNext() }, [personnelId])

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
    if (diff <= 0) { setCountdown('Pågår nu!'); return }
    const d = Math.floor(diff/86400000)
    const h = Math.floor((diff%86400000)/3600000)
    const m = Math.floor((diff%3600000)/60000)
    const s = Math.floor((diff%60000)/1000)
    if (d > 0) setCountdown(`${d}d ${h}h ${m}m`)
    else if (h > 0) setCountdown(`${h}h ${m}m ${s}s`)
    else setCountdown(`${m}m ${s}s`)
  }

  if (loading) return null
  if (!next) return (
    <div style={{ background:'rgba(255,255,255,0.95)', backdropFilter:'blur(20px)', padding:'24px', borderRadius:'24px', boxShadow:'var(--glass-shadow)', border:'1px solid var(--glass-border)', textAlign:'center', color:'#718096' }}>
      <h2 style={{ margin:'0 0 8px', fontSize:'18px', fontWeight:'700', color:'#1f2937' }}>Kommande arbetspass</h2>
      <p style={{ margin:0 }}>Inga kommande pass schemalagda</p>
    </div>
  )

  const guardStart = (next.workHours?.start_time || (next.match.time ? minutesToTime(timeToMinutes(next.match.time)-120) : null))?.slice(0,5)
  const guardEnd = next.workHours?.end_time || (next.match.time ? minutesToTime(timeToMinutes(next.match.time)+150) : null)

  return (
    <div style={{ background:'rgba(255,255,255,0.95)', backdropFilter:'blur(20px)', padding:'24px', borderRadius:'24px', boxShadow:'var(--glass-shadow)', border:'1px solid var(--glass-border)' }}>
      <h2 style={{ margin:'0 0 16px', fontSize:'18px', fontWeight:'700', color:'#1f2937' }}>Kommande arbetspass</h2>
      <div style={{ background:'linear-gradient(135deg,#ef4444 0%,#dc2626 100%)', color:'white', borderRadius:'16px', padding:'24px', textAlign:'center' }}>
        <div style={{ fontSize:'20px', fontWeight:'700', marginBottom:'12px' }}>
          IF Troja-Ljungby – {next.match.opponent}
        </div>
        <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'12px', padding:'16px', marginBottom:'16px' }}>
          <div style={{ fontSize:'28px', fontWeight:'700', fontFamily:'monospace', marginBottom:'4px' }}>{countdown}</div>
          <div style={{ fontSize:'12px', opacity:0.9 }}>kvar till {next.workHours ? 'arbetsstart' : 'matchstart'}</div>
        </div>
        <div style={{ display:'flex', justifyContent:'center', gap:'16px', flexWrap:'wrap', fontSize:'14px', opacity:0.9 }}>
          <span>{fmtDate(next.match.date)}</span>
          <span>Matchstart: {next.match.time}</span>
          {guardStart && <span>Vaktstart: {guardStart}</span>}
          <span>{next.match.match_type === 'away' ? 'Bortamatch' : 'Hemmamatch'}</span>
        </div>
      </div>
    </div>
  )
}

// ─── MatchPersonnelModal ──────────────────────────────────────────────────────

function MatchPersonnelModal({ match, onClose }) {
  const [personnel, setPersonnel] = useState([])
  const [securityId, setSecurityId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (match) fetchPersonnel() }, [match])

  const fetchPersonnel = async () => {
    const [{ data: asgn }, { data: hours }, { data: matchData }] = await Promise.all([
      supabase.from('assignments').select('*, personnel(*)').eq('match_id', match.id).eq('is_working', true),
      supabase.from('work_hours').select('*').eq('match_id', match.id),
      supabase.from('matches').select('security_responsible_id').eq('id', match.id).single(),
    ])
    setSecurityId(matchData?.security_responsible_id || null)
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

  const guardStart = match?.time ? minutesToTime(timeToMinutes(match.time) - 120) : null
  const setCount = personnel.filter(p => p.workHours).length
  const [attendance, setAttendance] = useState(null)
  const [attendanceInput, setAttendanceInput] = useState('')
  const [savingAttendance, setSavingAttendance] = useState(false)

  useEffect(() => {
    if (match?.id) {
      supabase.from('matches').select('attendance').eq('id', match.id).single()
        .then(({ data }) => {
          setAttendance(data?.attendance || null)
          setAttendanceInput(data?.attendance ? String(data.attendance) : '')
        })
    }
  }, [match?.id])

  const saveAttendance = async () => {
    const val = parseInt(attendanceInput)
    if (isNaN(val) || val < 0) return
    setSavingAttendance(true)
    await supabase.from('matches').update({ attendance: val }).eq('id', match.id)
    setAttendance(val)
    setAttendanceInput('')
    setSavingAttendance(false)
  }

  function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }
  function avatarColor(name) {
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    const hue = Math.abs(hash) % 360
    return `hsl(${hue}, 65%, 45%)`
  }

  if (!match) return null
  return createPortal(
    <div className="time-registration-modal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="time-registration-content" style={{ maxWidth: '480px' }}>
        <button className="close-button" onClick={onClose}>×</button>
        <div className="time-registration-inner">

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ef4444', marginBottom: '6px' }}>Vakter</div>
            <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '800', color: '#1a202c', lineHeight: 1.2 }}>
              IF Troja-Ljungby – {match.opponent}
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#718096' }}>
              {fmtDate(match.date)}
              {match.time && ` · Match ${match.time}`}
              {guardStart && ` · Vaktstart ${guardStart}`}
            </p>
          </div>

          {!loading && personnel.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#4a5568' }}>Arbetstider registrerade</span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: setCount === personnel.length ? '#059669' : '#d97706' }}>
                  {setCount} / {personnel.length}
                </span>
              </div>
              <div style={{ height: '5px', background: 'rgba(0,0,0,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(setCount / personnel.length) * 100}%`,
                  background: setCount === personnel.length ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,#f59e0b,#d97706)',
                  borderRadius: '99px',
                  transition: 'width 0.4s ease'
                }} />
              </div>
            </div>
          )}

          {/* Publiksiffra */}
          <div style={{ marginBottom: '16px', padding: '12px 14px', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Publik</div>
            {attendance !== null && attendanceInput === '' ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '18px', fontWeight: '700', color: '#1a202c' }}>{attendance.toLocaleString('sv-SE')} åskådare</span>
                <button onClick={() => setAttendanceInput(String(attendance))} style={{ fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Ändra</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  min="0"
                  value={attendanceInput}
                  onChange={e => setAttendanceInput(e.target.value)}
                  placeholder="Ange publiksiffra..."
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '15px', outline: 'none' }}
                  onKeyDown={e => e.key === 'Enter' && saveAttendance()}
                />
                <button
                  onClick={saveAttendance}
                  disabled={savingAttendance || !attendanceInput}
                  style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', flexShrink: 0, opacity: !attendanceInput ? 0.5 : 1 }}
                >
                  {savingAttendance ? '...' : 'Spara'}
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#718096' }}>Laddar...</div>
          ) : personnel.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#718096', background: 'rgba(0,0,0,0.04)', borderRadius: '16px' }}>
              Inga vakter tilldelade
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {personnel.map(p => {
                const isSecurity = p.personnelId === securityId
                const wh = p.workHours
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 14px', borderRadius: '14px',
                    background: 'white',
                    border: `1.5px solid ${wh ? '#bbf7d0' : '#fde68a'}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                  }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '50%',
                      background: avatarColor(p.name), color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: '700', fontSize: '13px', flexShrink: 0
                    }}>
                      {getInitials(p.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: '700', fontSize: '15px', color: '#1a202c' }}>{p.name}</span>
                        {isSecurity && (
                          <span style={{
                            fontSize: '10px', fontWeight: '700', letterSpacing: '0.05em',
                            background: '#1d4ed8', color: 'white',
                            padding: '2px 7px', borderRadius: '99px', textTransform: 'uppercase'
                          }}>
                            Säk.ansvarig
                          </span>
                        )}
                      </div>
                      {wh ? (
                        <div style={{ fontSize: '12px', color: '#059669', fontWeight: '600', marginTop: '1px' }}>
                          {fmtTime(wh.start_time)} – {fmtTime(wh.end_time)} · {calcHours(wh.start_time, wh.end_time)}h
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#d97706', fontWeight: '500', marginTop: '1px' }}>Tider ej registrerade</div>
                      )}
                    </div>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                      background: wh ? '#10b981' : '#f59e0b'
                    }} />
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
      // Spara publik om ifyllt
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

  const adjBtn = { width:'44px', height:'44px', border:'none', borderRadius:'14px', background:'linear-gradient(135deg,#e02020,#b91c1c)', fontSize:'22px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'white', flexShrink:0, boxShadow:'0 3px 10px rgba(185,28,28,0.3)' }

  return (
    <div className="time-registration-modal" onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:'420px', background:'white', borderRadius:'28px', overflow:'hidden', boxShadow:'0 24px 60px rgba(0,0,0,0.25)', margin:'auto' }}>

        {/* Header */}
        <div style={{ background:'white', padding:'22px 22px 16px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'flex-start', gap:'14px', position:'relative' }}>
          <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <img src="/images/troja-logo.png" alt="" style={{ width:'32px', height:'32px', objectFit:'contain' }} />
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:'10px', fontWeight:'800', letterSpacing:'0.12em', textTransform:'uppercase', color:'#e02020', marginBottom:'2px' }}>{wh ? 'Ändra arbetstider' : 'Sätt arbetstider'}</div>
            <div style={{ fontSize:'17px', fontWeight:'800', color:'#111827', lineHeight:1.2 }}>{assignment.matches?.opponent}</div>
            <div style={{ fontSize:'12px', color:'#9ca3af', marginTop:'3px' }}>
              {fmtDate(assignment.matches?.date)}{matchTime && ` · Match ${matchTime} · Vaktstart ${guardStart}`}
            </div>
          </div>
          <button onClick={onClose} style={{ position:'absolute', top:'14px', right:'14px', width:'28px', height:'28px', borderRadius:'50%', background:'#f1f5f9', border:'none', fontSize:'16px', cursor:'pointer', color:'#6b7280', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px', background:'#f9fafb' }}>

          {/* Starttid + Sluttid */}
          {[['start','Starttid',start,setStart],['end','Sluttid',end,setEnd]].map(([which,label,val,setter])=>(
            <div key={which}>
              <div style={{ fontSize:'10px', fontWeight:'800', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'6px' }}>{label}</div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <button style={adjBtn} onClick={()=>adjustTime(which,-15)}>−</button>
                <input type="time" value={val} onChange={e=>setter(e.target.value)}
                  style={{ flex:1, height:'48px', border:'2px solid #e5e7eb', borderRadius:'14px', fontSize:'24px', fontWeight:'800', textAlign:'center', outline:'none', color:'#111827', background:'white', fontVariantNumeric:'tabular-nums' }} />
                <button style={adjBtn} onClick={()=>adjustTime(which,15)}>+</button>
              </div>
            </div>
          ))}

          {/* Totalt — kompakt */}
          <div style={{ textAlign:'center', padding:'8px 0 0' }}>
            <span style={{ fontSize:'15px', fontWeight:'700', color: isStandard ? '#059669' : '#d97706' }}>
              {hours}h totalt{!isStandard && ' · Avviker från standard'}
            </span>
          </div>

          {/* Publik */}
          <div>
            <div style={{ fontSize:'10px', fontWeight:'800', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'6px' }}>Publik (valfritt)</div>
            <input type="number" min="0" value={attendanceInput} onChange={e=>setAttendanceInput(e.target.value)}
              placeholder={attendance ? `Nuvarande: ${attendance.toLocaleString('sv-SE')}` : 'Antal åskådare...'}
              style={{ width:'100%', height:'44px', border:'2px solid #e5e7eb', borderRadius:'14px', fontSize:'16px', fontWeight:'600', padding:'0 14px', outline:'none', color:'#111827', background:'white', boxSizing:'border-box' }} />
          </div>

          {/* Anteckningar */}
          <div>
            <div style={{ fontSize:'10px', fontWeight:'800', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'6px' }}>Anteckningar (valfritt)</div>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="T.ex. övertid, paus..." rows={2}
              style={{ width:'100%', border:'2px solid #e5e7eb', borderRadius:'14px', fontSize:'14px', padding:'10px 14px', fontFamily:'inherit', resize:'none', outline:'none', color:'#111827', background:'white', boxSizing:'border-box' }} />
          </div>

          {/* Knappar */}
          <div style={{ display:'flex', gap:'10px', paddingTop:'2px' }}>
            <button onClick={onClose} style={{ flex:1, height:'50px', background:'white', border:'2px solid #e5e7eb', borderRadius:'16px', fontSize:'15px', fontWeight:'600', cursor:'pointer', color:'#374151' }}>Avbryt</button>
            <button onClick={handleSave} disabled={saving||!start||!end} style={{ flex:2, height:'50px', background:saving?'#d1d5db':'linear-gradient(135deg,#e02020,#b91c1c)', border:'none', borderRadius:'16px', fontSize:'15px', fontWeight:'700', cursor:saving?'not-allowed':'pointer', color:'white', boxShadow:'0 4px 16px rgba(185,28,28,0.35)' }}>
              {saving ? 'Sparar...' : wh ? 'Uppdatera' : 'Spara tider'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ScheduleModal ───────────────────────────────────────────────────────────

function ScheduleModal({ assignments, onClose }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const upcoming = assignments
    .filter(a => {
      const d = new Date(a.matches?.date); d.setHours(0,0,0,0)
      return d >= today
    })
    .sort((a,b) => new Date(a.matches.date) - new Date(b.matches.date))

  const weekdays = ['Sön','Mån','Tis','Ons','Tor','Fre','Lör']

  return createPortal(
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', zIndex:99999, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:'24px', width:'100%', maxWidth:'360px', overflow:'hidden', boxShadow:'0 20px 50px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:'10px', fontWeight:'800', letterSpacing:'0.1em', textTransform:'uppercase', color:'#e02020', marginBottom:'2px' }}>Kommande pass</div>
            <div style={{ fontSize:'18px', fontWeight:'800', color:'#111827' }}>{upcoming.length} schemalagda</div>
          </div>
          <button onClick={onClose} style={{ width:'30px', height:'30px', borderRadius:'50%', background:'#f1f5f9', border:'none', cursor:'pointer', fontSize:'16px', color:'#6b7280', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>
        {/* Lista */}
        <div style={{ maxHeight:'60vh', overflow:'auto', padding:'12px' }}>
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

function MyHours({ personnelId }) {
  const [allHours, setAllHours] = useState([])
  const [delegatesMap, setDelegatesMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [seasonFilter, setSeasonFilter] = useState(null)
  const [availableSeasons, setAvailableSeasons] = useState([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => { fetchHours() }, [personnelId])

  const fetchHours = async () => {
    const [{ data }, { data: activeAssignments }] = await Promise.all([
      supabase.from('work_hours').select('*, matches(date,opponent,time,match_type,season,attendance)').eq('personnel_id', personnelId).lt('work_date', new Date().toISOString().split('T')[0]).order('work_date', { ascending: true }),
      supabase.from('assignments').select('match_id').eq('personnel_id', personnelId).eq('is_working', true),
    ])
    const activeMatchIds = new Set((activeAssignments || []).map(a => a.match_id))
    const all = (data || []).filter(wh => activeMatchIds.has(wh.match_id))

    // Hämta delegater för dessa matcher
    const matchIds = all.map(wh => wh.match_id)
    if (matchIds.length > 0) {
      const { data: dels } = await supabase.from('delegates').select('match_id, name').in('match_id', matchIds)
      const map = {}
      ;(dels || []).forEach(d => { if (!map[d.match_id]) map[d.match_id] = []; map[d.match_id].push(d.name) })
      setDelegatesMap(map)
    }
    const seasons = [...new Set(all.map(wh => wh.matches?.season).filter(Boolean))].sort().reverse()
    setAvailableSeasons(seasons)
    setSeasonFilter(seasons[0] || null)
    setAllHours(all)
    setLoading(false)
  }

  const hours = allHours
    .filter(wh => !seasonFilter || wh.matches?.season === seasonFilter)
    .filter(wh => !fromDate || wh.work_date >= fromDate)
    .filter(wh => !toDate || wh.work_date <= toDate)
  const totalHours = hours.reduce((s,wh) => s + (parseFloat(wh.total_hours)||calcHours(wh.start_time,wh.end_time)), 0)
  const shown = showAll ? hours : hours.slice(0,5)

  return (
    <div style={{ background:'rgba(255,255,255,0.95)', backdropFilter:'blur(20px)', padding:'24px', borderRadius:'24px', boxShadow:'var(--glass-shadow)', border:'1px solid var(--glass-border)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <h2 style={{ margin:0, fontSize:'18px', fontWeight:'700', color:'#1f2937' }}>Mina Arbetstider</h2>
        <div style={{ background:'linear-gradient(135deg,#10b981 0%,#059669 100%)', color:'white', padding:'8px 16px', borderRadius:'12px', fontSize:'14px', fontWeight:'600', display:'flex', gap:'8px' }}>
          <span>{hours.length} pass</span><span>•</span><span>{totalHours.toFixed(1)}h</span>
        </div>
      </div>
      {availableSeasons.length >= 1 && (
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'12px' }}>
          {availableSeasons.map(s => (
            <button key={s} onClick={() => { setSeasonFilter(s); setShowAll(false); setFromDate(''); setToDate('') }} style={{ padding:'6px 14px', borderRadius:'99px', fontSize:'13px', fontWeight:'600', border:'none', cursor:'pointer', background: seasonFilter===s ? 'linear-gradient(135deg,#10b981,#059669)' : 'white', color: seasonFilter===s ? 'white' : '#4a5568', boxShadow: seasonFilter===s ? '0 2px 8px rgba(16,185,129,0.4)' : 'var(--shadow-sm)', minHeight:'36px' }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Periodfilter */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px', alignItems:'center' }}>
        <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setSeasonFilter(null); setShowAll(false) }}
          style={{ flex:1, padding:'7px 10px', border:'1.5px solid #e5e7eb', borderRadius:'10px', fontSize:'13px', color:'#374151', outline:'none' }} />
        <span style={{ color:'#9ca3af', fontSize:'13px' }}>–</span>
        <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setSeasonFilter(null); setShowAll(false) }}
          style={{ flex:1, padding:'7px 10px', border:'1.5px solid #e5e7eb', borderRadius:'10px', fontSize:'13px', color:'#374151', outline:'none' }} />
        {(fromDate || toDate) && (
          <button onClick={() => { setFromDate(''); setToDate(''); setSeasonFilter(availableSeasons[0]||null) }} style={{ padding:'7px 10px', border:'none', borderRadius:'10px', background:'#fee2e2', color:'#b91c1c', fontSize:'12px', fontWeight:'600', cursor:'pointer', whiteSpace:'nowrap' }}>
            Rensa
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'32px', color:'#6b7280' }}>Laddar...</div>
      ) : hours.length === 0 ? (
        <div style={{ textAlign:'center', padding:'32px', color:'#6b7280', background:'#f8fafc', borderRadius:'12px', border:'2px dashed #cbd5e0' }}>
          <div style={{ fontWeight:'600', color:'#374151', marginBottom:'8px' }}>Inga arbetstider än</div>
          <div style={{ fontSize:'14px' }}>Genomförda pass visas här.</div>
        </div>
      ) : (
        <>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {shown.map(wh => (
              <div key={wh.id} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'14px', display:'grid', gridTemplateColumns:'auto 1fr auto', gap:'12px', alignItems:'center' }}>
                <div style={{ background:'#ef4444', color:'white', padding:'4px 8px', borderRadius:'8px', fontSize:'12px', fontWeight:'600', minWidth:'50px', textAlign:'center' }}>
                  {fmtDate(wh.work_date, true)}
                </div>
                <div>
                  <div style={{ fontWeight:'600', color:'#1f2937', fontSize:'14px' }}>{wh.matches?.opponent||'Uppdrag'}</div>
                  <div style={{ fontSize:'12px', color:'#718096', display:'flex', gap:'8px', flexWrap:'wrap', marginTop:'1px' }}>
                    <span>{fmtTime(wh.start_time)} – {fmtTime(wh.end_time)}</span>
                    {wh.matches?.attendance && <span style={{ color:'#9ca3af' }}>· 👥 {wh.matches.attendance.toLocaleString('sv-SE')}</span>}
                    {delegatesMap[wh.match_id]?.length > 0 && (
                      <span style={{ color:'#7c3aed', fontWeight:'600' }}>· 🎖 Delegat</span>
                    )}
                  </div>
                </div>
                <div style={{ background:'#10b981', color:'white', padding:'4px 10px', borderRadius:'12px', fontSize:'12px', fontWeight:'700' }}>
                  {(parseFloat(wh.total_hours)||calcHours(wh.start_time,wh.end_time)).toFixed(1)}h
                </div>
              </div>
            ))}
          </div>
          {hours.length > 3 && (
            <div style={{ textAlign:'center', marginTop:'16px' }}>
              <button onClick={()=>setShowAll(v=>!v)} style={{ background:'transparent', border:'2px solid #10b981', color:'#10b981', borderRadius:'12px', padding:'8px 24px', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>
                {showAll ? `Visa färre` : `Visa alla (${hours.length-3} till)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── AssignedMatches ──────────────────────────────────────────────────────────

function AssignedMatches({ assignments, onEditTimes }) {
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
    <div style={{ background:'rgba(255,255,255,0.95)', backdropFilter:'blur(20px)', padding:'24px', borderRadius:'24px', boxShadow:'var(--glass-shadow)', border:'1px solid var(--glass-border)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <h2 style={{ margin:0, fontSize:'18px', fontWeight:'700', color:'#1f2937' }}>Kommande Matcher</h2>
        {filtered.length > 3 && (
          <div onClick={()=>setShowAll(v=>!v)} style={{ background:'linear-gradient(135deg,#ef4444 0%,#dc2626 100%)', color:'white', padding:'8px 16px', borderRadius:'12px', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>
            {showAll ? 'Visa färre' : `${filtered.length} matcher`}
          </div>
        )}
      </div>



      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px', color:'#6b7280', background:'#f8fafc', borderRadius:'16px', border:'2px dashed #cbd5e0' }}>
          <div style={{ fontWeight:'600', color:'#374151', marginBottom:'8px' }}>Inga kommande matcher</div>
          <p style={{ margin:0, fontSize:'14px' }}>Du har inga tilldelade matcher framöver.</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {shown.map(a => {
            const match = a.matches
            const wh = a.workHours
            const d = new Date(match.date); d.setHours(0,0,0,0)
            const isPast = d < today
            const guardStart = match.time ? minutesToTime(timeToMinutes(match.time)-120) : null

            return (
              <div key={a.id} style={{ border:'1px solid #e5e7eb', borderRadius:'16px', padding:'20px', background:'white', opacity:isPast?0.75:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px' }}>
                  <div style={{ flex:1 }}>
                    <h3 onClick={()=>setSelectedMatch(match)} style={{ margin:'0 0 4px', fontSize:'17px', fontWeight:'700', color:'#ef4444', cursor:'pointer', textDecoration:'underline', textDecorationColor:'transparent' }}
                      onMouseEnter={e=>{e.target.style.textDecorationColor='#ef4444'}}
                      onMouseLeave={e=>{e.target.style.textDecorationColor='transparent'}}>
                      IF Troja-Ljungby – {match.opponent} 👥
                    </h3>
                    <div style={{ color:'#6b7280', fontSize:'13px', marginBottom:'10px' }}>
                      {fmtDate(match.date)} • Match {match.time||'TBA'}{guardStart&&` • Vaktstart ${guardStart}`} • {match.match_type==='away'?'Borta':'Hemma'}
                    </div>
                    {wh ? (
                      <div style={{ background:'#d1fae5', border:'1px solid #10b981', padding:'8px 12px', borderRadius:'8px', fontSize:'13px', color:'#065f46', fontWeight:'500', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span>✓ Arbetstider: {fmtTime(wh.start_time)} – {fmtTime(wh.end_time)} ({calcHours(wh.start_time,wh.end_time)}h)</span>
                        {match.attendance && <span style={{ color:'#374151', fontWeight:'600' }}>👥 {match.attendance.toLocaleString('sv-SE')}</span>}
                      </div>
                    ) : !isPast && (
                      <div style={{ background:'#fef3c7', border:'1px solid #f59e0b', padding:'6px 12px', borderRadius:'8px', fontSize:'12px', color:'#92400e', fontWeight:'500' }}>
                        ⚠ Tider inte registrerade
                      </div>
                    )}
                  </div>
                  {!isPast && (
                    <button onClick={()=>onEditTimes(a)} className="btn btn-primary btn-small" style={{ flexShrink:0 }}>
                      {wh?'Ändra':'Sätt tider'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedMatch && <MatchPersonnelModal match={selectedMatch} onClose={()=>setSelectedMatch(null)} />}
    </div>
  )
}

// ─── GuardApp (main) ──────────────────────────────────────────────────────────

export default function GuardApp({ personnelId, personnelName, onSignOut, embedded = false }) {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [seasonFilter, setSeasonFilter] = useState('current')
  const [availableSeasons, setAvailableSeasons] = useState([])
  const [editingAssignment, setEditingAssignment] = useState(null)
  const [showSchedule, setShowSchedule] = useState(false)

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

    const seasons = [...new Set(withHours.map(a=>a.matches?.season).filter(Boolean))].sort().reverse()
    setAvailableSeasons(seasons)
    setAssignments(withHours)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight:embedded?'200px':'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#ef4444 0%,#dc2626 100%)' }}>
      <div style={{ textAlign:'center', background:'rgba(255,255,255,0.1)', padding:'40px', borderRadius:'24px', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.2)' }}>
        <div style={{ width:'48px', height:'48px', border:'4px solid rgba(255,255,255,0.3)', borderTop:'4px solid white', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 16px' }} />
        <div style={{ color:'white', fontWeight:'700', fontSize:'18px' }}>Laddar...</div>
      </div>
    </div>
  )

  return (
    <div className="app" style={{ background:'linear-gradient(135deg,#ef4444 0%,#dc2626 100%)', minHeight:'100vh' }}>
      <div className="dashboard">
        <div className="dashboard-header">
          <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
            <img src="/images/troja-logo.png" alt="Troja" style={{ height:'48px' }} />
            <div>
              <h1>Välkommen {personnelName}!</h1>
              <p style={{ margin:0, fontSize:'14px', color:'#718096' }}>Översikt för kommande uppdrag</p>
            </div>
          </div>
          {onSignOut && (
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              <button onClick={() => setShowSchedule(true)} style={{ background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:'10px', color:'#e02020', padding:'8px 14px', cursor:'pointer', fontSize:'13px', fontWeight:'600', display:'flex', flexDirection:'column', alignItems:'center', lineHeight:1.2 }}>
                <span style={{ fontSize:'18px' }}>📋</span>
                <span style={{ fontSize:'11px', marginTop:'2px' }}>Mitt schema</span>
              </button>
              <button className="logout-btn" onClick={onSignOut}>Logga ut</button>
            </div>
          )}
        </div>

        <div className="dashboard-content">
          <NextMatch personnelId={personnelId} />
          <AssignedMatches
            assignments={assignments}
            onEditTimes={setEditingAssignment}
          />
          <MyHours personnelId={personnelId} />
        </div>
      </div>

      {showSchedule && (
        <ScheduleModal assignments={assignments} onClose={() => setShowSchedule(false)} />
      )}

      {editingAssignment && (
        <TimeModal
          assignment={editingAssignment}
          personnelId={personnelId}
          onClose={()=>setEditingAssignment(null)}
          onSave={()=>{ setEditingAssignment(null); fetchAssignments() }}
        />
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}