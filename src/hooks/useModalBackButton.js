import { useEffect } from 'react'

/**
 * När en modal öppnas pushas ett falskt history-state.
 * Om användaren trycker "Tillbaka" på telefonen fångar vi
 * popstate-eventet och stänger modalen istället.
 */
export function useModalBackButton(isOpen, onClose) {
  useEffect(() => {
    if (!isOpen) return

    // Pusha ett falskt state så att "tillbaka" har något att poppa
    window.history.pushState({ modal: true }, '')

    const handlePop = () => {
      onClose()
    }

    window.addEventListener('popstate', handlePop)
    return () => {
      window.removeEventListener('popstate', handlePop)
      // Om modalen stängs på annat sätt (t.ex. kryssknappen),
      // poppa det falska state:t så historiken hålls ren
      if (window.history.state?.modal) {
        window.history.back()
      }
    }
  }, [isOpen])
}