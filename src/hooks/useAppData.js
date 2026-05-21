import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { REGULAR_GUARDS, HOURLY_RATE, MILEAGE_RATE } from '../constants'
import { calculateWorkTimes } from '../utils/timeUtils'

export function useAppData() {
  const [matches, setMatches] = useState([])
  const [personnel, setPersonnel] = useState([])
  const [workHours, setWorkHours] = useState([])
  const [securityDuties, setSecurityDuties] = useState([])
  const [delegates, setDelegates] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false)
  const [isSecurityDutyModalOpen, setIsSecurityDutyModalOpen] = useState(false)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [isAddMatchModalOpen, setIsAddMatchModalOpen] = useState(false)
  const [confirmModalData, setConfirmModalData] = useState(null)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [selectedSecurityDuty, setSelectedSecurityDuty] = useState(null)

  const [expandedMonths, setExpandedMonths] = useState(new Set())
  const [toasts, setToasts] = useState([])
  const [matchFilter, setMatchFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [seasonFilter, setSeasonFilter] = useState('all')

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    if (matches.length > 0) {
      const monthGroups = groupMatchesByMonth(matches, matchFilter)
      const allMonthKeys = monthGroups.map(g => g.monthKey)
      setExpandedMonths(new Set(allMonthKeys))
    }
  }, [matches])

  // ─── Data fetching ────────────────────────────────────────────────────────

  const fetchData = async () => {
    try {
      const { data: personnelData } = await supabase.from('personnel').select('*')

      const { data: matchData } = await supabase
        .from('matches')
        .select('*, assignments(personnel_id, is_working)')
        .order('date')

      const { data: hoursData } = await supabase
        .from('work_hours')
        .select('*, matches(date, opponent, season, category), personnel(name)')
        .order('work_date', { ascending: false })

      const { data: securityData } = await supabase
        .from('security_duties')
        .select('*')
        .order('date', { ascending: false })

      const { data: delegatesData } = await supabase
        .from('delegates')
        .select('*')
        .order('date', { ascending: false })

      const sortedPersonnel = personnelData?.sort((a, b) => {
        const aIsRegular = REGULAR_GUARDS.includes(a.name)
        const bIsRegular = REGULAR_GUARDS.includes(b.name)
        if (aIsRegular && !bIsRegular) return -1
        if (!aIsRegular && bIsRegular) return 1
        return a.name.localeCompare(b.name)
      }) || []

      setPersonnel(sortedPersonnel)
      setMatches(matchData || [])
      setWorkHours(hoursData || [])
      setSecurityDuties(securityData || [])
      setDelegates(delegatesData || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // ─── Toast ────────────────────────────────────────────────────────────────

  const showToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  // ─── Confirm modal ────────────────────────────────────────────────────────

  const showConfirmModal = (title, message, onConfirm, confirmText = 'Ta bort', confirmButtonClass = 'btn-danger') => {
    setConfirmModalData({ title, message, onConfirm, confirmText, confirmButtonClass })
    setIsConfirmModalOpen(true)
  }

  const closeConfirmModal = () => {
    setIsConfirmModalOpen(false)
    setConfirmModalData(null)
  }

  const handleConfirmAction = () => {
    if (confirmModalData?.onConfirm) confirmModalData.onConfirm()
    closeConfirmModal()
  }

  // ─── Match CRUD ───────────────────────────────────────────────────────────

  const addMatch = async (matchData) => {
    setSaving(true)
    try {
      await supabase.from('matches').insert([matchData])
      fetchData()
      showToast(`Match mot ${matchData.opponent} har lagts till`, 'success')
    } catch (error) {
      console.error('Error:', error)
      showToast('Fel vid tillägg av match', 'error')
    } finally {
      setSaving(false)
    }
  }

  const deleteMatch = async (matchId, opponent) => {
    showConfirmModal(
      'Ta bort match',
      `Vill du ta bort matchen mot ${opponent}?\n\nDetta tar även bort alla tilldelningar och arbetstider.\n\nÅtgärden kan inte ångras.`,
      async () => {
        setSaving(true)
        try {
          await supabase.from('assignments').delete().eq('match_id', matchId)
          await supabase.from('work_hours').delete().eq('match_id', matchId)
          await supabase.from('matches').delete().eq('id', matchId)
          fetchData()
          showToast(`Match borttagen`, 'info')
        } catch (error) {
          console.error('Error:', error)
          showToast('Fel vid borttagning', 'error')
        } finally {
          setSaving(false)
        }
      },
      'Ta bort match'
    )
  }

  // ─── Schedule helpers ─────────────────────────────────────────────────────

  const isWorking = (match, personnelId) => {
    const assignment = match.assignments?.find(a => a.personnel_id === personnelId)
    return assignment?.is_working || false
  }

  const getWorkingCount = (match) => match.assignments?.filter(a => a.is_working).length || 0

  const hasWorkHours = (matchId, personnelId) =>
    workHours.some(wh => wh.match_id === matchId && wh.personnel_id === personnelId)

  const getWorkHoursForMatch = (matchId, personnelId) =>
    workHours.find(wh => wh.match_id === matchId && wh.personnel_id === personnelId)

  const hasDeviatingHours = (matchId, personnelId) => {
    const wh = getWorkHoursForMatch(matchId, personnelId)
    return wh && wh.total_hours != 4.5
  }

  const getDetailedTooltip = (match, person) => {
    const wh = getWorkHoursForMatch(match.id, person.id)
    const totalHours = getTotalHoursForPerson(person.id)
    const totalMatches = workHours.filter(w => w.personnel_id === person.id).length
    const avgHours = totalMatches > 0 ? (parseFloat(totalHours) / totalMatches).toFixed(1) : 0
    let tooltip = `${person.name}\nTotalt: ${totalHours}h (${totalMatches} matcher)\nSnitt: ${avgHours}h\n`
    if (wh) {
      tooltip += `\nDenna match:\n${wh.start_time} - ${wh.end_time}\n${wh.total_hours}h`
      if (wh.total_hours != 4.5) tooltip += ` (avviker från standard)`
      if (wh.notes) tooltip += `\n${wh.notes}`
    }
    return tooltip
  }

  const calculateMileageForMatch = (match) => {
    if (match.match_type !== 'away' || !match.distance_miles) return 0
    return match.distance_miles * MILEAGE_RATE * getWorkingCount(match)
  }

  const groupMatchesByMonth = (matchList = matches, typeFilter = matchFilter, catFilter = categoryFilter, seaFilter = seasonFilter) => {
    const groups = {}
    let filtered = matchList
    if (typeFilter !== 'all') filtered = filtered.filter(m => (m.match_type || 'home') === typeFilter)
    if (catFilter !== 'all') filtered = filtered.filter(m => (m.category || '') === catFilter)
    if (seaFilter !== 'all') filtered = filtered.filter(m => (m.season || '') === seaFilter)

    filtered.forEach(match => {
      const date = new Date(match.date)
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`
      const monthName = date.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' })
      if (!groups[monthKey]) groups[monthKey] = { monthName, monthKey, matches: [] }
      groups[monthKey].matches.push(match)
    })

    return Object.values(groups).sort((a, b) => {
      const [yearA, monthA] = a.monthKey.split('-').map(Number)
      const [yearB, monthB] = b.monthKey.split('-').map(Number)
      return yearA !== yearB ? yearA - yearB : monthA - monthB
    })
  }

  const toggleMonth = (monthKey) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev)
      newSet.has(monthKey) ? newSet.delete(monthKey) : newSet.add(monthKey)
      return newSet
    })
  }

  // Unika kategorier och säsonger för filter
  const availableCategories = [...new Set(matches.map(m => m.category).filter(Boolean))]
  const availableSeasons = [...new Set(matches.map(m => m.season).filter(Boolean))]

  // ─── Personnel helpers ────────────────────────────────────────────────────

  const getTotalHoursForPerson = (personnelId) =>
    workHours.filter(wh => wh.personnel_id === personnelId)
      .reduce((total, wh) => total + (wh.total_hours || 0), 0).toFixed(1)

  const getSecurityHoursForPerson = (personName) =>
    securityDuties.filter(d => d.personnel_name === personName)
      .reduce((total, d) => total + d.hours, 0)

  const getTotalAllHoursForPerson = (person) =>
    parseFloat(getTotalHoursForPerson(person.id)) + getSecurityHoursForPerson(person.name)

  // ─── Toggle working ───────────────────────────────────────────────────────

  const addAutomaticWorkHours = async (matchId, personnelId) => {
    try {
      const match = matches.find(m => m.id === matchId)
      if (!match) return
      const { startTime, endTime } = calculateWorkTimes(match.time)
      const { data: existingList } = await supabase.from('work_hours').select('id')
        .eq('match_id', matchId).eq('personnel_id', personnelId).limit(1)
      const existing = existingList?.[0]
      if (!existing) {
        await supabase.from('work_hours').insert([{
          match_id: matchId, personnel_id: personnelId,
          start_time: startTime, end_time: endTime,
          work_date: match.date, notes: 'Automatiskt registrerad (4,5h standard)'
        }])
      }
    } catch (error) { console.error('Error adding automatic work hours:', error) }
  }

  const removeWorkHours = async (matchId, personnelId) => {
    try {
      await supabase.from('work_hours').delete().eq('match_id', matchId).eq('personnel_id', personnelId)
    } catch (error) { console.error('Error removing work hours:', error) }
  }

  const toggleWorking = async (matchId, personnelId) => {
    try {
      const { data: existingList } = await supabase.from('assignments').select('*')
        .eq('match_id', matchId).eq('personnel_id', personnelId).limit(1)
      const existing = existingList?.[0]
      const person = personnel.find(p => p.id === personnelId)
      const match = matches.find(m => m.id === matchId)

      if (existing) {
        if (existing.is_working) {
          showConfirmModal(
            'Ta bort vakt från match',
            `Vill du ta bort ${person.name} från match mot ${match.opponent}?\n\nDetta tar bort tilldelningen och registrerade arbetstider.\n\nÅtgärden kan inte ångras.`,
            async () => {
              setSaving(true)
              try {
                await supabase.from('assignments').update({ is_working: false }).eq('id', existing.id)
                await removeWorkHours(matchId, personnelId)
                showToast(`${person.name} borttagen från match mot ${match.opponent}`, 'info')
                fetchData()
              } catch (e) { showToast('Ett fel uppstod', 'error') }
              finally { setSaving(false) }
            }, 'Ta bort vakt'
          )
          return
        }
        setSaving(true)
        await supabase.from('assignments').update({ is_working: true }).eq('id', existing.id)
        await addAutomaticWorkHours(matchId, personnelId)
        showToast(`${person.name} tillagd för match mot ${match.opponent}`, 'success')
      } else {
        setSaving(true)
        await supabase.from('assignments').insert([{ match_id: matchId, personnel_id: personnelId, is_working: true }])
        await addAutomaticWorkHours(matchId, personnelId)
        showToast(`${person.name} tillagd för match mot ${match.opponent}`, 'success')
      }
      fetchData()
    } catch (error) {
      console.error('Error:', error)
      showToast('Ett fel uppstod', 'error')
    } finally { setSaving(false) }
  }

  // ─── Work time modal ──────────────────────────────────────────────────────

  const openTimeModal = (matchId, personnelId) => {
    setSelectedMatch(matches.find(m => m.id === matchId))
    setSelectedPerson(personnel.find(p => p.id === personnelId))
    setIsTimeModalOpen(true)
  }

  const saveWorkTime = async (timeData) => {
    setSaving(true)
    try {
      await supabase.from('work_hours').delete()
        .eq('match_id', selectedMatch.id).eq('personnel_id', selectedPerson.id)
      await supabase.from('work_hours').insert([{
        match_id: selectedMatch.id, personnel_id: selectedPerson.id,
        start_time: timeData.startTime, end_time: timeData.endTime,
        work_date: selectedMatch.date, notes: timeData.notes
      }])
      fetchData()
      showToast(`Arbetstid uppdaterad för ${selectedPerson.name} (${timeData.hours}h)`, 'success')
    } catch (error) {
      showToast('Fel vid sparande av arbetstid', 'error')
    } finally { setSaving(false) }
  }

  // ─── Personnel CRUD ───────────────────────────────────────────────────────

  const addPersonnel = async () => {
    const name = prompt('Namn på ny vakt:')
    if (!name?.trim()) return
    setSaving(true)
    try {
      await supabase.from('personnel').insert([{ name: name.trim() }])
      fetchData()
      showToast(`${name.trim()} har lagts till`, 'success')
    } catch (error) { showToast('Fel vid tillägg', 'error') }
    finally { setSaving(false) }
  }

  const deletePersonnel = async (personnelId, name) => {
    showConfirmModal(
      'Ta bort personal',
      `Vill du ta bort ${name} permanent?\n\nDetta tar bort personen, alla tilldelningar och arbetstider.\n\nÅtgärden kan inte ångras.`,
      async () => {
        setSaving(true)
        try {
          await supabase.from('assignments').delete().eq('personnel_id', personnelId)
          await supabase.from('work_hours').delete().eq('personnel_id', personnelId)
          await supabase.from('personnel').delete().eq('id', personnelId)
          fetchData()
          showToast(`${name} har tagits bort`, 'info')
        } catch (error) { showToast('Fel vid borttagning', 'error') }
        finally { setSaving(false) }
      }, 'Ta bort person'
    )
  }

  // ─── Security duties ──────────────────────────────────────────────────────

  const saveSecurityDuty = async (securityData) => {
    setSaving(true)
    try {
      if (securityData.id) {
        await supabase.from('security_duties').update({
          date: securityData.date, opponent: securityData.opponent,
          personnel_name: securityData.personnel_name, hours: securityData.hours,
          mileage_compensation: securityData.mileage_compensation, notes: securityData.notes
        }).eq('id', securityData.id)
        showToast(`Uppdrag för ${securityData.personnel_name} uppdaterat`, 'success')
      } else {
        await supabase.from('security_duties').insert([{
          date: securityData.date, opponent: securityData.opponent,
          personnel_name: securityData.personnel_name, hours: securityData.hours,
          mileage_compensation: securityData.mileage_compensation, notes: securityData.notes
        }])
        showToast(`Uppdrag för ${securityData.personnel_name} tillagt`, 'success')
      }
      fetchData()
    } catch (error) { showToast('Fel vid sparande', 'error') }
    finally { setSaving(false) }
  }

  const deleteSecurityDuty = async (dutyId, personnelName, opponent) => {
    showConfirmModal(
      'Ta bort säkerhetsansvarig uppdrag',
      `Vill du ta bort uppdraget?\n\nUppdrag: ${opponent}\nPerson: ${personnelName}\n\nÅtgärden kan inte ångras.`,
      async () => {
        setSaving(true)
        try {
          await supabase.from('security_duties').delete().eq('id', dutyId)
          fetchData()
          showToast('Uppdrag borttaget', 'info')
        } catch (error) { showToast('Fel vid borttagning', 'error') }
        finally { setSaving(false) }
      }, 'Ta bort uppdrag'
    )
  }

  const openAddSecurityDutyModal = () => { setSelectedSecurityDuty(null); setIsSecurityDutyModalOpen(true) }
  const openEditSecurityDutyModal = (duty) => { setSelectedSecurityDuty(duty); setIsSecurityDutyModalOpen(true) }

  // ─── Match security responsible ───────────────────────────────────────────

  const updateMatchSecurityResponsible = async (matchId, personnelId) => {
    try {
      await supabase
        .from('matches')
        .update({ security_responsible_id: personnelId || null })
        .eq('id', matchId)
      fetchData()
    } catch (error) { showToast('Fel vid uppdatering av säkerhetsansvarig', 'error') }
  }

  // ─── Delegates ────────────────────────────────────────────────────────────

  const addDelegate = async (delegateData) => {
    setSaving(true)
    try {
      await supabase.from('delegates').insert([delegateData])
      fetchData()
      showToast(`Delegat ${delegateData.name} noterad`, 'success')
    } catch (error) {
      showToast('Fel vid sparande av delegat', 'error')
    } finally { setSaving(false) }
  }

  const deleteDelegate = async (delegateId, name) => {
    showConfirmModal(
      'Ta bort delegatnotering',
      `Vill du ta bort noteringen för ${name}?\n\nÅtgärden kan inte ångras.`,
      async () => {
        setSaving(true)
        try {
          await supabase.from('delegates').delete().eq('id', delegateId)
          fetchData()
          showToast('Delegatnotering borttagen', 'info')
        } catch (error) { showToast('Fel vid borttagning', 'error') }
        finally { setSaving(false) }
      }, 'Ta bort'
    )
  }

  // ─── Personnel role ───────────────────────────────────────────────────────

  const updatePersonnelRole = async (personnelId, isSecurityResponsible) => {
    try {
      await supabase
        .from('personnel')
        .update({ is_security_responsible: isSecurityResponsible })
        .eq('id', personnelId)
      fetchData()
    } catch (error) { showToast('Fel vid uppdatering av roll', 'error') }
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  const exportWorkHours = (personnelId = null) => {
    let workData = workHours
    let secData = securityDuties
    if (personnelId) {
      const personName = personnel.find(p => p.id === personnelId)?.name
      workData = workHours.filter(wh => wh.personnel_id === personnelId)
      secData = securityDuties.filter(d => d.personnel_name === personName)
    }
    const headers = 'Typ,Datum,Match/Uppdrag,Personal,Starttid,Sluttid,Timmar,Milersättning,Anteckningar\n'
    const entries = [
      ...workData.map(wh => ({
        type: 'Vakt', date: wh.work_date || wh.matches?.date,
        opponent: wh.matches?.opponent, personnel: wh.personnel?.name,
        start: wh.start_time, end: wh.end_time, hours: wh.total_hours || 0,
        mileage: '', notes: wh.notes || '',
        sortDate: new Date(wh.work_date || wh.matches?.date || '1900-01-01')
      })),
      ...secData.map(d => ({
        type: 'Säkerhetsansvarig', date: d.date, opponent: d.opponent,
        personnel: d.personnel_name, start: '-', end: '-', hours: d.hours,
        mileage: d.mileage_compensation || 0, notes: d.notes || '',
        sortDate: new Date(d.date)
      }))
    ].sort((a, b) => b.sortDate - a.sortDate)

    const csv = entries.map(e =>
      `${e.type},${e.date},${e.opponent},${e.personnel},${e.start},${e.end},${e.hours},${e.mileage},"${e.notes}"`
    ).join('\n')

    const blob = new Blob([headers + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = personnelId
      ? `arbetstid_${personnel.find(p => p.id === personnelId)?.name || 'person'}.csv`
      : 'arbetstid_alla.csv'
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ─── Derived data ─────────────────────────────────────────────────────────

  const regularPersonnel = personnel.filter(p => REGULAR_GUARDS.includes(p.name))
  const extraPersonnel = personnel.filter(p => !REGULAR_GUARDS.includes(p.name))

  const personnelStatsData = personnel.map(person => {
    const personMatches = workHours.filter(wh => wh.personnel_id === person.id)
    const personHours = personMatches.reduce((t, wh) => t + (wh.total_hours || 0), 0)
    let personMileage = 0
    personMatches.forEach(wh => {
      const match = matches.find(m => m.id === wh.match_id)
      if (match?.match_type === 'away' && match.distance_miles)
        personMileage += match.distance_miles * MILEAGE_RATE
    })
    const secForPerson = securityDuties.filter(d => d.personnel_name === person.name)
    const secHours = secForPerson.reduce((t, d) => t + d.hours, 0)
    const secMileage = secForPerson.reduce((t, d) => t + (d.mileage_compensation || 0), 0)
    const totalHours = personHours + secHours
    const totalMileage = personMileage + secMileage
    return {
      name: person.name, matches: personMatches.length, hours: totalHours,
      salary: totalHours * HOURLY_RATE, mileage: totalMileage,
      totalCompensation: (totalHours * HOURLY_RATE) + totalMileage,
      securityDuties: secForPerson.length, securityHours: secHours
    }
  })

  const totalMatchesWorked = workHours.length
  const totalSecurityDuties = securityDuties.length
  const totalHoursWorked = workHours.reduce((t, wh) => t + (wh.total_hours || 0), 0)
  const totalSecurityHours = securityDuties.reduce((t, d) => t + d.hours, 0)
  const totalAllHours = totalHoursWorked + totalSecurityHours
  const totalSalary = totalAllHours * HOURLY_RATE
  const totalMileage = matches.reduce((t, m) => t + calculateMileageForMatch(m), 0)
  const totalSecurityMileage = securityDuties.reduce((t, d) => t + (d.mileage_compensation || 0), 0)
  const totalAllMileage = totalMileage + totalSecurityMileage
  const totalMiles = matches.filter(m => m.match_type === 'away')
    .reduce((t, m) => t + (m.distance_miles * getWorkingCount(m) || 0), 0)
  const totalCompensation = totalSalary + totalAllMileage

  const allWorkEntries = [
    ...workHours.map(wh => ({ ...wh, type: 'work', sortDate: new Date(wh.work_date || wh.matches?.date || '1900-01-01') })),
    ...securityDuties.map(d => ({ ...d, type: 'security', sortDate: new Date(d.date) }))
  ].sort((a, b) => b.sortDate - a.sortDate)

  return {
    matches, personnel, workHours, securityDuties, delegates,
    loading, saving,
    matchFilter, setMatchFilter,
    categoryFilter, setCategoryFilter,
    seasonFilter, setSeasonFilter,
    availableCategories, availableSeasons,
    expandedMonths, toasts,
    isTimeModalOpen, setIsTimeModalOpen,
    isSecurityDutyModalOpen, setIsSecurityDutyModalOpen,
    isConfirmModalOpen,
    isAddMatchModalOpen, setIsAddMatchModalOpen,
    confirmModalData,
    selectedMatch, selectedPerson, selectedSecurityDuty,
    showToast, removeToast,
    closeConfirmModal, handleConfirmAction,
    isWorking, getWorkingCount, hasWorkHours, getWorkHoursForMatch,
    hasDeviatingHours, getDetailedTooltip, calculateMileageForMatch,
    groupMatchesByMonth, toggleMonth,
    addMatch, deleteMatch,
    getTotalHoursForPerson, getSecurityHoursForPerson, getTotalAllHoursForPerson,
    addPersonnel, deletePersonnel,
    openTimeModal, saveWorkTime,
    toggleWorking,
    saveSecurityDuty, deleteSecurityDuty,
    openAddSecurityDutyModal, openEditSecurityDutyModal,
    updateMatchSecurityResponsible,
    addDelegate, deleteDelegate,
    updatePersonnelRole,
    exportWorkHours,
    regularPersonnel, extraPersonnel, personnelStatsData,
    totalMatchesWorked, totalSecurityDuties,
    totalAllHours, totalSalary, totalAllMileage, totalMiles, totalCompensation,
    allWorkEntries
  }
}