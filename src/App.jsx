import { useState } from 'react'
import { useAppData } from './hooks/useAppData'

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
  const data = useAppData()

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
        />
      )}

      {activeTab === 'security' && (
        <SecurityTab
          securityDuties={data.securityDuties}
          openAddSecurityDutyModal={data.openAddSecurityDutyModal}
          openEditSecurityDutyModal={data.openEditSecurityDutyModal}
          deleteSecurityDuty={data.deleteSecurityDuty}
          saving={data.saving}
        />
      )}

      {activeTab === 'stats' && (
        <StatsTab
          matches={data.matches}
          workHours={data.workHours}
          securityDuties={data.securityDuties}
          personnel={data.personnel}
          delegates={data.delegates}
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