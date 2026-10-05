// Excel-export av löneunderlag. exceljs laddas först när man klickar (dynamic import),
// så den ändrar inte startstorleken på appen.
//
// Flikar: Förstasida · Dashboard · Summering · Löneunderlag · Kontroll · en flik per vakt (avstämning)

const RED = 'FFB91C1C' // Troja-röd
const RED_LIGHT = 'FFFEE2E2'
const GRAY = 'FFF3F4F6'
const GRAY_TEXT = 'FF6B7280'
const WHITE = 'FFFFFFFF'

const solid = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const cfFill = (argb) => ({ fill: { type: 'pattern', pattern: 'solid', bgColor: { argb } } })

const DETAIL_COLUMNS = [
  { header: 'Datum', key: 'date', width: 12, fmt: 'yyyy-mm-dd' },
  { header: 'Evenemang', key: 'event', width: 26 },
  { header: 'Personal', key: 'name', width: 22 },
  { header: 'Typ', key: 'type', width: 18 },
  { header: 'Starttid', key: 'start', width: 10 },
  { header: 'Sluttid', key: 'end', width: 10 },
  { header: 'Avrundad sluttid', key: 'roundedEnd', width: 16 },
  { header: 'Timmar (avrundade)', key: 'gross', width: 18, fmt: '0.0', sum: true },
  { header: 'Matavdrag (h)', key: 'deduction', width: 14, fmt: '0.0', sum: true },
  { header: 'Lönetimmar', key: 'payHours', width: 13, fmt: '0.0', sum: true },
  { header: 'Bruttolön (kr)', key: 'brutto', width: 15, fmt: '#,##0.00', sum: true },
  { header: 'Milersättning (kr)', key: 'mileage', width: 18, fmt: '#,##0.00', sum: true },
  { header: 'Brutto minus milersättning (kr)', key: 'net', width: 30, fmt: '#,##0.00', sum: true },
  { header: 'Milersättning säkerhetsuppdrag (kr)', key: 'away', width: 34, fmt: '#,##0.00', sum: true },
  { header: 'Anteckningar', key: 'notes', width: 30 },
]

const SUMMARY_COLUMNS = [
  { header: 'Personal', key: 'name', width: 24 },
  { header: 'Antal pass', key: 'shifts', width: 12, fmt: '0', sum: true },
  { header: 'Timmar (avrundade)', key: 'gross', width: 18, fmt: '0.0', sum: true },
  { header: 'Matavdrag (h)', key: 'deduction', width: 14, fmt: '0.0', sum: true },
  { header: 'Lönetimmar', key: 'payHours', width: 13, fmt: '0.0', sum: true },
  { header: 'Bruttolön (kr)', key: 'brutto', width: 15, fmt: '#,##0.00', sum: true },
  { header: 'Milersättning (kr)', key: 'mileage', width: 18, fmt: '#,##0.00', sum: true },
  { header: 'Brutto minus milersättning (kr)', key: 'net', width: 30, fmt: '#,##0.00', sum: true },
  { header: 'Milersättning säkerhetsuppdrag (kr)', key: 'away', width: 34, fmt: '#,##0.00', sum: true },
]

const PERSON_COLUMNS = [
  { header: 'Datum', key: 'date', width: 12, fmt: 'yyyy-mm-dd' },
  { header: 'Evenemang', key: 'event', width: 28 },
  { header: 'Typ', key: 'type', width: 18 },
  { header: 'Start', key: 'start', width: 9 },
  { header: 'Slut', key: 'end', width: 9 },
  { header: 'Avrundad slut', key: 'roundedEnd', width: 14 },
  { header: 'Lönetimmar', key: 'payHours', width: 13, fmt: '0.0', sum: true },
  { header: 'Bruttolön (kr)', key: 'brutto', width: 15, fmt: '#,##0.00', sum: true },
  { header: 'Milersättning (kr)', key: 'mileage', width: 18, fmt: '#,##0.00', sum: true },
  { header: 'Netto (kr)', key: 'net', width: 14, fmt: '#,##0.00', sum: true },
  { header: 'Milersättning säkerhetsuppdrag (kr)', key: 'away', width: 34, fmt: '#,##0.00', sum: true },
]

