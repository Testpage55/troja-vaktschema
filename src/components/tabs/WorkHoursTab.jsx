import { useState } from 'react'
import { HOURLY_RATE, MEAL_DEDUCTION_HOURS, MILEAGE_RATE } from '../../constants'
import { calcPayroll } from '../../utils/timeUtils'

// Löneberäkning per rad: sluttid uppåt till halvtimme, sedan matavdrag.
// Säkerhetsuppdrag saknar klockslag – där dras bara matavdraget (0 h stannar på 0 h).
function getPay(e) {
  if (e.type === 'work') {
    const p = calcPayroll(e.start_time, e.end_time)
    if (p) return p
    const h = e.total_hours || 0
    return { roundedEnd: '-', grossHours: h, deduction: MEAL_DEDUCTION_HOURS, payHours: Math.max(0, h - MEAL_DEDUCTION_HOURS) }
  }
  const h = e.hours || 0
  if (h <= 0) return { roundedEnd: '-', grossHours: 0, deduction: 0, payHours: 0 }
  return { roundedEnd: '-', grossHours: h, deduction: MEAL_DEDUCTION_HOURS, payHours: Math.max(0, h - MEAL_DEDUCTION_HOURS) }
}

// Milersättning för resa till jobbet: tur/retur × mil × 25 kr, per vaktpass, för vakter markerade
// "Får milersättning". Säkerhetsuppdrag får ingen (de hör till ett vaktpass eller ersätts separat).
function commuteMileage(e, personById, personByName) {
  if (e.type !== 'work') return 0
  const person = personById[e.personnel_id] || personByName[e.personnel?.name]
  if (!person?.gets_mileage) return 0
  return (parseFloat(person.commute_miles) || 0) * 2 * MILEAGE_RATE
}

// Bruttolön, milersättning och brutto minus milersättning för en rad
function getMoney(e, personById, personByName) {
  const brutto = getPay(e).payHours * HOURLY_RATE
  const mileage = commuteMileage(e, personById, personByName)
  return { brutto, mileage, net: brutto - mileage }
}

const entryName = (e) => (e.type === 'work' ? (e.personnel?.name || '') : (e.personnel_name || ''))
// Ersättning för bortamatch (säkerhetsansvarig) – redovisas separat, dras inte från bruttolönen
const awayCompensation = (e) => (e.type === 'security' ? (e.mileage_compensation || 0) : 0)

function download(csv, filename) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function summarizeByPerson(entries, personById, personByName) {
  const map = {}
  entries.forEach(e => {
    const name = entryName(e) || 'Okänd'
    const p = getPay(e)
    if (!map[name]) map[name] = { name, shifts: 0, gross: 0, deduction: 0, payHours: 0, brutto: 0, mileage: 0, net: 0, away: 0 }
    const m = getMoney(e, personById, personByName)
    map[name].shifts += 1
    map[name].gross += p.grossHours
    map[name].deduction += p.deduction
    map[name].payHours += p.payHours
    map[name].brutto += m.brutto
    map[name].mileage += m.mileage
    map[name].net += m.net
    map[name].away += awayCompensation(e)
  })
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name, 'sv-SE'))
}

const n2 = (v) => v.toFixed(2)

function exportToCSV(entries, fromDate, toDate, personById, personByName) {
  const headers = 'Datum,Evenemang,Personal,Typ,Starttid,Sluttid,Avrundad sluttid,Timmar (avrundade),Matavdrag (h),Lönetimmar,Bruttolön (kr),Milersättning (kr),Brutto minus milersättning (kr),Ersättning bortamatch (kr),Anteckningar\n'

  const rows = entries.map(e => {
    const date = e.type === 'work' ? (e.work_date || e.matches?.date || '') : e.date
    const opponent = e.type === 'work' ? (e.matches?.opponent || '') : e.opponent
    const type = e.type === 'work' ? 'Vakt' : 'Säkerhetsansvarig'
    const start = e.type === 'work' ? (e.start_time || '') : '-'
    const end = e.type === 'work' ? (e.end_time || '') : '-'
    const p = getPay(e)
    const m = getMoney(e, personById, personByName)
    return `${date},"${opponent}","${entryName(e)}",${type},${start},${end},${p.roundedEnd},${p.grossHours},${p.deduction},${p.payHours},${n2(m.brutto)},${n2(m.mileage)},${n2(m.net)},${awayCompensation(e)},"${e.notes || ''}"`
  }).join('\n')

  const suffix = fromDate || toDate ? `${fromDate || 'start'}_${toDate || 'slut'}` : 'alla'
  download(headers + rows, `loneunderlag_${suffix}.csv`)
}

function exportSummaryCSV(entries, fromDate, toDate, personById, personByName) {
  const headers = 'Personal,Antal pass,Timmar (avrundade),Matavdrag (h),Lönetimmar,Bruttolön (kr),Milersättning (kr),Brutto minus milersättning (kr),Ersättning bortamatch (kr)\n'
  const rows = summarizeByPerson(entries, personById, personByName).map(r =>
    `"${r.name}",${r.shifts},${r.gross},${r.deduction},${r.payHours},${n2(r.brutto)},${n2(r.mileage)},${n2(r.net)},${r.away}`
  ).join('\n')
  const suffix = fromDate || toDate ? `${fromDate || 'start'}_${toDate || 'slut'}` : 'alla'
  download(headers + rows, `lon_summering_per_person_${suffix}.csv`)
}

