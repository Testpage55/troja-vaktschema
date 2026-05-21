import { useState } from 'react'

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(mins) {
  const total = ((mins % 1440) + 1440) % 1440
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function calcHours(start, end) {
  if (!start || !end) return 0
  let diff = timeToMinutes(end) - timeToMinutes(start)
  if (diff <= 0) diff += 1440
  return parseFloat((diff / 60).toFixed(1))
}

const CURRENT_YEAR = new Date().getFullYear()
const DEFAULT_SEASONS = [
  `${CURRENT_YEAR}/${CURRENT_YEAR + 1}`,
  `${CURRENT_YEAR - 1}/${CURRENT_YEAR}`,
]

export default function AddMatchModal({ isOpen, onClose, onSave, availableCategories, availableSeasons }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('19:00')
  const [endTime, setEndTime] = useState('')
  const [hoursInput, setHoursInput] = useState('')
  const [opponent, setOpponent] = useState('')
  const [matchType, setMatchType] = useState('home')
  const [distanceMiles, setDistanceMiles] = useState('')
  const [requiredGuards, setRequiredGuards] = useState('4')
  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [season, setSeason] = useState(DEFAULT_SEASONS[0])
  const [customSeason, setCustomSeason] = useState('')
  const [saving, setSaving] = useState(false)

  const allCategories = [...new Set([...availableCategories, 'Hockey', 'Fotboll', 'Konsert', 'Övrigt'])]
  const allSeasons = [...new Set([...DEFAULT_SEASONS, ...availableSeasons])]

  const reset = () => {
    setDate(''); setTime('19:00'); setEndTime(''); setHoursInput(''); setOpponent(''); setMatchType('home')
    setDistanceMiles(''); setRequiredGuards('4'); setCategory('')
    setCustomCategory(''); setSeason(DEFAULT_SEASONS[0]); setCustomSeason('')
  }

  const handleSave = async () => {
    if (!date || !opponent.trim()) {
      alert('Datum och motstånd/namn är obligatoriska')
      return
    }
    const finalCategory = category === '__new__' ? customCategory.trim() : category
    const finalSeason = season === '__new__' ? customSeason.trim() : season

    setSaving(true)
    await onSave({
      date,
      time: time || null,
      end_time: endTime || null,
      opponent: opponent.trim(),
      match_type: matchType,
      distance_miles: matchType === 'away' && distanceMiles ? parseFloat(distanceMiles) : null,
      required_guards: parseInt(requiredGuards) || 4,
      category: finalCategory || null,
      season: finalSeason || null,
    })
    setSaving(false)
    reset()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content add-match-modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '500px', width: '100%' }}
      >
        <div className="modal-header">
          <h2>Lägg till evenemang</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Datum */}
          <div className="form-group">
            <label>Datum *</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="form-input"
            />
          </div>

          {/* Starttid + Sluttid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Starttid</label>
              <input
                type="time"
                value={time}
                onChange={e => {
                  setTime(e.target.value)
                  if (e.target.value && endTime) setHoursInput(String(calcHours(e.target.value, endTime)))
                }}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Sluttid</label>
              <input
                type="time"
                value={endTime}
                onChange={e => {
                  setEndTime(e.target.value)
                  if (time && e.target.value) setHoursInput(String(calcHours(time, e.target.value)))
                }}
                className="form-input"
              />
            </div>
          </div>

          {/* Timmar */}
          <div className="form-group">
            <label>Antal timmar</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={hoursInput}
              onChange={e => {
                setHoursInput(e.target.value)
                const h = parseFloat(e.target.value)
                if (!isNaN(h) && h > 0 && time) {
                  setEndTime(minutesToTime(timeToMinutes(time) + Math.round(h * 60)))
                }
              }}
              className="form-input"
              placeholder="Räknas ut automatiskt"
            />
          </div>

          {/* Motstånd */}
          <div className="form-group">
            <label>Motstånd / namn *</label>
            <input
              type="text"
              value={opponent}
              onChange={e => setOpponent(e.target.value)}
              className="form-input"
              placeholder="t.ex. Frölunda HC eller Konsert XYZ"
              autoFocus
            />
          </div>

          {/* Antal vakter */}
          <div className="form-group">
            <label>Antal vakter som behövs</label>
            <input
              type="number"
              min="1"
              max="20"
              value={requiredGuards}
              onChange={e => setRequiredGuards(e.target.value)}
              className="form-input"
            />
          </div>

          {/* Kategori */}
          <div className="form-group">
            <label>Kategori</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="form-select"
            >
              <option value="">Ingen kategori</option>
              {allCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__new__">+ Ny kategori...</option>
            </select>
            {category === '__new__' && (
              <input
                type="text"
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
                className="form-input"
                placeholder="Ange ny kategori"
                style={{ marginTop: '8px' }}
                autoFocus
              />
            )}
          </div>

          {/* Säsong */}
          <div className="form-group">
            <label>Säsong</label>
            <select
              value={season}
              onChange={e => setSeason(e.target.value)}
              className="form-select"
            >
              {allSeasons.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value="__new__">+ Ny säsong...</option>
            </select>
            {season === '__new__' && (
              <input
                type="text"
                value={customSeason}
                onChange={e => setCustomSeason(e.target.value)}
                className="form-input"
                placeholder="t.ex. 2026/2027"
                style={{ marginTop: '8px' }}
                autoFocus
              />
            )}
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Avbryt</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !date || !opponent.trim()}
          >
            {saving ? 'Sparar...' : 'Lägg till evenemang'}
          </button>
        </div>
      </div>
    </div>
  )
}