/**
 * Types et appels de l'API publique QuelBus (back/routes/api.php).
 * Les types reprennent ceux du front web (front/src/lib/api.ts) : gardez-les alignés.
 */
import type { Fare, Schedule } from './fares'
import { getJson } from './http'

export type LineType = 'sotra' | 'gbaka' | 'woro-woro' | 'autre'

export type Place = { name: string; lat: number; lng: number }

export type Suggestion = Place & { stops: number }

export type ResultStop = { id: number; name: string; slug: string; lat: number; lng: number; walk: number }

export type SearchResult = {
  line: { id: number; ref: string | null; name: string; slug: string; type: LineType } & Partial<Fare>
  direction: {
    id: number
    name: string
    origin_label: string | null
    destination_label: string | null
    schedules?: Schedule[]
  }
  board: ResultStop
  alight: ResultStop
  stops: number
  walk: number
}

/** Une étape d'une combinaison : `board.walk` est la marche pour rejoindre l'arrêt. */
export type CombinationLeg = Omit<SearchResult, 'walk'> & { lines_here: number }

export type Combination = { legs: CombinationLeg[]; changes: number; walk: number; stops: number; score: number }

export type SearchResponse = {
  radius: number
  requested_radius: number
  expanded: boolean
  walkable: boolean
  distance: number
  results: SearchResult[]
  combinations: Combination[]
  prefer: 'direct' | 'combinations'
}

export type SearchParams = { from: Place; to: Place; radius: number; types: LineType[] }

export type LineSummary = {
  id: number
  ref: string | null
  name: string
  slug: string
  type: LineType
  category: string | null
  directions_count: number
  city: string | null
  fare: number | null
  accepts_student_card: boolean | null
}

export type StopSummary = { id: number; name: string; slug: string; lat: number; lng: number }

export type CityRef = { slug: string; name: string; bounds: [number, number, number, number] }

export type LineDirection = {
  id: number
  name: string
  is_loop: boolean
  /** Seuls les terminus sont connus */
  is_partial: boolean
  schedules: Schedule[]
  has_history?: boolean
  /** Tracé : liste de segments de points [lat, lng] */
  geometry?: [number, number][][]
  stops: StopSummary[]
}

export type LineDetail = Omit<LineSummary, 'directions_count' | 'city'> & {
  operator: string | null
  city: CityRef | null
  fare_type: string | null
  directions: LineDirection[]
}

export type StopDetail = StopSummary & {
  city: CityRef | null
  lines: { line: Pick<LineSummary, 'id' | 'ref' | 'name' | 'slug' | 'type'>; direction: { id: number; name: string } }[]
  nearby: { id: number; name: string; slug: string; walk: number }[]
}

export type NearestStop = { name: string; slug: string; walk: number }

/** Prochains passages estimés d'un sens à l'arrêt le plus proche, d'après les voyages partagés. */
export type Arrival = {
  line: { id: number; ref: string | null; name: string; slug: string; type: LineType; city: string | null }
  direction: { id: number; name: string; destination: string | null }
  stop: { id: number; name: string; slug: string; walk_m: number }
  next: { at: string; in_minutes: number; days: number }[]
}

export async function fetchSuggestions(query: string, city?: string, signal?: AbortSignal): Promise<Suggestion[]> {
  const params = new URLSearchParams({ q: query, ...(city ? { city } : {}) })
  return (await getJson<{ data?: Suggestion[] }>('/suggest', params, signal)).data ?? []
}

export async function fetchNearestStop(lat: number, lng: number, signal?: AbortSignal): Promise<NearestStop | null> {
  const params = new URLSearchParams({ lat: lat.toFixed(6), lng: lng.toFixed(6) })
  return (await getJson<{ data?: NearestStop | null }>('/nearest-stop', params, signal)).data ?? null
}

export function fetchSearch({ from, to, radius, types }: SearchParams, signal?: AbortSignal): Promise<SearchResponse> {
  const params = new URLSearchParams({
    from_lat: String(from.lat),
    from_lng: String(from.lng),
    to_lat: String(to.lat),
    to_lng: String(to.lng),
    radius: String(radius),
    from_name: from.name.slice(0, 120),
    to_name: to.name.slice(0, 120),
  })
  types.forEach((type) => params.append('types[]', type))
  return getJson<SearchResponse>('/search', params, signal)
}

export async function fetchLines(city?: string, signal?: AbortSignal): Promise<LineSummary[]> {
  const params = city ? new URLSearchParams({ city }) : undefined
  return (await getJson<{ data: LineSummary[] }>('/lines', params, signal)).data
}

export async function fetchLine(slug: string, signal?: AbortSignal): Promise<LineDetail> {
  return (await getJson<{ data: LineDetail }>(`/lines/${encodeURIComponent(slug)}`, undefined, signal)).data
}

export async function fetchStop(slug: string, signal?: AbortSignal): Promise<StopDetail> {
  return (await getJson<{ data: StopDetail }>(`/stops/${encodeURIComponent(slug)}`, undefined, signal)).data
}

export async function fetchArrivals(
  position: { lat: number; lng: number },
  directionId?: number,
  signal?: AbortSignal,
): Promise<Arrival[]> {
  const params = new URLSearchParams({
    // Arrondi à ~100 m : une position qui bouge un peu ne relance pas la requête
    lat: position.lat.toFixed(3),
    lng: position.lng.toFixed(3),
    ...(directionId ? { direction: String(directionId) } : {}),
  })
  return (await getJson<{ data?: Arrival[] }>('/arrivals', params, signal)).data ?? []
}
