import { useModalBackButton } from '../../hooks/useModalBackButton'
import { useState, useEffect } from 'react'

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

const CURRENT_YEAR = new Date().getFullYear()
const DEFAULT_SEASONS = [
  `${CURRENT_YEAR}/${CURRENT_YEAR + 1}`,
  `${CURRENT_YEAR - 1}/${CURRENT_YEAR}`,
]

export default function EditMatchModal({ isOpen, onClose, onSave, match, availableCategories = [], availableSeasons = [] }) {
  const [date, setDate] = useState('')
  const [matchTime, setMatchTime] = useState('19:00')
  const [opponent, setOpponent] = useState('')
  const [matchType, setMatchType] = useState('home')
  const [distanceMiles, setDistanceMiles] = useState('')
  const [requiredGuards, setRequiredGuards] = useState('4')
  const [category, setCategory] = useState('Hockey')
  const [customCategory, setCustomCategory] = useState('')
  const [season, setSeason] = useState(DEFAULT_SEASONS[0])
  const [customSeason, setCustomSeason] = useState('')
  const [attendance, setAttendance] = useState('')
  const [saving, setSaving] = useState(false)

  // time = matchstart i databasen
  const getMatchTime = (m) => m?.time || '19:00'

  useModalBackButton(isOpen, onClose)
  useEffect(() => {
    if (match) {
      setDate(match.date || '')
      setMatchTime(getMatchTime(match))
      setOpponent(match.opponent || '')
      setMatchType(match.match_type || 'home')
      setDistanceMiles(match.distance_miles ? String(match.distance_miles) : '')
      setRequiredGuards(String(match.required_guards || 4))
      setCategory(match.category || 'Hockey')
      setCustomCategory('')
      setSeason(match.season || DEFAULT_SEASONS[0])
      setCustomSeason('')
      setAttendance(match.attendance ? String(match.attendance) : '')
    }
  }, [match])

  const allCategories = [...new Set([...availableCategories, 'Hockey', 'Fotboll', 'Konsert', 'Övrigt'])]
  const allSeasons = [...new Set([...DEFAULT_SEASONS, ...availableSeasons])]

  const handleSave = async () => {
    if (!date || !opponent.trim()) {
      alert('Datum och motstånd/namn är obligatoriska')
      return
    }
    const finalCategory = category === '__new__' ? customCategory.trim() : category
    const finalSeason = season === '__new__' ? customSeason.trim() : season
    const guardStart = matchTime ? minutesToTime(timeToMinutes(matchTime) - 120) : null

    setSaving(true)
    await onSave(match.id, {
      date,
      time: guardStart,
      end_time: matchTime || null,
      opponent: opponent.trim(),
      match_type: matchType,
      distance_miles: matchType === 'away' && distanceMiles ? parseFloat(distanceMiles) : null,
      required_guards: parseInt(requiredGuards) || 4,
      category: finalCategory || null,
      season: finalSeason || null,
      attendance: attendance ? parseInt(attendance) : null,
    })
    setSaving(false)
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
          <h2>Redigera evenemang</h2>
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

          {/* Matchens starttid */}
          <div className="form-group">
            <label>Matchens starttid</label>
            <input
              type="time"
              value={matchTime}
              onChange={e => setMatchTime(e.target.value)}
              className="form-input"
            />
            {matchTime && (
              <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '6px' }}>
                Vakterna börjar {minutesToTime(timeToMinutes(matchTime) - 120)} (2h före match)
              </div>
            )}
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
            />
          </div>

          {/* Hemma/Borta */}
          <div className="form-group">
            <label>Typ</label>
            <select value={matchType} onChange={e => setMatchType(e.target.value)} className="form-select">
              <option value="home">Hemma</option>
              <option value="away">Borta</option>
            </select>
          </div>

          {matchType === 'away' && (
            <div className="form-group">
              <label>Avstånd (mil)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={distanceMiles}
                onChange={e => setDistanceMiles(e.target.value)}
                className="form-input"
                placeholder="t.ex. 5.5"
              />
            </div>
          )}

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
            <select value={category} onChange={e => setCategory(e.target.value)} className="form-select">
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

          {/* Publikantal */}
          <div className="form-group">
            <label>Publikantal</label>
            <input
              type="number"
              min="0"
              value={attendance}
              onChange={e => setAttendance(e.target.value)}
              className="form-input"
              placeholder="Antal åskådare (valfritt)"
            />
          </div>

          {/* Säsong */}
          <div className="form-group">
            <label>Säsong</label>
            <select value={season} onChange={e => setSeason(e.target.value)} className="form-select">
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
            {saving ? 'Sparar...' : 'Spara ändringar'}
          </button>
        </div>
      </div>
    </div>
  )
}