export default function WorkHoursTab({ personnel = [], workHours, securityDuties, allWorkEntries, saving, seasonFilter: seasonFilterProp, setSeasonFilter: setSeasonFilterProp, availableSeasons: availableSeasonsProp }) {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [personnelFilter, setPersonnelFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [localSeasonFilter, setLocalSeasonFilter] = useState(seasonFilterProp || 'all')
  const seasonFilter = seasonFilterProp !== undefined ? seasonFilterProp : localSeasonFilter
  const setSeasonFilter = setSeasonFilterProp || setLocalSeasonFilter

  const personById = Object.fromEntries(personnel.map(p => [p.id, p]))
  const personByName = Object.fromEntries(personnel.map(p => [p.name, p]))

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

  const totalHours = filtered.reduce((t, e) => t + getPay(e).payHours, 0)
  const totalSalary = totalHours * HOURLY_RATE
  const summary = summarizeByPerson(filtered, personById, personByName)
  const totalMileage = summary.reduce((t, r) => t + r.mileage, 0)
  const totalNet = summary.reduce((t, r) => t + r.net, 0)
  const missingMiles = personnel.filter(p => p.gets_mileage && !(parseFloat(p.commute_miles) > 0)).map(p => p.name)
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
              <strong>{totalHours.toFixed(1)}h</strong> lönetimmar
            </span>
            <span style={{ fontSize: '13px', color: 'var(--gray-600)' }}>
              <strong>{totalSalary.toLocaleString('sv-SE')} kr</strong> bruttolön
            </span>
            {totalMileage > 0 && (
              <>
                <span style={{ fontSize: '13px', color: 'var(--gray-600)' }}>
                  <strong>−{totalMileage.toLocaleString('sv-SE')} kr</strong> milersättning
                </span>
                <span style={{ fontSize: '13px', color: 'var(--gray-600)' }}>
                  <strong>{totalNet.toLocaleString('sv-SE')} kr</strong> brutto minus milersättning
                </span>
              </>
            )}
          </div>
          <button
            className="btn btn-success"
            onClick={() => exportToCSV(filtered, fromDate, toDate, personById, personByName)}
            disabled={saving || filtered.length === 0}
          >
            Exportera löneunderlag ({filtered.length} rader)
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => exportSummaryCSV(filtered, fromDate, toDate, personById, personByName)}
            disabled={saving || filtered.length === 0}
          >
            Exportera summering per person
          </button>
        </div>
      </div>

      <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '12px' }}>
        Löneberäkning: sluttiden rundas upp till närmaste halvtimme, därefter dras matavdrag på {MEAL_DEDUCTION_HOURS * 60} min per pass.
        Milersättning (tur/retur × mil × {MILEAGE_RATE} kr, per vaktpass) dras från bruttolönen för vakter som är markerade "Får milersättning".
      </div>
      {missingMiles.length > 0 && (
        <div style={{ fontSize: '13px', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px' }}>
          ⚠ Saknar antal mil (räknas som 0): {missingMiles.join(', ')}
        </div>
      )}

      {summary.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3>Summering per person</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Personal</th>
                  <th>Pass</th>
                  <th>Timmar (avrundade)</th>
                  <th>Matavdrag</th>
                  <th>Lönetimmar</th>
                  <th>Bruttolön</th>
                  <th>Milersättning</th>
                  <th>Brutto − milersättning</th>
                </tr>
              </thead>
              <tbody>
                {summary.map(r => (
                  <tr key={r.name}>
                    <td><strong>{r.name}</strong></td>
                    <td className="text-center">{r.shifts}</td>
                    <td className="text-center">{r.gross.toFixed(1)}h</td>
                    <td className="text-center">−{r.deduction.toFixed(1)}h</td>
                    <td className="text-center"><strong>{r.payHours.toFixed(1)}h</strong></td>
                    <td className="text-center">{r.brutto.toLocaleString('sv-SE')} kr</td>
                    <td className="text-center">{r.mileage > 0 ? `−${r.mileage.toLocaleString('sv-SE')} kr` : '-'}</td>
                    <td className="text-center"><strong>{r.net.toLocaleString('sv-SE')} kr</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              <th>Avrundad sluttid</th>
              <th>Timmar (avrundade)</th>
              <th>Matavdrag</th>
              <th>Lönetimmar</th>
              <th>Bruttolön</th>
              <th>Milersättning</th>
              <th>Brutto − milersättning</th>
              <th>Anteckningar</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(entry => {
              const date = entry.type === 'work'
                ? (entry.work_date || entry.matches?.date)
                : entry.date
              const pay = getPay(entry)
              const money = getMoney(entry, personById, personByName)

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
                  <td>{pay.roundedEnd}</td>
                  <td>{pay.grossHours.toFixed(1)}h</td>
                  <td>{pay.deduction > 0 ? `−${pay.deduction.toFixed(1)}h` : '-'}</td>
                  <td><strong>{pay.payHours.toFixed(1)}h</strong></td>
                  <td>{money.brutto.toLocaleString('sv-SE')} kr</td>
                  <td>{money.mileage > 0 ? `−${money.mileage.toLocaleString('sv-SE')} kr` : '-'}</td>
                  <td><strong>{money.net.toLocaleString('sv-SE')} kr</strong></td>
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