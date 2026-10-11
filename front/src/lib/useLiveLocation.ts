import { useEffect, useState } from 'react'

export type LivePosition = { lat: number; lng: number; accuracy: number }

/** Suit la position GPS tant que `enabled` est vrai. */
export function useLiveLocation(enabled: boolean) {
  const [position, setPosition] = useState<LivePosition | null>(null)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    if (!enabled || !('geolocation' in navigator)) return
    const id = navigator.geolocation.watchPosition(
      ({ coords }) => setPosition({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }),
      (error) => setDenied(error.code === error.PERMISSION_DENIED),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [enabled])

  return { position: enabled ? position : null, denied }
}
