import { useState } from 'react'
import { HOURLY_RATE } from '../../constants'

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function PersonDetailModal({ person, workHours, securityDuties, onClose, onExport, onDelete, isRegular, saving }) {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [seasonFilter, setSeasonFilter] = useState('all')

  const personWorkHours = workHours.filter(wh => wh.personnel_id === person.id)
  const personSecurityDuties = securityDuties.filter(d => d.personnel_name === person.name)

  const allEntries = [
    ...personWorkHours.map(wh => ({
      id: `work-${wh.id}`,
      type: 'work',
      date: wh.work_date || wh.matches?.date || '',
      opponent: wh.matches?.opponent || '-',
      startTime: wh.start_time,
      endTime: wh.end_time,
      hours: wh.total_hours || 0,
      mileage: 0,
      notes: wh.notes || '',
      season: wh.matches?.season || '',
    })),
    ...personSecurityDuties.map(d => ({
      id: `sec-${d.id}`,
      type: 'security',
      date: d.date,
      opponent: d.opponent || '-',
      startTime: '-',
      endTime: '-',
      hours: d.hours,
      mileage: d.mileage_compensation || 0,
      notes: d.notes || '',
      season: '',
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date))

  const availableSeasons = [...new Set(allEntries.map(e => e.season).filter(Boolean))]

  const filtered = allEntries.filter(e => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false
    if (seasonFilter !== 'all' && e.season !== seasonFilter) return false
    if (fromDate && e.date < fromDate) return false
    if (toDate && e.date > toDate) return false
    return true
  })

  const totalHours = filtered.reduce((t, e) => t + e.hours, 0)
  const totalSalary = totalHours * HOURLY_RATE
  const totalMileage = filtered.reduce((t, e) => t + e.mileage, 0)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '16px',
          width: '100%', maxWidth: '700px',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--gray-100)',
          display: 'flex', alignItems: 'center', gap: '16px'
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: '#16a34a', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', fontWeight: '700', flexShrink: 0
          }}>
            {getInitials(person.name)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--gray-900)' }}>{person.name}</div>
            <div style={{ fontSize: '13px', color: 'var(--gray-500)' }}>{isRegular ? 'Ordinarie vakt' : 'Extra vakt'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--gray-500)' }}>×</button>
        </div>

        {/* Statistik-chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '16px 24px', borderBottom: '1px solid var(--gray-100)' }}>
          {[
            { label: 'Tillfällen', value: filtered.length },
            { label: 'Totala timmar', value: `${totalHours.toFixed(1)}h` },
            { label: 'Total lön', value: `${totalSalary.toLocaleString('sv-SE')} kr` },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'var(--gray-50)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{stat.label}</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--gray-900)' }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--gray-100)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="filter-select" style={{ fontSize: '13px' }}>
            <option value="all">Alla pass</option>
            <option value="work">Vaktpass</option>
            <option value="security">Säkerhetsansvarig</option>
          </select>
          {availableSeasons.length > 0 && (
            <select value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)} className="filter-select" style={{ fontSize: '13px' }}>
              <option value="all">Alla säsonger</option>
              {availableSeasons.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--gray-200)', borderRadius: '6px', fontSize: '13px' }} />
          <span style={{ color: 'var(--gray-400)', fontSize: '13px' }}>–</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--gray-200)', borderRadius: '6px', fontSize: '13px' }} />
          {(fromDate || toDate || typeFilter !== 'all' || seasonFilter !== 'all') && (
            <button onClick={() => { setFromDate(''); setToDate(''); setTypeFilter('all'); setSeasonFilter('all') }} style={{ fontSize: '12px', color: 'var(--gray-500)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Rensa filter
            </button>
          )}
        </div>

        {/* Summering av filtrerat */}
        {(fromDate || toDate || typeFilter !== 'all') && filtered.length > 0 && (
          <div style={{ padding: '8px 24px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', fontSize: '13px', color: '#15803d' }}>
            {filtered.length} pass • {totalHours.toFixed(1)}h • {totalSalary.toLocaleString('sv-SE')} kr lön
            {totalMileage > 0 && ` • ${totalMileage.toLocaleString('sv-SE')} kr mil`}
          </div>
        )}

        {/* Passlista */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-400)', fontSize: '14px' }}>
              Inga pass matchar filtret
            </div>
          ) : (
            filtered.map(entry => (
              <div
                key={entry.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '12px 24px',
                  borderBottom: '1px solid var(--gray-100)'
                }}
              >
                <div style={{ minWidth: '80px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--gray-900)' }}>
                    {new Date(entry.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>
                    {new Date(entry.date).getFullYear()}
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--gray-900)' }}>{entry.opponent}</div>
                  <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                    {entry.type === 'work'
                      ? `${entry.startTime} – ${entry.endTime}`
                      : 'Säkerhetsansvarig'}
                    {entry.notes && ` • ${entry.notes}`}
                  </div>
                </div>

                <div style={{ textAlign: 'right', minWidth: '60px' }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--gray-900)' }}>{entry.hours}h</div>
                  <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                    {(entry.hours * HOURLY_RATE).toLocaleString('sv-SE')} kr
                  </div>
                </div>

                <span style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '99px', whiteSpace: 'nowrap',
                  background: entry.type === 'work' ? '#dcfce7' : '#fef3c7',
                  color: entry.type === 'work' ? '#15803d' : '#92400e'
                }}>
                  {entry.type === 'work' ? 'Vakt' : 'Säkerhet'}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--gray-100)', display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-sm btn-success"
              onClick={() => onExport(person.id)}
              disabled={saving}
            >
              Exportera CSV
            </button>
            {!isRegular && (
              <button
                className="btn btn-sm btn-danger"
                onClick={() => { onDelete(person.id, person.name); onClose() }}
                disabled={saving}
              >
                Ta bort
              </button>
            )}
          </div>
          <button className="btn btn-secondary" onClick={onClose}>Stäng</button>
        </div>
      </div>
    </div>
  )
}

