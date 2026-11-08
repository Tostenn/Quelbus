import * as Location from 'expo-location'
import { useCallback, useEffect, useState } from 'react'

export type Position = { lat: number; lng: number }

export type LocationStatus = 'idle' | 'locating' | 'denied' | 'unavailable'

/** Position actuelle : la dernière connue si elle est récente, sinon une nouvelle mesure. */
async function currentPosition(): Promise<Position> {
  const last = await Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 200 })
  if (last) return { lat: last.coords.latitude, lng: last.coords.longitude }
  const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
  return { lat: fresh.coords.latitude, lng: fresh.coords.longitude }
}

/**
 * Position du téléphone. `request()` demande l'autorisation si besoin ;
 * si elle est déjà accordée, la position arrive seule au montage (avec `auto`).
 */
export function useLocation({ auto = false } = {}) {
  const [position, setPosition] = useState<Position | null>(null)
  const [status, setStatus] = useState<LocationStatus>('idle')

  const request = useCallback(async (): Promise<Position | null> => {
    setStatus('locating')
    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync()
      if (permission !== 'granted') {
        setStatus('denied')
        return null
      }
      const found = await currentPosition()
      setPosition(found)
      setStatus('idle')
      return found
    } catch {
      // GPS coupé, délai dépassé…
      setStatus('unavailable')
      return null
    }
  }, [])

  useEffect(() => {
    if (!auto) return
    let cancelled = false
    Location.getForegroundPermissionsAsync()
      .then(({ granted }) => {
        if (granted && !cancelled) request()
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [auto, request])

  return { position, status, request }
}

export const locationMessage: Record<LocationStatus, string | null> = {
  idle: null,
  locating: null,
  denied: 'Localisation refusée. Autorisez-la dans les réglages du téléphone pour QuelBus.',
  unavailable: 'Position introuvable. Vérifiez que la localisation (GPS) est activée.',
}