// 'YYYY-MM-DD' → riktigt Excel-datum (UTC-middag så tidszon inte flyttar dagen)
function toDate(s) {
  if (s instanceof Date) return s
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return s || null
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

function colLetter(i) {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100
const sumOf = (rows, key) => rows.reduce((t, r) => t + (Number(r[key]) || 0), 0)
const q = (name) => `'${name.replace(/'/g, "''")}'` // sheet-referens i formler

function styleHeader(ws, rowNumber = 1) {
  const head = ws.getRow(rowNumber)
  head.font = { bold: true, color: { argb: WHITE } }
  head.fill = solid(RED)
  head.alignment = { vertical: 'middle', wrapText: true }
  head.height = 32
}

function setupPrint(ws, { headerRow = 1, landscape = true } = {}) {
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: landscape ? 'landscape' : 'portrait',
    fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    printTitlesRow: `${headerRow}:${headerRow}`,
    margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  }
  ws.headerFooter.oddFooter = '&L&8Troja-Ljungby Vaktportal&C&8Sida &P av &N&R&8&D'
}

// Tabell med rubrikrad, summarad (SUM-formler med förberäknade värden) och autofilter.
// Returnerar { first, last, total } = radnummer.
function addTable(ws, columns, rows, { headerRow = 1, filter = true } = {}) {
  columns.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width
    const cell = ws.getRow(headerRow).getCell(i + 1)
    cell.value = c.header
  })
  styleHeader(ws, headerRow)

  rows.forEach((r, idx) => {
    const row = ws.getRow(headerRow + 1 + idx)
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1)
      cell.value = c.key === 'date' ? toDate(r[c.key]) : r[c.key]
      if (c.fmt) cell.numFmt = c.fmt
    })
  })

  const first = headerRow + 1
  const last = headerRow + rows.length
  const total = last + 1
  if (rows.length > 0) {
    const row = ws.getRow(total)
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1)
      if (i === 0) cell.value = 'Summa'
      if (c.sum) cell.value = { formula: `SUM(${colLetter(i)}${first}:${colLetter(i)}${last})`, result: round2(sumOf(rows, c.key)) }
      if (c.fmt) cell.numFmt = c.fmt
    })
    row.font = { bold: true }
    row.fill = solid(GRAY)
    row.border = { top: { style: 'thin' } }
    if (filter) ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: last, column: columns.length } }
  }
  return { first, last, total }
}

function colIndex(columns, key) { return columns.findIndex(c => c.key === key) }

// ─── Kontrollrader (görs i JS så att de kan listas i klartext) ──────────────
function findIssues(detailRows) {
  const issues = []
  detailRows.forEach(r => {
    const base = { name: r.name || '(saknar namn)', date: r.date, event: r.event }
    if (!r.name) issues.push({ ...base, kind: 'Saknar namn', text: 'Raden saknar personal.' })
    if (r.type === 'Vakt') {
      if (!r.start || !r.end) issues.push({ ...base, kind: 'Saknar tid', text: 'Start- eller sluttid saknas – timmar bygger på sparat timvärde.' })
      if (r.payHours === 0) issues.push({ ...base, kind: '0 lönetimmar', text: 'Passet ger 0 lönetimmar.' })
      if (r.payHours > 12) issues.push({ ...base, kind: 'Över 12 timmar', text: `Passet ger ${r.payHours} lönetimmar – kontrollera tiderna.` })
    }
  })
  return issues
}

// ─── Flikar ──────────────────────────────────────────────────────────────────
function addSummarySheet(wb, summaryRows) {
  const ws = wb.addWorksheet('Summering', { views: [{ state: 'frozen', ySplit: 1 }] })
  const t = addTable(ws, SUMMARY_COLUMNS, summaryRows)
  if (summaryRows.length > 1) {
    const ph = colLetter(colIndex(SUMMARY_COLUMNS, 'payHours'))
    const br = colLetter(colIndex(SUMMARY_COLUMNS, 'brutto'))
    ws.addConditionalFormatting({
      ref: `${ph}${t.first}:${ph}${t.last}`,
      rules: [{ type: 'dataBar', cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], color: { argb: 'FFF87171' }, gradient: false }],
    })
    ws.addConditionalFormatting({
      ref: `${br}${t.first}:${br}${t.last}`,
      rules: [{ type: 'colorScale', cfvo: [{ type: 'min' }, { type: 'max' }], color: [{ argb: 'FFFFFFFF' }, { argb: 'FFFCA5A5' }] }],
    })
  }
  setupPrint(ws)
  return { ws, ...t }
}

