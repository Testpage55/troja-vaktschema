import { useState, useMemo } from 'react'
import { REGULAR_GUARDS } from '../../constants'

// Sammanställning av hur många pass varje vakt jobbat och hur stor andel av
// matcherna det motsvarar – underlag för en rättvis fördelning.
// Ett "pass" = en tilldelning med is_working = true på en match.
// Nämnare för procent = matcher i urvalet som har minst en bemannad vakt.

const todayStr = () => new Date().toISOString().split('T')[0]

export default function FairnessTab({ matches, personnel, workHours, securityDuties = [], seasonFilter, setSeasonFilter, availableSeasons: availableSeasonsProp }) {
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')       // all | home | away
  const [periodFilter, setPeriodFilter] = useState('all')   // all | past | upcoming
  const [showAllPersonnel, setShowAllPersonnel] = useState(false)
  const [sortKey, setSortKey] = useState('shifts')          // shifts | percent | name | hours

  const availableSeasons = availableSeasonsProp || [...new Set(matches.map(m => m.season).filter(Boolean))].sort().reverse()
  const availableCategories = [...new Set(matches.map(m => m.category).filter(Boolean))].sort()

  const filteredMatches = useMemo(() => {
    const today = todayStr()
    return matches.filter(m => {
      if (seasonFilter !== 'all' && m.season !== seasonFilter) return false
      if (categoryFilter !== 'all' && (m.category || '') !== categoryFilter) return false
      if (typeFilter !== 'all' && m.match_type !== typeFilter) return false
      if (periodFilter === 'past' && m.date >= today) return false
      if (periodFilter === 'upcoming' && m.date < today) return false
      return true
    })
  }, [matches, seasonFilter, categoryFilter, typeFilter, periodFilter])

  // Bara matcher där minst en vakt är schemalagd räknas som "tillfälle"
  const staffedMatches = useMemo(
    () => filteredMatches.filter(m => (m.assignments || []).some(a => a.is_working)),
    [filteredMatches]
  )
  const totalStaffed = staffedMatches.length

  const rows = useMemo(() => {
    const staffedIds = new Set(staffedMatches.map(m => m.id))
    const list = personnel.map(p => {
      const shifts = staffedMatches.filter(m =>
        (m.assignments || []).some(a => a.personnel_id === p.id && a.is_working)
      )
      const home = shifts.filter(m => m.match_type !== 'away').length
      const away = shifts.filter(m => m.match_type === 'away').length
      // Säkerhetsansvarig: satt på matchen (följer alla filter) + manuellt inlagda uppdrag (följer säsong/period)
      const fromMatches = filteredMatches.filter(m => m.security_responsible_id === p.id).length
      const manual = securityDuties.filter(d => {
        if (d.auto || d.personnel_name !== p.name) return false
        if (seasonFilter !== 'all' && (d.season || '') !== seasonFilter) return false
        if (periodFilter === 'past' && d.date >= todayStr()) return false
        if (periodFilter === 'upcoming' && d.date < todayStr()) return false
        return true
      }).length
      const securityLeader = fromMatches + manual
      const hours = workHours
        .filter(wh => wh.personnel_id === p.id && staffedIds.has(wh.match_id))
        .reduce((t, wh) => t + (parseFloat(wh.total_hours) || 0), 0)
      return {
        id: p.id,
        name: p.name,
        isRegular: REGULAR_GUARDS.includes(p.name),
        shifts: shifts.length,
        home,
        away,
        securityLeader,
        hours,
        percent: totalStaffed > 0 ? (shifts.length / totalStaffed) * 100 : 0,
      }
    }).filter(r => showAllPersonnel || r.isRegular || r.shifts > 0)

    // Jämförelse mot snittet bland ordinarie vakter (de som delar på grundpassen)
    const regulars = list.filter(r => r.isRegular)
    const avg = regulars.length > 0 ? regulars.reduce((t, r) => t + r.shifts, 0) / regulars.length : 0

    const sorted = list.map(r => ({ ...r, diff: r.shifts - avg })).sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'sv-SE')
      if (sortKey === 'percent') return b.percent - a.percent || a.name.localeCompare(b.name, 'sv-SE')
      if (sortKey === 'hours') return b.hours - a.hours || a.name.localeCompare(b.name, 'sv-SE')
      return b.shifts - a.shifts || a.name.localeCompare(b.name, 'sv-SE')
    })
    return { list: sorted, avg }
  }, [personnel, staffedMatches, filteredMatches, workHours, securityDuties, seasonFilter, periodFilter, totalStaffed, showAllPersonnel, sortKey])

  const maxShifts = Math.max(1, ...rows.list.map(r => r.shifts))
  const hasFilter = seasonFilter !== 'all' || categoryFilter !== 'all' || typeFilter !== 'all' || periodFilter !== 'all'

  const diffLabel = (d) => {
    const v = Math.round(d * 10) / 10
    if (Math.abs(v) < 0.5) return { text: '± 0', color: 'var(--gray-500)' }
    return v > 0
      ? { text: `+${v.toLocaleString('sv-SE')}`, color: '#b45309' }
      : { text: `${v.toLocaleString('sv-SE')}`, color: '#047857' }
  }

  const exportCsv = () => {
    const header = ['Namn', 'Pass', 'Andel av matcher (%)', 'Hemma', 'Borta', 'Säkerhetsansvarig', 'Timmar', 'Avvikelse mot snitt']
    const lines = rows.list.map(r => [
      r.name, r.shifts, r.percent.toFixed(1).replace('.', ','), r.home, r.away, r.securityLeader,
      r.hours.toFixed(1).replace('.', ','), r.diff.toFixed(1).replace('.', ',')
    ].join(';'))
    const csv = '﻿' + [header.join(';'), ...lines].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `rattvisa_${seasonFilter}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="tab-content">
      {/* Filter */}
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
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="filter-select">
          <option value="all">Hemma + borta</option>
          <option value="home">Endast hemma</option>
          <option value="away">Endast borta</option>
        </select>
        <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} className="filter-select">
          <option value="all">Alla matcher</option>
          <option value="past">Genomförda</option>
          <option value="upcoming">Kommande</option>
        </select>
        <select value={sortKey} onChange={e => setSortKey(e.target.value)} className="filter-select">
          <option value="shifts">Sortera: flest pass</option>
          <option value="percent">Sortera: högst andel</option>
          <option value="hours">Sortera: flest timmar</option>
          <option value="name">Sortera: namn</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--gray-500)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showAllPersonnel} onChange={e => setShowAllPersonnel(e.target.checked)} />
          Visa all personal
        </label>
        {hasFilter && (
          <button
            onClick={() => { setSeasonFilter('all'); setCategoryFilter('all'); setTypeFilter('all'); setPeriodFilter('all') }}
            style={{ fontSize: '12px', color: 'var(--gray-500)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Rensa filter
          </button>
        )}
        <button onClick={exportCsv} className="btn btn-small" style={{ marginLeft: 'auto' }} disabled={rows.list.length === 0}>
          Exportera CSV
        </button>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Bemannade matcher', value: totalStaffed, sub: `av ${filteredMatches.length} i urvalet`, bg: '#4f46e5' },
          { label: 'Snitt pass / ordinarie vakt', value: rows.avg.toLocaleString('sv-SE', { maximumFractionDigits: 1 }), sub: `${rows.list.filter(r => r.isRegular).length} ordinarie vakter`, bg: '#0891b2' },
          { label: 'Snitt andel', value: totalStaffed > 0 ? `${((rows.avg / totalStaffed) * 100).toFixed(0)}%` : '–', sub: 'av bemannade matcher', bg: '#16a34a' },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: kpi.bg, color: 'white', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{kpi.label}</div>
            <div style={{ fontSize: '28px', fontWeight: '700' }}>{kpi.value}</div>
            {kpi.sub && <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>{kpi.sub}</div>}
          </div>
        ))}
      </div>

      {/* Tabell */}
      {rows.list.length > 0 && totalStaffed > 0 ? (
        <div className="personnel-stats-table">
          <h3>Fördelning per vakt</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Namn</th>
                  <th>Pass</th>
                  <th style={{ minWidth: '180px' }}>Andel av matcher</th>
                  <th>Hemma</th>
                  <th>Borta</th>
                  <th>Säkerhetsansvarig</th>
                  <th>Timmar</th>
                  <th title="Jämfört med snittet bland ordinarie vakter">Mot snitt</th>
                </tr>
              </thead>
              <tbody>
                {rows.list.map(r => {
                  const d = diffLabel(r.diff)
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.name}</strong>
                        {!r.isRegular && <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--gray-400)' }}>extra</span>}
                      </td>
                      <td className="text-center"><span className="stat-badge">{r.shifts}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '8px', background: 'var(--gray-200)', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ width: `${(r.shifts / maxShifts) * 100}%`, height: '100%', background: r.isRegular ? '#16a34a' : '#9ca3af', borderRadius: '99px' }} />
                          </div>
                          <strong style={{ minWidth: '44px', textAlign: 'right' }}>{r.percent.toFixed(0)}%</strong>
                        </div>
                      </td>
                      <td className="text-center">{r.home}</td>
                      <td className="text-center">{r.away}</td>
                      <td className="text-center">
                        {r.securityLeader > 0
                          ? <span className="stat-badge" style={{ background: '#dbeafe', color: '#1e40af' }}>{r.securityLeader}</span>
                          : <span style={{ color: 'var(--gray-400)' }}>–</span>}
                      </td>
                      <td className="text-center">{r.hours.toFixed(1)}h</td>
                      <td className="text-center"><strong style={{ color: d.color }}>{d.text}</strong></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '10px' }}>
            Andel = pass / bemannade matcher i urvalet ({totalStaffed}). "Mot snitt" jämför med ordinarie vakter:
            plus = fler pass än snittet, minus = färre.
          </p>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-400)' }}>
          Inga bemannade matcher matchar filtret
        </div>
      )}
    </div>
  )
}