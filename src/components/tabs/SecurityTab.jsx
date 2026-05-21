import { HOURLY_RATE, SECURITY_RESPONSIBLE } from '../../constants'

export default function SecurityTab({
  securityDuties,
  openAddSecurityDutyModal,
  openEditSecurityDutyModal,
  deleteSecurityDuty,
  saving,
  seasonFilter,
  setSeasonFilter,
  availableSeasons,
}) {
  const filtered = securityDuties.filter(d => !seasonFilter || seasonFilter === 'all' || d.season === seasonFilter)

  return (
    <div className="tab-content">
      <div className="actions">
        <button className="btn btn-success" onClick={openAddSecurityDutyModal} disabled={saving}>
          + Lägg till säkerhetsansvarig uppdrag
        </button>
      </div>

      {availableSeasons?.length > 0 && (
        <div className="filter-bar" style={{ marginBottom: '16px' }}>
          <select
            value={seasonFilter || 'all'}
            onChange={e => setSeasonFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">Alla säsonger</option>
            {availableSeasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Match/Uppdrag</th>
              <th>Person</th>
              <th>Timmar</th>
              <th>Milersättning</th>
              <th>Total ersättning</th>
              <th>Anteckningar</th>
              <th>Åtgärder</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(duty => {
              const totalCompensation = (duty.hours * HOURLY_RATE) + (duty.mileage_compensation || 0)
              return (
                <tr key={duty.id}>
                  <td>{new Date(duty.date).toLocaleDateString('sv-SE')}</td>
                  <td><strong>{duty.opponent}</strong></td>
                  <td><span className="stat-badge">{duty.personnel_name}</span></td>
                  <td className="text-center"><strong>{duty.hours}h</strong></td>
                  <td className="text-center"><strong>{(duty.mileage_compensation || 0).toLocaleString('sv-SE')} kr</strong></td>
                  <td className="text-center"><strong className="total-compensation">{totalCompensation.toLocaleString('sv-SE')} kr</strong></td>
                  <td>{duty.notes || '-'}</td>
                  <td>
                    {duty.auto ? (
                      <span style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>Auto</span>
                    ) : (
                      <>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => openEditSecurityDutyModal(duty)}
                          disabled={saving}
                          style={{ marginRight: '8px' }}
                        >
                          Redigera
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteSecurityDuty(duty.id, duty.personnel_name, duty.opponent)}
                          disabled={saving}
                        >
                          Ta bort
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="summary-section">
        <h3>Sammanfattning säkerhetsansvariga uppdrag</h3>
        <p><strong>Totalt antal uppdrag:</strong> {filtered.length}</p>
        <p><strong>Totala timmar:</strong> {filtered.reduce((total, duty) => total + duty.hours, 0).toFixed(1)}h</p>
        <p><strong>Total lönekostnad:</strong> {(filtered.reduce((total, duty) => total + duty.hours, 0) * HOURLY_RATE).toLocaleString('sv-SE')} kr</p>
        <p><strong>Total milersättning:</strong> {filtered.reduce((total, duty) => total + (duty.mileage_compensation || 0), 0).toLocaleString('sv-SE')} kr</p>
        <p><strong>Total ersättning:</strong> {filtered.reduce((total, duty) => total + (duty.hours * HOURLY_RATE) + (duty.mileage_compensation || 0), 0).toLocaleString('sv-SE')} kr</p>

        <div style={{ marginTop: '20px' }}>
          <h4>Per person:</h4>
          {SECURITY_RESPONSIBLE.map(person => {
            const personDuties = filtered.filter(duty => duty.personnel_name === person)
            const personHours = personDuties.reduce((total, duty) => total + duty.hours, 0)
            const personMileage = personDuties.reduce((total, duty) => total + (duty.mileage_compensation || 0), 0)
            const personTotal = (personHours * HOURLY_RATE) + personMileage

            return (
              <p key={person}>
                <strong>{person}:</strong> {personDuties.length} uppdrag, {personHours.toFixed(1)}h, {personTotal.toLocaleString('sv-SE')} kr
              </p>
            )
          })}
        </div>
      </div>
    </div>
  )
}