function addDetailSheet(wb, detailRows) {
  const ws = wb.addWorksheet('Löneunderlag', { views: [{ state: 'frozen', ySplit: 1, xSplit: 3 }] })
  const t = addTable(ws, DETAIL_COLUMNS, detailRows)
  if (detailRows.length > 0) {
    const range = `A${t.first}:${colLetter(DETAIL_COLUMNS.length - 1)}${t.last}`
    ws.addConditionalFormatting({
      ref: range,
      rules: [
        // Varning: pass utan tider, 0 timmar eller över 12 timmar → gul rad
        { type: 'expression', priority: 1, formulae: [`AND($D${t.first}="Vakt",OR($E${t.first}="",$F${t.first}="",$J${t.first}=0,$J${t.first}>12))`], style: cfFill('FFFDE68A') },
        // Säkerhetsansvarig → ljusblå rad
        { type: 'expression', priority: 2, formulae: [`$D${t.first}="Säkerhetsansvarig"`], style: cfFill('FFE0F2FE') },
      ],
    })
  }
  setupPrint(ws)
  return { ws, ...t }
}

function addPersonSheets(wb, detailRows, summaryRows, periodText) {
  const used = new Set(wb.worksheets.map(w => w.name.toLowerCase()))
  const names = summaryRows.map(s => s.name)
  names.forEach(name => {
    let base = (name || 'Okänd').replace(/[\\/?*[\]:]/g, '').trim().slice(0, 28) || 'Okänd'
    let title = base, n = 2
    while (used.has(title.toLowerCase())) title = `${base} (${n++})`
    used.add(title.toLowerCase())

    const rows = detailRows.filter(r => (r.name || 'Okänd') === name)
    const ws = wb.addWorksheet(title)
    ws.getCell('A1').value = name
    ws.getCell('A1').font = { bold: true, size: 16, color: { argb: RED } }
    ws.getCell('A2').value = `Avstämning av löneunderlag · ${periodText || ''}`
    ws.getCell('A2').font = { color: { argb: GRAY_TEXT } }
    const t = addTable(ws, PERSON_COLUMNS, rows, { headerRow: 4 })
    ws.views = [{ state: 'frozen', ySplit: 4 }]
    ws.addConditionalFormatting({
      ref: `A${t.first}:K${t.last}`,
      rules: [{ type: 'expression', priority: 1, formulae: [`$C${t.first}="Säkerhetsansvarig"`], style: cfFill('FFE0F2FE') }],
    })
    const note = ws.getRow(t.total + 2).getCell(1)
    note.value = 'Stämmer inte uppgifterna? Hör av dig till administratören innan lönekörningen.'
    note.font = { italic: true, color: { argb: GRAY_TEXT } }
    setupPrint(ws, { headerRow: 4 })
  })
}

function addIssuesSheet(wb, issues, appWarnings) {
  const ws = wb.addWorksheet('Kontroll', { views: [{ state: 'frozen', ySplit: 1 }] })
  const cols = [
    { header: 'Typ av avvikelse', key: 'kind', width: 22 },
    { header: 'Personal', key: 'name', width: 24 },
    { header: 'Datum', key: 'date', width: 12, fmt: 'yyyy-mm-dd' },
    { header: 'Evenemang', key: 'event', width: 28 },
    { header: 'Kommentar', key: 'text', width: 70 },
  ]
  const rows = [
    ...appWarnings.map(w => ({ kind: 'Personaluppgift', name: '', date: null, event: '', text: w })),
    ...issues,
  ]
  if (rows.length === 0) {
    cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.width; ws.getRow(1).getCell(i + 1).value = c.header })
    styleHeader(ws)
    ws.getCell('A2').value = '✓ Inga avvikelser hittades.'
    ws.getCell('A2').font = { bold: true, color: { argb: 'FF166534' } }
  } else {
    addTable(ws, cols, rows, { filter: true })
    // addTable lägger på en Summa-rad bara om kolumn har sum – här finns ingen, men rubriken "Summa" hamnar i A: ta bort
    ws.getRow(rows.length + 2).values = []
    ws.getRow(rows.length + 2).fill = undefined
    ws.getRow(rows.length + 2).border = undefined
  }
  setupPrint(ws)
}

