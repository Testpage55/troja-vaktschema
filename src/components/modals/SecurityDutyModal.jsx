import { useState, useEffect } from 'react'
import { SECURITY_RESPONSIBLE } from '../../constants'

const CURRENT_YEAR = new Date().getFullYear()
const DEFAULT_SEASONS = [
  `${CURRENT_YEAR}/${CURRENT_YEAR + 1}`,
  `${CURRENT_YEAR - 1}/${CURRENT_YEAR}`,
]

export default function SecurityDutyModal({ isOpen, onClose, onSave, duty = null, availableSeasons = [] }) {
  const [date, setDate] = useState('')
  const [opponent, setOpponent] = useState('')
  const [person, setPerson] = useState('')
  const [hours, setHours] = useState('')
  const [mileageCompensation, setMileageCompensation] = useState('')
  const [notes, setNotes] = useState('')
  const [season, setSeason] = useState(DEFAULT_SEASONS[0])

  const allSeasons = [...new Set([...DEFAULT_SEASONS, ...availableSeasons])]
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
        setSeason(duty.season || DEFAULT_SEASONS[0])
      } else {
        resetForm()
      }
    }
  }, [isOpen, duty, isEditing])

  const resetForm = () => {
    setDate(''); setOpponent(''); setPerson('')
    setHours(''); setMileageCompensation(''); setNotes('')
    setSeason(DEFAULT_SEASONS[0])
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
      date, opponent: opponent.trim(), personnel_name: person,
      hours: parseFloat(hours),
      mileage_compensation: parseFloat(mileageCompensation) || 0,
      notes: notes.trim(),
      season: season || null
    }
    if (isEditing) securityData.id = duty.id
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
              <label>Datum *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input" />
            </div>
            <div className="form-group">
              <label>Person *</label>
              <select value={person} onChange={e => setPerson(e.target.value)} className="form-select">
                <option value="">Välj person</option>
                {SECURITY_RESPONSIBLE.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Match/Uppdrag *</label>
            <input type="text" value={opponent} onChange={e => setOpponent(e.target.value)} className="form-input" placeholder="t.ex. Växjö Lakers eller Säkerhetsmöte" />
          </div>

          <div className="form-group">
            <label>Säsong</label>
            <select value={season} onChange={e => setSeason(e.target.value)} className="form-select">
              {allSeasons.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Antal timmar *</label>
              <input type="number" step="0.5" value={hours} onChange={e => setHours(e.target.value)} className="form-input" placeholder="t.ex. 3.5" min="0.5" />
            </div>
            <div className="form-group">
              <label>Milersättning (kr)</label>
              <input type="number" step="0.01" value={mileageCompensation} onChange={e => setMileageCompensation(e.target.value)} className="form-input" placeholder="t.ex. 250" min="0" />
            </div>
          </div>

          <div className="form-group">
            <label>Anteckningar (valfritt)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="form-input" placeholder="T.ex. Extra ansvar, övertid..." rows="3" />
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