import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ─── Ansökningar till matcher (admin) ─────────────────────────────────────────
// Vakter ansöker i vaktvyn. Godkänn lägger vakten på matchen och skapar
// arbetstid med standardtid – allt görs i databasen i ett steg (approve_application).

export const APPLICATIONS_EVENT = 'troja-applications-change'

export function useApplications() {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    const { data } = await supabase
      .from('match_applications')
      .select('*, personnel(name), matches(id, date, time, opponent, required_guards, match_type, season)')
      .order('created_at', { ascending: true })
    setApps(data || [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
    const h = () => load()
    window.addEventListener(APPLICATIONS_EVENT, h)
    return () => window.removeEventListener(APPLICATIONS_EVENT, h)
  }, [load])
  return { apps, loading, reload: load }
}

const fmtDate = (d) => new Date(d + 'T12:00').toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtAgo = (ts) => new Date(ts).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

async function deleteApplication(app) {
  const who = app.personnel?.name || 'vakten'
  const extra = app.status === 'approved' ? '\n\nVakten ligger kvar på matchen. Ta bort vakten från matchen separat om det behövs.' : ''
  if (!window.confirm(`Ta bort ansökan från ${who}?${extra}`)) return false
  const { error } = await supabase.from('match_applications').delete().eq('id', app.id)
  if (error) { window.alert('Kunde inte ta bort: ' + error.message); return false }
  window.dispatchEvent(new Event(APPLICATIONS_EVENT))
  return true
}

