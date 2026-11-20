import { calculateWorkTimes } from './timeUtils.js'

// ─── Kalenderexport (.ics) ────────────────────────────────────────────────────
// Skapar en iCalendar-fil med vaktpass som kan öppnas i iPhone-, Google- och
// Outlook-kalendern. Tider anges i svensk tid (Europe/Stockholm).

const TZID = 'Europe/Stockholm'

// VTIMEZONE så att alla kalenderappar tolkar sommar-/vintertid rätt
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${TZID}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
]

const pad = (n) => String(n).padStart(2, '0')

// '2026-11-20' + '17:00' (+ dagar) → '20261120T170000'
function toIcsLocal(dateStr, time, addDays = 0) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + addDays))
  const [hh, mm] = String(time).split(':').map(Number)
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(hh)}${pad(mm || 0)}00`
}

function nowStamp() {
  const n = new Date()
  return `${n.getUTCFullYear()}${pad(n.getUTCMonth() + 1)}${pad(n.getUTCDate())}T${pad(n.getUTCHours())}${pad(n.getUTCMinutes())}${pad(n.getUTCSeconds())}Z`
}

const escapeText = (s) => String(s ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n')

// Rader får max vara 75 tecken enligt standarden
function fold(line) {
  if (line.length <= 75) return line
  const parts = []
  let rest = line
  parts.push(rest.slice(0, 75)); rest = rest.slice(75)
  while (rest.length > 0) { parts.push(' ' + rest.slice(0, 74)); rest = rest.slice(74) }
  return parts.join('\r\n')
}

const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0) }
const hhmm = (t) => String(t).split(':').slice(0, 2).join(':')

/**
 * Bygger ett kalenderevent för ett vaktpass.
 * Använder registrerade tider (work_hours) om de finns, annars standard
 * (2 h före match till 2,5 h efter matchstart).
 */
function buildEvent({ match, workHours, personnelId }) {
  if (!match?.date) return null

  let start, end
  if (workHours?.start_time && workHours?.end_time) {
    start = hhmm(workHours.start_time)
    end = hhmm(workHours.end_time)
  } else {
    const t = calculateWorkTimes(match.time)
    start = t.startTime
    end = t.endTime
  }
  const endNextDay = toMin(end) <= toMin(start) ? 1 : 0 // pass över midnatt

  const isAway = match.match_type === 'away'
  const summary = `Vakt: IF Troja – ${match.opponent}${isAway ? ' (borta)' : ''}`
  const desc = [
    match.time && match.time !== 'TBA' ? `Matchstart ${match.time}` : 'Matchtid ej klar',
    `Vaktpass ${start}–${end}`,
    workHours ? 'Tider registrerade' : 'Preliminära tider (2 h före match)',
  ].join('\n')

  return [
    'BEGIN:VEVENT',
    `UID:troja-${match.id}-${personnelId ?? 'alla'}@troja-vaktschema`,
    `DTSTAMP:${nowStamp()}`,
    `DTSTART;TZID=${TZID}:${toIcsLocal(match.date, start)}`,
    `DTEND;TZID=${TZID}:${toIcsLocal(match.date, end, endNextDay)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(desc)}`,
    isAway ? null : 'LOCATION:Ljungby Arena',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(summary)}`,
    'TRIGGER:-PT3H',
    'END:VALARM',
    'END:VEVENT',
  ].filter(Boolean)
}

/** items: [{ match, workHours, personnelId }] */
export function buildIcs(items, calendarName = 'Troja vaktschema') {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IF Troja-Ljungby//Vaktschema//SV',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    `X-WR-TIMEZONE:${TZID}`,
    ...VTIMEZONE,
  ]
  items.forEach(it => {
    const ev = buildEvent(it)
    if (ev) lines.push(...ev)
  })
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function downloadIcs(items, filename = 'troja-vaktschema.ics', calendarName) {
  const ics = buildIcs(items, calendarName)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
