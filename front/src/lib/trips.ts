import { useEffect, useRef, useState } from 'react'
import { API_URL } from './config'
import type { LineType } from './api'
import { listen, REALTIME } from './realtime'

type LiveStop = { id: number; name: string; slug: string; sequence: number }

/** Un bus en ce moment, d'après les voyageurs qui partagent leur position. */
export type LiveBus = {
  /** Identifiant stable du bus (voyage en tête du groupe) */
  id: string
  direction_id: number
  progress_m: number
  lat: number
  lng: number
  seen_at: string
  seen_seconds_ago: number
  reporters: number
  last_stop: LiveStop | null
  next_stop: LiveStop | null
  /** Présents sur la page « En direct » (toutes lignes) */
  line?: { id: number; ref: string | null; name: string; slug: string; type: LineType; city: string | null }
  direction?: { id: number; name: string; destination: string | null }
}

/** Au-delà, une position n'est plus « en direct » (comme côté API) */
export const FRESH_SECONDS = 180

type Point = { lat: number; lng: number; accuracy: number; t: number }
type TripStatus = 'active' | 'ended' | 'off_route'
type TripReply = { status: TripStatus; accepted: number; line_direction_id: number | null }
type Session = { id: string; token: string; lineId: number }

const SESSION_KEY = 'quelbus:voyage'
/** Envoi groupé : un lot toutes les 15 s, ou plus tôt si le lot grossit */
const FLUSH_MS = 15000
const MAX_BUFFER = 120
/** Sans temps réel, ou en secours si la connexion Pusher tombe */
const POLL_MS = REALTIME ? 60000 : 20000

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
  /** Sens déduit des premiers points (null tant qu'on ne sait pas) */
  directionId: number | null
}

type SharingTarget = {
  lineId: number
  /** Connu quand l'usager vient d'une recherche ; sinon le serveur le déduit des premiers points */
  directionId?: number | null
}

/**
 * Partage anonyme de la position pendant le trajet.
 * Les points sont gardés tant que le réseau ne répond pas, puis envoyés d'un coup.
 * L'écran reste allumé pendant le partage (un site ne peut pas envoyer la position écran éteint).
 */
