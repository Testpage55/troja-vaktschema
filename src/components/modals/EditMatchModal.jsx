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
  const [policeContact, setPoliceContact] = useState('')
  const [noMealDeduction, setNoMealDeduction] = useState(false)
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
      setPoliceContact(match.police_contact || '')
      setNoMealDeduction(!!match.no_meal_deduction)
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
      police_contact: policeContact.trim() || null,
      no_meal_deduction: noMealDeduction,
    })
    setSaving(false)
    onClose()
  }

  if (!isOpen) return null

  const field = { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }
  const lbl = { fontSize: '12px', fontWeight: 600, color: 'var(--gray-600)' }
  const ctl = { padding: '8px 10px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }
  const row = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content add-match-modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '460px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--gray-200)', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '17px' }}>Redigera evenemang</h2>
          <button onClick={onClose} aria-label="Stäng" style={{ background: 'none', border: 'none', fontSize: '24px', lineHeight: 1, cursor: 'pointer', color: 'var(--gray-500)' }}>×</button>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1, minHeight: 0 }}>

          <div style={field}>
            <label style={lbl}>Motstånd / namn *</label>
            <input type="text" value={opponent} onChange={e => setOpponent(e.target.value)} className="form-input" style={ctl} placeholder="t.ex. Frölunda HC eller Konsert XYZ" />
          </div>

          <div style={row}>
            <div style={field}>
              <label style={lbl}>Datum *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input" style={ctl} />
            </div>
            <div style={field}>
              <label style={lbl}>Matchstart{matchTime ? ` (vakt ${minutesToTime(timeToMinutes(matchTime) - 120)})` : ''}</label>
              <input type="time" value={matchTime} onChange={e => setMatchTime(e.target.value)} className="form-input" style={ctl} />
            </div>
          </div>

          <div style={row}>
            <div style={field}>
              <label style={lbl}>Typ</label>
              <select value={matchType} onChange={e => setMatchType(e.target.value)} className="form-select" style={ctl}>
                <option value="home">Hemma</option>
                <option value="away">Borta</option>
              </select>
            </div>
            <div style={field}>
              <label style={lbl}>Antal vakter</label>
              <input type="number" min="1" max="20" value={requiredGuards} onChange={e => setRequiredGuards(e.target.value)} className="form-input" style={ctl} />
            </div>
            {matchType === 'away' && (
              <div style={field}>
                <label style={lbl}>Avstånd (mil)</label>
                <input type="number" step="0.1" min="0" value={distanceMiles} onChange={e => setDistanceMiles(e.target.value)} className="form-input" style={ctl} placeholder="5.5" />
              </div>
            )}
          </div>

          <div style={row}>
            <div style={field}>
              <label style={lbl}>Kategori</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="form-select" style={ctl}>
                <option value="">Ingen kategori</option>
                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__new__">+ Ny kategori...</option>
              </select>
              {category === '__new__' && (
                <input type="text" value={customCategory} onChange={e => setCustomCategory(e.target.value)} className="form-input" style={ctl} placeholder="Ny kategori" autoFocus />
              )}
            </div>
            <div style={field}>
              <label style={lbl}>Säsong</label>
              <select value={season} onChange={e => setSeason(e.target.value)} className="form-select" style={ctl}>
                {allSeasons.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="__new__">+ Ny säsong...</option>
              </select>
              {season === '__new__' && (
                <input type="text" value={customSeason} onChange={e => setCustomSeason(e.target.value)} className="form-input" style={ctl} placeholder="t.ex. 2026/2027" autoFocus />
              )}
            </div>
          </div>

          <div style={row}>
            <div style={field}>
              <label style={lbl}>Publikantal</label>
              <input type="number" min="0" value={attendance} onChange={e => setAttendance(e.target.value)} className="form-input" style={ctl} placeholder="Valfritt" />
            </div>
            <div style={field}>
              <label style={lbl}>Poliskontakt</label>
              <input type="text" value={policeContact} onChange={e => setPoliceContact(e.target.value)} className="form-input" style={ctl} placeholder="Valfritt" />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }} title="Gäller alla vakter på matchen i löneunderlaget">
            <input type="checkbox" checked={noMealDeduction} onChange={e => setNoMealDeduction(e.target.checked)} />
            Inget matavdrag på den här matchen
          </label>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '12px 18px', borderTop: '1px solid var(--gray-200)', flexShrink: 0 }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '8px 16px' }}>Avbryt</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !date || !opponent.trim()} style={{ padding: '8px 16px' }}>
            {saving ? 'Sparar...' : 'Spara'}
          </button>
        </div>
      </div>
    </div>
  )
}