function addDashboard(wb, { detail, summary, summaryRows, detailRows }) {
  const ws = wb.addWorksheet('Dashboard', { views: [{ showGridLines: false }] })
  ;[3, 26, 16, 16, 16, 16, 3, 3].forEach((w, i) => { ws.getColumn(i + 1).width = w })
  ws.getColumn(2).width = 28

  ws.getCell('B1').value = 'Dashboard'
  ws.getCell('B1').font = { bold: true, size: 20, color: { argb: RED } }

  const S = q('Summering')
  const D = q('Löneunderlag')
  const sTot = summary.total
  const col = (cols, key) => colLetter(colIndex(cols, key))
  const hours = sumOf(summaryRows, 'payHours')
  const brutto = sumOf(summaryRows, 'brutto')
  const shifts = sumOf(summaryRows, 'shifts')
  const people = summaryRows.length

  // KPI-brickor
  const tiles = [
    ['Lönetimmar', { formula: `${S}!${col(SUMMARY_COLUMNS, 'payHours')}${sTot}`, result: round2(hours) }, '#,##0.0'],
    ['Bruttolön (kr)', { formula: `${S}!${col(SUMMARY_COLUMNS, 'brutto')}${sTot}`, result: round2(brutto) }, '#,##0'],
    ['Antal pass', { formula: `${S}!${col(SUMMARY_COLUMNS, 'shifts')}${sTot}`, result: shifts }, '0'],
    ['Antal personer', { formula: `COUNTA(${S}!A2:A${sTot - 1})`, result: people }, '0'],
  ]
  tiles.forEach(([label, value, fmt], i) => {
    const c = i + 2
    const l = ws.getRow(3).getCell(c); l.value = label
    l.font = { size: 9, color: { argb: GRAY_TEXT } }; l.fill = solid(GRAY)
    const v = ws.getRow(4).getCell(c); v.value = value; v.numFmt = fmt
    v.font = { bold: true, size: 18 }; v.fill = solid(GRAY); v.alignment = { horizontal: 'left' }
  })
  ws.getRow(4).height = 30

  // Topp 10 vakter efter bruttolön (statisk sortering, värden hämtas från Summering-raden)
  let r = 7
  ws.getCell(`B${r}`).value = 'Kostnad per vakt (topp 10)'
  ws.getCell(`B${r}`).font = { bold: true, size: 13 }
  r += 1
  ;['Personal', 'Lönetimmar', 'Bruttolön (kr)', 'Andel av totalt'].forEach((h, i) => { ws.getRow(r).getCell(i + 2).value = h })
  styleHeader(ws, r); ws.getRow(r).height = 20
  ws.getCell(`A${r}`).fill = undefined
  const top = [...summaryRows].sort((a, b) => b.brutto - a.brutto).slice(0, 10)
  const topFirst = r + 1
  top.forEach((p, i) => {
    const rowNo = topFirst + i
    const idx = summaryRows.findIndex(s => s.name === p.name) + 2 // rad i Summering
    ws.getCell(`B${rowNo}`).value = p.name
    ws.getCell(`C${rowNo}`).value = { formula: `${S}!${col(SUMMARY_COLUMNS, 'payHours')}${idx}`, result: p.payHours }
    ws.getCell(`C${rowNo}`).numFmt = '0.0'
    ws.getCell(`D${rowNo}`).value = { formula: `${S}!${col(SUMMARY_COLUMNS, 'brutto')}${idx}`, result: p.brutto }
    ws.getCell(`D${rowNo}`).numFmt = '#,##0'
    ws.getCell(`E${rowNo}`).value = { formula: `IF($C$4=0,0,D${rowNo}/$C$4)`, result: brutto ? p.brutto / brutto : 0 }
    ws.getCell(`E${rowNo}`).numFmt = '0.0%'
  })
  const topLast = topFirst + top.length - 1
  if (top.length > 1) {
    ws.addConditionalFormatting({
      ref: `D${topFirst}:D${topLast}`,
      rules: [{ type: 'dataBar', cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], color: { argb: 'FFF87171' }, gradient: false }],
    })
  }
  r = topLast + 3

  // Per månad (live-formler mot Löneunderlag)
  ws.getCell(`B${r}`).value = 'Per månad'
  ws.getCell(`B${r}`).font = { bold: true, size: 13 }
  r += 1
  ;['Månad', 'Antal pass', 'Lönetimmar', 'Bruttolön (kr)'].forEach((h, i) => { ws.getRow(r).getCell(i + 2).value = h })
  styleHeader(ws, r); ws.getRow(r).height = 20
  ws.getCell(`A${r}`).fill = undefined
  const monthKeys = [...new Set(detailRows.map(d => String(d.date || '').slice(0, 7)).filter(m => /^\d{4}-\d{2}$/.test(m)))].sort()
  const dCol = (k) => col(DETAIL_COLUMNS, k)
  const dLast = detail.last
  const monthFirst = r + 1
  monthKeys.forEach((mk, i) => {
    const rowNo = monthFirst + i
    const [y, m] = mk.split('-').map(Number)
    const inMonth = detailRows.filter(d => String(d.date).startsWith(mk))
    const dateRng = `${D}!$A$2:$A$${dLast}`
    const crit = `${dateRng},">="&DATE(${y},${m},1),${dateRng},"<"&DATE(${y},${m + 1},1)`
    const monthCell = ws.getCell(`B${rowNo}`)
    monthCell.value = new Date(Date.UTC(y, m - 1, 1, 12))
    monthCell.numFmt = 'mmmm yyyy'
    monthCell.alignment = { horizontal: 'left' }
    ws.getCell(`C${rowNo}`).value = { formula: `COUNTIFS(${crit})`, result: inMonth.length }
    ws.getCell(`D${rowNo}`).value = { formula: `SUMIFS(${D}!$${dCol('payHours')}$2:$${dCol('payHours')}$${dLast},${crit})`, result: round2(sumOf(inMonth, 'payHours')) }
    ws.getCell(`D${rowNo}`).numFmt = '0.0'
    ws.getCell(`E${rowNo}`).value = { formula: `SUMIFS(${D}!$${dCol('brutto')}$2:$${dCol('brutto')}$${dLast},${crit})`, result: round2(sumOf(inMonth, 'brutto')) }
    ws.getCell(`E${rowNo}`).numFmt = '#,##0'
  })
  const monthLast = monthFirst + monthKeys.length - 1
  if (monthKeys.length > 1) {
    ws.addConditionalFormatting({
      ref: `E${monthFirst}:E${monthLast}`,
      rules: [{ type: 'dataBar', cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], color: { argb: 'FF60A5FA' }, gradient: false }],
    })
  }
  r = monthLast + 3

  // Typ-fördelning
  ws.getCell(`B${r}`).value = 'Fördelning per typ'
  ws.getCell(`B${r}`).font = { bold: true, size: 13 }
  r += 1
  ;['Typ', 'Antal pass', 'Lönetimmar', 'Bruttolön (kr)'].forEach((h, i) => { ws.getRow(r).getCell(i + 2).value = h })
  styleHeader(ws, r); ws.getRow(r).height = 20
  ws.getCell(`A${r}`).fill = undefined
  ;['Vakt', 'Säkerhetsansvarig'].forEach((typ, i) => {
    const rowNo = r + 1 + i
    const rowsT = detailRows.filter(d => d.type === typ)
    const typRng = `${D}!$D$2:$D$${dLast}`
    ws.getCell(`B${rowNo}`).value = typ
    ws.getCell(`C${rowNo}`).value = { formula: `COUNTIFS(${typRng},B${rowNo})`, result: rowsT.length }
    ws.getCell(`D${rowNo}`).value = { formula: `SUMIFS(${D}!$${dCol('payHours')}$2:$${dCol('payHours')}$${dLast},${typRng},B${rowNo})`, result: round2(sumOf(rowsT, 'payHours')) }
    ws.getCell(`D${rowNo}`).numFmt = '0.0'
    ws.getCell(`E${rowNo}`).value = { formula: `SUMIFS(${D}!$${dCol('brutto')}$2:$${dCol('brutto')}$${dLast},${typRng},B${rowNo})`, result: round2(sumOf(rowsT, 'brutto')) }
    ws.getCell(`E${rowNo}`).numFmt = '#,##0'
  })

  setupPrint(ws, { headerRow: 1, landscape: false })
  ws.pageSetup.printTitlesRow = undefined
}

