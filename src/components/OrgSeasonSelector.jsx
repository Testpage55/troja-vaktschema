import { useState } from 'react'

export default function OrgSeasonSelector({ organizations, seasons, onSelect, onCreate }) {
  const [selectedOrg, setSelectedOrg] = useState(null)
  const [showNewOrg, setShowNewOrg] = useState(false)
  const [showNewSeason, setShowNewSeason] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newSeasonName, setNewSeasonName] = useState('')
  const [saving, setSaving] = useState(false)

  const orgSeasons = selectedOrg
    ? seasons.filter(s => s.organization_id === selectedOrg.id)
    : []

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return
    setSaving(true)
    await onCreate('organization', { name: newOrgName.trim() })
    setNewOrgName('')
    setShowNewOrg(false)
    setSaving(false)
  }

  const handleCreateSeason = async () => {
    if (!newSeasonName.trim() || !selectedOrg) return
    setSaving(true)
    await onCreate('season', { name: newSeasonName.trim(), organization_id: selectedOrg.id })
    setNewSeasonName('')
    setShowNewSeason(false)
    setSaving(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--gray-50)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: 'var(--gray-900)' }}>Vaktschema</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--gray-500)', fontSize: '15px' }}>
            {!selectedOrg ? 'Välj verksamhet' : 'Välj säsong'}
          </p>
        </div>

        {!selectedOrg ? (
          /* Org-väljare */
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {organizations.map(org => (
                <button
                  key={org.id}
                  onClick={() => setSelectedOrg(org)}
                  style={{
                    padding: '16px 20px', background: 'white',
                    border: '1px solid var(--gray-200)', borderRadius: '12px',
                    cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: '14px',
                    fontSize: '16px', fontWeight: '600', color: 'var(--gray-900)',
                    transition: 'border-color 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#16a34a'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--gray-200)'}
                >
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: '#dcfce7', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '18px', flexShrink: 0
                  }}>
                    🏢
                  </div>
                  <div>
                    <div>{org.name}</div>
                    <div style={{ fontSize: '13px', fontWeight: '400', color: 'var(--gray-500)', marginTop: '2px' }}>
                      {seasons.filter(s => s.organization_id === org.id).length} säsonger
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', color: 'var(--gray-400)', fontSize: '20px' }}>›</div>
                </button>
              ))}
            </div>

            {showNewOrg ? (
              <div style={{
                background: 'white', border: '1px solid var(--gray-200)',
                borderRadius: '12px', padding: '16px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-700)', marginBottom: '10px' }}>
                  Ny verksamhet
                </div>
                <input
                  type="text"
                  placeholder="t.ex. Troja-Ljungby"
                  value={newOrgName}
                  onChange={e => setNewOrgName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateOrg()}
                  autoFocus
                  style={{
                    width: '100%', padding: '10px 12px', boxSizing: 'border-box',
                    border: '1px solid var(--gray-200)', borderRadius: '8px',
                    fontSize: '15px', outline: 'none', marginBottom: '10px'
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleCreateOrg}
                    disabled={saving || !newOrgName.trim()}
                    style={{
                      flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
                      background: '#16a34a', color: 'white', fontSize: '14px',
                      fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    Skapa
                  </button>
                  <button
                    onClick={() => { setShowNewOrg(false); setNewOrgName('') }}
                    style={{
                      padding: '10px 16px', border: '1px solid var(--gray-200)',
                      borderRadius: '8px', background: 'white', fontSize: '14px',
                      cursor: 'pointer', color: 'var(--gray-600)'
                    }}
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewOrg(true)}
                style={{
                  width: '100%', padding: '14px', background: 'white',
                  border: '1.5px dashed var(--gray-300)', borderRadius: '12px',
                  cursor: 'pointer', fontSize: '14px', color: 'var(--gray-500)',
                  fontWeight: '500'
                }}
              >
                + Ny verksamhet
              </button>
            )}
          </div>
        ) : (
          /* Säsong-väljare */
          <div>
            <button
              onClick={() => setSelectedOrg(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--gray-500)', fontSize: '14px', marginBottom: '20px', padding: 0
              }}
            >
              ‹ {selectedOrg.name}
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {orgSeasons.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--gray-400)', fontSize: '14px', padding: '20px 0' }}>
                  Inga säsonger ännu
                </div>
              )}
              {orgSeasons.map(season => (
                <button
                  key={season.id}
                  onClick={() => onSelect(selectedOrg, season)}
                  style={{
                    padding: '16px 20px', background: 'white',
                    border: '1px solid var(--gray-200)', borderRadius: '12px',
                    cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: '14px',
                    fontSize: '16px', fontWeight: '600', color: 'var(--gray-900)',
                    transition: 'border-color 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#16a34a'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--gray-200)'}
                >
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: '#dcfce7', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '18px', flexShrink: 0
                  }}>
                    📅
                  </div>
                  <div style={{ fontSize: '16px' }}>{season.name}</div>
                  <div style={{ marginLeft: 'auto', color: 'var(--gray-400)', fontSize: '20px' }}>›</div>
                </button>
              ))}
            </div>

            {showNewSeason ? (
              <div style={{
                background: 'white', border: '1px solid var(--gray-200)',
                borderRadius: '12px', padding: '16px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-700)', marginBottom: '10px' }}>
                  Ny säsong
                </div>
                <input
                  type="text"
                  placeholder="t.ex. 2025/2026"
                  value={newSeasonName}
                  onChange={e => setNewSeasonName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateSeason()}
                  autoFocus
                  style={{
                    width: '100%', padding: '10px 12px', boxSizing: 'border-box',
                    border: '1px solid var(--gray-200)', borderRadius: '8px',
                    fontSize: '15px', outline: 'none', marginBottom: '10px'
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleCreateSeason}
                    disabled={saving || !newSeasonName.trim()}
                    style={{
                      flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
                      background: '#16a34a', color: 'white', fontSize: '14px',
                      fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    Skapa
                  </button>
                  <button
                    onClick={() => { setShowNewSeason(false); setNewSeasonName('') }}
                    style={{
                      padding: '10px 16px', border: '1px solid var(--gray-200)',
                      borderRadius: '8px', background: 'white', fontSize: '14px',
                      cursor: 'pointer', color: 'var(--gray-600)'
                    }}
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewSeason(true)}
                style={{
                  width: '100%', padding: '14px', background: 'white',
                  border: '1.5px dashed var(--gray-300)', borderRadius: '12px',
                  cursor: 'pointer', fontSize: '14px', color: 'var(--gray-500)',
                  fontWeight: '500'
                }}
              >
                + Ny säsong
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}