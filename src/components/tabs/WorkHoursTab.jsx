import { useState } from 'react'
import { HOURLY_RATE } from '../../constants'

function exportToCSV(entries, fromDate, toDate) {
  const headers = 'Datum,Evenemang,Personal,Typ,Starttid,Sluttid,Timmar,Lön (kr),Milersättning (kr),Anteckningar\n'

  const rows = entries.map(e => {
    const date = e.type === 'work'
      ? (e.work_date || e.matches?.date || '')
      : e.date
    const opponent = e.type === 'work' ? (e.matches?.opponent || '') : e.opponent
    const name = e.type === 'work' ? (e.personnel?.name || '') : e.personnel_name
    const type = e.type === 'work' ? 'Vakt' : 'Säkerhetsansvarig'
    const start = e.type === 'work' ? (e.start_time || '') : '-'
    const end = e.type === 'work' ? (e.end_time || '') : '-'
    const hours = e.type === 'work' ? (e.total_hours || 0) : e.hours
    const salary = (hours * HOURLY_RATE).toFixed(2)
    const mileage = e.type === 'security' ? (e.mileage_compensation || 0) : 0
    const notes = (e.type === 'work' ? e.notes : e.notes) || ''

    return `${date},"${opponent}","${name}",${type},${start},${end},${hours},${salary},${mileage},"${notes}"`
  }).join('\n')

  const filename = fromDate || toDate
    ? `loneunderlag_${fromDate || 'start'}_${toDate || 'slut'}.csv`
    : 'loneunderlag_alla.csv'

  const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export default function WorkHoursTab({ workHours, securityDuties, allWorkEntries, saving, seasonFilter: seasonFilterProp, setSeasonFilter: setSeasonFilterProp, availableSeasons: availableSeasonsProp }) {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [personnelFilter, setPersonnelFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [localSeasonFilter, setLocalSeasonFilter] = useState(seasonFilterProp || 'all')
  const seasonFilter = seasonFilterProp !== undefined ? seasonFilterProp : localSeasonFilter
  const setSeasonFilter = setSeasonFilterProp || setLocalSeasonFilter

  const allPersonnel = [...new Set([
    ...workHours.map(wh => wh.personnel?.name),
    ...securityDuties.map(d => d.personnel_name)
  ].filter(Boolean))].sort()

  const availableSeasons = [...new Set(
    workHours.map(wh => wh.matches?.season).filter(Boolean)
  )].sort()

  const filtered = allWorkEntries.filter(e => {
    const date = e.type === 'work'
      ? (e.work_date || e.matches?.date || '')
      : e.date
    const name = e.type === 'work' ? e.personnel?.name : e.personnel_name
    const season = e.type === 'work' ? e.matches?.season : null

    if (fromDate && date < fromDate) return false
    if (toDate && date > toDate) return false
    if (typeFilter !== 'all' && e.type !== typeFilter) return false
    if (personnelFilter !== 'all' && name !== personnelFilter) return false
    if (seasonFilter !== 'all' && season !== seasonFilter) return false
    return true
  })

  const totalHours = filtered.reduce((t, e) => t + (e.type === 'work' ? (e.total_hours || 0) : e.hours), 0)
  const totalSalary = totalHours * HOURLY_RATE
  const totalMileage = filtered.filter(e => e.type === 'security').reduce((t, e) => t + (e.mileage_compensation || 0), 0)
  const hasFilter = fromDate || toDate || personnelFilter !== 'all' || typeFilter !== 'all' || seasonFilter !== 'all'

  return (
    <div className="tab-content">

      {/* Filterrad */}
      <div style={{ background: 'white', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '14px' }}
          />
          <span style={{ color: 'var(--gray-400)' }}>–</span>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '14px' }}
          />
          <select value={personnelFilter} onChange={e => setPersonnelFilter(e.target.value)} className="filter-select">
            <option value="all">All personal</option>
            {allPersonnel.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="filter-select">
            <option value="all">Alla typer</option>
            <option value="work">Vakt</option>
            <option value="security">Säkerhetsansvarig</option>
          </select>
          {availableSeasons.length > 0 && (
            <select value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)} className="filter-select">
              <option value="all">Alla säsonger</option>
              {availableSeasons.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {hasFilter && (
            <button
              onClick={() => { setFromDate(''); setToDate(''); setPersonnelFilter('all'); setTypeFilter('all'); setSeasonFilter('all') }}
              style={{ fontSize: '12px', color: 'var(--gray-500)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Rensa filter
            </button>
          )}
        </div>

        {/* Summering + exportknapp */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: 'var(--gray-600)' }}>
              <strong>{filtered.length}</strong> pass
            </span>
            <span style={{ fontSize: '13px', color: 'var(--gray-600)' }}>
              <strong>{totalHours.toFixed(1)}h</strong>
            </span>
            <span style={{ fontSize: '13px', color: 'var(--gray-600)' }}>
              <strong>{totalSalary.toLocaleString('sv-SE')} kr</strong> lön
            </span>
            {totalMileage > 0 && (
              <span style={{ fontSize: '13px', color: 'var(--gray-600)' }}>
                <strong>{totalMileage.toLocaleString('sv-SE')} kr</strong> mil
              </span>
            )}
          </div>
          <button
            className="btn btn-success"
            onClick={() => exportToCSV(filtered, fromDate, toDate)}
            disabled={saving || filtered.length === 0}
          >
            Exportera löneunderlag ({filtered.length} rader)
          </button>
        </div>
      </div>

      {/* Tabell */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Evenemang</th>
              <th>Personal</th>
              <th>Typ</th>
              <th>Starttid</th>
              <th>Sluttid</th>
              <th>Timmar</th>
              <th>Lön</th>
              <th>Anteckningar</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(entry => {
              const date = entry.type === 'work'
                ? (entry.work_date || entry.matches?.date)
                : entry.date
              const hours = entry.type === 'work' ? entry.total_hours : entry.hours
              const salary = (hours * HOURLY_RATE).toLocaleString('sv-SE')

              return (
                <tr key={`${entry.type}-${entry.id}`}>
                  <td>{new Date(date).toLocaleDateString('sv-SE')}</td>
                  <td>{entry.type === 'work' ? entry.matches?.opponent : entry.opponent}</td>
                  <td>{entry.type === 'work' ? entry.personnel?.name : entry.personnel_name}</td>
                  <td>
                    <span className={`badge ${entry.type === 'work' ? 'badge-success' : 'badge-warning'}`}>
                      {entry.type === 'work' ? 'Vakt' : 'Säkerhet'}
                    </span>
                  </td>
                  <td>{entry.type === 'work' ? entry.start_time : '-'}</td>
                  <td>{entry.type === 'work' ? entry.end_time : '-'}</td>
                  <td><strong>{hours}h</strong></td>
                  <td><strong>{salary} kr</strong></td>
                  <td style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{entry.notes || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}