function addCoverSheet(wb, { detailRows, summaryRows, detail, summary, meta, issues, appWarnings }) {
  const ws = wb.addWorksheet('Förstasida', { views: [{ showGridLines: false }] })
  ws.getColumn(1).width = 3
  ws.getColumn(2).width = 34
  ws.getColumn(3).width = 52

  ws.getCell('B2').value = 'Löneunderlag'
  ws.getCell('B2').font = { bold: true, size: 26, color: { argb: RED } }
  ws.getCell('B3').value = 'IF Troja-Ljungby · Vaktportal'
  ws.getCell('B3').font = { size: 12, color: { argb: GRAY_TEXT } }

  const S = q('Summering')
  const D = q('Löneunderlag')
  const sCol = (k) => colLetter(colIndex(SUMMARY_COLUMNS, k))
  const dCol = (k) => colLetter(colIndex(DETAIL_COLUMNS, k))

  const info = [
    ['Period', meta.periodText || ''],
    ['Skapad', meta.generatedAt || new Date()],
    ['Antal rader', { formula: `COUNTA(${D}!A2:A${detail.last})`, result: detailRows.length }],
    ['Antal personer', { formula: `COUNTA(${S}!A2:A${summary.total - 1})`, result: summaryRows.length }],
    ['Lönetimmar', { formula: `${S}!${sCol('payHours')}${summary.total}`, result: round2(sumOf(summaryRows, 'payHours')) }],
    ['Bruttolön (kr)', { formula: `${S}!${sCol('brutto')}${summary.total}`, result: round2(sumOf(summaryRows, 'brutto')) }],
    ['Milersättning (kr)', { formula: `${S}!${sCol('mileage')}${summary.total}`, result: round2(sumOf(summaryRows, 'mileage')) }],
    ['Brutto minus milersättning (kr)', { formula: `${S}!${sCol('net')}${summary.total}`, result: round2(sumOf(summaryRows, 'net')) }],
    ['Milersättning säkerhetsuppdrag (kr)', { formula: `${S}!${sCol('away')}${summary.total}`, result: round2(sumOf(summaryRows, 'away')) }],
  ]
  let r = 5
  info.forEach(([label, value]) => {
    ws.getCell(`B${r}`).value = label
    ws.getCell(`B${r}`).font = { color: { argb: GRAY_TEXT } }
    const c = ws.getCell(`C${r}`)
    c.value = value
    c.alignment = { horizontal: 'left' }
    c.font = { bold: true }
    if (value instanceof Date) c.numFmt = 'yyyy-mm-dd hh:mm'
    else if (label.includes('(kr)')) c.numFmt = '#,##0.00'
    else if (label === 'Lönetimmar') c.numFmt = '#,##0.0'
    for (const k of ['B', 'C']) ws.getCell(`${k}${r}`).border = { bottom: { style: 'hair', color: { argb: 'FFD1D5DB' } } }
    r += 1
  })

  // Kontroller
  r += 1
  ws.getCell(`B${r}`).value = 'Kontroller'
  ws.getCell(`B${r}`).font = { bold: true, size: 13 }
  r += 1
  const sumsOk = Math.abs(sumOf(summaryRows, 'payHours') - sumOf(detailRows, 'payHours')) < 0.005
    && Math.abs(sumOf(summaryRows, 'brutto') - sumOf(detailRows, 'brutto')) < 0.005
  ws.getCell(`B${r}`).value = 'Summering = Löneunderlag'
  ws.getCell(`C${r}`).value = {
    formula: `IF(AND(ROUND(${S}!${sCol('payHours')}${summary.total}-${D}!${dCol('payHours')}${detail.total},2)=0,ROUND(${S}!${sCol('brutto')}${summary.total}-${D}!${dCol('brutto')}${detail.total},2)=0),"✓ Stämmer","✗ AVVIKELSE")`,
    result: sumsOk ? '✓ Stämmer' : '✗ AVVIKELSE',
  }
  ws.getCell(`C${r}`).font = { bold: true }
  ws.addConditionalFormatting({
    ref: `C${r}`,
    rules: [
      { type: 'expression', priority: 1, formulae: [`LEFT(C${r},1)="✓"`], style: { font: { color: { argb: 'FF166534' }, bold: true } } },
      { type: 'expression', priority: 2, formulae: [`LEFT(C${r},1)="✗"`], style: { font: { color: { argb: 'FF991B1B' }, bold: true }, ...cfFill(RED_LIGHT) } },
    ],
  })
  r += 1
  const nIssues = issues.length + appWarnings.length
  ws.getCell(`B${r}`).value = 'Avvikelser att titta på'
  ws.getCell(`C${r}`).value = nIssues === 0 ? '✓ Inga' : { text: `⚠ ${nIssues} st – se fliken Kontroll`, hyperlink: "#'Kontroll'!A1" }
  ws.getCell(`C${r}`).font = nIssues === 0 ? { bold: true, color: { argb: 'FF166534' } } : { bold: true, color: { argb: 'FFB45309' }, underline: true }
  r += 2

  // Regler
  ws.getCell(`B${r}`).value = 'Beräkningsregler'
  ws.getCell(`B${r}`).font = { bold: true, size: 13 }
  r += 1
  ;(meta.rules || []).forEach(t => {
    ws.getCell(`B${r}`).value = '•  ' + t
    ws.mergeCells(`B${r}:C${r}`)
    ws.getCell(`B${r}`).alignment = { wrapText: true, vertical: 'top' }
    ws.getRow(r).height = t.length > 70 ? 32 : 18
    r += 1
  })
  r += 1

  // Innehåll med länkar
  ws.getCell(`B${r}`).value = 'Flikar'
  ws.getCell(`B${r}`).font = { bold: true, size: 13 }
  r += 1
  ;[
    ['Dashboard', 'Överblick: kostnad per vakt, per månad och per typ'],
    ['Summering', 'En rad per person'],
    ['Löneunderlag', 'Detaljerat underlag, ett pass per rad'],
    ['Kontroll', 'Avvikelser och varningar'],
  ].forEach(([sheet, text]) => {
    ws.getCell(`B${r}`).value = { text: sheet, hyperlink: `#'${sheet}'!A1` }
    ws.getCell(`B${r}`).font = { color: { argb: 'FF2563EB' }, underline: true }
    ws.getCell(`C${r}`).value = text
    ws.getCell(`C${r}`).font = { color: { argb: GRAY_TEXT } }
    r += 1
  })
  ws.getCell(`B${r}`).value = 'Övriga flikar'
  ws.getCell(`B${r}`).font = { color: { argb: GRAY_TEXT } }
  ws.getCell(`C${r}`).value = 'Avstämning per vakt, en flik per person'
  ws.getCell(`C${r}`).font = { color: { argb: GRAY_TEXT } }
  r += 3

  // Godkännande
  ws.getCell(`B${r}`).value = 'Godkänt av'
  ws.getCell(`B${r}`).border = { top: { style: 'thin' } }
  ws.getCell(`C${r}`).value = 'Datum'
  ws.getCell(`C${r}`).border = { top: { style: 'thin' } }
  ws.getCell(`B${r}`).font = { color: { argb: GRAY_TEXT } }
  ws.getCell(`C${r}`).font = { color: { argb: GRAY_TEXT } }
  ws.getRow(r - 1).height = 28

  setupPrint(ws, { landscape: false })
  ws.pageSetup.printTitlesRow = undefined
}

