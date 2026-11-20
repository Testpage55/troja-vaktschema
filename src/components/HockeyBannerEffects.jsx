import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

// ─── HockeyBannerEffects ──────────────────────────────────────────────────────
// Bakgrundslager med PixiJS-effekter för den röda nedräkningsbannern.
// Läggs absolut positionerat (inset 0, z-index 1) inuti bannern. Bannerns
// text ska ligga ovanpå med z-index 2 och pointer-events: none, så att klick
// och pekarrörelser når effekterna.
//
// Props:
//   intensity            0–2, standard 0.7
//   speed                standard 1
//   enableBokeh, enableFlashes, enableSnow, enableFog,
//   enableTrail, enableClickFireworks   (booleans, standard true)
//   respectReducedMotion (standard true)
// Ref: ref.current.celebrate() – fyrverkeri, t.ex. när nedräkningen når 00:00:00.

const HockeyBannerEffects = forwardRef(function HockeyBannerEffects(props, ref) {
  const hostRef = useRef(null)
  const fxRef = useRef(null)
  const {
    intensity = 0.7,
    speed = 1,
    enableBokeh = true,
    enableFlashes = true,
    enableSnow = true,
    enableFog = true,
    enableTrail = true,
    enableClickFireworks = true,
    respectReducedMotion = true,
  } = props

  const options = { intensity, speed, enableBokeh, enableFlashes, enableSnow, enableFog, enableTrail, enableClickFireworks }

  // Skapa och städa upp PixiJS (laddas först när bannern visas)
  useEffect(() => {
    let cancelled = false
    let instance = null
    const el = hostRef.current
    if (!el) return

    import('../effects/hockeyBannerEffects').then(async ({ createHockeyBannerEffects }) => {
      if (cancelled) return
      try {
        instance = await createHockeyBannerEffects(el, { ...options, respectReducedMotion })
      } catch (e) {
        console.warn('Kunde inte starta bannereffekter:', e)
        return
      }
      if (cancelled) { instance.destroy(); return }
      fxRef.current = instance
    })

    return () => {
      cancelled = true
      fxRef.current = null
      if (instance) instance.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respectReducedMotion])

  // Uppdatera inställningar utan att starta om
  useEffect(() => {
    fxRef.current?.setOptions(options)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intensity, speed, enableBokeh, enableFlashes, enableSnow, enableFog, enableTrail, enableClickFireworks])

  useImperativeHandle(ref, () => ({
    celebrate: () => fxRef.current?.celebrate(),
  }), [])

  return <div ref={hostRef} className="hbe-host" aria-hidden="true" />
})

export default HockeyBannerEffects
