import { useState, useEffect, useRef } from 'react'

// ─── TimeInput ────────────────────────────────────────────────────────────────
// Tidsfält som alltid visar 24-timmarsformat (tt:mm), oberoende av webbläsarens
// eller datorns språkinställning. Ersätter <input type="time">, som visar
// AM/PM på datorer med engelska inställningar.
// Skrivs "1930" blir det 19:30. Vid blur fylls korta värden ut: "9" → 09:00,
// "930" → 09:30. onChange får samma form som ett vanligt input: e.target.value.

const normalize = (v) => {
  if (!v) return ''
  const [h, m] = String(v).split(':')
  if (h === undefined || m === undefined) return ''
  return `${h.padStart(2, '0')}:${m.slice(0, 2).padStart(2, '0')}`
}

const isValid = (h, m) => h >= 0 && h <= 23 && m >= 0 && m <= 59

function parseDigits(digits) {
  if (digits.length === 0) return ''
  let h, m
  if (digits.length <= 2) { h = +digits; m = 0 }
  else if (digits.length === 3) { h = +digits[0]; m = +digits.slice(1) }
  else { h = +digits.slice(0, 2); m = +digits.slice(2, 4) }
  if (!isValid(h, m)) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function TimeInput({ value, onChange, onKeyDown, onBlur, style, className, ...rest }) {
  const [text, setText] = useState(normalize(value))
  const justFocused = useRef(false)

  useEffect(() => { setText(normalize(value)) }, [value])

  const emit = (v) => onChange && onChange({ target: { value: v } })

  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
    const formatted = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
    setText(formatted)
    if (digits.length === 4) {
      const parsed = parseDigits(digits)
      if (parsed) emit(parsed)
    }
  }

  const commit = () => {
    const digits = text.replace(/\D/g, '')
    if (digits.length === 0) { setText(normalize(value)); return }
    const parsed = parseDigits(digits)
    if (parsed) { setText(parsed); if (parsed !== normalize(value)) emit(parsed) }
    else setText(normalize(value))
  }

  const step = (mins) => {
    const base = parseDigits(text.replace(/\D/g, '')) || normalize(value) || '00:00'
    const [h, m] = base.split(':').map(Number)
    const t = ((h * 60 + m + mins) % 1440 + 1440) % 1440
    const v = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
    setText(v); emit(v)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); step(15); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); step(-15); return }
    if (e.key === 'Enter') commit()
    onKeyDown && onKeyDown(e)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="tt:mm"
      maxLength={5}
      value={text}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={(e) => { commit(); onBlur && onBlur(e) }}
      onFocus={(e) => { justFocused.current = true; e.target.select() }}
      onMouseUp={(e) => { if (justFocused.current) { e.preventDefault(); justFocused.current = false } }}
      className={className}
      style={style}
      {...rest}
    />
  )
}
