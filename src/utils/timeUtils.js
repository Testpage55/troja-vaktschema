import { MEAL_DEDUCTION_HOURS } from '../constants.js'

export const calculateWorkTimes = (matchTime) => {
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

// ─── Löneberäkning ────────────────────────────────────────────────────────────
// Sluttiden rundas UPP till närmaste hel/halv timme (21:20 → 21:30, 21:40 → 22:00,
// 21:30 → 21:30). Därefter dras matavdraget (30 min) av från passets längd.
const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0) }
const fromMin = (mins) => {
  const t = ((mins % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

export function calcPayroll(start, end, deduction = MEAL_DEDUCTION_HOURS) {
  if (!start || !end) return null
  const s = toMin(start)
  let e = toMin(end)
  if (e <= s) e += 1440 // pass över midnatt
  const roundedEnd = Math.ceil(e / 30) * 30
  const grossHours = (roundedEnd - s) / 60
  return {
    roundedEnd: fromMin(roundedEnd),
    grossHours,
    deduction,
    payHours: Math.max(0, grossHours - deduction),
  }
}
// Matchresultat ur Trojas perspektiv, t.ex. { text: '3–4 ö.t.', outcome: 'loss' }
export function formatResult(match) {
  if (match?.troja_goals == null || match?.opponent_goals == null) return null
  const t = match.troja_goals, o = match.opponent_goals
  const suffix = match.result_type === 'ot' ? ' ö.t.' : match.result_type === 'so' ? ' str.' : ''
  const outcome = t > o ? 'win' : t < o ? 'loss' : 'draw'
  return { text: `${t}–${o}${suffix}`, outcome, label: outcome === 'win' ? 'Vinst' : outcome === 'loss' ? 'Förlust' : 'Oavgjort' }
}

// ─── Spårbarhet för arbetstider ───────────────────────────────────────────────
// Fälten change_status, changed_by_name, changed_at och original_* sätts av
// databasen (trigger) och kan inte ändras från appen.
const fmtStamp = (ts) => ts
  ? new Date(ts).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '')
  : ''
const hm = (t) => (t ? String(t).slice(0, 5) : '')

export function auditLabel(wh) {
  if (!wh) return null
  const who = wh.changed_by_role === 'admin' ? `${wh.changed_by_name} (admin)` : wh.changed_by_name
  switch (wh.change_status) {
    case 'auto':
      return { tone: 'neutral', text: 'Automatiskt registrerad (4,5h standard)' }
    case 'registered':
      return { tone: 'info', text: `Registrerad av ${who || 'okänd'} ${fmtStamp(wh.changed_at)}` }
    case 'changed': {
      const orig = wh.original_start_time && wh.original_end_time
        ? `${hm(wh.original_start_time)}–${hm(wh.original_end_time)}` : null
      return {
        tone: 'changed',
        text: `Ändrad av ${who || 'okänd'} ${fmtStamp(wh.changed_at)}`,
        detail: orig ? `Ursprungligen ${orig}` : null,
      }
    }
    case 'restored':
      return { tone: 'info', text: `Återställd till ursprunglig tid av ${who || 'okänd'} ${fmtStamp(wh.changed_at)}` }
    case 'legacy':
      return { tone: 'neutral', text: 'Registrerad före ändringsloggen' }
    default:
      return null
  }
}

export const AUDIT_COLORS = {
  neutral: { bg: '#f3f4f6', fg: '#4b5563' },
  info: { bg: '#e0f2fe', fg: '#075985' },
  changed: { bg: '#fef3c7', fg: '#92400e' },
}