function DeleteButton({ app }) {
  return (
    <button onClick={() => deleteApplication(app)} title="Ta bort ansökan"
      style={{ padding: '4px 8px', borderRadius: '8px', border: 'none', background: 'none', color: 'var(--gray-500)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
      Ta bort
    </button>
  )
}

function DecisionButtons({ app, onDone, compact }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const act = async (kind) => {
    setBusy(kind); setError('')
    const { error } = await supabase.rpc(kind === 'approve' ? 'approve_application' : 'reject_application', { p_id: app.id })
    setBusy(null)
    if (error) { setError(error.message); return }
    window.dispatchEvent(new Event(APPLICATIONS_EVENT))
    onDone?.(kind)
  }
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
      <button onClick={() => act('approve')} disabled={!!busy}
        style={{ padding: compact ? '4px 10px' : '6px 14px', borderRadius: '8px', border: 'none', background: '#16a34a', color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
        {busy === 'approve' ? 'Godkänner…' : 'Godkänn'}
      </button>
      <button onClick={() => act('reject')} disabled={!!busy}
        style={{ padding: compact ? '4px 10px' : '6px 14px', borderRadius: '8px', border: '1px solid #fca5a5', background: 'white', color: '#b91c1c', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
        {busy === 'reject' ? 'Nekar…' : 'Neka'}
      </button>
      <DeleteButton app={app} />
      {error && <span style={{ color: '#b91c1c', fontSize: '12px' }}>{error}</span>}
    </div>
  )
}

/** Panel överst i Schema: alla väntande ansökningar. */
export function PendingApplicationsPanel({ onChanged, shiftsByPerson = {}, getWorkingCount, flat }) {
  const { apps } = useApplications()
  const [showDecided, setShowDecided] = useState(false)
  const todayStr = new Date().toISOString().split('T')[0]
  const upcoming = apps.filter(a => a.matches && a.matches.date >= todayStr)
  const pending = upcoming.filter(a => a.status === 'pending')
  const decided = upcoming.filter(a => a.status !== 'pending')
    .sort((x, y) => (y.decided_at || '').localeCompare(x.decided_at || ''))
  if (pending.length === 0 && decided.length === 0) return null

  const byMatch = pending.reduce((acc, a) => { (acc[a.match_id] ??= []).push(a); return acc }, {})
  const groups = Object.values(byMatch).sort((x, y) => x[0].matches.date.localeCompare(y[0].matches.date))

  return (
    <div style={flat ? {} : { background: 'white', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px', boxShadow: 'var(--shadow-sm)', borderLeft: '0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: pending.length ? '10px' : 0, flexWrap: 'wrap' }}>
        {pending.length > 0 ? (
          <>
            <span style={{ background: '#dc2626', color: 'white', borderRadius: '99px', padding: '2px 10px', fontWeight: 700, fontSize: '13px' }}>{pending.length}</span>
            <span style={{ fontWeight: 700, fontSize: '15px' }}>{pending.length === 1 ? 'ansökan väntar' : 'ansökningar väntar'} på beslut</span>
          </>
        ) : (
          <span style={{ fontWeight: 700, fontSize: '15px' }}>Ansökningar</span>
        )}
        {decided.length > 0 && (
          <button onClick={() => setShowDecided(v => !v)}
            style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--gray-200)', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: 'var(--gray-600)' }}>
            {showDecided ? 'Dölj hanterade' : `Visa hanterade (${decided.length})`}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {groups.map(list => {
          const m = list[0].matches
          const working = getWorkingCount ? getWorkingCount(m.id) : null
          const need = m.required_guards || 4
          return (
            <div key={m.id} style={{ border: '1px solid var(--gray-200)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '8px 12px', background: 'var(--gray-50)', fontSize: '13px', flexWrap: 'wrap' }}>
                <span><strong>{m.opponent}</strong> · {fmtDate(m.date)} · match {m.time || 'TBA'}{m.match_type === 'away' ? ' · borta' : ''}</span>
                {working != null && (
                  <span style={{ fontWeight: 700, color: working >= need ? '#15803d' : '#b91c1c' }}>{working}/{need} vakter</span>
                )}
              </div>
              {list.map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '8px 12px', borderTop: '1px solid var(--gray-100)', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '14px' }}>
                    <strong>{a.personnel?.name}</strong>
                    <span style={{ color: 'var(--gray-500)', fontSize: '12px' }}>
                      {' '}· ansökte {fmtAgo(a.created_at)}{` · ${shiftsByPerson[`${a.personnel_id}|${a.matches.season}`] || 0} pass i säsongen`}
                    </span>
                    {a.comment && <div style={{ fontSize: '13px', color: 'var(--gray-600)', fontStyle: 'italic' }}>"{a.comment}"</div>}
                  </div>
                  <DecisionButtons app={a} onDone={onChanged} compact />
                </div>
              ))}
            </div>
          )
        })}
      </div>
      {showDecided && decided.length > 0 && (
        <div style={{ marginTop: pending.length ? '12px' : '10px', border: '1px solid var(--gray-200)', borderRadius: '10px', overflow: 'hidden' }}>
          {decided.map(a => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '8px 12px', borderTop: '1px solid var(--gray-100)', flexWrap: 'wrap', fontSize: '13px' }}>
              <span>
                <strong>{a.personnel?.name}</strong> · {a.matches.opponent} {fmtDate(a.matches.date)}{' '}
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '1px 7px', borderRadius: '6px', background: a.status === 'approved' ? '#dcfce7' : '#f3f4f6', color: a.status === 'approved' ? '#166534' : '#4b5563' }}>
                  {a.status === 'approved' ? 'Godkänd' : 'Nekad'}
                </span>
                {a.decided_by_name && <span style={{ color: 'var(--gray-500)', fontSize: '12px' }}> av {a.decided_by_name} {fmtAgo(a.decided_at)}</span>}
              </span>
              <DeleteButton app={a} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Sektion i matchrutan: ansökningar för en match. */
export function MatchApplicationsSection({ matchId, onChanged }) {
  const { apps } = useApplications()
  const list = apps.filter(a => a.match_id === matchId)
  if (list.length === 0) return null
  const label = { pending: 'Väntar', approved: 'Godkänd', rejected: 'Nekad' }
  const color = { pending: ['#fef3c7', '#92400e'], approved: ['#dcfce7', '#166534'], rejected: ['#f3f4f6', '#4b5563'] }
  return (
    <div style={{ marginBottom: '12px', border: '1px solid var(--gray-200)', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', background: 'var(--gray-50)', fontWeight: 700, fontSize: '13px' }}>
        Ansökningar ({list.length})
      </div>
      {list.map(a => (
        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '8px 12px', borderTop: '1px solid var(--gray-100)', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '14px' }}>
            <strong>{a.personnel?.name}</strong>{' '}
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '1px 7px', borderRadius: '6px', background: color[a.status][0], color: color[a.status][1] }}>{label[a.status]}</span>
            {a.decided_by_name && <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}> av {a.decided_by_name} {fmtAgo(a.decided_at)}</span>}
            {a.comment && <div style={{ fontSize: '13px', color: 'var(--gray-600)', fontStyle: 'italic' }}>"{a.comment}"</div>}
          </div>
          {a.status === 'pending' ? <DecisionButtons app={a} onDone={onChanged} compact /> : <DeleteButton app={a} />}
        </div>
      ))}
    </div>
  )
}

/** Under varje matchkort: ansökningar för matchen, går att fälla ihop. */
export function MatchCardApplications({ apps, onChanged, shiftsByPerson = {}, season }) {
  const pendingCount = apps.filter(a => a.status === 'pending').length
  const [open, setOpen] = useState(pendingCount > 0)
  const [touched, setTouched] = useState(false)
  // Öppna automatiskt när en ny ansökan dyker upp, om admin inte själv valt
  useEffect(() => { if (!touched) setOpen(pendingCount > 0) }, [pendingCount, touched])
  if (apps.length === 0) return null
  const label = { approved: 'Godkänd', rejected: 'Nekad' }
  const color = { approved: ['#dcfce7', '#166534'], rejected: ['#f3f4f6', '#4b5563'] }
  const sorted = [...apps].sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1))
  return (
    <div style={{ marginTop: '6px', border: '1px solid var(--gray-200)', borderRadius: '10px', background: 'white', overflow: 'hidden' }}>
      <button onClick={() => { setTouched(true); setOpen(v => !v) }} aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: pendingCount ? '#fef2f2' : 'var(--gray-50)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, textAlign: 'left' }}>
        <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', fontSize: '11px' }}>▶</span>
        <span>Ansökningar ({apps.length})</span>
        {pendingCount > 0 && (
          <span style={{ marginLeft: 'auto', background: '#dc2626', color: 'white', borderRadius: '99px', padding: '1px 9px', fontSize: '12px' }}>{pendingCount} väntar</span>
        )}
      </button>
      {open && sorted.map(a => (
        <div key={a.id} style={{ padding: '8px 10px', borderTop: '1px solid var(--gray-100)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '13px', minWidth: 0 }}>
            <strong>{a.personnel?.name}</strong>{' '}
            {a.status !== 'pending' && (
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '1px 7px', borderRadius: '6px', background: color[a.status][0], color: color[a.status][1] }}>{label[a.status]}</span>
            )}
            <div style={{ color: 'var(--gray-500)', fontSize: '11px' }}>
              {a.status === 'pending'
                ? `ansökte ${fmtAgo(a.created_at)} · ${shiftsByPerson[`${a.personnel_id}|${season}`] || 0} pass i säsongen`
                : a.decided_by_name ? `av ${a.decided_by_name} ${fmtAgo(a.decided_at)}` : ''}
            </div>
          </div>
          {a.status === 'pending' ? <DecisionButtons app={a} onDone={onChanged} compact /> : <div><DeleteButton app={a} /></div>}
        </div>
      ))}
    </div>
  )
}