function PersonCard({ person, totalHours, securityHours, isRegular, lastShift, shiftCount, onToggleSecurityRole, onClick }) {
  const total = typeof totalHours === 'number' ? totalHours : parseFloat(totalHours)

  return (
    <div
      style={{
        background: 'white', borderRadius: '12px',
        border: `1px solid ${person.is_security_responsible ? '#bfdbfe' : 'var(--gray-200)'}`,
        padding: '16px', cursor: 'pointer',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        display: 'flex', alignItems: 'center', gap: '14px'
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      <div
        onClick={onClick}
        style={{
          width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
          background: person.is_security_responsible ? '#2563eb' : (isRegular ? '#16a34a' : 'var(--gray-300)'),
          color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', fontWeight: '700', cursor: 'pointer'
        }}
      >
        {getInitials(person.name)}
      </div>
      <div style={{ flex: 1 }} onClick={onClick}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--gray-900)' }}>{person.name}</div>
          {person.is_security_responsible && (
            <span style={{ fontSize: '10px', color: '#1e40af', background: '#dbeafe', padding: '1px 7px', borderRadius: '99px', fontWeight: '600' }}>
              Säkerhetsansvarig
            </span>
          )}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '2px' }}>
          {lastShift
            ? `Senaste pass: ${new Date(lastShift).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })}`
            : shiftCount !== null
            ? `${shiftCount} pass totalt`
            : isRegular ? 'Ordinarie' : 'Extra'}
        </div>
      </div>
      <div style={{ textAlign: 'right' }} onClick={onClick}>
        <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--gray-900)' }}>{(isNaN(total) ? 0 : total).toFixed(1)}h</div>
        <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{((isNaN(total) ? 0 : total) * HOURLY_RATE).toLocaleString('sv-SE')} kr</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
        <button
          onClick={e => { e.stopPropagation(); onToggleSecurityRole(person.id, !person.is_security_responsible) }}
          title={person.is_security_responsible ? 'Ta bort säkerhetsansvarig-roll' : 'Markera som säkerhetsansvarig'}
          style={{
            width: '28px', height: '28px', borderRadius: '50%', border: 'none',
            background: person.is_security_responsible ? '#2563eb' : 'var(--gray-100)',
            color: person.is_security_responsible ? 'white' : 'var(--gray-400)',
            cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          🛡
        </button>
        <div style={{ color: 'var(--gray-300)', fontSize: '18px', cursor: 'pointer' }} onClick={onClick}>›</div>
      </div>
    </div>
  )
}