/**
 * Bygger arbetsboken. detailRows/summaryRows: objekt med nycklarna ovan (tal som tal).
 * meta: { periodText, generatedAt, rules: string[], warnings: string[] }
 */
export async function buildPayrollWorkbook({ detailRows, summaryRows, meta = {} }) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Troja-Ljungby Vaktportal'
  wb.created = new Date()

  const issues = findIssues(detailRows)
  const appWarnings = meta.warnings || []

  // Ordning på flikarna: Förstasida, Dashboard, Summering, Löneunderlag, Kontroll, personflikar.
  // Förstasida och Dashboard behöver radnummer från tabellerna, så de skapas sist och flyttas först.
  const summary = addSummarySheet(wb, summaryRows)
  const detail = addDetailSheet(wb, detailRows)
  addIssuesSheet(wb, issues, appWarnings)
  addDashboard(wb, { detail, summary, summaryRows, detailRows })
  addCoverSheet(wb, { detailRows, summaryRows, detail, summary, meta, issues, appWarnings })
  addPersonSheets(wb, detailRows, summaryRows, meta.periodText)

  const order = ['Förstasida', 'Dashboard', 'Summering', 'Löneunderlag', 'Kontroll']
  const sorted = [...wb.worksheets].sort((a, b) => {
    const ia = order.indexOf(a.name), ib = order.indexOf(b.name)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
  sorted.forEach((w, i) => { w.orderNo = i })
  wb.views = [{ activeTab: 0 }]
  return wb
}

export async function exportPayrollXlsx({ detailRows, summaryRows, filename, meta }) {
  const wb = await buildPayrollWorkbook({ detailRows, summaryRows, meta })
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(link.href), 10000)
}