export function useTripSharing(
  target: SharingTarget,
  enabled: boolean,
  { onStop, onDirection }: { onStop: () => void; onDirection?: (directionId: number) => void },
) {
  const [state, setState] = useState<SharingState>({ phase: 'idle', sent: 0, pending: 0, offline: false, directionId: null })
  const session = useRef<Session | null>(null)
  const buffer = useRef<Point[]>([])
  // Lus au démarrage du partage seulement : un changement de sens détecté ne relance pas le voyage
  const latest = useRef({ target, onStop, onDirection })
  useEffect(() => {
    latest.current = { target, onStop, onDirection }
  })

  useEffect(() => {
    if (!enabled) return
    const geolocation = 'geolocation' in navigator ? navigator.geolocation : null
    const { lineId, directionId } = latest.current.target
    let cancelled = false
    let wakeLock: WakeLockSentinel | null = null
    let flushing = false
    let knownDirection = directionId ?? null

    const stop = () => latest.current.onStop()

    async function flush() {
      const current = session.current
      if (!current || flushing || !buffer.current.length) return
      flushing = true
      const batch = buffer.current.slice(0, MAX_BUFFER)
      try {
        const result = await post<TripReply>(`/trips/${current.id}/positions`, { points: batch }, current.token)
        buffer.current = buffer.current.slice(batch.length)
        if (cancelled) return
        if (result.line_direction_id && result.line_direction_id !== knownDirection) {
          knownDirection = result.line_direction_id
          latest.current.onDirection?.(result.line_direction_id)
        }
        if (result.status !== 'active') {
          writeSession(null)
          setState((s) => ({ ...s, phase: result.status === 'off_route' ? 'off_route' : 'ended', pending: 0 }))
          stop()
          return
        }
        setState((s) => ({
          ...s,
          phase: 'sharing',
          sent: s.sent + result.accepted,
          pending: buffer.current.length,
          offline: false,
          directionId: result.line_direction_id,
        }))
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
        stop()
        return
      }
      setState({ phase: 'starting', sent: 0, pending: 0, offline: false, directionId: directionId ?? null })
      const saved = readSession()
      if (saved && saved.lineId === lineId) {
        session.current = saved
      } else {
        try {
          const body = directionId ? { line_direction_id: directionId, client: 'web' } : { line_id: lineId, client: 'web' }
          const trip = await post<{ id: string; token: string }>('/trips', body)
          session.current = { id: trip.id, token: trip.token, lineId }
          writeSession(session.current)
        } catch {
          if (!cancelled) {
            setState((s) => ({ ...s, phase: 'error' }))
            stop()
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
          stop()
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
        // Derniers points puis fin du voyage
        const points = buffer.current.slice(0, MAX_BUFFER)
        buffer.current = []
        const send = points.length ? post(`/trips/${current.id}/positions`, { points }, current.token) : Promise.resolve()
        send.catch(() => {}).finally(() => post(`/trips/${current.id}/end`, {}, current.token).catch(() => {}))
        session.current = null
        writeSession(null)
      }
    }
  }, [enabled])

  return state
}

/** Horloge qui avance toutes les 10 s : « il y a 30 s » se met à jour, les bus trop anciens disparaissent. */
export function useNow(intervalMs = 10000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

/** Âge d'une position, en secondes, d'après l'heure du téléphone. */
export const ageSeconds = (bus: LiveBus, now: number) => Math.max(0, (now - Date.parse(bus.seen_at)) / 1000)

/**
 * Bus en direct : chargés au départ, puis poussés par Pusher (canal donné) ; à défaut, rafraîchis régulièrement.
 * `merge` reçoit chaque message temps réel et rend la nouvelle liste.
 */
function useLiveFeed<M>(
  url: string | null,
  channel: string | null,
  merge: (current: LiveBus[], message: M) => LiveBus[],
): { buses: LiveBus[]; loaded: boolean } {
  const [state, setState] = useState<{ url: string | null; buses: LiveBus[] }>({ url: null, buses: [] })
  const mergeRef = useRef(merge)
  useEffect(() => {
    mergeRef.current = merge
  })

  useEffect(() => {
    if (!url) return
    let controller: AbortController | null = null
    const load = () => {
      if (document.visibilityState !== 'visible') return
      controller?.abort()
      controller = new AbortController()
      fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((json) => setState({ url, buses: json.data ?? [] }))
        .catch(() => {})
    }
    load()
    const timer = window.setInterval(load, POLL_MS)
    document.addEventListener('visibilitychange', load)
    const unlisten = channel
      ? listen<M>(channel, 'buses', (message) => setState((s) => ({ url, buses: mergeRef.current(s.buses, message) })))
      : () => {}
    return () => {
      controller?.abort()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', load)
      unlisten()
    }
  }, [url, channel])

  return { buses: state.url === url ? state.buses : [], loaded: state.url === url }
}

type LineMessage = { line_id: number; buses: LiveBus[] }

/** Bus en direct d'une ligne. */
export function useLiveBuses(slug: string, lineId: number | undefined, enabled = true): LiveBus[] {
  const url = enabled && slug ? `${API_URL}/api/lines/${encodeURIComponent(slug)}/live` : null
  const { buses } = useLiveFeed<LineMessage>(url, enabled && lineId ? `line.${lineId}` : null, (_, message) => message.buses)
  const now = useNow()
  return buses.filter((bus) => ageSeconds(bus, now) <= FRESH_SECONDS)
}

/** Tous les bus en direct (page « En direct ») : un message Pusher remplace les bus de sa ligne. */
export function useAllLiveBuses(): { buses: LiveBus[]; loaded: boolean } {
  const { buses, loaded } = useLiveFeed<LineMessage>(`${API_URL}/api/live`, 'live', (current, message) => [
    ...current.filter((bus) => bus.line?.id !== message.line_id),
    ...message.buses,
  ])
  const now = useNow()
  return { buses: buses.filter((bus) => ageSeconds(bus, now) <= FRESH_SECONDS), loaded }
}

/** « il y a 30 s », « il y a 2 min » */
export function seenLabel(seconds: number): string {
  return seconds < 60 ? `il y a ${Math.max(5, Math.round(seconds / 5) * 5)} s` : `il y a ${Math.round(seconds / 60)} min`
}
