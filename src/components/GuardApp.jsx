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

  const [start, setStart] = useState(wh?.start_time || guardStart)
  const [end,   setEnd]   = useState(wh?.end_time   || guardEnd)
  const [notes, setNotes] = useState(wh?.notes || '')
  const [saving, setSaving] = useState(false)

  const hours = calcHours(start, end)
  const isStandard = hours === 4.5

  const handleSave = async () => {
    if (!start || !end) return
    setSaving(true)
    try {
      const payload = { match_id: assignment.match_id, personnel_id: personnelId, start_time: start, end_time: end, work_date: assignment.matches.date, notes: notes.trim()||null }
      if (wh?.id) await supabase.from('work_hours').update(payload).eq('id', wh.id)
      else await supabase.from('work_hours').insert([payload])
      onSave()
    } catch { alert('Fel vid sparande') }
    finally { setSaving(false) }
  }

  return (
    <div className="time-registration-modal" onClick={onClose}>
      <div className="time-registration-content" onClick={e=>e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <div className="time-registration-inner">
          <h3 style={{ margin:'0 0 8px', fontSize:'22px', fontWeight:'700', color:'#1f2937' }}>{wh?'Ändra arbetstider':'Sätt arbetstider'}</h3>

          <div className="info-card" style={{ marginTop:'16px', marginBottom:'16px' }}>
            <div className="info-card-content">
              <h3>{assignment.matches?.opponent}</h3>
              <p>{fmtDate(assignment.matches?.date)}</p>
              {matchTime && <p>Match {matchTime} • Vaktstart {guardStart}</p>}
            </div>
          </div>

          {matchTime && (
            <button className="btn btn-secondary btn-full" style={{ marginBottom:'16px' }} onClick={()=>{setStart(guardStart);setEnd(guardEnd)}}>
              💡 Föreslagna tider ({guardStart}–{guardEnd})
            </button>
          )}

          <div className="time-inputs">
            <div className="form-group">
              <label className="form-label">Starttid</label>
              <input type="time" className="form-input" value={start} onChange={e=>setStart(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Sluttid</label>
              <input type="time" className="form-input" value={end} onChange={e=>setEnd(e.target.value)} />
            </div>
          </div>

          <div className="calculated-hours" style={{ background:isStandard?'#d1fae5':'#fef3c7', borderColor:isStandard?'#10b981':'#f59e0b' }}>
            <h3 style={{ color:isStandard?'#065f46':'#92400e' }}>Totalt: {hours} timmar</h3>
            {!isStandard && <div className="deviation">Avviker från standard (4.5h)</div>}
          </div>

          <div className="form-group" style={{ marginTop:'16px' }}>
            <label className="form-label">Anteckningar (valfritt)</label>
            <textarea className="form-textarea" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="T.ex. övertid..." rows={2} />
          </div>

          <div style={{ display:'flex', gap:'12px', marginTop:'8px' }}>
            <button className="btn btn-secondary" style={{ flex:1 }} onClick={onClose}>Avbryt</button>
            <button className="btn btn-primary" style={{ flex:2 }} disabled={saving||!start||!end} onClick={handleSave}>
              {saving?'Sparar...':wh?'Uppdatera':'Spara tider'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MyHours ─────────────────────────────────────────────────────────────────

function MyHours({ personnelId }) {
  const [allHours, setAllHours] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [seasonFilter, setSeasonFilter] = useState(null)
  const [availableSeasons, setAvailableSeasons] = useState([])

  useEffect(() => { fetchHours() }, [personnelId])

  const fetchHours = async () => {
    const [{ data }, { data: activeAssignments }] = await Promise.all([
      supabase.from('work_hours').select('*, matches(date,opponent,time,match_type,season)').eq('personnel_id', personnelId).order('work_date', { ascending: false }),
      supabase.from('assignments').select('match_id').eq('personnel_id', personnelId).eq('is_working', true),
    ])
    const activeMatchIds = new Set((activeAssignments || []).map(a => a.match_id))
    const all = (data || []).filter(wh => activeMatchIds.has(wh.match_id))
    const seasons = [...new Set(all.map(wh => wh.matches?.season).filter(Boolean))].sort().reverse()
    setAvailableSeasons(seasons)
    setSeasonFilter(seasons[0] || null)
    setAllHours(all)
    setLoading(false)
  }

  const hours = allHours.filter(wh => !seasonFilter || wh.matches?.season === seasonFilter)
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
      {availableSeasons.length > 1 && (
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'16px' }}>
          {availableSeasons.map(s => (
            <button key={s} onClick={() => { setSeasonFilter(s); setShowAll(false) }} style={{ padding:'6px 14px', borderRadius:'99px', fontSize:'13px', fontWeight:'600', border:'none', cursor:'pointer', background: seasonFilter===s ? 'linear-gradient(135deg,#10b981,#059669)' : 'white', color: seasonFilter===s ? 'white' : '#4a5568', boxShadow: seasonFilter===s ? '0 2px 8px rgba(16,185,129,0.4)' : 'var(--shadow-sm)', minHeight:'36px' }}>
              {s}
            </button>
          ))}
        </div>
      )}

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
                  <div style={{ fontSize:'12px', color:'#718096' }}>{fmtTime(wh.start_time)} – {fmtTime(wh.end_time)}</div>
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

function AssignedMatches({ assignments, seasonFilter, setSeasonFilter, availableSeasons, onEditTimes }) {
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [showAll, setShowAll] = useState(false)

  const today = new Date(); today.setHours(0,0,0,0)
  const currentSeason = availableSeasons[0] || null

  const filtered = assignments
    .filter(a => {
      if (!a.matches?.date) return false
      if (seasonFilter === 'current') {
        const d = new Date(a.matches.date); d.setHours(0,0,0,0)
        return d >= today || a.matches.season === currentSeason
      }
      return a.matches.season === seasonFilter
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

      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'16px' }}>
        {[{key:'current',label:'Aktuellt'}, ...availableSeasons.map(s=>({key:s,label:s}))].map(f=>(
          <button key={f.key} onClick={()=>setSeasonFilter(f.key)} style={{ padding:'7px 16px', borderRadius:'99px', fontSize:'13px', fontWeight:'600', border:'none', cursor:'pointer', minHeight:'40px', background:seasonFilter===f.key?'linear-gradient(135deg,#ef4444 0%,#dc2626 100%)':'white', color:seasonFilter===f.key?'white':'#4a5568', boxShadow:seasonFilter===f.key?'var(--shadow-primary)':'var(--shadow-sm)' }}>
            {f.label}
          </button>
        ))}
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
                      <div style={{ background:'#d1fae5', border:'1px solid #10b981', padding:'8px 12px', borderRadius:'8px', fontSize:'13px', color:'#065f46', fontWeight:'500' }}>
                        ✓ Arbetstider: {fmtTime(wh.start_time)} – {fmtTime(wh.end_time)} ({calcHours(wh.start_time,wh.end_time)}h)
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

  useEffect(() => { if (personnelId) fetchAssignments() }, [personnelId])

  const fetchAssignments = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('assignments')
      .select('*, matches(id,date,time,opponent,match_type,season,required_guards)')
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
            <button className="logout-btn" onClick={onSignOut}>Logga ut</button>
          )}
        </div>

        <div className="dashboard-content">
          <NextMatch personnelId={personnelId} />
          <AssignedMatches
            assignments={assignments}
            seasonFilter={seasonFilter}
            setSeasonFilter={setSeasonFilter}
            availableSeasons={availableSeasons}
            onEditTimes={setEditingAssignment}
          />
          <MyHours personnelId={personnelId} />
        </div>
      </div>

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