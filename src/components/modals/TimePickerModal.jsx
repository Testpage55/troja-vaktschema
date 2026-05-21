import { useState, useEffect } from 'react'
import { calculateWorkTimes } from '../../utils/timeUtils'

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(mins) {
  // Hantera dygnskifte
  const total = ((mins % 1440) + 1440) % 1440
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function calcHours(start, end) {
  if (!start || !end) return 0
  let diff = timeToMinutes(end) - timeToMinutes(start)
  if (diff <= 0) diff += 1440 // nästa dygn
  return parseFloat((diff / 60).toFixed(1))
}

export default function TimePickerModal({ isOpen, onClose, onSave, personName, matchInfo }) {
  const [startTime, setStartTime] = useState('17:00')
  const [endTime, setEndTime] = useState('21:30')
  const [hoursInput, setHoursInput] = useState('4.5')
  const [notes, setNotes] = useState('')
  const [lastChanged, setLastChanged] = useState('times') // 'times' | 'hours'

  useEffect(() => {
    if (isOpen) {
      if (matchInfo?.time) {
        const { startTime: autoStart, endTime: autoEnd } = calculateWorkTimes(matchInfo.time)
        setStartTime(autoStart)
        setEndTime(autoEnd)
        setHoursInput(String(calcHours(autoStart, autoEnd)))
      } else {
        setStartTime('17:00')
        setEndTime('21:30')
        setHoursInput('4.5')
      }
      setLastChanged('times')
      setNotes('')
    }
  }, [isOpen, matchInfo])

  // När start eller sluttid ändras → räkna om timmar
  const handleStartChange = (val) => {
    setStartTime(val)
    setLastChanged('times')
    if (val && endTime) setHoursInput(String(calcHours(val, endTime)))
  }

  const handleEndChange = (val) => {
    setEndTime(val)
    setLastChanged('times')
    if (startTime && val) setHoursInput(String(calcHours(startTime, val)))
  }

  // När timmar ändras → räkna ut sluttid
  const handleHoursChange = (val) => {
    setHoursInput(val)
    setLastChanged('hours')
    const h = parseFloat(val)
    if (!isNaN(h) && h > 0 && startTime) {
      const startMins = timeToMinutes(startTime)
      const endMins = startMins + Math.round(h * 60)
      setEndTime(minutesToTime(endMins))
    }
  }

  const hours = calcHours(startTime, endTime)
  const crossesMidnight = startTime && endTime && timeToMinutes(endTime) <= timeToMinutes(startTime)

  const handleSave = () => {
    if (!startTime || !endTime || hours <= 0) {
      alert('Kontrollera att tiderna är korrekt ifyllda!')
      return
    }
    onSave({ startTime, endTime, notes, hours: hoursInput || String(hours) })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '10px'
      }}
    >
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'white', borderRadius: '15px',
          width: '100%', maxWidth: '400px',
          maxHeight: '90vh', overflow: 'auto', margin: '0 auto'
        }}
      >
        <div style={{
          backgroundColor: '#ef4444', color: 'white',
          padding: '20px', borderRadius: '15px 15px 0 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Registrera arbetstid</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <strong style={{ color: '#374151' }}>{personName}</strong>
            </div>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <strong style={{ color: '#374151' }}>{matchInfo?.opponent}</strong>
            </div>
            {matchInfo?.date && (
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center', gridColumn: '1 / -1' }}>
                <strong>{new Date(matchInfo.date).toLocaleDateString('sv-SE')}</strong>
                {matchInfo.time && <span style={{ fontSize: '14px', color: '#6b7280' }}> • {matchInfo.time}</span>}
              </div>
            )}
          </div>

          {/* Starttid + Sluttid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '10px', alignItems: 'end', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px', color: '#374151' }}>Starttid</label>
              <input
                type="time"
                value={startTime}
                onChange={e => handleStartChange(e.target.value)}
                style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '16px', textAlign: 'center', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ fontSize: '18px', color: '#9ca3af', paddingBottom: '10px' }}>→</div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px', color: '#374151' }}>
                Sluttid
                {crossesMidnight && <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '6px' }}>+1 dag</span>}
              </label>
              <input
                type="time"
                value={endTime}
                onChange={e => handleEndChange(e.target.value)}
                style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '16px', textAlign: 'center', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Timmar */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px', color: '#374151' }}>Antal timmar</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="number"
                step="0.5"
                min="0"
                value={hoursInput}
                onChange={e => handleHoursChange(e.target.value)}
                style={{
                  width: '120px', padding: '10px 12px',
                  border: `2px solid ${hours === 4.5 ? '#10b981' : '#f59e0b'}`,
                  borderRadius: '8px', fontSize: '20px', fontWeight: 'bold',
                  color: hours === 4.5 ? '#047857' : '#d97706',
                  textAlign: 'center'
                }}
              />
              <span style={{ fontSize: '14px', color: '#6b7280' }}>
                {crossesMidnight ? 'timmar (nästa dygn)' : 'timmar'}
              </span>
            </div>
          </div>

          {/* Anteckningar */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px', color: '#374151' }}>Anteckningar (valfritt)</label>
            <textarea
              placeholder="T.ex. övertid, paus..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows="2"
              style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', gap: '10px', borderTop: '1px solid #e5e7eb' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '500', cursor: 'pointer', backgroundColor: '#6b7280', color: 'white' }}
          >
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={hours <= 0}
            style={{
              flex: 1, padding: '12px', border: 'none', borderRadius: '8px',
              fontSize: '15px', fontWeight: '500',
              cursor: hours <= 0 ? 'not-allowed' : 'pointer',
              backgroundColor: hours <= 0 ? '#9ca3af' : '#ef4444',
              color: 'white'
            }}
          >
            Spara {hours}h
          </button>
        </div>
      </div>
    </div>
  )
}