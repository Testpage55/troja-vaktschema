import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { PendingApplicationsPanel, APPLICATIONS_EVENT } from './ApplicationsAdmin'
import { planDistribution } from '../utils/fairPlanner'

// Samlad vy över ansökningar: per match, per vakt, samt en generator som
// fördelar passen så jämnt som möjligt bland de vakter admin väljer.

const fmtDate = (d) => new Date(d + 'T12:00').toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
const chip = (active) => ({
  padding: '5px 12px', borderRadius: '99px', fontSize: '13px', cursor: 'pointer',
  border: active ? 'none' : '1px solid var(--gray-200)',
  background: active ? '#16a34a' : 'white', color: active ? 'white' : 'var(--gray-700)', fontWeight: active ? 600 : 400,
})

export default function ApplicationsHub({ apps, matches, getWorkingCount, shiftsByPerson, onChanged }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('match')
  const todayStr = new Date().toISOString().split('T')[0]
  const upcoming = apps.filter(a => a.matches && a.matches.date >= todayStr)
  const pending = upcoming.filter(a => a.status === 'pending')
  if (upcoming.length === 0) return null

  return (
    <div style={{ marginBottom: '16px' }}>
      <button onClick={() => setOpen(v => !v)} aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--gray-200)', background: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}>
        <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', fontSize: '11px' }}>▶</span>
        Alla ansökningar
        {pending.length > 0 && <span style={{ background: '#dc2626', color: 'white', borderRadius: '99px', padding: '1px 9px', fontSize: '12px' }}>{pending.length} väntar</span>}
      </button>
      {open && (
        <div style={{ marginTop: '10px', background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <button style={chip(tab === 'match')} onClick={() => setTab('match')}>Per match</button>
            <button style={chip(tab === 'person')} onClick={() => setTab('person')}>Per vakt</button>
            <button style={chip(tab === 'plan')} onClick={() => setTab('plan')}>Fördela jämnt</button>
          </div>
          {tab === 'match' && (
            <PendingApplicationsPanel flat onChanged={onChanged} getWorkingCount={getWorkingCount} shiftsByPerson={shiftsByPerson} />
          )}
          {tab === 'person' && <PerPerson apps={upcoming} shiftsByPerson={shiftsByPerson} />}
          {tab === 'plan' && (
            <Planner pending={pending} matches={matches} getWorkingCount={getWorkingCount} shiftsByPerson={shiftsByPerson} onChanged={onChanged} />
          )}
        </div>
      )}
    </div>
  )
}

function PerPerson({ apps, shiftsByPerson }) {
  const people = useMemo(() => {
    const map = {}
    apps.forEach(a => { (map[a.personnel_id] ??= { id: a.personnel_id, name: a.personnel?.name || '?', list: [] }).list.push(a) })
    return Object.values(map).sort((x, y) => x.name.localeCompare(y.name, 'sv'))
  }, [apps])
  const color = { pending: ['#fef3c7', '#92400e'], approved: ['#dcfce7', '#166534'], rejected: ['#f3f4f6', '#6b7280'] }
  const label = { pending: 'väntar', approved: 'godkänd', rejected: 'nekad' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {people.map(p => {
        const season = p.list[0]?.matches?.season
        return (
          <div key={p.id} style={{ border: '1px solid var(--gray-200)', borderRadius: '10px', padding: '8px 12px' }}>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>
              {p.name} <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--gray-500)' }}>· {shiftsByPerson[`${p.id}|${season}`] || 0} pass i säsongen · {p.list.length} ansökt{p.list.length === 1 ? '' : 'a'}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {p.list.sort((a, b) => a.matches.date.localeCompare(b.matches.date)).map(a => (
                <span key={a.id} style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '8px', background: color[a.status][0], color: color[a.status][1] }}>
                  {a.matches.opponent} {fmtDate(a.matches.date)} · {label[a.status]}
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Planner({ pending, matches, getWorkingCount, shiftsByPerson, onChanged }) {
  // Vakter och matcher som har väntande ansökningar
  const guards = useMemo(() => {
    const m = new Map()
    pending.forEach(a => m.set(a.personnel_id, a.personnel?.name || '?'))
    return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  }, [pending])
  const matchList = useMemo(() => {
    const m = {}
    pending.forEach(a => { m[a.match_id] = a.matches })
    return Object.values(m).sort((a, b) => a.date.localeCompare(b.date))
  }, [pending])

  const [offGuards, setOffGuards] = useState(new Set())
  const [offMatches, setOffMatches] = useState(new Set())
  const [proposals, setProposals] = useState([])
  const [active, setActive] = useState(0)
  const plan = proposals[active] || null
  const setPlan = (v) => { if (v === null) { setProposals([]); setActive(0) } }
  const [skipped, setSkipped] = useState(new Set())
  const [rejectRest, setRejectRest] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const toggle = (set, setter, id) => { const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); setter(n); setPlan(null) }

  const generate = (random = false) => {
    const ms = matchList.filter(m => !offMatches.has(m.id)).map(m => {
      const full = matches.find(x => x.id === m.id)
      const need = Math.max(0, (m.required_guards || 4) - (full ? getWorkingCount(full) : 0))
      return { id: m.id, date: m.date, season: m.season, opponent: m.opponent, need }
    })
    const apps = pending.filter(a => !offGuards.has(a.personnel_id) && !offMatches.has(a.match_id))
    const result = planDistribution({ matches: ms, apps, baseCounts: shiftsByPerson, random })
    const next = { ...result, before: { ...shiftsByPerson }, ms, guardIds: guards.filter(g => !offGuards.has(g.id)).map(g => g.id) }
    const list = random ? [...proposals, next] : [next]
    setProposals(list)
    setActive(list.length - 1)
    setSkipped(new Set())
    setMsg('')
  }

  const totalsFor = (pl, only) => {
    const out = {}
    pl.guardIds.forEach(id => {
      const seasons = [...new Set(pending.filter(a => a.personnel_id === id).map(a => a.matches.season))]
      const now = seasons.reduce((t, se) => t + (pl.before[`${id}|${se}`] || 0), 0)
      out[id] = { now, add: only.filter(x => x.app.personnel_id === id).length }
    })
    return out
  }
  const spreadOf = (pl, only) => {
    const v = Object.values(totalsFor(pl, only)).map(t => t.now + t.add)
    return v.length ? Math.max(...v) - Math.min(...v) : 0
  }
  const chosen = plan ? plan.assignments.filter(x => !skipped.has(x.app.id)) : []
  const nameOf = (pid) => guards.find(g => g.id === pid)?.name || '?'

  const apply = async () => {
    if (!chosen.length) return
    if (!window.confirm(`Godkänn ${chosen.length} ansökningar enligt förslaget?${rejectRest ? '\n\nÖvriga sökande på fyllda matcher nekas.' : ''}`)) return
    setBusy(true); setMsg('')
    const errors = []
    for (const x of chosen) {
      const { error } = await supabase.rpc('approve_application', { p_id: x.app.id })
      if (error) errors.push(`${nameOf(x.app.personnel_id)} – ${x.match.opponent}: ${error.message}`)
    }
    if (rejectRest) {
      const chosenIds = new Set(chosen.map(x => x.app.id))
      const filledMatches = new Set(plan.ms.filter(m => chosen.filter(x => x.match.id === m.id).length >= m.need && m.need > 0).map(m => m.id))
      for (const a of pending) {
        if (filledMatches.has(a.match_id) && !chosenIds.has(a.id)) {
          const { error } = await supabase.rpc('reject_application', { p_id: a.id })
          if (error) errors.push(`Neka ${nameOf(a.personnel_id)}: ${error.message}`)
        }
      }
    }
    setBusy(false)
    window.dispatchEvent(new Event(APPLICATIONS_EVENT))
    onChanged?.()
    setProposals([]); setActive(0)
    setMsg(errors.length ? 'Klart, men: ' + errors.join(' · ') : `Klart – ${chosen.length} ansökningar godkända.`)
  }

  if (guards.length === 0) return <div style={{ fontSize: '14px', color: 'var(--gray-500)' }}>Inga väntande ansökningar att fördela.{msg && <div style={{ marginTop: '8px', color: '#166534', fontWeight: 600 }}>{msg}</div>}</div>

  const check = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', padding: '3px 0' }
  const box = { border: '1px solid var(--gray-200)', borderRadius: '10px', padding: '8px 12px', flex: '1 1 240px', minWidth: 0 }

  return (
    <div>
      <div style={{ fontSize: '13px', color: 'var(--gray-600)', marginBottom: '10px' }}>
        Välj vilka vakter och matcher som ska ingå. Generatorn fyller lediga platser med dem som ansökt, så att antalet pass i säsongen blir så lika som möjligt.
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div style={box}>
          <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>Vakter</div>
          {guards.map(g => (
            <label key={g.id} style={check}>
              <input type="checkbox" checked={!offGuards.has(g.id)} onChange={() => toggle(offGuards, setOffGuards, g.id)} />
              {g.name}
            </label>
          ))}
        </div>
        <div style={box}>
          <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>Matcher</div>
          {matchList.map(m => (
            <label key={m.id} style={check}>
              <input type="checkbox" checked={!offMatches.has(m.id)} onChange={() => toggle(offMatches, setOffMatches, m.id)} />
              {m.opponent} · {fmtDate(m.date)}
            </label>
          ))}
        </div>
      </div>
      <button className="btn btn-success" onClick={() => generate(false)}>Skapa förslag</button>
      {msg && <div style={{ marginTop: '10px', fontSize: '13px', fontWeight: 600, color: msg.startsWith('Klart –') ? '#166534' : '#b91c1c' }}>{msg}</div>}

      {plan && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
            {proposals.map((pl, i) => (
              <button key={i} onClick={() => { setActive(i); setSkipped(new Set()) }} style={chip(i === active)}>
                Förslag {i + 1} · skillnad {spreadOf(pl, pl.assignments)}
              </button>
            ))}
            <button onClick={() => generate(true)} style={{ ...chip(false), borderStyle: 'dashed' }}>+ Nytt förslag</button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '8px' }}>
            Skillnad = antal pass mellan den vakt som får flest och färst efter fördelningen. Lägre är rättvisare.
          </div>
          {plan.assignments.length === 0 ? (
            <div style={{ fontSize: '14px' }}>Inget att fördela med de valen (inga lediga platser eller inga sökande).</div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {plan.ms.filter(m => plan.assignments.some(x => x.match.id === m.id)).map(m => (
                  <div key={m.id} style={{ border: '1px solid var(--gray-200)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ padding: '6px 12px', background: 'var(--gray-50)', fontSize: '13px', fontWeight: 700 }}>
                      {m.opponent} · {fmtDate(m.date)}
                      <span style={{ fontWeight: 400, color: 'var(--gray-500)' }}> · {m.need} lediga</span>
                    </div>
                    {plan.assignments.filter(x => x.match.id === m.id).map(x => (
                      <label key={x.app.id} style={{ ...check, padding: '6px 12px', borderTop: '1px solid var(--gray-100)' }}>
                        <input type="checkbox" checked={!skipped.has(x.app.id)} onChange={() => { const n = new Set(skipped); n.has(x.app.id) ? n.delete(x.app.id) : n.add(x.app.id); setSkipped(n) }} />
                        {nameOf(x.app.personnel_id)}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
              {plan.unfilled.length > 0 && (
                <div style={{ marginTop: '8px', fontSize: '13px', color: '#b91c1c' }}>
                  Kunde inte fylla: {plan.unfilled.map(u => `${u.match.opponent} (${u.missing} saknas)`).join(', ')}
                </div>
              )}
              <div style={{ marginTop: '12px', border: '1px solid var(--gray-200)', borderRadius: '10px', padding: '8px 12px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>Pass i säsongen: nu → efter (skillnad {spreadOf(plan, chosen)})</div>
                {guards.filter(g => plan.guardIds.includes(g.id)).map(g => {
                  const t = totalsFor(plan, chosen)[g.id] || { now: 0, add: 0 }
                  return (
                    <div key={g.id} style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{g.name}</span>
                      <span><strong>{t.now}</strong> → <strong>{t.now + t.add}</strong>{t.add ? ` (+${t.add})` : ''}</span>
                    </div>
                  )
                })}
              </div>
              <label style={{ ...check, marginTop: '10px' }}>
                <input type="checkbox" checked={rejectRest} onChange={e => setRejectRest(e.target.checked)} />
                Neka övriga sökande på matcher som blir fulla
              </label>
              <button className="btn btn-success" onClick={apply} disabled={busy || !chosen.length} style={{ marginTop: '6px' }}>
                {busy ? 'Godkänner…' : `Godkänn ${chosen.length} enligt förslaget`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
