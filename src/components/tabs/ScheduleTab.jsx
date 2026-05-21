import { useState } from 'react'
import { SECURITY_RESPONSIBLE, REGULAR_GUARDS } from '../../constants'
import EditMatchModal from '../modals/EditMatchModal'

function PersonRow({ person, match, toggleWorking, saving }) {
  const isSecResp = match.security_responsible_id == person.id
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 14px',
      background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: '10px'
    }}>
      <div style={{
        width: '34px', height: '34px', borderRadius: '50%',
        background: isSecResp ? '#2563eb' : 'var(--gray-200)',
        color: isSecResp ? 'white' : 'var(--gray-500)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '12px', fontWeight: '600', flexShrink: 0
      }}>
        {getInitials(person.name)}
      </div>
      <div style={{ flex: 1, fontSize: '14px', color: 'var(--gray-700)' }}>
        {person.name}
        {isSecResp && <span style={{ fontSize: '10px', marginLeft: '6px', color: '#2563eb', background: '#dbeafe', padding: '1px 6px', borderRadius: '99px' }}>Säkerhetsansvarig</span>}
      </div>
      <button onClick={() => toggleWorking(match.id, person.id)} disabled={saving}
        style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid #16a34a', borderRadius: '6px', background: 'white', color: '#15803d', cursor: 'pointer', fontWeight: '500' }}>
        + Lägg till
      </button>
    </div>
  )
}

