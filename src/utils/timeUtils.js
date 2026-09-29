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