export default function PersonnelTab({
  regularPersonnel, extraPersonnel,
  workHours, securityDuties,
  availableSeasons,
  getTotalHoursForPerson, getSecurityHoursForPerson, getTotalAllHoursForPerson,
  addPersonnel, deletePersonnel, exportWorkHours,
  updatePersonnelRole,
  saving
}) {
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [seasonFilter, setSeasonFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const getLastShiftDate = (person) => {
    const entries = workHours
      .filter(wh => wh.personnel_id === person.id)
      .map(wh => wh.work_date || wh.matches?.date || '')
      .filter(Boolean)
      .sort()
    return entries[entries.length - 1] || ''
  }

  const getPersonSeasons = (person) =>
    [...new Set(workHours.filter(wh => wh.personnel_id === person.id).map(wh => wh.matches?.season).filter(Boolean))]

  const getFilteredWorkHours = (person) =>
    workHours.filter(wh => {
      if (wh.personnel_id !== person.id) return false
      const date = wh.work_date || wh.matches?.date || ''
      if (fromDate && date < fromDate) return false
      if (toDate && date > toDate) return false
      if (seasonFilter !== 'all' && wh.matches?.season !== seasonFilter) return false
      return true
    })

  const getFilteredSecurityDuties = (person) =>
    securityDuties.filter(d => {
      if (d.personnel_name !== person.name) return false
      if (fromDate && d.date < fromDate) return false
      if (toDate && d.date > toDate) return false
      return true
    })

  const getShiftCount = (person) =>
    getFilteredWorkHours(person).length + getFilteredSecurityDuties(person).length

  const getFilteredHours = (person) =>
    getFilteredWorkHours(person).reduce((t, wh) => t + (wh.total_hours || 0), 0) +
    getFilteredSecurityDuties(person).reduce((t, d) => t + d.hours, 0)

  const allPersonnel = [...regularPersonnel, ...extraPersonnel]
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p => seasonFilter === 'all' || getPersonSeasons(p).includes(seasonFilter))
    .sort((a, b) => {
      if (sortBy === 'hours') return getFilteredHours(b) - getFilteredHours(a)
      if (sortBy === 'shifts') return getShiftCount(b) - getShiftCount(a)
      if (sortBy === 'lastShift') return getLastShiftDate(b).localeCompare(getLastShiftDate(a))
      return a.name.localeCompare(b.name)
    })

  const isRegular = (person) => regularPersonnel.some(p => p.id === person.id)
  const hasFilter = fromDate || toDate || seasonFilter !== 'all'

  return (
    <div className="tab-content">
      <div className="actions">
        <button className="btn btn-success" onClick={addPersonnel} disabled={saving}>
          + Lägg till vakt
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontSize: '16px', pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            placeholder="Sök personal..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px 10px 36px', boxSizing: 'border-box',
              border: '1px solid var(--gray-200)', borderRadius: '8px',
              fontSize: '14px', outline: 'none', background: 'white'
            }}
          />
        </div>
        {availableSeasons.length > 0 && (
          <select value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)} className="filter-select">
            <option value="all">Alla säsonger</option>
            {availableSeasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <input
          type="date"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          title="Från datum"
          style={{ padding: '8px 10px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '13px' }}
        />
        <span style={{ color: 'var(--gray-400)', fontSize: '13px' }}>–</span>
        <input
          type="date"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
          title="Till datum"
          style={{ padding: '8px 10px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '13px' }}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="filter-select">
          <option value="name">Sortera: Namn</option>
          <option value="hours">Sortera: Timmar</option>
          <option value="shifts">Sortera: Antal pass</option>
          <option value="lastShift">Sortera: Senaste pass</option>
        </select>
        {(fromDate || toDate || seasonFilter !== 'all') && (          <button
            onClick={() => { setFromDate(''); setToDate(''); setSeasonFilter('all') }}
            style={{ fontSize: '12px', color: 'var(--gray-500)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}
          >
            Rensa filter
          </button>
        )}
      </div>
      {hasFilter && (
        <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '12px' }}>
          Filtrerat — timmar och passantal gäller valt urval
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {allPersonnel.map(person => (
          <PersonCard
            key={person.id}
            person={person}
            totalHours={hasFilter ? getFilteredHours(person) : getTotalAllHoursForPerson(person)}
            securityHours={0}
            isRegular={isRegular(person)}
            lastShift={sortBy === 'lastShift' ? getLastShiftDate(person) : null}
            shiftCount={sortBy === 'shifts' || hasFilter ? getShiftCount(person) : null}
            onToggleSecurityRole={updatePersonnelRole}
            onClick={() => setSelectedPerson(person)}
          />
        ))}
      </div>

      {selectedPerson && (
        <PersonDetailModal
          person={selectedPerson}
          workHours={workHours}
          securityDuties={securityDuties}
          isRegular={isRegular(selectedPerson)}
          onClose={() => setSelectedPerson(null)}
          onExport={exportWorkHours}
          onDelete={(id, name) => { deletePersonnel(id, name); setSelectedPerson(null) }}
          saving={saving}
        />
      )}
    </div>
  )
}