function NotWorkingList({ match, notWorkingPersonnel, allPersonnel, isWorking, toggleWorking, saving, search, q }) {
  const [showExtra, setShowExtra] = useState(false)

  const regularNotWorking = notWorkingPersonnel.filter(p => REGULAR_GUARDS.includes(p.name))
  const extraNotWorking = notWorkingPersonnel.filter(p => !REGULAR_GUARDS.includes(p.name))
  const totalNotWorking = allPersonnel.filter(p => !isWorking(match, p.id)).length

  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
        Ej tilldelad ({totalNotWorking})
      </div>

      {notWorkingPersonnel.length === 0 && q && (
        <div style={{ fontSize: '13px', color: 'var(--gray-500)', fontStyle: 'italic', padding: '4px 0 8px' }}>
          Ingen vakt matchar "{search}"
        </div>
      )}

      {/* Ordinarie alltid synliga */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {regularNotWorking.map(person => (
          <PersonRow key={person.id} person={person} match={match} toggleWorking={toggleWorking} saving={saving} />
        ))}
      </div>

      {/* Extra — kollapsade om ingen sökning pågår */}
      {extraNotWorking.length > 0 && (
        <div style={{ marginTop: regularNotWorking.length > 0 ? '8px' : '0' }}>
          {q ? (
            // Om sökning pågår, visa direkt
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {extraNotWorking.map(person => (
                <PersonRow key={person.id} person={person} match={match} toggleWorking={toggleWorking} saving={saving} />
              ))}
            </div>
          ) : (
            // Annars kollapsa
            <>
              <button
                onClick={() => setShowExtra(v => !v)}
                style={{
                  width: '100%', padding: '8px 14px', border: '1px dashed var(--gray-300)',
                  borderRadius: '8px', background: 'none', cursor: 'pointer',
                  fontSize: '13px', color: 'var(--gray-500)', textAlign: 'left',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}
              >
                <span>Extra vakter ({extraNotWorking.length})</span>
                <span>{showExtra ? '▲' : '▼'}</span>
              </button>
              {showExtra && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  {extraNotWorking.map(person => (
                    <PersonRow key={person.id} person={person} match={match} toggleWorking={toggleWorking} saving={saving} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function AddDelegateForm({ matchId, matchDate, delegates, onAdd, onDelete, saving }) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')

  // Rullista med tidigare delegater
  const previousNames = [...new Set(delegates.map(d => d.name))].sort()
  const matchDelegates = delegates.filter(d => d.match_id === matchId)

  const handleAdd = async () => {
    if (!name.trim()) return
    await onAdd({ match_id: matchId, name: name.trim(), date: matchDate, notes: notes.trim() || null })
    setName('')
    setNotes('')
  }

  return (
    <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--gray-100)' }}>
      <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
        Delegater ({matchDelegates.length})
      </div>

      {matchDelegates.map(d => (
        <div key={d.id} style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '8px 12px', marginBottom: '6px',
          background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px'
        }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: '#2563eb', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: '700', flexShrink: 0
          }}>
            {getInitials(d.name)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e40af' }}>{d.name}</div>
            {d.notes && <div style={{ fontSize: '11px', color: '#3b82f6' }}>{d.notes}</div>}
          </div>
          <button
            onClick={() => onDelete(d.id, d.name)}
            disabled={saving}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: '16px' }}
          >×</button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <input
          list="delegate-names"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Delegatens namn..."
          style={{
            flex: 1, padding: '8px 10px',
            border: '1px solid var(--gray-200)', borderRadius: '8px',
            fontSize: '13px', outline: 'none'
          }}
        />
        <datalist id="delegate-names">
          {previousNames.map(n => <option key={n} value={n} />)}
        </datalist>
        <input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Anteckning (valfritt)"
          style={{
            flex: 1, padding: '8px 10px',
            border: '1px solid var(--gray-200)', borderRadius: '8px',
            fontSize: '13px', outline: 'none'
          }}
        />
        <button
          onClick={handleAdd}
          disabled={saving || !name.trim()}
          style={{
            padding: '8px 14px', border: 'none', borderRadius: '8px',
            background: '#2563eb', color: 'white', fontSize: '13px',
            fontWeight: '600', cursor: name.trim() ? 'pointer' : 'not-allowed'
          }}
        >
          + Lägg till
        </button>
      </div>
    </div>
  )
}

function MatchDetailPanel({ match, allPersonnel, isWorking, hasWorkHours, getWorkHoursForMatch, hasDeviatingHours, toggleWorking, openTimeModal, saving, onClose, onEdit, onDelete, delegates, onAddDelegate, onDeleteDelegate, onUpdateSecurityResponsible }) {
  const [search, setSearch] = useState('')
  const matchType = match.match_type || 'home'
  const q = search.toLowerCase()
  const workingPersonnel = allPersonnel
    .filter(p => isWorking(match, p.id))
    .filter(p => !q || p.name.toLowerCase().includes(q))
  const notWorkingPersonnel = allPersonnel
    .filter(p => !isWorking(match, p.id))
    .filter(p => !q || p.name.toLowerCase().includes(q))

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--white)', borderRadius: '20px 20px 0 0',
          width: '100%', maxWidth: '600px',
          maxHeight: '85vh', overflowY: 'auto',
          padding: '0 0 32px 0'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 4px' }}>
          <div style={{ width: '40px', height: '4px', background: 'var(--gray-200)', borderRadius: '99px', margin: '0 auto' }} />
        </div>

        <div style={{ padding: '12px 20px 16px', borderBottom: '1px solid var(--gray-100)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                {new Date(match.date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                {' • '}{match.end_time || match.time}{match.time && match.end_time ? ` • Vaktstart ${match.time}` : ''}
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--gray-900)' }}>{match.opponent}</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{
                fontSize: '13px', fontWeight: '600', padding: '4px 10px', borderRadius: '99px',
                background: allPersonnel.filter(p => isWorking(match, p.id)).length >= (match.required_guards || 4) ? '#dcfce7' : '#fee2e2',
                color: allPersonnel.filter(p => isWorking(match, p.id)).length >= (match.required_guards || 4) ? '#15803d' : '#b91c1c'
              }}>
                {allPersonnel.filter(p => isWorking(match, p.id)).length}/{match.required_guards || 4}
              </span>
              <button onClick={onEdit} disabled={saving}
                style={{ fontSize: '12px', padding: '5px 10px', border: '1px solid var(--gray-300)', borderRadius: '6px', background: 'white', color: 'var(--gray-700)', cursor: 'pointer' }}>
                ✏️ Redigera
              </button>
              <button onClick={() => onDelete(match.id, match.opponent)} disabled={saving}
                style={{ fontSize: '12px', padding: '5px 10px', border: '1px solid #fca5a5', borderRadius: '6px', background: 'white', color: '#b91c1c', cursor: 'pointer' }}>
                🗑 Ta bort
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 20px 0' }}>
          {/* Säkerhetsansvarig per match */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', padding: '10px 14px', background: match.security_responsible_id ? '#eff6ff' : 'var(--gray-50)', borderRadius: '8px', border: `1px solid ${match.security_responsible_id ? '#bfdbfe' : 'var(--gray-200)'}` }}>
            <span style={{ fontSize: '12px', color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>🛡 Säkerhetsansvarig:</span>
            <select
              value={match.security_responsible_id || ''}
              onChange={e => onUpdateSecurityResponsible(match.id, e.target.value || null)}
              style={{
                flex: 1, padding: '5px 10px', border: '1px solid var(--gray-200)', borderRadius: '8px',
                fontSize: '13px', background: 'white',
                color: match.security_responsible_id ? '#1e40af' : 'var(--gray-600)',
                fontWeight: match.security_responsible_id ? '600' : '400'
              }}
            >
              <option value="">— Ingen vald —</option>
              {allPersonnel
                .filter(p => SECURITY_RESPONSIBLE.includes(p.name))
                .map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
          </div>

          {/* Sökfält */}
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-500)', fontSize: '15px', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              placeholder="Sök vakt..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={{
                width: '100%', padding: '9px 12px 9px 34px',
                border: '1px solid var(--gray-200)', borderRadius: '8px',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                background: 'var(--gray-50)'
              }}
            />
          </div>

          {/* Tjänstgör */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
              Tjänstgör ({allPersonnel.filter(p => isWorking(match, p.id)).length})
            </div>
            {workingPersonnel.length === 0 && !q && (
              <div style={{ fontSize: '13px', color: 'var(--gray-500)', fontStyle: 'italic' }}>Ingen tilldelad ännu</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {workingPersonnel.map(person => {
                const wh = getWorkHoursForMatch(match.id, person.id)
                const deviating = hasDeviatingHours(match.id, person.id)
                const isSecResp = match.security_responsible_id == person.id
                return (
                  <div key={person.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px',
                    background: isSecResp ? '#eff6ff' : '#f0fdf4',
                    border: `1px solid ${isSecResp ? '#bfdbfe' : '#bbf7d0'}`,
                    borderRadius: '10px'
                  }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '50%',
                      background: isSecResp ? '#2563eb' : '#16a34a', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: '600', flexShrink: 0
                    }}>
                      {getInitials(person.name)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-900)' }}>
                        {person.name}
                        {isSecResp && <span style={{ fontSize: '10px', marginLeft: '6px', color: '#2563eb', background: '#dbeafe', padding: '1px 6px', borderRadius: '99px' }}>Säkerhetsansvarig</span>}
                      </div>
                      {wh && (
                        <div style={{ fontSize: '12px', color: deviating ? '#d97706' : (isSecResp ? '#2563eb' : '#16a34a') }}>
                          {wh.start_time} – {wh.end_time} • {wh.total_hours}h{deviating && ' ⚠'}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {wh && (
                        <button onClick={() => openTimeModal(match.id, person.id)} disabled={saving}
                          style={{ fontSize: '12px', padding: '5px 10px', border: '1px solid #16a34a', borderRadius: '6px', background: 'white', color: '#15803d', cursor: 'pointer' }}>
                          Ändra tid
                        </button>
                      )}
                      <button onClick={() => toggleWorking(match.id, person.id)} disabled={saving}
                        style={{ fontSize: '12px', padding: '5px 10px', border: '1px solid #fca5a5', borderRadius: '6px', background: 'white', color: '#b91c1c', cursor: 'pointer' }}>
                        Ta bort
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Ej tilldelad */}
          {allPersonnel.some(p => !isWorking(match, p.id)) && (
            <NotWorkingList
              match={match}
              notWorkingPersonnel={notWorkingPersonnel}
              allPersonnel={allPersonnel}
              isWorking={isWorking}
              toggleWorking={toggleWorking}
              saving={saving}
              search={search}
              q={q}
            />
          )}

          {/* Delegater */}
          <AddDelegateForm
            matchId={match.id}
            matchDate={match.date}
            delegates={delegates}
            onAdd={onAddDelegate}
            onDelete={onDeleteDelegate}
            saving={saving}
          />
        </div>
      </div>
    </div>
  )
}

function MatchCard({ match, allPersonnel, isWorking, getWorkHoursForMatch, hasDeviatingHours, getWorkingCount, delegates, onClick }) {
  const matchType = match.match_type || 'home'
  const workingCount = getWorkingCount(match)
  const required = match.required_guards || 4
  const isFull = workingCount >= required
  const workingPersonnel = allPersonnel.filter(p => isWorking(match, p.id))
  const matchDelegates = delegates.filter(d => d.match_id === match.id)

  const dateObj = new Date(match.date)
  const dayName = dateObj.toLocaleDateString('sv-SE', { weekday: 'short' })
  const dayNum = dateObj.getDate()
  const monthName = dateObj.toLocaleDateString('sv-SE', { month: 'short' })

  return (
    <div
      onClick={onClick}
      style={{
        background: 'white',
        border: `1px solid ${isFull ? '#bbf7d0' : '#fecaca'}`,
        borderRadius: '12px', padding: '14px', cursor: 'pointer',
        transition: 'box-shadow 0.15s', boxShadow: 'var(--shadow-sm)'
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
          <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--gray-900)', lineHeight: 1 }}>{dayNum}</span>
          <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{dayName} {monthName}</span>
        </div>
        <span style={{
          fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '99px',
          background: isFull ? '#dcfce7' : '#fee2e2',
          color: isFull ? '#15803d' : '#b91c1c'
        }}>
          {workingCount}/{required}
        </span>
      </div>

      <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--gray-900)', marginBottom: '4px', lineHeight: 1.2 }}>
        {match.opponent}
      </div>

      <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '10px' }}>
        {match.end_time || match.time}{match.time && match.end_time ? ` • Vaktstart ${match.time}` : ''}{match.category ? ` • ${match.category}` : ''}
      </div>

      {/* Avatarer */}
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
        {workingPersonnel.map(person => (
          <div
            key={person.id}
            title={person.name}
            style={{
              width: '30px', height: '30px', borderRadius: '50%',
              background: match.security_responsible_id == person.id ? '#2563eb' : '#16a34a',
              color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: '600'
            }}
          >
            {getInitials(person.name)}
          </div>
        ))}
        {Array.from({ length: Math.max(0, required - workingCount) }).map((_, i) => (
          <div key={`empty-${i}`} style={{
            width: '30px', height: '30px', borderRadius: '50%',
            border: '1.5px dashed #fca5a5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', color: '#fca5a5'
          }}>+</div>
        ))}
        {matchDelegates.length > 0 && (
          <div title={`Delegater: ${matchDelegates.map(d => d.name).join(', ')}`}
            style={{
              fontSize: '10px', padding: '2px 7px', borderRadius: '99px',
              background: '#dbeafe', color: '#1e40af', fontWeight: '600',
              marginLeft: '4px'
            }}>
            {matchDelegates.length} delegat{matchDelegates.length > 1 ? 'er' : ''}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ScheduleTab({
  matches, matchFilter, setMatchFilter,
  categoryFilter, setCategoryFilter,
  seasonFilter, setSeasonFilter,
  availableCategories, availableSeasons,
  regularPersonnel, extraPersonnel,
  expandedMonths, toggleMonth, groupMatchesByMonth,
  isWorking, getWorkingCount, hasWorkHours, getWorkHoursForMatch,
  hasDeviatingHours, getDetailedTooltip, calculateMileageForMatch,
  toggleWorking, openTimeModal, updateMatch, deleteMatch, onAddMatch,
  delegates, onAddDelegate, onDeleteDelegate, onUpdateSecurityResponsible,
  saving
}) {
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const allPersonnel = [...regularPersonnel, ...extraPersonnel]

  const monthGroups = groupMatchesByMonth()

  const today = new Date()
  const defaultKey = (() => {
    const future = monthGroups.find(g => g.matches.some(m => new Date(m.date) >= today))
    return future?.monthKey || monthGroups[monthGroups.length - 1]?.monthKey || null
  })()

  const [activeMonth, setActiveMonth] = useState(defaultKey)
  const activeGroup = monthGroups.find(g => g.monthKey === activeMonth)
  const activeIndex = monthGroups.findIndex(g => g.monthKey === activeMonth)
  const hasPrev = activeIndex > 0
  const hasNext = activeIndex < monthGroups.length - 1

  return (
    <div className="tab-content">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
        <button className="btn btn-success" onClick={onAddMatch} disabled={saving}>
          + Lägg till evenemang
        </button>
        {availableCategories.length > 0 && (
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="filter-select">
            <option value="all">Alla kategorier</option>
            {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {availableSeasons.length > 0 && (
          <select value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)} className="filter-select">
            <option value="all">Alla säsonger</option>
            {availableSeasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {monthGroups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--gray-500)' }}>
          Inga evenemang — klicka "+ Lägg till evenemang" för att komma igång.
        </div>
      ) : (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
            background: 'white', borderRadius: '10px', padding: '12px 16px', boxShadow: 'var(--shadow-sm)'
          }}>
            <button onClick={() => hasPrev && setActiveMonth(monthGroups[activeIndex - 1].monthKey)} disabled={!hasPrev}
              style={{ width: '34px', height: '34px', borderRadius: '50%', border: '1px solid var(--gray-200)', background: 'white', cursor: hasPrev ? 'pointer' : 'not-allowed', color: hasPrev ? 'var(--gray-700)' : 'var(--gray-300)', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <div style={{ display: 'flex', gap: '6px', flex: 1, overflowX: 'auto', padding: '2px 0' }}>
              {monthGroups.map(g => {
                const isActive = g.monthKey === activeMonth
                const hasFuture = g.matches.some(m => new Date(m.date) >= today)
                return (
                  <button key={g.monthKey} onClick={() => setActiveMonth(g.monthKey)}
                    style={{ padding: '5px 12px', borderRadius: '99px', whiteSpace: 'nowrap', border: isActive ? 'none' : '1px solid var(--gray-200)', background: isActive ? '#16a34a' : 'white', color: isActive ? 'white' : hasFuture ? 'var(--gray-800)' : 'var(--gray-400)', fontWeight: isActive ? '600' : '400', fontSize: '13px', cursor: 'pointer' }}>
                    {g.monthName}
                  </button>
                )
              })}
            </div>
            <button onClick={() => hasNext && setActiveMonth(monthGroups[activeIndex + 1].monthKey)} disabled={!hasNext}
              style={{ width: '34px', height: '34px', borderRadius: '50%', border: '1px solid var(--gray-200)', background: 'white', cursor: hasNext ? 'pointer' : 'not-allowed', color: hasNext ? 'var(--gray-700)' : 'var(--gray-300)', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          </div>

          {activeGroup && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
              {activeGroup.matches.map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  allPersonnel={allPersonnel}
                  isWorking={isWorking}
                  getWorkHoursForMatch={getWorkHoursForMatch}
                  hasDeviatingHours={hasDeviatingHours}
                  getWorkingCount={getWorkingCount}
                  delegates={delegates}
                  onClick={() => setSelectedMatch(match)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {selectedMatch && (
        <MatchDetailPanel
          match={selectedMatch}
          allPersonnel={allPersonnel}
          isWorking={isWorking}
          hasWorkHours={hasWorkHours}
          getWorkHoursForMatch={getWorkHoursForMatch}
          hasDeviatingHours={hasDeviatingHours}
          toggleWorking={toggleWorking}
          openTimeModal={openTimeModal}
          saving={saving}
          onClose={() => setSelectedMatch(null)}
          onEdit={() => setIsEditModalOpen(true)}
          onDelete={deleteMatch}
          delegates={delegates}
          onAddDelegate={onAddDelegate}
          onDeleteDelegate={onDeleteDelegate}
          onUpdateSecurityResponsible={onUpdateSecurityResponsible}
        />
      )}

      <EditMatchModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={async (id, data) => { await updateMatch(id, data); setIsEditModalOpen(false); setSelectedMatch(null) }}
        match={selectedMatch}
        availableCategories={availableCategories}
        availableSeasons={availableSeasons}
      />
    </div>
  )
}