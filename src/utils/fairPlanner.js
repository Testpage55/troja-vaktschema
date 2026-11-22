// Fördelar vakter så jämnt som möjligt bland de som ansökt.
//
// Indata
//   matches:    [{ id, date, season, need }]   need = antal lediga platser
//   apps:       [{ id, match_id, personnel_id, created_at }]  väntande ansökningar
//   baseCounts: { 'personId|säsong': antal pass redan }
//
// Regler: bara den som ansökt kan få matchen, ingen får samma match två gånger,
// och den med färst pass hittills går först. Matcher med få sökande fylls först,
// därefter bytes pass mellan vakter så länge det gör fördelningen jämnare.

export function planDistribution({ matches, apps, baseCounts = {}, random = false }) {
  // random: slumpad ordning vid lika läge, så man kan få olika (lika rättvisa) förslag
  const rnd = new Map(apps.map(a => [a.id, random ? Math.random() : 0]))
  const counts = { ...baseCounts }
  const keyOf = (pid, season) => `${pid}|${season || ''}`
  const get = (pid, season) => counts[keyOf(pid, season)] || 0
  const add = (pid, season, d) => { counts[keyOf(pid, season)] = get(pid, season) + d }

  const byMatch = {}
  apps.forEach(a => { (byMatch[a.match_id] ??= []).push(a) })
  const appsPerPerson = apps.reduce((acc, a) => { acc[a.personnel_id] = (acc[a.personnel_id] || 0) + 1; return acc }, {})

  const todo = matches
    .filter(m => m.need > 0 && (byMatch[m.id] || []).length > 0)
    .sort((a, b) => ((byMatch[a.id].length - a.need) - (byMatch[b.id].length - b.need)) || a.date.localeCompare(b.date))

  const chosen = {} // match_id -> [app]
  for (const m of todo) {
    const pool = [...byMatch[m.id]]
    chosen[m.id] = []
    while (chosen[m.id].length < m.need && pool.length) {
      pool.sort((x, y) =>
        (get(x.personnel_id, m.season) - get(y.personnel_id, m.season)) ||
        ((appsPerPerson[x.personnel_id] || 0) - (appsPerPerson[y.personnel_id] || 0)) ||
        (random ? rnd.get(x.id) - rnd.get(y.id) : String(x.created_at).localeCompare(String(y.created_at))))
      const pick = pool.shift()
      chosen[m.id].push(pick)
      add(pick.personnel_id, m.season, 1)
    }
  }

  // Förbättring: byt vakt på en match om skillnaden mellan två vakter är 2 pass eller mer
  let changed = true, guard = 0
  while (changed && guard++ < 500) {
    changed = false
    for (const m of todo) {
      const taken = chosen[m.id]
      for (let i = 0; i < taken.length; i++) {
        const cur = taken[i]
        const candidates = byMatch[m.id].filter(a => !taken.includes(a)).sort((x, y) => rnd.get(x.id) - rnd.get(y.id))
        for (const cand of candidates) {
          if (get(cur.personnel_id, m.season) - get(cand.personnel_id, m.season) >= 2) {
            add(cur.personnel_id, m.season, -1)
            add(cand.personnel_id, m.season, 1)
            taken[i] = cand
            changed = true
            break
          }
        }
      }
    }
  }

  // Samma person kan inte ha fått mer än en plats på samma match (säkras ovan via pool/taken)
  const assignments = todo.flatMap(m => chosen[m.id].map(a => ({ app: a, match: m })))
  const unfilled = todo
    .map(m => ({ match: m, missing: m.need - chosen[m.id].length }))
    .filter(x => x.missing > 0)
  return { assignments, unfilled, counts }
}
