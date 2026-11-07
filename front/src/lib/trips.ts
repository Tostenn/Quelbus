import { useEffect, useRef, useState } from 'react'
import { API_URL } from './config'

/** Un bus de la ligne en ce moment, d'après les voyageurs qui partagent leur position. */
export type LiveBus = {
  direction_id: number
  progress_m: number
  lat: number
  lng: number
  seen_seconds_ago: number
  reporters: number
  last_stop: { id: number; name: string; slug: string; sequence: number } | null
  next_stop: { id: number; name: string; slug: string; sequence: number } | null
}

type Point = { lat: number; lng: number; accuracy: number; t: number }
type TripStatus = 'active' | 'ended' | 'off_route'
type Session = { id: string; token: string; directionId: number }

const SESSION_KEY = 'quelbus:voyage'
/** Envoi groupé : un lot toutes les 15 s, ou plus tôt si le lot grossit */
const FLUSH_MS = 15000
const MAX_BUFFER = 120

async function post<T>(path: string, body: object, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { 'X-Trip-Token': token } : {}) },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.json()).data
}

function readSession(): Session | null {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null')
  } catch {
    return null
  }
}

function writeSession(session: Session | null) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // stockage indisponible : un rechargement de la page démarrera un nouveau voyage
  }
}

export type SharingState = {
  /** idle : pas de partage ; starting : création du voyage ; sharing : envoi en cours */
  phase: 'idle' | 'starting' | 'sharing' | 'ended' | 'off_route' | 'denied' | 'error'
  sent: number
  /** Points pas encore envoyés */
  pending: number
  /** Le dernier envoi a échoué : les points attendent le retour du réseau */
  offline: boolean
}

/**
 * Partage anonyme de la position pendant le trajet, pour un sens de ligne.
 * Les points sont gardés tant que le réseau ne répond pas, puis envoyés d'un coup.
 * L'écran reste allumé pendant le partage (un site ne peut pas envoyer la position écran éteint).
 */
export function useTripSharing(directionId: number, enabled: boolean, onStop: () => void) {
  const [state, setState] = useState<SharingState>({ phase: 'idle', sent: 0, pending: 0, offline: false })
  const session = useRef<Session | null>(null)
  const buffer = useRef<Point[]>([])
  const stopRef = useRef(onStop)
  useEffect(() => {
    stopRef.current = onStop
  })

  useEffect(() => {
    if (!enabled) return
    const geolocation = 'geolocation' in navigator ? navigator.geolocation : null
    let cancelled = false
    let wakeLock: WakeLockSentinel | null = null
    let flushing = false

    async function flush() {
      const current = session.current
      if (!current || flushing || !buffer.current.length) return
      flushing = true
      const batch = buffer.current.slice(0, MAX_BUFFER)
      try {
        const result = await post<{ status: TripStatus; accepted: number }>(`/trips/${current.id}/positions`, { points: batch }, current.token)
        buffer.current = buffer.current.slice(batch.length)
        if (cancelled) return
        if (result.status !== 'active') {
          writeSession(null)
          setState((s) => ({ ...s, phase: result.status === 'off_route' ? 'off_route' : 'ended', pending: 0 }))
          stopRef.current()
          return
        }
        setState((s) => ({ ...s, phase: 'sharing', sent: s.sent + result.accepted, pending: buffer.current.length, offline: false }))
      } catch {
        // Réseau coupé : les points restent dans le tampon pour le prochain essai
        if (!cancelled) setState((s) => ({ ...s, pending: buffer.current.length, offline: true }))
      } finally {
        flushing = false
      }
    }

    async function begin() {
      if (!geolocation) {
        setState((s) => ({ ...s, phase: 'error' }))
        stopRef.current()
        return
      }
      setState({ phase: 'starting', sent: 0, pending: 0, offline: false })
      const saved = readSession()
      if (saved && saved.directionId === directionId) {
        session.current = saved
      } else {
        try {
          const trip = await post<{ id: string; token: string }>('/trips', { line_direction_id: directionId, client: 'web' })
          session.current = { id: trip.id, token: trip.token, directionId }
          writeSession(session.current)
        } catch {
          if (!cancelled) {
            setState((s) => ({ ...s, phase: 'error' }))
            stopRef.current()
          }
          return
        }
      }
      if (cancelled) return
      setState((s) => ({ ...s, phase: 'sharing' }))
      try {
        wakeLock = (await navigator.wakeLock?.request('screen')) ?? null
        // Partage arrêté pendant la demande : on rend la main tout de suite
        if (cancelled) wakeLock?.release().catch(() => {})
      } catch {
        // pas de maintien de l'écran : le partage s'arrêtera si l'écran s'éteint
      }
    }

    begin()
    const watch = geolocation?.watchPosition(
      ({ coords, timestamp }) => {
        buffer.current = [
          ...buffer.current,
          { lat: coords.latitude, lng: coords.longitude, accuracy: Math.round(coords.accuracy), t: Math.round(timestamp) },
        ].slice(-MAX_BUFFER * 3)
        if (buffer.current.length >= 10) flush()
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED && !cancelled) {
          setState((s) => ({ ...s, phase: 'denied' }))
          stopRef.current()
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    )
    const timer = window.setInterval(flush, FLUSH_MS)

    return () => {
      cancelled = true
      if (watch !== undefined) geolocation?.clearWatch(watch)
      window.clearInterval(timer)
      wakeLock?.release().catch(() => {})
      const current = session.current
      if (current) {
        // Derniers points puis fin du voyage, même si la page se ferme
        const points = buffer.current.slice(0, MAX_BUFFER)
        buffer.current = []
        const send = points.length ? post(`/trips/${current.id}/positions`, { points }, current.token) : Promise.resolve()
        send.catch(() => {}).finally(() => post(`/trips/${current.id}/end`, {}, current.token).catch(() => {}))
        session.current = null
        writeSession(null)
      }
    }
  }, [enabled, directionId])

  return state
}

/** Bus en direct d'une ligne, rafraîchis toutes les 20 s tant que la page est visible. */
export function useLiveBuses(slug: string, enabled = true): LiveBus[] {
  const [buses, setBuses] = useState<LiveBus[]>([])

  useEffect(() => {
    if (!enabled || !slug) return
    let controller: AbortController | null = null
    const load = () => {
      if (document.visibilityState !== 'visible') return
      controller?.abort()
      controller = new AbortController()
      fetch(`${API_URL}/api/lines/${encodeURIComponent(slug)}/live`, { headers: { Accept: 'application/json' }, signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((json) => setBuses(json.data ?? []))
        .catch(() => {})
    }
    load()
    const timer = window.setInterval(load, 20000)
    document.addEventListener('visibilitychange', load)
    return () => {
      controller?.abort()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', load)
    }
  }, [slug, enabled])

  return enabled ? buses : []
}

/** « il y a 30 s », « il y a 2 min » */
export function seenLabel(seconds: number): string {
  return seconds < 60 ? `il y a ${Math.max(5, Math.round(seconds / 5) * 5)} s` : `il y a ${Math.round(seconds / 60)} min`
}
