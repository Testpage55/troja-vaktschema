import { useState, useMemo, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts'
import { HOURLY_RATE, MILEAGE_RATE } from '../../constants'
import { supabase } from '../../lib/supabase'

const REPORT_BUCKET = 'delegate-reports'
const MAX_REPORT_MB = 15

// Storage-nycklar tål inte å/ä/ö och specialtecken
const safeFileName = (name) =>
  name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_')

// Rapportkolumn per delegatbesök: ladda upp, öppna, byt ut, ta bort
function DelegateReportCell({ delegate, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const upload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_REPORT_MB * 1024 * 1024) { setError(`Filen är för stor (max ${MAX_REPORT_MB} MB)`); return }
    setBusy(true); setError('')
    const oldPath = delegate.report_path
    const path = `${delegate.id}/${Date.now()}_${safeFileName(file.name)}`
    const { error: upErr } = await supabase.storage.from(REPORT_BUCKET).upload(path, file, { contentType: file.type || undefined })
    if (upErr) { console.error(upErr); setError('Uppladdningen misslyckades'); setBusy(false); return }
    const { error: dbErr } = await supabase.from('delegates').update({ report_path: path, report_name: file.name }).eq('id', delegate.id)
    if (dbErr) {
      console.error(dbErr)
      await supabase.storage.from(REPORT_BUCKET).remove([path])
      setError('Kunde inte spara (har SQL-kolumnerna skapats?)'); setBusy(false); return
    }
    if (oldPath) await supabase.storage.from(REPORT_BUCKET).remove([oldPath])
    setBusy(false)
    onChanged && onChanged()
  }

  const open = async () => {
    // Fliken öppnas direkt vid klicket (annars blockerar mobilens popup-skydd den)
    const win = window.open('', '_blank')
    const { data, error: err } = await supabase.storage.from(REPORT_BUCKET).createSignedUrl(delegate.report_path, 300)
    if (err || !data?.signedUrl) {
      if (win) win.close()
      setError('Kunde inte öppna filen')
      return
    }
    if (win) win.location.href = data.signedUrl
    else window.location.href = data.signedUrl // om popup ändå blockeras: öppna i samma flik
  }

  const remove = async () => {
    if (!window.confirm('Ta bort delegatrapporten?')) return
    setBusy(true); setError('')
    const { error: dbErr } = await supabase.from('delegates').update({ report_path: null, report_name: null }).eq('id', delegate.id)
    if (dbErr) { setError('Kunde inte ta bort'); setBusy(false); return }
    await supabase.storage.from(REPORT_BUCKET).remove([delegate.report_path])
    setBusy(false)
    onChanged && onChanged()
  }

  const btn = { fontSize: '12px', padding: '3px 9px', borderRadius: '6px', cursor: 'pointer', background: 'white' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      {delegate.report_path ? (
        <>
          <button onClick={open} disabled={busy} title={delegate.report_name} style={{ ...btn, border: '1px solid #2563eb', color: '#1d4ed8', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📄 {delegate.report_name || 'Öppna rapport'}
          </button>
          <button onClick={() => inputRef.current?.click()} disabled={busy} style={{ ...btn, border: '1px solid var(--gray-300)', color: 'var(--gray-600)' }}>Byt</button>
          <button onClick={remove} disabled={busy} style={{ ...btn, border: '1px solid #fca5a5', color: '#b91c1c' }}>Ta bort</button>
        </>
      ) : (
        <button onClick={() => inputRef.current?.click()} disabled={busy} style={{ ...btn, border: '1px solid #16a34a', color: '#15803d' }}>
          {busy ? 'Laddar upp…' : '+ Ladda upp rapport'}
        </button>
      )}
      <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*" onChange={upload} style={{ display: 'none' }} />
      {error && <div style={{ width: '100%', fontSize: '11px', color: '#b91c1c' }}>{error}</div>}
    </div>
  )
}

export default function StatsTab({ matches, workHours, securityDuties, personnel, delegates, onDelegateReportChanged, seasonFilter, setSeasonFilter, availableSeasons: availableSeasonsProp }) {
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const availableSeasons = availableSeasonsProp || [...new Set(matches.map(m => m.season).filter(Boolean))].sort()
  const availableCategories = [...new Set(matches.map(m => m.category).filter(Boolean))].sort()

  // Filtrera matcher
  const filteredMatches = useMemo(() => matches.filter(m => {
    if (seasonFilter !== 'all' && m.season !== seasonFilter) return false
    if (categoryFilter !== 'all' && m.category !== categoryFilter) return false
    if (fromDate && m.date < fromDate) return false
    if (toDate && m.date > toDate) return false
    return true
  }), [matches, seasonFilter, categoryFilter, fromDate, toDate])

  const filteredMatchIds = new Set(filteredMatches.map(m => m.id))

  // Filtrera arbetstider baserat på filtrerade matcher
  const filteredWorkHours = useMemo(() => workHours.filter(wh => {
    if (!filteredMatchIds.has(wh.match_id)) return false
    return true
  }), [workHours, filteredMatchIds])

  // Filtrera säkerhetsuppdrag på datum
  const filteredSecurityDuties = useMemo(() => securityDuties.filter(d => {
    if (fromDate && d.date < fromDate) return false
    if (toDate && d.date > toDate) return false
    if (seasonFilter !== 'all' && (d.season || '') !== seasonFilter) return false
    return true
  }), [securityDuties, fromDate, toDate, seasonFilter])

  const filteredDelegates = useMemo(() => (delegates || []).filter(d => {
    if (fromDate && d.date < fromDate) return false
    if (toDate && d.date > toDate) return false
    // Filter by match season/category
    const match = filteredMatches.find(m => m.id === d.match_id)
    if (seasonFilter !== 'all' && !match) return false
    if (categoryFilter !== 'all' && !match) return false
    return true
  }), [delegates, filteredMatches, fromDate, toDate, seasonFilter, categoryFilter])

  const uniqueDelegateNames = [...new Set(filteredDelegates.map(d => d.name))].sort()
  const personnelStatsData = useMemo(() => personnel.map(person => {
    const personMatches = filteredWorkHours.filter(wh => wh.personnel_id === person.id)
    const personHours = personMatches.reduce((t, wh) => t + (wh.total_hours || 0), 0)
    const secForPerson = filteredSecurityDuties.filter(d => d.personnel_name === person.name)
    const secHours = secForPerson.reduce((t, d) => t + d.hours, 0)
    const secMileage = secForPerson.reduce((t, d) => t + (d.mileage_compensation || 0), 0)
    const totalHours = personHours + secHours
    return {
      name: person.name,
      matches: personMatches.length,
      securityDuties: secForPerson.length,
      // Säkerhetsansvar som ingår i ett vaktpass är inte ett eget arbetstillfälle
      shifts: personMatches.length + secForPerson.filter(d => !d.coveredByShift).length,
      hours: totalHours,
      securityHours: secHours,
      salary: totalHours * HOURLY_RATE,
      mileage: secMileage,
      totalCompensation: (totalHours * HOURLY_RATE) + secMileage,
    }
  }).filter(p => p.matches > 0 || p.securityDuties > 0)
    .sort((a, b) => b.matches - a.matches),
  [personnel, filteredWorkHours, filteredSecurityDuties])

  // Totaler
  const totalEvents = filteredMatches.length
  const totalWorkHours = filteredWorkHours.reduce((t, wh) => t + (wh.total_hours || 0), 0)
  const totalSecHours = filteredSecurityDuties.reduce((t, d) => t + d.hours, 0)
  const totalAllHours = totalWorkHours + totalSecHours
  const totalSalary = totalAllHours * HOURLY_RATE
  const totalMileage = filteredSecurityDuties.reduce((t, d) => t + (d.mileage_compensation || 0), 0)
  const totalCompensation = totalSalary + totalMileage
  const separateSecurity = filteredSecurityDuties.filter(d => !d.coveredByShift).length
  const totalShifts = filteredWorkHours.length + separateSecurity

  const hasFilter = seasonFilter !== 'all' || categoryFilter !== 'all' || fromDate || toDate

  const kr = (n) => `${Math.round(n).toLocaleString('sv-SE')} kr`
  const sum = (key) => personnelStatsData.reduce((t, p) => t + p[key], 0)

  const chartData = [...personnelStatsData]
    .sort((a, b) => b.hours - a.hours)
    .map(p => ({ name: p.name, hours: Math.round(p.hours * 10) / 10, label: `${p.hours.toFixed(1)}h · ${p.shifts} pass` }))

  const input = { padding: '6px 8px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '13px', background: 'white' }

  const kpis = [
    { label: 'Evenemang', value: totalEvents },
    { label: 'Arbetstillfällen', value: totalShifts, sub: `${filteredWorkHours.length} vakt + ${separateSecurity} säkerhet` },
    { label: 'Timmar', value: `${totalAllHours.toFixed(1)}h`, sub: totalShifts > 0 ? `snitt ${(totalAllHours / totalShifts).toFixed(1)}h per tillfälle` : null },
    { label: 'Total kostnad', value: kr(totalCompensation), sub: `lön ${kr(totalSalary)}${totalMileage > 0 ? ` + mil ${kr(totalMileage)}` : ''}`, strong: true },
    { label: 'Delegatbesök', value: filteredDelegates.length, sub: uniqueDelegateNames.length > 0 ? `${uniqueDelegateNames.length} unika` : null },
  ]

  return (
    <div className="tab-content">
      <style>{`
        .st-table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
        .st-table th{padding:8px 12px !important;font-size:11px !important;text-transform:uppercase;letter-spacing:.05em;color:var(--gray-500) !important;background:transparent !important;border-bottom:1px solid var(--gray-200) !important;text-align:right;font-weight:600 !important;white-space:nowrap}
        .st-table td{padding:8px 12px !important;border-bottom:1px solid var(--gray-100) !important;text-align:right;color:var(--gray-800)}
        .st-table th:first-child,.st-table td:first-child{text-align:left}
        .st-table tbody tr:hover td{background:var(--gray-50)}
        .st-table tfoot td{font-weight:700;border-top:2px solid var(--gray-200) !important;border-bottom:none !important;color:var(--gray-900)}
        .st-card{background:white;border:1px solid var(--gray-200);border-radius:12px}
        .st-h{margin:0 0 10px;font-size:14px;font-weight:700;color:var(--gray-900)}
      `}</style>

      {/* Filterrad */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
        {availableSeasons.length > 0 && (
          <select value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)} className="filter-select">
            <option value="all">Alla säsonger</option>
            {availableSeasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {availableCategories.length > 0 && (
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="filter-select">
            <option value="all">Alla kategorier</option>
            {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} title="Från datum" style={input} />
        <span style={{ color: 'var(--gray-400)' }}>–</span>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} title="Till datum" style={input} />
        {hasFilter && (
          <button
            onClick={() => { setSeasonFilter('all'); setCategoryFilter('all'); setFromDate(''); setToDate('') }}
            style={{ fontSize: '12px', color: 'var(--gray-500)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Rensa filter
          </button>
        )}
      </div>

      {/* Nyckeltal */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        {kpis.map(k => (
          <div key={k.label} className="st-card" style={{ padding: '12px 14px', ...(k.strong ? { borderColor: 'var(--gray-300)', boxShadow: 'var(--shadow-sm)' } : {}) }}>
            <div style={{ fontSize: '11px', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--gray-900)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Graf: timmar per vakt */}
      {chartData.length > 0 && (
        <div className="st-card" style={{ padding: '14px 16px', marginBottom: '14px' }}>
          <h3 className="st-h">Timmar per vakt</h3>
          <ResponsiveContainer width="100%" height={chartData.length * 32 + 24}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 110, left: 0, bottom: 0 }} barCategoryGap={6}>
              <CartesianGrid horizontal={false} stroke="#e5e7eb" />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={96} tickLine={false} axisLine={false} tick={{ fontSize: 13, fill: '#374151' }} />
              <Tooltip cursor={{ fill: '#f3f4f6' }} formatter={(v) => [`${v}h`, 'Timmar']} />
              <Bar dataKey="hours" name="Timmar" fill="#dc2626" radius={[0, 4, 4, 0]} maxBarSize={18}>
                <LabelList dataKey="label" position="right" style={{ fontSize: 12, fill: '#6b7280' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per vakt */}
      {personnelStatsData.length > 0 ? (
        <div className="st-card" style={{ padding: '14px 16px', marginBottom: '14px' }}>
          <h3 className="st-h">Per vakt</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="st-table">
              <thead>
                <tr>
                  <th>Namn</th>
                  <th>Vaktpass</th>
                  <th title="Antal gånger som säkerhetsansvarig (ingår i vaktpasset när vakten även jobbat)">Säkerhetsansv.</th>
                  <th>Timmar</th>
                  <th>Lön</th>
                  <th>Mil</th>
                  <th>Totalt</th>
                  <th>Snitt h</th>
                </tr>
              </thead>
              <tbody>
                {personnelStatsData.map(person => (
                  <tr key={person.name}>
                    <td><strong>{person.name}</strong></td>
                    <td>{person.matches}</td>
                    <td>{person.securityDuties || <span style={{ color: 'var(--gray-300)' }}>–</span>}</td>
                    <td>
                      {person.hours.toFixed(1)}h
                      {person.securityHours > 0 && <span style={{ color: 'var(--gray-400)', fontSize: '11px' }}> ({person.securityHours.toFixed(1)}h säk.)</span>}
                    </td>
                    <td>{kr(person.salary)}</td>
                    <td>{person.mileage > 0 ? kr(person.mileage) : <span style={{ color: 'var(--gray-300)' }}>–</span>}</td>
                    <td><strong>{kr(person.totalCompensation)}</strong></td>
                    <td>{person.shifts > 0 ? (person.hours / person.shifts).toFixed(1) : '0.0'}h</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Summa</td>
                  <td>{sum('matches')}</td>
                  <td>{sum('securityDuties')}</td>
                  <td>{sum('hours').toFixed(1)}h</td>
                  <td>{kr(sum('salary'))}</td>
                  <td>{kr(sum('mileage'))}</td>
                  <td>{kr(sum('totalCompensation'))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-400)' }}>
          Inga data matchar filtret
        </div>
      )}

      {/* Delegater */}
      {filteredDelegates.length > 0 && (
        <div className="st-card" style={{ padding: '14px 16px' }}>
          <h3 className="st-h">Delegatbesök</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="st-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th style={{ textAlign: 'left' }}>Evenemang</th>
                  <th style={{ textAlign: 'left' }}>Delegat</th>
                  <th style={{ textAlign: 'left' }}>Anteckning</th>
                  <th style={{ textAlign: 'left' }}>Delegatrapport</th>
                </tr>
              </thead>
              <tbody>
                {filteredDelegates.map(d => {
                  const match = matches.find(m => m.id === d.match_id)
                  return (
                    <tr key={d.id}>
                      <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>{d.date ? new Date(d.date).toLocaleDateString('sv-SE') : '-'}</td>
                      <td style={{ textAlign: 'left' }}>{match?.opponent || '-'}</td>
                      <td style={{ textAlign: 'left' }}>
                        <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '99px', background: '#dbeafe', color: '#1e40af', fontWeight: '600', whiteSpace: 'nowrap' }}>
                          {d.name}
                        </span>
                      </td>
                      <td style={{ textAlign: 'left', color: 'var(--gray-500)' }}>{d.notes || '-'}</td>
                      <td style={{ textAlign: 'left' }}><DelegateReportCell delegate={d} onChanged={onDelegateReportChanged} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}