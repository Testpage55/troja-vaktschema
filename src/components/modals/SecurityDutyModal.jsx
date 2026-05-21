import { useState, useEffect } from 'react'
import { SECURITY_RESPONSIBLE } from '../../constants'

export default function SecurityDutyModal({ isOpen, onClose, onSave, duty = null }) {
  const [date, setDate] = useState('')
  const [opponent, setOpponent] = useState('')
  const [person, setPerson] = useState('')
  const [hours, setHours] = useState('')
  const [mileageCompensation, setMileageCompensation] = useState('')
  const [notes, setNotes] = useState('')

  const isEditing = duty !== null

  useEffect(() => {
    if (isOpen) {
      if (isEditing && duty) {
        setDate(duty.date || '')
        setOpponent(duty.opponent || '')
        setPerson(duty.personnel_name || '')
        setHours(duty.hours?.toString() || '')
        setMileageCompensation(duty.mileage_compensation?.toString() || '')
        setNotes(duty.notes || '')
      } else {
        resetForm()
      }
    }
  }, [isOpen, duty, isEditing])

  const resetForm = () => {
    setDate('')
    setOpponent('')
    setPerson('')
    setHours('')
    setMileageCompensation('')
    setNotes('')
  }

  const handleSave = () => {
    if (!date || !opponent.trim() || !person || !hours) {
      alert('Fyll i alla obligatoriska fält (datum, match, person, timmar)')
      return
    }
    if (parseFloat(hours) <= 0) {
      alert('Antal timmar måste vara större än 0')
      return
    }

    const securityData = {
      date,
      opponent: opponent.trim(),
      personnel_name: person,
      hours: parseFloat(hours),
      mileage_compensation: parseFloat(mileageCompensation) || 0,
      notes: notes.trim()
    }

    if (isEditing) {
      securityData.id = duty.id
    }

    onSave(securityData)
    resetForm()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-match-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Redigera' : 'Lägg till'} säkerhetsansvarig uppdrag</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="security-date">Datum *</label>
              <input
                id="security-date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="security-person">Person *</label>
              <select
                id="security-person"
                value={person}
                onChange={e => setPerson(e.target.value)}
                className="form-select"
              >
                <option value="">Välj person</option>
                {SECURITY_RESPONSIBLE.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="security-opponent">Match/Uppdrag *</label>
            <input
              id="security-opponent"
              type="text"
              value={opponent}
              onChange={e => setOpponent(e.target.value)}
              className="form-input"
              placeholder="t.ex. Växjö Lakers eller Säkerhetsmöte"
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="security-hours">Antal timmar *</label>
              <input
                id="security-hours"
                type="number"
                step="0.5"
                value={hours}
                onChange={e => setHours(e.target.value)}
                className="form-input"
                placeholder="t.ex. 3.5"
                min="0.5"
              />
            </div>

            <div className="form-group">
              <label htmlFor="security-mileage">Milersättning (kr)</label>
              <input
                id="security-mileage"
                type="number"
                step="0.01"
                value={mileageCompensation}
                onChange={e => setMileageCompensation(e.target.value)}
                className="form-input"
                placeholder="t.ex. 250"
                min="0"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="security-notes">Anteckningar (valfritt)</label>
            <textarea
              id="security-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="form-input"
              placeholder="T.ex. Extra ansvar, övertid..."
              rows="3"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Avbryt</button>
          <button className="btn btn-primary" onClick={handleSave}>
            {isEditing ? 'Spara ändringar' : 'Lägg till uppdrag'}
          </button>
        </div>
      </div>
    </div>
  )
}