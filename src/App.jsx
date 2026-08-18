import { useState } from 'react'
import { useAppData } from './hooks/useAppData'
import { useAuth } from './hooks/useAuth'

import LoginPage from './components/LoginPage'
import GuardApp from './components/GuardApp'
import ToastContainer from './components/ToastContainer'
import ConfirmModal from './components/modals/ConfirmModal'
import SecurityDutyModal from './components/modals/SecurityDutyModal'
import TimePickerModal from './components/modals/TimePickerModal'
import AddMatchModal from './components/modals/AddMatchModal'

import ScheduleTab from './components/tabs/ScheduleTab'
import PersonnelTab from './components/tabs/PersonnelTab'
import WorkHoursTab from './components/tabs/WorkHoursTab'
import SecurityTab from './components/tabs/SecurityTab'
import StatsTab from './components/tabs/StatsTab'

export default function App() {
  const [activeTab, setActiveTab] = useState('schedule')
  const auth = useAuth()
  const data = useAppData()

  // Laddar auth
  if (auth.loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <h1>Laddar...</h1>
      </div>
    )
  }

  // Inte inloggad
  if (!auth.user) {
    return <LoginPage onLogin={auth.signIn} />
  }

  // Profil saknas — visa felmeddelande
  if (!auth.profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '40px', maxWidth: '400px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ margin: '0 0 8px', color: '#1f2937' }}>Inget konto kopplat</h2>
          <p style={{ color: '#6b7280', margin: '0 0 24px' }}>Ditt konto är inte kopplat till en vakt. Kontakta administratören.</p>
          <button onClick={auth.signOut} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', padding: '12px 24px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>
            Logga ut
          </button>
        </div>
      </div>
    )
  }

  // Inloggad som vakt — skicka till vaktvy
  if (!auth.isAdmin) {
    return (
      <GuardApp
        personnelId={auth.personnelId}
        personnelName={auth.personnelName}
        onSignOut={auth.signOut}
        isAdmin={false}
        embedded={false}
      />
    )
  }

  // Laddar admin-data
  if (data.loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <h1>Laddar vaktschema...</h1>
      </div>
    )
  }

  return (
    <div className="app">
      {data.saving && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <span>Sparar...</span>
        </div>
      )}

      <ToastContainer toasts={data.toasts} removeToast={data.removeToast} />

      <div className="header">
        <div className="logo">
          <img src="/images/troja-logo.png" alt="Troja-Ljungby Logotyp" />
        </div>
        <div>
          <h1>Troja-Ljungby Vaktschema</h1>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#6b7280', fontSize: '13px', whiteSpace: 'nowrap' }}>
            Inloggad som <strong style={{ color: '#1f2937' }}>{auth.personnelName || auth.user?.email}</strong>
          </span>
          <button
            onClick={() => window.open('/vakt', '_blank')}
            style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151', padding: '8px 14px', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' }}
          >
            👤 Vaktvy
          </button>
          <button
            onClick={auth.signOut}
            style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#b91c1c', padding: '8px 14px', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' }}
          >
            Logga ut
          </button>
        </div>
      </div>

      <div className="tabs">
        {[
          { key: 'schedule', label: 'Schema' },
          { key: 'personnel', label: 'Personal' },
          { key: 'hours', label: 'Arbetstider' },
          { key: 'security', label: 'Säkerhetsansvarig' },
          { key: 'stats', label: 'Statistik' },
        ].map(tab => (
          <button
            key={tab.key}
            className={activeTab === tab.key ? 'tab active' : 'tab'}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'schedule' && (
        <ScheduleTab
          matches={data.matches}
          matchFilter={data.matchFilter}
          setMatchFilter={data.setMatchFilter}
          categoryFilter={data.categoryFilter}
          setCategoryFilter={data.setCategoryFilter}
          seasonFilter={data.seasonFilter}
          setSeasonFilter={data.setSeasonFilter}
          availableCategories={data.availableCategories}
          availableSeasons={data.availableSeasons}
          regularPersonnel={data.regularPersonnel}
          extraPersonnel={data.extraPersonnel}
          expandedMonths={data.expandedMonths}
          toggleMonth={data.toggleMonth}
          groupMatchesByMonth={data.groupMatchesByMonth}
          isWorking={data.isWorking}
          getWorkingCount={data.getWorkingCount}
          hasWorkHours={data.hasWorkHours}
          getWorkHoursForMatch={data.getWorkHoursForMatch}
          hasDeviatingHours={data.hasDeviatingHours}
          getDetailedTooltip={data.getDetailedTooltip}
          calculateMileageForMatch={data.calculateMileageForMatch}
          toggleWorking={data.toggleWorking}
          openTimeModal={data.openTimeModal}
          updateMatch={data.updateMatch}
          deleteMatch={data.deleteMatch}
          onAddMatch={() => data.setIsAddMatchModalOpen(true)}
          delegates={data.delegates}
          onAddDelegate={data.addDelegate}
          onDeleteDelegate={data.deleteDelegate}
          onUpdateSecurityResponsible={data.updateMatchSecurityResponsible}
          saving={data.saving}
        />
      )}

      {activeTab === 'personnel' && (
        <PersonnelTab
          regularPersonnel={data.regularPersonnel}
          extraPersonnel={data.extraPersonnel}
          workHours={data.workHours}
          securityDuties={data.securityDuties}
          availableSeasons={data.availableSeasons}
          seasonFilter={data.seasonFilter}
          setSeasonFilter={data.setSeasonFilter}
          getTotalHoursForPerson={data.getTotalHoursForPerson}
          getSecurityHoursForPerson={data.getSecurityHoursForPerson}
          getTotalAllHoursForPerson={data.getTotalAllHoursForPerson}
          addPersonnel={data.addPersonnel}
          deletePersonnel={data.deletePersonnel}
          exportWorkHours={data.exportWorkHours}
          updatePersonnelRole={data.updatePersonnelRole}
          saving={data.saving}
        />
      )}

      {activeTab === 'hours' && (
        <WorkHoursTab
          workHours={data.workHours}
          securityDuties={data.securityDuties}
          allWorkEntries={data.allWorkEntries}
          exportWorkHours={data.exportWorkHours}
          saving={data.saving}
          seasonFilter={data.seasonFilter}
          setSeasonFilter={data.setSeasonFilter}
          availableSeasons={data.availableSeasons}
        />
      )}

      {activeTab === 'security' && (
        <SecurityTab
          securityDuties={data.securityDuties}
          openAddSecurityDutyModal={data.openAddSecurityDutyModal}
          openEditSecurityDutyModal={data.openEditSecurityDutyModal}
          deleteSecurityDuty={data.deleteSecurityDuty}
          saving={data.saving}
          seasonFilter={data.seasonFilter}
          setSeasonFilter={data.setSeasonFilter}
          availableSeasons={data.availableSeasons}
        />
      )}

      {activeTab === 'stats' && (
        <StatsTab
          matches={data.matches}
          workHours={data.workHours}
          securityDuties={data.securityDuties}
          personnel={data.personnel}
          delegates={data.delegates}
          seasonFilter={data.seasonFilter}
          setSeasonFilter={data.setSeasonFilter}
          availableSeasons={data.availableSeasons}
        />
      )}


      <AddMatchModal
        isOpen={data.isAddMatchModalOpen}
        onClose={() => data.setIsAddMatchModalOpen(false)}
        onSave={data.addMatch}
        availableCategories={data.availableCategories}
        availableSeasons={data.availableSeasons}
      />

      <TimePickerModal
        isOpen={data.isTimeModalOpen}
        onClose={() => data.setIsTimeModalOpen(false)}
        onSave={data.saveWorkTime}
        personName={data.selectedPerson?.name}
        matchInfo={data.selectedMatch || {}}
      />

      <SecurityDutyModal
        isOpen={data.isSecurityDutyModalOpen}
        onClose={() => data.setIsSecurityDutyModalOpen(false)}
        onSave={data.saveSecurityDuty}
        duty={data.selectedSecurityDuty}
        availableSeasons={data.availableSeasons}
      />

      <ConfirmModal
        isOpen={data.isConfirmModalOpen}
        onClose={data.closeConfirmModal}
        onConfirm={data.handleConfirmAction}
        title={data.confirmModalData?.title}
        message={data.confirmModalData?.message}
        confirmText={data.confirmModalData?.confirmText}
        confirmButtonClass={data.confirmModalData?.confirmButtonClass}
      />
    </div>
  )
}