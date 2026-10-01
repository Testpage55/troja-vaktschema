import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint32Array(12))
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}

const EMPTY_FORM = { email: '', password: '', role: 'guard', personnelId: '', newName: '' }

export default function UsersTab({ personnel, currentUserId, showToast, showConfirmModal, onCreated }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(null)
  const [pwFor, setPwFor] = useState(null)
  const [pwValue, setPwValue] = useState('')
  const [pwDone, setPwDone] = useState(null)
  const [menuFor, setMenuFor] = useState(null)

  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, personnel_id')
      .order('email', { ascending: true })
    if (error) {
      setError(error.message)
      setProfiles([])
    } else {
      setError(null)
      setProfiles(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const personnelById = Object.fromEntries((personnel || []).map(p => [p.id, p]))
  const linkedIds = new Set(profiles.map(p => p.personnel_id).filter(Boolean))
  const unlinkedPersonnel = (personnel || []).filter(p => !linkedIds.has(p.id))

  const update = async (profile, patch, okMsg) => {
    setBusyId(profile.id)
    const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id)
    setBusyId(null)
    if (error) { showToast(`Kunde inte spara: ${error.message}`, 'error'); return }
    showToast(okMsg, 'success')
    load()
  }

  const changeRole = (profile, role) => {
    if (profile.id === currentUserId) {
      showToast('Du kan inte ändra din egen roll', 'error')
      return
    }
    if (role === 'admin') {
      showConfirmModal(
        'Ge adminrättigheter',
        `${profile.email || 'Användaren'} får full tillgång till adminvyn. Fortsätta?`,
        () => update(profile, { role }, 'Roll uppdaterad'),
        'Ge admin',
        'btn-success'
      )
    } else {
      update(profile, { role }, 'Roll uppdaterad')
    }
  }

  const changeLink = (profile, personnelId) =>
    update(profile, { personnel_id: personnelId || null }, 'Koppling uppdaterad')

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const createUser = async (e) => {
    e.preventDefault()
    setCreating(true)
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        personnelId: form.personnelId || null,
        newPersonnelName: form.personnelId ? null : form.newName,
      },
    })
    setCreating(false)
    let msg = data?.error || error?.message
    if (error?.context?.json) {
      try { msg = (await error.context.json()).error || msg } catch { /* behåll msg */ }
    }
    if (msg) { showToast(msg, 'error'); return }
    setCreated({ email: form.email.trim(), password: form.password })
    setForm(EMPTY_FORM)
    showToast('Användare skapad', 'success')
    load()
    onCreated?.()
  }

  const callManage = async (body) => {
    const { data, error } = await supabase.functions.invoke('admin-manage-user', { body })
    let msg = data?.error || error?.message
    if (error?.context?.json) {
      try { msg = (await error.context.json()).error || msg } catch { /* behåll msg */ }
    }
    return msg || null
  }

  const savePassword = async (e) => {
    e.preventDefault()
    setBusyId(pwFor.id)
    const msg = await callManage({ action: 'set-password', userId: pwFor.id, password: pwValue })
    setBusyId(null)
    if (msg) { showToast(msg, 'error'); return }
    setPwDone({ email: pwFor.email, password: pwValue })
    setPwFor(null)
    setPwValue('')
    showToast('Lösenord ändrat', 'success')
  }

  const deleteUser = (profile, alsoPersonnel) => {
    const vakt = personnelById[profile.personnel_id]?.name
    showConfirmModal(
      alsoPersonnel ? 'Ta bort konto och vakt' : 'Ta bort konto',
      alsoPersonnel
        ? `Vill du ta bort kontot ${profile.email} och vakten ${vakt} permanent?\n\nDetta tar även bort vaktens tilldelningar och arbetstider.\n\nÅtgärden kan inte ångras.`
        : `Vill du ta bort kontot ${profile.email}?${vakt ? `\n\nVakten ${vakt} finns kvar men får ingen inloggning.` : ''}\n\nÅtgärden kan inte ångras.`,
      async () => {
        setBusyId(profile.id)
        const msg = await callManage({ action: 'delete', userId: profile.id, alsoDeletePersonnel: alsoPersonnel })
        setBusyId(null)
        if (msg) { showToast(msg, 'error'); load(); onCreated?.(); return }
        showToast('Konto borttaget', 'info')
        load()
        onCreated?.()
      },
      alsoPersonnel ? 'Ta bort konto och vakt' : 'Ta bort konto'
    )
  }

  const q = search.trim().toLowerCase()
  const filtered = profiles.filter(p => {
    if (!q) return true
    const name = personnelById[p.personnel_id]?.name || ''
    return (p.email || '').toLowerCase().includes(q) || name.toLowerCase().includes(q)
  })

  if (loading) return <div className="tab-content"><p>Laddar användare...</p></div>

  if (error) {
    return (
      <div className="tab-content">
        <div className="card" style={{ padding: '16px', color: '#b91c1c' }}>
          <strong>Kunde inte hämta användare.</strong>
          <p style={{ margin: '8px 0 0' }}>{error}</p>
          <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: '13px' }}>
            Kontrollera att SQL-migreringen för användarhantering är körd i Supabase (kolumnen <code>email</code> och admin-policyerna på <code>profiles</code>).
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="tab-content">
      <div className="filter-bar" style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Sök e-post eller vakt..."
          className="filter-select"
          style={{ minWidth: '220px' }}
        />
        <span style={{ color: '#6b7280', fontSize: '13px' }}>
          {profiles.length} konton · {unlinkedPersonnel.length} vakter utan konto
        </span>
        <button className="btn btn-secondary" style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: '13px' }} onClick={() => { setShowForm(v => !v); setCreated(null) }}>
          {showForm ? 'Stäng' : '+ Ny användare'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createUser} className="card" style={{ padding: '16px', marginBottom: '16px', display: 'grid', gap: '12px', maxWidth: '520px' }}>
          <strong>Ny användare</strong>
          <label>E-post
            <input id="nu-email" type="email" required value={form.email} onChange={e => setField('email', e.target.value)} className="filter-select" style={{ width: '100%' }} />
          </label>
          <label>Lösenord (minst 8 tecken)
            <div style={{ display: 'flex', gap: '8px' }}>
              <input id="nu-password" type="text" required minLength={8} value={form.password} onChange={e => setField('password', e.target.value)} className="filter-select" style={{ flex: 1 }} />
              <button type="button" className="btn btn-secondary" onClick={() => setField('password', generatePassword())}>Generera</button>
            </div>
          </label>
          <label>Roll
            <select id="nu-role" value={form.role} onChange={e => setField('role', e.target.value)} className="filter-select" style={{ width: '100%' }}>
              <option value="guard">Vakt</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label>Koppla till vakt
            <select id="nu-personnel" value={form.personnelId} onChange={e => setField('personnelId', e.target.value)} className="filter-select" style={{ width: '100%' }}>
              <option value="">– Skapa ny vakt –</option>
              {unlinkedPersonnel.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          {!form.personnelId && (
            <label>Namn på ny vakt
              <input id="nu-name" type="text" value={form.newName} onChange={e => setField('newName', e.target.value)} className="filter-select" style={{ width: '100%' }} placeholder="Lämna tomt för att inte skapa vakt" />
            </label>
          )}
          <button type="submit" className="btn btn-success" disabled={creating}>{creating ? 'Skapar...' : 'Skapa användare'}</button>
        </form>
      )}

      {created && (
        <div className="card" style={{ padding: '16px', marginBottom: '16px', maxWidth: '520px' }}>
          <strong>Användaren är skapad. Skicka uppgifterna till vakten:</strong>
          <pre style={{ margin: '8px 0 0', userSelect: 'all', whiteSpace: 'pre-wrap' }}>{`E-post: ${created.email}\nLösenord: ${created.password}`}</pre>
          <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: '13px' }}>Lösenordet visas bara nu.</p>
        </div>
      )}

      {pwFor && (
        <form onSubmit={savePassword} className="card" style={{ padding: '16px', marginBottom: '16px', display: 'grid', gap: '12px', maxWidth: '520px' }}>
          <strong>Byt lösenord för {pwFor.email}</strong>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input id="pw-new" type="text" required minLength={8} value={pwValue} onChange={e => setPwValue(e.target.value)} className="filter-select" style={{ flex: 1 }} placeholder="Nytt lösenord (minst 8 tecken)" />
            <button type="button" className="btn btn-secondary" onClick={() => setPwValue(generatePassword())}>Generera</button>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-success" disabled={busyId === pwFor.id}>Spara lösenord</button>
            <button type="button" className="btn btn-secondary" onClick={() => setPwFor(null)}>Avbryt</button>
          </div>
        </form>
      )}

      {pwDone && (
        <div className="card" style={{ padding: '16px', marginBottom: '16px', maxWidth: '520px' }}>
          <strong>Lösenordet är ändrat. Skicka uppgifterna till vakten:</strong>
          <pre style={{ margin: '8px 0 0', userSelect: 'all', whiteSpace: 'pre-wrap' }}>{`E-post: ${pwDone.email}\nLösenord: ${pwDone.password}`}</pre>
          <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: '13px' }}>Lösenordet visas bara nu.</p>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>E-post</th>
              <th>Kopplad vakt</th>
              <th>Roll</th>
              <th>Åtgärder</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const isMe = p.id === currentUserId
              const busy = busyId === p.id
              const currentLinked = personnelById[p.personnel_id]
              return (
                <tr key={p.id}>
                  <td>
                    <strong>{p.email || '(okänd e-post)'}</strong>
                    {isMe && <span className="badge badge-success" style={{ marginLeft: '8px' }}>Du</span>}
                  </td>
                  <td>
                    <select
                      value={p.personnel_id || ''}
                      disabled={busy}
                      onChange={e => changeLink(p, e.target.value)}
                      className="filter-select"
                    >
                      <option value="">– Ingen koppling –</option>
                      {currentLinked && <option value={currentLinked.id}>{currentLinked.name}</option>}
                      {unlinkedPersonnel.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select
                      value={p.role || 'guard'}
                      disabled={busy || isMe}
                      onChange={e => changeRole(p, e.target.value)}
                      className="filter-select"
                      title={isMe ? 'Du kan inte ändra din egen roll' : undefined}
                    >
                      <option value="guard">Vakt</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
                      <button
                        disabled={busy}
                        onClick={() => { setPwFor(p); setPwValue(''); setPwDone(null) }}
                        style={{ background: 'none', border: 'none', color: '#374151', fontSize: '13px', cursor: 'pointer', padding: '6px 8px', borderRadius: '6px' }}
                      >
                        Byt lösenord
                      </button>
                      {!isMe && (
                        <>
                          <button
                            disabled={busy}
                            aria-label="Fler åtgärder"
                            onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}
                            style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '18px', lineHeight: 1, cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' }}
                          >
                            ⋯
                          </button>
                          {menuFor === p.id && (
                            <>
                              <div onClick={() => setMenuFor(null)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
                              <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 21, background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 14px rgba(0,0,0,0.1)', minWidth: '190px', padding: '4px' }}>
                                <button
                                  onClick={() => { setMenuFor(null); deleteUser(p, false) }}
                                  style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: '#b91c1c', fontSize: '13px', padding: '8px 10px', cursor: 'pointer', borderRadius: '6px' }}
                                >
                                  Ta bort konto
                                </button>
                                {currentLinked && (
                                  <button
                                    onClick={() => { setMenuFor(null); deleteUser(p, true) }}
                                    style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: '#b91c1c', fontSize: '13px', padding: '8px 10px', cursor: 'pointer', borderRadius: '6px' }}
                                  >
                                    Ta bort konto + vakt
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: '#6b7280', padding: '24px' }}>Inga konton hittades</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {unlinkedPersonnel.length > 0 && (
        <div className="card" style={{ marginTop: '16px', padding: '16px' }}>
          <strong>Vakter utan inloggning</strong>
          <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {unlinkedPersonnel.map(u => <span key={u.id} className="stat-badge">{u.name}</span>)}
          </div>
          <p style={{ margin: '12px 0 0', color: '#6b7280', fontSize: '13px' }}>
            Skapa konto med knappen "+ Ny användare" och välj vakten i listan.
          </p>
        </div>
      )}
    </div>
  )
}