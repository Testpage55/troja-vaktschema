import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Ordinarie vakter (visas först)
const REGULAR_GUARDS = ['Micke', 'Jocke', 'Patrik', 'Gary', 'Jozsef', 'Tomas']

// Säkerhetsansvariga
const SECURITY_RESPONSIBLE = ['Patrik', 'Micke']

// Timlön för statistik
const HOURLY_RATE = 285 // kr per timme

// Milersättning
const MILEAGE_RATE = 25 // kr per mil

// Funktion för att beräkna arbetstider baserat på matchtid
const calculateWorkTimes = (matchTime) => {
  if (!matchTime || matchTime === 'TBA') {
    return { startTime: '17:00', endTime: '21:30' }
  }

  try {
    const [hours, minutes] = matchTime.split(':').map(Number)
    
    let startHour = hours - 2
    let startMinutes = minutes
    
    startMinutes = Math.round(startMinutes / 15) * 15
    if (startMinutes >= 60) {
      startHour += 1
      startMinutes = 0
    }
    
    const startTime = `${startHour.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}`
    
    let endHour = hours + 2
    let endMinutes = minutes + 30
    
    endMinutes = Math.round(endMinutes / 15) * 15
    if (endMinutes >= 60) {
      endHour += 1
      endMinutes -= 60
    }
    
    const endTime = `${endHour.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
    
    return { startTime, endTime }
  } catch (error) {
    return { startTime: '17:00', endTime: '21:30' }
  }
}

// Security Duty Modal (för både lägg till och redigera)
function SecurityDutyModal({ isOpen, onClose, onSave, duty = null }) {
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
                onChange={(e) => setDate(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="security-person">Person *</label>
              <select
                id="security-person"
                value={person}
                onChange={(e) => setPerson(e.target.value)}
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
              onChange={(e) => setOpponent(e.target.value)}
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
                onChange={(e) => setHours(e.target.value)}
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
                onChange={(e) => setMileageCompensation(e.target.value)}
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
              onChange={(e) => setNotes(e.target.value)}
              className="form-input"
              placeholder="T.ex. Extra ansvar, övertid..."
              rows="3"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Avbryt
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
          >
            {isEditing ? 'Spara ändringar' : 'Lägg till uppdrag'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Add Match Modal
function AddMatchModal({ isOpen, onClose, onSave }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('19:00')
  const [opponent, setOpponent] = useState('')
  const [matchType, setMatchType] = useState('home')
  const [distanceMiles, setDistanceMiles] = useState('')
  const [requiredGuards, setRequiredGuards] = useState(4)

  const resetForm = () => {
    setDate('')
    setTime('19:00')
    setOpponent('')
    setMatchType('home')
    setDistanceMiles('')
    setRequiredGuards(4)
  }

  const handleSave = () => {
    if (!date || !time || !opponent.trim()) {
      alert('Fyll i alla obligatoriska fält (datum, tid, motstånd)')
      return
    }

    if (matchType === 'away' && (!distanceMiles || parseFloat(distanceMiles) <= 0)) {
      alert('Ange antal mil för bortamatch')
      return
    }

    const matchData = {
      date,
      time,
      opponent: opponent.trim(),
      match_type: matchType,
      distance_miles: matchType === 'away' ? parseFloat(distanceMiles) : null,
      required_guards: requiredGuards
    }

    onSave(matchData)
    resetForm()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-match-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Lägg till ny match</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="match-date">Datum *</label>
              <input
                id="match-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="form-input"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="form-group">
              <label htmlFor="match-time">Tid *</label>
              <input
                id="match-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="opponent">Motstånd *</label>
            <input
              id="opponent"
              type="text"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              className="form-input"
              placeholder="t.ex. Växjö Lakers"
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="match-type">Matchtyp</label>
              <select
                id="match-type"
                value={matchType}
                onChange={(e) => setMatchType(e.target.value)}
                className="form-select"
              >
                <option value="home">Hemmamatch</option>
                <option value="away">Bortamatch</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="required-guards">Antal vakter</label>
              <input
                id="required-guards"
                type="number"
                value={requiredGuards}
                onChange={(e) => setRequiredGuards(parseInt(e.target.value) || 4)}
                className="form-input"
                min="1"
                max="10"
              />
            </div>
          </div>

          {matchType === 'away' && (
            <div className="form-group mileage-section">
              <label htmlFor="distance">Avstånd (mil) *</label>
              <input
                id="distance"
                type="number"
                step="0.1"
                value={distanceMiles}
                onChange={(e) => setDistanceMiles(e.target.value)}
                className="form-input"
                placeholder="t.ex. 15.5"
              />
              <div className="mileage-info">
                Milersättning: {MILEAGE_RATE} kr/mil per vakt
                {distanceMiles && (
                  <span className="mileage-preview">
                    {' → '}
                    {(parseFloat(distanceMiles) * MILEAGE_RATE * requiredGuards).toLocaleString('sv-SE')} kr totalt
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Avbryt
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
          >
            Lägg till match
          </button>
        </div>
      </div>
    </div>
  )
}

// Time Picker Modal
function TimePickerModal({ isOpen, onClose, onSave, personName, matchInfo }) {
  const [startTime, setStartTime] = useState('17:00')
  const [endTime, setEndTime] = useState('21:30')
  const [notes, setNotes] = useState('')
  const [calculatedHours, setCalculatedHours] = useState(4.5)

  useEffect(() => {
    if (isOpen && matchInfo?.time) {
      const { startTime: autoStart, endTime: autoEnd } = calculateWorkTimes(matchInfo.time)
      setStartTime(autoStart)
      setEndTime(autoEnd)
    }
  }, [isOpen, matchInfo])

  useEffect(() => {
    if (startTime && endTime) {
      const start = new Date(`2000-01-01T${startTime}:00`)
      const end = new Date(`2000-01-01T${endTime}:00`)
      
      if (end > start) {
        const diffMs = end - start
        const hours = diffMs / (1000 * 60 * 60)
        setCalculatedHours(hours.toFixed(1))
      } else {
        setCalculatedHours(0)
      }
    }
  }, [startTime, endTime])

  const handleSave = () => {
    if (startTime && endTime && parseFloat(calculatedHours) > 0) {
      onSave({
        startTime,
        endTime,
        notes,
        hours: calculatedHours
      })
      onClose()
      setNotes('')
    } else {
      alert('Kontrollera att start- och sluttid är korrekt ifyllda!')
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Registrera arbetstid</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="worker-info">
            <div className="info-card">
              <strong>{personName}</strong>
            </div>
            <div className="info-card">
              <strong>{matchInfo.opponent}</strong>
            </div>
            <div className="info-card">
              <strong>{new Date(matchInfo.date).toLocaleDateString('sv-SE')}</strong>
            </div>
            <div className="info-card">
              <strong>Match: {matchInfo.time}</strong>
            </div>
          </div>

          <div className="standard-notice">
            <div className="notice-box">
              <strong>Standard: 4,5 timmar</strong>
              <p>Start 2h före match • Slut 2,5h efter matchstart</p>
              <p>Justera tiderna nedan om avvikelse behövs</p>
            </div>
          </div>

          <div className="time-inputs">
            <div className="time-input-group">
              <label htmlFor="start-time">Starttid</label>
              <div className="time-display">
                <input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="time-picker"
                />
                <div className="time-label">{startTime}</div>
              </div>
            </div>

            <div className="time-arrow">→</div>

            <div className="time-input-group">
              <label htmlFor="end-time">Sluttid</label>
              <div className="time-display">
                <input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="time-picker"
                />
                <div className="time-label">{endTime}</div>
              </div>
            </div>
          </div>

          <div className="calculated-hours">
            <div className={`hours-display ${calculatedHours == 4.5 ? 'standard' : 'modified'}`}>
              <span className="hours-number">{calculatedHours}</span>
              <span className="hours-text">timmar</span>
              {calculatedHours != 4.5 && (
                <div className="deviation-notice">Avviker från standard</div>
              )}
            </div>
          </div>

          <div className="notes-section">
            <label htmlFor="notes">Anteckningar (valfritt)</label>
            <textarea
              id="notes"
              placeholder="T.ex. Övertid, paus, extratid..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows="3"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Avbryt
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={calculatedHours <= 0}
          >
            Spara {calculatedHours}h
          </button>
        </div>
      </div>
    </div>
  )
}

// Toast Component
function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => removeToast(toast.id)}>×</button>
        </div>
      ))}
    </div>
  )
}

function App() {
  const [matches, setMatches] = useState([])
  const [personnel, setPersonnel] = useState([])
  const [workHours, setWorkHours] = useState([])
  const [securityDuties, setSecurityDuties] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('schedule')
  
  // Modal state
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false)
  const [isAddMatchModalOpen, setIsAddMatchModalOpen] = useState(false)
  const [isSecurityDutyModalOpen, setIsSecurityDutyModalOpen] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [selectedSecurityDuty, setSelectedSecurityDuty] = useState(null)
  
  // Accordion state för månadsgruppering
  const [expandedMonths, setExpandedMonths] = useState(new Set())
  
  // Toast state
  const [toasts, setToasts] = useState([])

  // Filter state
  const [matchFilter, setMatchFilter] = useState('all')

  useEffect(() => {
    fetchData()
  }, [])

  // Toast functions
  const showToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id))
    }, 4000)
  }

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  // FIXADE FUNKTIONER - dessa saknades i ursprungskoden
  const getSecurityHoursForPerson = (personName) => {
    return securityDuties
      .filter(duty => duty.personnel_name === personName)
      .reduce((total, duty) => total + duty.hours, 0)
  }

  const getTotalAllHoursForPerson = (person) => {
    const vaktHours = parseFloat(getTotalHoursForPerson(person.id))
    const securityHours = getSecurityHoursForPerson(person.name)
    return vaktHours + securityHours
  }

  // Expandera alla månader som default när data laddas
  useEffect(() => {
    if (matches.length > 0) {
      const monthGroups = groupMatchesByMonth()
      const allMonthKeys = monthGroups.map(group => group.monthKey)
      setExpandedMonths(new Set(allMonthKeys))
    }
  }, [matches])

  const fetchData = async () => {
    try {
      const { data: personnelData } = await supabase
        .from('personnel')
        .select('*')

      const { data: matchData } = await supabase
        .from('matches')
        .select(`
          *,
          assignments (
            personnel_id,
            is_working
          )
        `)
        .order('date')

      const { data: hoursData } = await supabase
        .from('work_hours')
        .select(`
          *,
          matches(date, opponent),
          personnel(name)
        `)
        .order('work_date', { ascending: false })

      const { data: securityData } = await supabase
        .from('security_duties')
        .select('*')
        .order('date', { ascending: false })

      // Sortera personal: ordinarie först, sedan extra
      const sortedPersonnel = personnelData?.sort((a, b) => {
        const aIsRegular = REGULAR_GUARDS.includes(a.name)
        const bIsRegular = REGULAR_GUARDS.includes(b.name)
        
        if (aIsRegular && !bIsRegular) return -1
        if (!aIsRegular && bIsRegular) return 1
        
        return a.name.localeCompare(b.name)
      }) || []

      setPersonnel(sortedPersonnel)
      setMatches(matchData || [])
      setWorkHours(hoursData || [])
      setSecurityDuties(securityData || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Lägg till eller redigera säkerhetsansvarig uppdrag
  const saveSecurityDuty = async (securityData) => {
    setSaving(true)
    try {
      if (securityData.id) {
        // Redigera befintligt uppdrag
        await supabase
          .from('security_duties')
          .update({
            date: securityData.date,
            opponent: securityData.opponent,
            personnel_name: securityData.personnel_name,
            hours: securityData.hours,
            mileage_compensation: securityData.mileage_compensation,
            notes: securityData.notes
          })
          .eq('id', securityData.id)
        
        showToast(`Säkerhetsansvarig uppdrag för ${securityData.personnel_name} har uppdaterats`, 'success')
      } else {
        // Lägg till nytt uppdrag
        await supabase
          .from('security_duties')
          .insert([{
            date: securityData.date,
            opponent: securityData.opponent,
            personnel_name: securityData.personnel_name,
            hours: securityData.hours,
            mileage_compensation: securityData.mileage_compensation,
            notes: securityData.notes
          }])
        
        showToast(`Säkerhetsansvarig uppdrag för ${securityData.personnel_name} har lagts till`, 'success')
      }
      
      fetchData()
    } catch (error) {
      console.error('Error:', error)
      showToast('Fel vid sparande av säkerhetsansvarig uppdrag', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Ta bort säkerhetsansvarig uppdrag
  const deleteSecurityDuty = async (dutyId, personnelName, opponent) => {
    if (window.confirm(`Är du säker på att du vill ta bort säkerhetsansvarig uppdraget för ${personnelName} - ${opponent}?`)) {
      setSaving(true)
      try {
        await supabase
          .from('security_duties')
          .delete()
          .eq('id', dutyId)
        
        fetchData()
        showToast(`Säkerhetsansvarig uppdrag borttaget`, 'info')
      } catch (error) {
        console.error('Error:', error)
        showToast('Fel vid borttagning', 'error')
      } finally {
        setSaving(false)
      }
    }
  }

  // Öppna modal för att lägga till nytt säkerhetsansvarig uppdrag
  const openAddSecurityDutyModal = () => {
    setSelectedSecurityDuty(null)
    setIsSecurityDutyModalOpen(true)
  }

  // Öppna modal för att redigera säkerhetsansvarig uppdrag
  const openEditSecurityDutyModal = (duty) => {
    setSelectedSecurityDuty(duty)
    setIsSecurityDutyModalOpen(true)
  }

  // Lägg till ny match
  const addMatch = async (matchData) => {
    setSaving(true)
    try {
      await supabase
        .from('matches')
        .insert([{
          date: matchData.date,
          time: matchData.time,
          opponent: matchData.opponent,
          match_type: matchData.match_type,
          distance_miles: matchData.distance_miles,
          required_guards: matchData.required_guards
        }])
      
      fetchData()
      showToast(`Match mot ${matchData.opponent} har lagts till`, 'success')
    } catch (error) {
      console.error('Error:', error)
      showToast('Fel vid tillägg av match', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Automatisk registrering av 4,5h arbetstid
  const addAutomaticWorkHours = async (matchId, personnelId) => {
    try {
      const match = matches.find(m => m.id === matchId)
      if (!match) return

      const { startTime, endTime } = calculateWorkTimes(match.time)

      const { data: existingHours } = await supabase
        .from('work_hours')
        .select('id')
        .eq('match_id', matchId)
        .eq('personnel_id', personnelId)
        .single()

      if (!existingHours) {
        await supabase
          .from('work_hours')
          .insert([{
            match_id: matchId,
            personnel_id: personnelId,
            start_time: startTime,
            end_time: endTime,
            work_date: match.date,
            notes: 'Automatiskt registrerad (4,5h standard)'
          }])
      }
    } catch (error) {
      console.error('Error adding automatic work hours:', error)
    }
  }

  // Ta bort arbetstid
  const removeWorkHours = async (matchId, personnelId) => {
    try {
      await supabase
        .from('work_hours')
        .delete()
        .eq('match_id', matchId)
        .eq('personnel_id', personnelId)
    } catch (error) {
      console.error('Error removing work hours:', error)
    }
  }

  // Toggle working med loading states och toast notifications
  const toggleWorking = async (matchId, personnelId) => {
    setSaving(true)
    try {
      const { data: existing } = await supabase
        .from('assignments')
        .select('*')
        .eq('match_id', matchId)
        .eq('personnel_id', personnelId)
        .single()

      const person = personnel.find(p => p.id === personnelId)
      const match = matches.find(m => m.id === matchId)

      if (existing) {
        const newWorkingStatus = !existing.is_working
        
        await supabase
          .from('assignments')
          .update({ is_working: newWorkingStatus })
          .eq('id', existing.id)

        if (newWorkingStatus) {
          await addAutomaticWorkHours(matchId, personnelId)
          showToast(`${person.name} tillagd för match mot ${match.opponent}`, 'success')
        } else {
          await removeWorkHours(matchId, personnelId)
          showToast(`${person.name} borttagen från match mot ${match.opponent}`, 'info')
        }
      } else {
        await supabase
          .from('assignments')
          .insert([{
            match_id: matchId,
            personnel_id: personnelId,
            is_working: true
          }])
        
        await addAutomaticWorkHours(matchId, personnelId)
        showToast(`${person.name} tillagd för match mot ${match.opponent}`, 'success')
      }

      fetchData()
    } catch (error) {
      console.error('Error:', error)
      showToast('Ett fel uppstod vid uppdatering', 'error')
    } finally {
      setSaving(false)
    }
  }

  const isWorking = (match, personnelId) => {
    const assignment = match.assignments?.find(a => a.personnel_id === personnelId)
    return assignment?.is_working || false
  }

  const getWorkingCount = (match) => {
    return match.assignments?.filter(a => a.is_working).length || 0
  }

  // Kontrollera om arbetstid finns
  const hasWorkHours = (matchId, personnelId) => {
    return workHours.some(wh => 
      wh.match_id === matchId && wh.personnel_id === personnelId
    )
  }

  // Hämta arbetstid info
  const getWorkHoursForMatch = (matchId, personnelId) => {
    return workHours.find(wh => 
      wh.match_id === matchId && wh.personnel_id === personnelId
    )
  }

  // Kontrollera om arbetstid avviker från standard
  const hasDeviatingHours = (matchId, personnelId) => {
    const workHourInfo = getWorkHoursForMatch(matchId, personnelId)
    return workHourInfo && workHourInfo.total_hours != 4.5
  }

  // Hämta detaljerad tooltip-info för en vakt
  const getDetailedTooltip = (match, person) => {
    const workHourInfo = getWorkHoursForMatch(match.id, person.id)
    const totalHours = getTotalHoursForPerson(person.id)
    const totalMatches = workHours.filter(wh => wh.personnel_id === person.id).length
    const avgHours = totalMatches > 0 ? (parseFloat(totalHours) / totalMatches).toFixed(1) : 0
    
    let tooltip = `${person.name}\n`
    tooltip += `Totalt denna säsong: ${totalHours}h (${totalMatches} matcher)\n`
    tooltip += `Snitt per match: ${avgHours}h\n`
    
    if (workHourInfo) {
      tooltip += `\nDenna match:\n`
      tooltip += `${workHourInfo.start_time} - ${workHourInfo.end_time}\n`
      tooltip += `${workHourInfo.total_hours}h`
      if (workHourInfo.total_hours != 4.5) {
        tooltip += ` (avviker från standard 4,5h)`
      }
      if (workHourInfo.notes) {
        tooltip += `\nAnteckning: ${workHourInfo.notes}`
      }
    }
    
    return tooltip
  }

  // Beräkna milersättning för en match
  const calculateMileageForMatch = (match) => {
    if (match.match_type !== 'away' || !match.distance_miles) return 0
    const workingGuards = getWorkingCount(match)
    return match.distance_miles * MILEAGE_RATE * workingGuards
  }

  // Filtrera matcher baserat på typ
  const filterMatches = (matchList) => {
    if (matchFilter === 'all') return matchList
    return matchList.filter(match => {
      const type = match.match_type || 'home'
      return type === matchFilter
    })
  }

  // Öppna tid-modal
  const openTimeModal = (matchId, personnelId) => {
    const match = matches.find(m => m.id === matchId)
    const person = personnel.find(p => p.id === personnelId)
    
    setSelectedMatch(match)
    setSelectedPerson(person)
    setIsTimeModalOpen(true)
  }

  // Spara arbetstid från modal med toast notifications
  const saveWorkTime = async (timeData) => {
    setSaving(true)
    try {
      await supabase
        .from('work_hours')
        .delete()
        .eq('match_id', selectedMatch.id)
        .eq('personnel_id', selectedPerson.id)

      await supabase
        .from('work_hours')
        .insert([{
          match_id: selectedMatch.id,
          personnel_id: selectedPerson.id,
          start_time: timeData.startTime,
          end_time: timeData.endTime,
          work_date: selectedMatch.date,
          notes: timeData.notes
        }])
      
      fetchData()
      showToast(`Arbetstid uppdaterad för ${selectedPerson.name} (${timeData.hours}h)`, 'success')
    } catch (error) {
      console.error('Error:', error)
      showToast('Fel vid sparande av arbetstid', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Lägg till personal med toast notifications
  const addPersonnel = async () => {
    const name = prompt('Namn på ny vakt:')

    if (name && name.trim()) {
      setSaving(true)
      try {
        await supabase
          .from('personnel')
          .insert([{ 
            name: name.trim()
          }])
        fetchData()
        showToast(`${name.trim()} har lagts till som vakt`, 'success')
      } catch (error) {
        console.error('Error:', error)
        showToast('Fel vid tillägg av vakt', 'error')
      } finally {
        setSaving(false)
      }
    }
  }

  const deletePersonnel = async (personnelId, name) => {
    if (window.confirm(`Är du säker på att du vill ta bort ${name}?`)) {
      setSaving(true)
      try {
        await supabase.from('assignments').delete().eq('personnel_id', personnelId)
        await supabase.from('work_hours').delete().eq('personnel_id', personnelId)
        await supabase.from('personnel').delete().eq('id', personnelId)
        fetchData()
        showToast(`${name} har tagits bort`, 'info')
      } catch (error) {
        console.error('Error:', error)
        showToast('Fel vid borttagning', 'error')
      } finally {
        setSaving(false)
      }
    }
  }

  const getTotalHoursForPerson = (personnelId) => {
    return workHours
      .filter(wh => wh.personnel_id === personnelId)
      .reduce((total, wh) => total + (wh.total_hours || 0), 0)
      .toFixed(1)
  }

  const exportWorkHours = (personnelId = null) => {
    let workDataToExport = workHours
    let securityDataToExport = securityDuties

    if (personnelId) {
      const personName = personnel.find(p => p.id === personnelId)?.name
      workDataToExport = workHours.filter(wh => wh.personnel_id === personnelId)
      securityDataToExport = securityDuties.filter(duty => duty.personnel_name === personName)
    }

    const csvHeaders = 'Typ,Datum,Match/Uppdrag,Personal,Starttid,Sluttid,Timmar,Milersättning,Anteckningar\n'
    
    // Kombinera vanliga arbetstider och säkerhetsuppdrag
    const allEntries = [
      ...workDataToExport.map(wh => ({
        type: 'Vakt',
        date: wh.work_date || wh.matches?.date,
        opponent: wh.matches?.opponent,
        personnel: wh.personnel?.name,
        start_time: wh.start_time,
        end_time: wh.end_time,
        hours: wh.total_hours || 0,
        mileage: '',
        notes: wh.notes || '',
        sortDate: new Date(wh.work_date || wh.matches?.date || '1900-01-01')
      })),
      ...securityDataToExport.map(duty => ({
        type: 'Säkerhetsansvarig',
        date: duty.date,
        opponent: duty.opponent,
        personnel: duty.personnel_name,
        start_time: '-',
        end_time: '-',
        hours: duty.hours,
        mileage: duty.mileage_compensation || 0,
        notes: duty.notes || '',
        sortDate: new Date(duty.date)
      }))
    ].sort((a, b) => b.sortDate - a.sortDate)

    const csvData = allEntries.map(entry => 
      `${entry.type},${entry.date},${entry.opponent},${entry.personnel},${entry.start_time},${entry.end_time},${entry.hours},${entry.mileage},"${entry.notes}"`
    ).join('\n')

    const blob = new Blob([csvHeaders + csvData], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    
    const filename = personnelId 
      ? `arbetstid_${personnel.find(p => p.id === personnelId)?.name || 'person'}.csv`
      : 'arbetstid_alla.csv'
    
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Funktioner för månadsgruppering
  const toggleMonth = (monthKey) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev)
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey)
      } else {
        newSet.add(monthKey)
      }
      return newSet
    })
  }

  // Gruppera matcher per månad (med filtrering)
  const groupMatchesByMonth = () => {
    const groups = {}
    const filteredMatches = filterMatches(matches)
    
    filteredMatches.forEach(match => {
      const date = new Date(match.date)
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`
      const monthName = date.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' })
      
      if (!groups[monthKey]) {
        groups[monthKey] = {
          monthName,
          monthKey,
          matches: []
        }
      }
      groups[monthKey].matches.push(match)
    })
    
    return Object.values(groups).sort((a, b) => {
      const [yearA, monthA] = a.monthKey.split('-').map(Number)
      const [yearB, monthB] = b.monthKey.split('-').map(Number)
      return yearA !== yearB ? yearA - yearB : monthA - monthB
    })
  }

  // Separera ordinarie och extra vakter
  const regularPersonnel = personnel.filter(p => REGULAR_GUARDS.includes(p.name))
  const extraPersonnel = personnel.filter(p => !REGULAR_GUARDS.includes(p.name))

  // Beräkna data för statistik inklusive milersättning och säkerhetsansvariga
  const personnelStatsData = personnel.map(person => {
    const personHours = workHours.filter(wh => wh.personnel_id === person.id).reduce((total, wh) => total + (wh.total_hours || 0), 0)
    const personMatches = workHours.filter(wh => wh.personnel_id === person.id)
    
    // Vanlig milersättning från matcher
    let personMileage = 0
    personMatches.forEach(wh => {
      const match = matches.find(m => m.id === wh.match_id)
      if (match && match.match_type === 'away' && match.distance_miles) {
        personMileage += match.distance_miles * MILEAGE_RATE
      }
    })

    // Säkerhetsansvariga uppdrag
    const securityDutiesForPerson = securityDuties.filter(duty => duty.personnel_name === person.name)
    const securityHours = securityDutiesForPerson.reduce((total, duty) => total + duty.hours, 0)
    const securityMileage = securityDutiesForPerson.reduce((total, duty) => total + (duty.mileage_compensation || 0), 0)
    
    const totalHours = personHours + securityHours
    const totalMileage = personMileage + securityMileage
    
    return {
      name: person.name,
      matches: personMatches.length,
      hours: totalHours,
      salary: totalHours * HOURLY_RATE,
      mileage: totalMileage,
      totalCompensation: (totalHours * HOURLY_RATE) + totalMileage,
      securityDuties: securityDutiesForPerson.length,
      securityHours: securityHours
    }
  })

  // Totala statistik inklusive säkerhetsansvariga
  const totalMatchesWorked = workHours.length
  const totalSecurityDuties = securityDuties.length
  const totalHoursWorked = workHours.reduce((total, wh) => total + (wh.total_hours || 0), 0)
  const totalSecurityHours = securityDuties.reduce((total, duty) => total + duty.hours, 0)
  const totalAllHours = totalHoursWorked + totalSecurityHours
  const totalSalary = totalAllHours * HOURLY_RATE
  const totalMileage = matches.reduce((total, match) => total + calculateMileageForMatch(match), 0)
  const totalSecurityMileage = securityDuties.reduce((total, duty) => total + (duty.mileage_compensation || 0), 0)
  const totalAllMileage = totalMileage + totalSecurityMileage
  const totalMiles = matches.filter(m => m.match_type === 'away').reduce((total, match) => total + (match.distance_miles * getWorkingCount(match) || 0), 0)
  const totalCompensation = totalSalary + totalAllMileage

  // Kombinera och sortera arbetstider och säkerhetsansvariga för arbetstider-tabellen
  const allWorkEntries = [
    ...workHours.map(wh => ({
      ...wh,
      type: 'work',
      sortDate: new Date(wh.work_date || wh.matches?.date || '1900-01-01')
    })),
    ...securityDuties.map(duty => ({
      ...duty,
      type: 'security',
      sortDate: new Date(duty.date)
    }))
  ].sort((a, b) => b.sortDate - a.sortDate)
  
  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <h1>Laddar vaktschema...</h1>
      </div>
    )
  }

  return (
    <div className="app">
      {/* Loading overlay */}
      {saving && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <span>Sparar...</span>
        </div>
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Modern Header med logotyp */}
      <div className="header">
        <div className="logo">
          <img src="/images/troja-logo.png" alt="Troja-Ljungby Logotyp" />
        </div>
        <div>
          <h1>Troja-Ljungby Vaktschema</h1>
          <p>Säsong 2025/2026 • {matches.length} matcher</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs">
        <button 
          className={activeTab === 'schedule' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('schedule')}
        >
          Schema
        </button>
        <button 
          className={activeTab === 'personnel' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('personnel')}
        >
          Personal
        </button>
        <button 
          className={activeTab === 'hours' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('hours')}
        >
          Arbetstider
        </button>
        <button 
          className={activeTab === 'security' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('security')}
        >
          Säkerhetsansvarig
        </button>
        <button 
          className={activeTab === 'stats' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('stats')}
        >
          Statistik
        </button>
      </div>

      {/* Schema Tab */}
      {activeTab === 'schedule' && (
        <div className="tab-content">
          <div className="actions">
            <div className="match-filter">
              <label htmlFor="match-filter">Visa:</label>
              <select
                id="match-filter"
                value={matchFilter}
                onChange={(e) => setMatchFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">Alla matcher ({matches.length})</option>
                <option value="home">Hemmamatcher ({matches.filter(m => (m.match_type || 'home') === 'home').length})</option>
                <option value="away">Bortamatcher ({matches.filter(m => m.match_type === 'away').length})</option>
              </select>
            </div>
            <button 
              className="btn btn-success"
              onClick={() => setIsAddMatchModalOpen(true)}
              disabled={saving}
            >
              + Lägg till match
            </button>
          </div>

          <div className="month-accordion">
            {groupMatchesByMonth().map(monthGroup => {
              const isExpanded = expandedMonths.has(monthGroup.monthKey)
              
              return (
                <div key={monthGroup.monthKey} className="month-group" style={{
                  backgroundColor: 'white',
                  marginBottom: '20px',
                  borderRadius: '10px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <div 
                    className="month-header"
                    onClick={() => toggleMonth(monthGroup.monthKey)}
                    style={{
                      padding: '15px 20px',
                      cursor: 'pointer',
                      borderRadius: '10px 10px 0 0',
                      backgroundColor: '#f8fafc',
                      borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none'
                    }}
                  >
                    <div className="month-title" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <div className="month-expand-icon" style={{
                        fontSize: '12px',
                        color: '#6b7280'
                      }}>
                        {isExpanded ? '▼' : '▶'}
                      </div>
                      <h3 style={{ margin: 0, color: '#374151' }}>{monthGroup.monthName}</h3>
                      <span className="match-count" style={{
                        fontSize: '14px',
                        color: '#6b7280'
                      }}>({monthGroup.matches.length} matcher)</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="month-content" style={{ padding: '0' }}>
                      <div 
                        className="table-container" 
                        style={{
                          overflowX: 'auto',
                          overflowY: 'visible',
                          maxWidth: '100%',
                          margin: '0',
                          border: 'none',
                          borderRadius: '0 0 10px 10px'
                        }}
                      >
                        <table 
                          className="schedule-table" 
                          style={{
                            width: '100%',
                            minWidth: 'max-content',
                            borderCollapse: 'collapse',
                            backgroundColor: 'white'
                          }}
                        >
                          <thead>
                            <tr>
                              <th>Datum</th>
                              <th>Veckodag</th>
                              <th>Tid</th>
                              <th>Motstånd</th>
                              <th>Vakter</th>
                              {regularPersonnel.map(person => (
                                <th key={person.id} className="regular-guard">{person.name}</th>
                              ))}
                              {extraPersonnel.length > 0 && (
                                <th className="extra-divider">|</th>
                              )}
                              {extraPersonnel.map(person => (
                                <th key={person.id} className="extra-guard">{person.name}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {monthGroup.matches.map(match => {
                              const matchType = match.match_type || 'home'
                              const mileageForMatch = calculateMileageForMatch(match)
                              
                              return (
                                <tr key={match.id} className={`match-row ${matchType}-match`}>
                                  <td>{new Date(match.date).toLocaleDateString('sv-SE')}</td>
                                  <td>{new Date(match.date).toLocaleDateString('sv-SE', { weekday: 'long' })}</td>
                                  <td>{match.time}</td>
                                  <td>
                                    {match.opponent}
                                    {matchType === 'away' && match.distance_miles && (
                                      <div className="mileage-info-small">
                                        {match.distance_miles} mil • {mileageForMatch.toLocaleString('sv-SE')} kr
                                      </div>
                                    )}
                                  </td>
                                  <td>
                                    <span className={`badge ${getWorkingCount(match) >= (match.required_guards || 4) ? 'badge-success' : 'badge-danger'}`}>
                                      {getWorkingCount(match)}/{match.required_guards || 4}
                                    </span>
                                  </td>
                                  {regularPersonnel.map(person => {
                                    const workingStatus = isWorking(match, person.id)
                                    const hasHours = hasWorkHours(match.id, person.id)
                                    const workHourInfo = getWorkHoursForMatch(match.id, person.id)
                                    const deviatingHours = hasDeviatingHours(match.id, person.id)
                                    const tooltip = getDetailedTooltip(match, person)
                                    
                                    return (
                                      <td key={person.id}>
                                        <div className="guard-cell-content">
                                          <button
                                            className={`btn-circle ${workingStatus ? 'btn-success' : 'btn-danger'}`}
                                            onClick={() => toggleWorking(match.id, person.id)}
                                            title={tooltip}
                                            disabled={saving}
                                          >
                                            {workingStatus ? '✓' : '✗'}
                                          </button>
                                          <div className="work-hours-area">
                                            {workingStatus && hasHours && (
                                              <>
                                                <span className={`hours-badge ${deviatingHours ? 'hours-deviation' : ''}`}>
                                                  {workHourInfo?.total_hours || 4.5}h
                                                  {deviatingHours && <span className="deviation-icon">⚠️</span>}
                                                </span>
                                                <button
                                                  className="btn-time"
                                                  onClick={() => openTimeModal(match.id, person.id)}
                                                  title="Klicka för att ändra arbetstider"
                                                  disabled={saving}
                                                >
                                                  Ändra
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    )
                                  })}
                                  {extraPersonnel.length > 0 && (
                                    <td className="extra-divider"></td>
                                  )}
                                  {extraPersonnel.map(person => {
                                    const workingStatus = isWorking(match, person.id)
                                    const hasHours = hasWorkHours(match.id, person.id)
                                    const workHourInfo = getWorkHoursForMatch(match.id, person.id)
                                    const deviatingHours = hasDeviatingHours(match.id, person.id)
                                    const tooltip = getDetailedTooltip(match, person)
                                    
                                    return (
                                      <td key={person.id} className="extra-guard-cell">
                                        <div className="guard-cell-content">
                                          <button
                                            className={`btn-circle ${workingStatus ? 'btn-success' : 'btn-danger'}`}
                                            onClick={() => toggleWorking(match.id, person.id)}
                                            title={tooltip}
                                            disabled={saving}
                                          >
                                            {workingStatus ? '✓' : '✗'}
                                          </button>
                                          <div className="work-hours-area">
                                            {workingStatus && hasHours && (
                                              <>
                                                <span className={`hours-badge ${deviatingHours ? 'hours-deviation' : ''}`}>
                                                  {workHourInfo?.total_hours || 4.5}h
                                                  {deviatingHours && <span className="deviation-icon">⚠️</span>}
                                                </span>
                                                <button
                                                  className="btn-time"
                                                  onClick={() => openTimeModal(match.id, person.id)}
                                                  title="Klicka för att ändra arbetstider"
                                                  disabled={saving}
                                                >
                                                  Ändra
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    )
                                  })}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Personal Tab */}
      {activeTab === 'personnel' && (
        <div className="tab-content">
          <div className="actions">
            <button 
              className="btn btn-success"
              onClick={addPersonnel}
              disabled={saving}
            >
              + Lägg till vakt
            </button>
          </div>

          <div className="personnel-sections">
            <div className="personnel-section">
              <h3>Ordinarie vakter</h3>
              <div className="table-container">
                <table className="personnel-table">
                  <thead>
                    <tr>
                      <th>Namn</th>
                      <th>Vakt-timmar</th>
                      <th>Säkerhets-timmar</th>
                      <th>Totala timmar</th>
                      <th>Åtgärder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regularPersonnel.map(person => {
                      const vaktHours = getTotalHoursForPerson(person.id)
                      const securityHours = getSecurityHoursForPerson(person.name)
                      const totalHours = getTotalAllHoursForPerson(person)
                      
                      return (
                        <tr key={person.id}>
                          <td><strong>{person.name}</strong></td>
                          <td><strong>{vaktHours}h</strong></td>
                          <td>
                            {securityHours > 0 ? (
                              <strong style={{ color: 'var(--primary)' }}>{securityHours.toFixed(1)}h</strong>
                            ) : (
                              <span style={{ color: 'var(--gray-500)' }}>0h</span>
                            )}
                          </td>
                          <td>
                            <strong style={{ color: 'var(--primary-dark)', fontSize: '1.1rem' }}>
                              {totalHours.toFixed(1)}h
                            </strong>
                          </td>
                          <td>
                            <button 
                              className="btn btn-sm btn-success"
                              onClick={() => exportWorkHours(person.id)}
                              disabled={saving}
                            >
                              Exportera
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {extraPersonnel.length > 0 && (
              <div className="personnel-section">
                <h3>Extra vakter</h3>
                <div className="table-container">
                  <table className="personnel-table">
                    <thead>
                      <tr>
                        <th>Namn</th>
                        <th>Totala timmar</th>
                        <th>Åtgärder</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extraPersonnel.map(person => (
                        <tr key={person.id}>
                          <td>{person.name}</td>
                          <td>
                            <strong>{getTotalHoursForPerson(person.id)}h</strong>
                          </td>
                          <td>
                            <button 
                              className="btn btn-sm btn-success"
                              onClick={() => exportWorkHours(person.id)}
                              disabled={saving}
                            >
                              Exportera
                            </button>
                            <button 
                              className="btn btn-danger btn-sm"
                              onClick={() => deletePersonnel(person.id, person.name)}
                              disabled={saving}
                            >
                              Ta bort
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Arbetstider Tab */}
      {activeTab === 'hours' && (
        <div className="tab-content">
          <div className="actions">
            <button 
              className="btn btn-success"
              onClick={() => exportWorkHours()}
              disabled={saving}
            >
              Exportera alla arbetstider
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Typ</th>
                  <th>Datum</th>
                  <th>Match/Uppdrag</th>
                  <th>Personal</th>
                  <th>Starttid</th>
                  <th>Sluttid</th>
                  <th>Timmar</th>
                  <th>Anteckningar</th>
                </tr>
              </thead>
              <tbody>
                {allWorkEntries.map(entry => {
                  if (entry.type === 'work') {
                    return (
                      <tr key={`work-${entry.id}`} className={entry.total_hours != 4.5 ? 'non-standard-hours' : ''}>
                        <td>
                          <span className="badge badge-success">Vakt</span>
                        </td>
                        <td>{new Date(entry.work_date || entry.matches?.date).toLocaleDateString('sv-SE')}</td>
                        <td>{entry.matches?.opponent}</td>
                        <td>{entry.personnel?.name}</td>
                        <td>{entry.start_time}</td>
                        <td>{entry.end_time}</td>
                        <td>
                          <strong>{entry.total_hours}h</strong>
                          {entry.total_hours != 4.5 && <span className="deviation-mark"> ⚠️</span>}
                        </td>
                        <td>{entry.notes || '-'}</td>
                      </tr>
                    )
                  } else {
                    return (
                      <tr key={`security-${entry.id}`}>
                        <td>
                          <span className="badge badge-warning">Säkerhet</span>
                        </td>
                        <td>{new Date(entry.date).toLocaleDateString('sv-SE')}</td>
                        <td>{entry.opponent}</td>
                        <td>{entry.personnel_name}</td>
                        <td>-</td>
                        <td>-</td>
                        <td>
                          <strong>{entry.hours}h</strong>
                        </td>
                        <td>{entry.notes || '-'}</td>
                      </tr>
                    )
                  }
                })}
              </tbody>
            </table>
          </div>

          <div className="summary-section">
            <h3>Sammanfattning</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <h4>Vanliga vakter</h4>
                <p><strong>Antal tillfällen:</strong> {workHours.length}</p>
                <p><strong>Totala timmar:</strong> {workHours.reduce((total, wh) => total + (wh.total_hours || 0), 0).toFixed(1)}h</p>
                <p><strong>Standard 4,5h-pass:</strong> {workHours.filter(wh => wh.total_hours == 4.5).length}</p>
                <p><strong>Avvikande pass:</strong> {workHours.filter(wh => wh.total_hours != 4.5).length}</p>
              </div>
              <div>
                <h4>Säkerhetsansvariga uppdrag</h4>
                <p><strong>Antal uppdrag:</strong> {securityDuties.length}</p>
                <p><strong>Totala timmar:</strong> {securityDuties.reduce((total, duty) => total + duty.hours, 0).toFixed(1)}h</p>
                <p><strong>Genomsnitt per uppdrag:</strong> {securityDuties.length > 0 ? (securityDuties.reduce((total, duty) => total + duty.hours, 0) / securityDuties.length).toFixed(1) : 0}h</p>
              </div>
            </div>
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: 'var(--gray-50)', borderRadius: 'var(--radius-sm)' }}>
              <h4>Totalt (Vakter + Säkerhetsansvariga)</h4>
              <p><strong>Totala arbetstillfällen:</strong> {workHours.length + securityDuties.length}</p>
              <p><strong>Totala arbetstimmar:</strong> {(workHours.reduce((total, wh) => total + (wh.total_hours || 0), 0) + securityDuties.reduce((total, duty) => total + duty.hours, 0)).toFixed(1)}h</p>
            </div>
          </div>
        </div>
      )}

      {/* Säkerhetsansvarig Tab */}
      {activeTab === 'security' && (
        <div className="tab-content">
          <div className="actions">
            <button 
              className="btn btn-success"
              onClick={openAddSecurityDutyModal}
              disabled={saving}
            >
              + Lägg till säkerhetsansvarig uppdrag
            </button>
          </div>

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
                {securityDuties.map(duty => {
                  const totalCompensation = (duty.hours * HOURLY_RATE) + (duty.mileage_compensation || 0)
                  return (
                    <tr key={duty.id}>
                      <td>{new Date(duty.date).toLocaleDateString('sv-SE')}</td>
                      <td><strong>{duty.opponent}</strong></td>
                      <td>
                        <span className="stat-badge">{duty.personnel_name}</span>
                      </td>
                      <td className="text-center">
                        <strong>{duty.hours}h</strong>
                      </td>
                      <td className="text-center">
                        <strong>{(duty.mileage_compensation || 0).toLocaleString('sv-SE')} kr</strong>
                      </td>
                      <td className="text-center">
                        <strong className="total-compensation">{totalCompensation.toLocaleString('sv-SE')} kr</strong>
                      </td>
                      <td>{duty.notes || '-'}</td>
                      <td>
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
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="summary-section">
            <h3>Sammanfattning säkerhetsansvariga uppdrag</h3>
            <p><strong>Totalt antal uppdrag:</strong> {securityDuties.length}</p>
            <p><strong>Totala timmar:</strong> {securityDuties.reduce((total, duty) => total + duty.hours, 0).toFixed(1)}h</p>
            <p><strong>Total lönekostnad:</strong> {(securityDuties.reduce((total, duty) => total + duty.hours, 0) * HOURLY_RATE).toLocaleString('sv-SE')} kr</p>
            <p><strong>Total milersättning:</strong> {securityDuties.reduce((total, duty) => total + (duty.mileage_compensation || 0), 0).toLocaleString('sv-SE')} kr</p>
            <p><strong>Total ersättning:</strong> {securityDuties.reduce((total, duty) => total + (duty.hours * HOURLY_RATE) + (duty.mileage_compensation || 0), 0).toLocaleString('sv-SE')} kr</p>
            
            <div style={{ marginTop: '20px' }}>
              <h4>Per person:</h4>
              {SECURITY_RESPONSIBLE.map(person => {
                const personDuties = securityDuties.filter(duty => duty.personnel_name === person)
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
      )}
      
      {/* Statistik Tab */}
      {activeTab === 'stats' && (
        <div className="tab-content">
          <h2>Säsongsöversikt</h2>
          
          {/* Huvudstatistik */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '20px', 
            marginBottom: '30px' 
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '25px',
              borderRadius: '15px',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', opacity: '0.9' }}>TOTALA MATCHER</h3>
              <p style={{ margin: '0', fontSize: '36px', fontWeight: 'bold' }}>{matches.length}</p>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: 'white',
              padding: '25px',
              borderRadius: '15px',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', opacity: '0.9' }}>ARBETSTILLFÄLLEN</h3>
              <p style={{ margin: '0', fontSize: '36px', fontWeight: 'bold' }}>{totalMatchesWorked + totalSecurityDuties}</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '12px', opacity: '0.8' }}>
                {totalMatchesWorked} vakt + {totalSecurityDuties} säkerhet
              </p>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white',
              padding: '25px',
              borderRadius: '15px',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', opacity: '0.9' }}>TOTALA TIMMAR</h3>
              <p style={{ margin: '0', fontSize: '36px', fontWeight: 'bold' }}>{totalAllHours.toFixed(1)}h</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '12px', opacity: '0.8' }}>
                Snitt: {(totalMatchesWorked + totalSecurityDuties) > 0 ? (totalAllHours / (totalMatchesWorked + totalSecurityDuties)).toFixed(1) : 0}h/tillfälle
              </p>
            </div>
          </div>

          {/* Ekonomisk översikt */}
          <div style={{ 
            backgroundColor: 'white', 
            padding: '25px', 
            borderRadius: '15px', 
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            marginBottom: '30px'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>💰 Ekonomisk översikt</h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
              gap: '20px' 
            }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: '0', fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Lönekostnad</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '24px', fontWeight: 'bold', color: '#2563eb' }}>
                  {totalSalary.toLocaleString('sv-SE')} kr
                </p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: '0', fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Milersättning</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '24px', fontWeight: 'bold', color: '#059669' }}>
                  {totalAllMileage.toLocaleString('sv-SE')} kr
                </p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: '0', fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Total kostnad</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '28px', fontWeight: 'bold', color: '#dc2626' }}>
                  {totalCompensation.toLocaleString('sv-SE')} kr
                </p>
              </div>
            </div>
          </div>

          {/* Snabbfakta */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
            gap: '15px',
            marginBottom: '30px'
          }}>
            <div style={{
              backgroundColor: '#f8fafc',
              padding: '15px',
              borderRadius: '10px',
              textAlign: 'center',
              border: '1px solid #e2e8f0'
            }}>
              <p style={{ margin: '0', fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Timlön</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#334155' }}>{HOURLY_RATE} kr</p>
            </div>
            <div style={{
              backgroundColor: '#f8fafc',
              padding: '15px',
              borderRadius: '10px',
              textAlign: 'center',
              border: '1px solid #e2e8f0'
            }}>
              <p style={{ margin: '0', fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Totala mil</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#334155' }}>{totalMiles.toFixed(0)} mil</p>
            </div>
          </div>
          
          <div className="chart-container">
            <h3>Arbetstillfällen och timmar per vakt</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={personnelStatsData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 80,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="matches" name="Tillfällen" fill="#16a34a" />
                <Bar dataKey="hours" name="Timmar" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="personnel-stats-table">
            <h3>Detaljerad statistik per vakt (inklusive säkerhetsansvariga uppdrag)</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Namn</th>
                    <th>Arbetstillfällen</th>
                    <th>Säkerhetsuppdrag</th>
                    <th>Totala timmar</th>
                    <th>Lön (285 kr/h)</th>
                    <th>Milersättning</th>
                    <th>Total ersättning</th>
                    <th>Snitt timmar/tillfälle</th>
                    <th>Andel av matcher</th>
                  </tr>
                </thead>
                <tbody>
                  {personnelStatsData
                    .sort((a, b) => b.matches - a.matches)
                    .map(person => (
                    <tr key={person.name}>
                      <td><strong>{person.name}</strong></td>
                      <td className="text-center">
                        <span className="stat-badge">{person.matches}</span>
                      </td>
                      <td className="text-center">
                        <span className="stat-badge">{person.securityDuties}</span>
                      </td>
                      <td className="text-center">
                        <strong>{person.hours.toFixed(1)}h</strong>
                        {person.securityHours > 0 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                            ({person.securityHours.toFixed(1)}h säkerhet)
                          </div>
                        )}
                      </td>
                      <td className="text-center">
                        <strong>{person.salary.toLocaleString('sv-SE')} kr</strong>
                      </td>
                      <td className="text-center">
                        <strong>{person.mileage.toLocaleString('sv-SE')} kr</strong>
                      </td>
                      <td className="text-center">
                        <strong className="total-compensation">{person.totalCompensation.toLocaleString('sv-SE')} kr</strong>
                      </td>
                      <td className="text-center">
                        {(person.matches + person.securityDuties) > 0 ? (person.hours / (person.matches + person.securityDuties)).toFixed(1) : 0}h
                      </td>
                      <td className="text-center">
                        <span className="percentage-badge">
                          {matches.length > 0 ? Math.round((person.matches / matches.length) * 100) : 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Time Picker Modal */}
      <TimePickerModal
        isOpen={isTimeModalOpen}
        onClose={() => setIsTimeModalOpen(false)}
        onSave={saveWorkTime}
        personName={selectedPerson?.name}
        matchInfo={selectedMatch || {}}
      />

      {/* Add Match Modal */}
      <AddMatchModal
        isOpen={isAddMatchModalOpen}
        onClose={() => setIsAddMatchModalOpen(false)}
        onSave={addMatch}
      />

      {/* Security Duty Modal (för både lägg till och redigera) */}
      <SecurityDutyModal
        isOpen={isSecurityDutyModalOpen}
        onClose={() => setIsSecurityDutyModalOpen(false)}
        onSave={saveSecurityDuty}
        duty={selectedSecurityDuty}
      />
    </div>
  )
}

export default App