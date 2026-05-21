import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { HOURLY_RATE, MILEAGE_RATE } from '../../constants'

export default function StatsTab({ matches, workHours, securityDuties, personnel, delegates }) {
  const [seasonFilter, setSeasonFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const availableSeasons = [...new Set(matches.map(m => m.season).filter(Boolean))].sort()
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
    return true
  }), [securityDuties, fromDate, toDate])

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
  const totalShifts = filteredWorkHours.length + filteredSecurityDuties.length

  const hasFilter = seasonFilter !== 'all' || categoryFilter !== 'all' || fromDate || toDate

  return (
    <div className="tab-content">

      {/* Filterrad */}
      <div style={{ background: 'white', borderRadius: '10px', padding: '14px 20px', marginBottom: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
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
        <input
          type="date" value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          style={{ padding: '8px 10px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '14px' }}
        />
        <span style={{ color: 'var(--gray-400)' }}>–</span>
        <input
          type="date" value={toDate}
          onChange={e => setToDate(e.target.value)}
          style={{ padding: '8px 10px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '14px' }}
        />
        {hasFilter && (
          <button
            onClick={() => { setSeasonFilter('all'); setCategoryFilter('all'); setFromDate(''); setToDate('') }}
            style={{ fontSize: '12px', color: 'var(--gray-500)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Rensa filter
          </button>
        )}
      </div>

      {/* Huvud-KPIer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Evenemang', value: totalEvents, sub: null, bg: '#4f46e5' },
          { label: 'Arbetstillfällen', value: totalShifts, sub: `${filteredWorkHours.length} vakt + ${filteredSecurityDuties.length} säkerhet`, bg: '#db2777' },
          { label: 'Totala timmar', value: `${totalAllHours.toFixed(1)}h`, sub: totalShifts > 0 ? `Snitt ${(totalAllHours / totalShifts).toFixed(1)}h/tillfälle` : null, bg: '#0891b2' },
          { label: 'Total kostnad', value: `${totalCompensation.toLocaleString('sv-SE')} kr`, sub: `Lön ${totalSalary.toLocaleString('sv-SE')} kr`, bg: '#dc2626' },
          { label: 'Delegatbesök', value: filteredDelegates.length, sub: uniqueDelegateNames.length > 0 ? `${uniqueDelegateNames.length} unika` : null, bg: '#2563eb' },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: kpi.bg, color: 'white', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{kpi.label}</div>
            <div style={{ fontSize: '28px', fontWeight: '700' }}>{kpi.value}</div>
            {kpi.sub && <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>{kpi.sub}</div>}
          </div>
        ))}
      </div>

      {/* Graf */}
      {personnelStatsData.length > 0 && (
        <div className="chart-container" style={{ marginBottom: '24px' }}>
          <h3>Tillfällen och timmar per vakt</h3>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={personnelStatsData} margin={{ top: 10, right: 20, left: 0, bottom: 70 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-40} textAnchor="end" interval={0} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="matches" name="Tillfällen" fill="#16a34a" />
              <Bar dataKey="hours" name="Timmar" fill="#dc2626" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detaljerad tabell */}
      {personnelStatsData.length > 0 ? (
        <div className="personnel-stats-table">
          <h3>Per vakt</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Namn</th>
                  <th>Vaktpass</th>
                  <th>Säkerhetsuppdrag</th>
                  <th>Totala timmar</th>
                  <th>Lön</th>
                  <th>Milersättning</th>
                  <th>Total ersättning</th>
                  <th>Snitt h/tillfälle</th>
                </tr>
              </thead>
              <tbody>
                {personnelStatsData.map(person => (
                  <tr key={person.name}>
                    <td><strong>{person.name}</strong></td>
                    <td className="text-center"><span className="stat-badge">{person.matches}</span></td>
                    <td className="text-center"><span className="stat-badge">{person.securityDuties}</span></td>
                    <td className="text-center">
                      <strong>{person.hours.toFixed(1)}h</strong>
                      {person.securityHours > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>({person.securityHours.toFixed(1)}h säkerhet)</div>
                      )}
                    </td>
                    <td className="text-center"><strong>{person.salary.toLocaleString('sv-SE')} kr</strong></td>
                    <td className="text-center"><strong>{person.mileage.toLocaleString('sv-SE')} kr</strong></td>
                    <td className="text-center"><strong className="total-compensation">{person.totalCompensation.toLocaleString('sv-SE')} kr</strong></td>
                    <td className="text-center">
                      {(person.matches + person.securityDuties) > 0
                        ? (person.hours / (person.matches + person.securityDuties)).toFixed(1)
                        : 0}h
                    </td>
                  </tr>
                ))}
              </tbody>
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
        <div style={{ marginTop: '24px' }}>
          <h3>Delegatbesök</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Evenemang</th>
                  <th>Delegat</th>
                  <th>Anteckning</th>
                </tr>
              </thead>
              <tbody>
                {filteredDelegates.map(d => {
                  const match = matches.find(m => m.id === d.match_id)
                  return (
                    <tr key={d.id}>
                      <td>{d.date ? new Date(d.date).toLocaleDateString('sv-SE') : '-'}</td>
                      <td>{match?.opponent || '-'}</td>
                      <td>
                        <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '99px', background: '#dbeafe', color: '#1e40af', fontWeight: '600' }}>
                          {d.name}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--gray-500)' }}>{d.notes || '-'}</td>
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