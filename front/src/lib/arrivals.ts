import { useCallback, useEffect, useState } from 'react'
import { API_URL } from './config'
import type { LineType } from './api'

/** Prochains passages estimés d'un sens à l'arrêt le plus proche, d'après les voyages partagés. */
export type Arrival = {
  line: { id: number; ref: string | null; name: string; slug: string; type: LineType; city: string | null }
  direction: { id: number; name: string; destination: string | null }
  stop: { id: number; name: string; slug: string; walk_m: number }
  /** Passages habituels à venir ; days = nombre de jours où on l'a relevé */
  next: { at: string; in_minutes: number; days: number }[]
}

type Position = { lat: number; lng: number }

/**
 * Position du téléphone, sans rien demander si elle n'est pas déjà autorisée :
 * `request()` la demande (bouton), et elle arrive seule si l'autorisation est déjà donnée.
 */
export function usePosition() {
  const [position, setPosition] = useState<Position | null>(null)
  const [state, setState] = useState<'idle' | 'locating' | 'denied'>('idle')

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState('denied')
      return
    }
    setState('locating')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition({ lat: coords.latitude, lng: coords.longitude })
        setState('idle')
      },
      (error) => setState(error.code === error.PERMISSION_DENIED ? 'denied' : 'idle'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }, [])

  useEffect(() => {
    let cancelled = false
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((p) => !cancelled && p.state === 'granted' && request())
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [request])

  return { position, state, request }
}

/** Prochains passages estimés près d'une position (rafraîchis chaque minute). Rien sans position. */
export function useArrivals(position: Position | null, directionId?: number | null) {
  // Arrondi à ~100 m : la position qui bouge un peu ne relance pas la requête
  const key = position
    ? new URLSearchParams({
        lat: position.lat.toFixed(3),
        lng: position.lng.toFixed(3),
        ...(directionId ? { direction: String(directionId) } : {}),
      }).toString()
    : null
  const [state, setState] = useState<{ key: string | null; arrivals: Arrival[] }>({ key: null, arrivals: [] })

  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    const load = () =>
      fetch(`${API_URL}/api/arrivals?${key}`, { headers: { Accept: 'application/json' }, signal: controller.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((body) => setState({ key, arrivals: body.data ?? [] }))
        .catch(() => {})
    load()
    const timer = window.setInterval(load, 60000)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [key])

  return { arrivals: state.key === key ? state.arrivals : [], loaded: key !== null && state.key === key }
}

/** Minutes avant un passage estimé (négatif s'il est passé). */
export const minutesUntil = (at: string, now: number) => Math.round((Date.parse(at) - now) / 60000)

/** « 7 h 21 » */
export const clock = (at: string) => {
  const d = new Date(at)
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`
}

/** « dans 12 min », « d'un instant à l'autre » */
export function inLabel(minutes: number): string {
  if (minutes <= 1) return 'd’un instant à l’autre'
  if (minutes < 60) return `dans ${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `dans ${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}`
}

/** Passages encore à venir (on garde 2 min de retard possible). */
export const upcoming = (arrival: Arrival, now: number) => arrival.next.filter((n) => minutesUntil(n.at, now) >= -2)

export const basisLabel = (days: number) => (days > 1 ? `relevé ${days} jours` : 'relevé une fois')
