import { API_URL } from './config'
import type { Combination, LineDetail, Place, StopSummary } from './api'

/** Une étape d'un trajet, telle qu'écrite dans l'adresse de la page /trajet. */
export type TripLegRef = { slug: string; direction: number; board: number; alight: number }

/** Une étape prête à afficher : la ligne, son sens et les arrêts parcourus (montée et descente comprises). */
export type TripLeg = {
  line: LineDetail
  direction: LineDetail['directions'][number]
  stops: StopSummary[]
}

const SEPARATOR = '~'

/** Adresse de la page qui montre toute la combinaison. */
export function tripUrl(combination: Combination, from: Place, to: Place): string {
  const query = new URLSearchParams({
    etapes: combination.legs.map((l) => [l.line.slug, l.direction.id, l.board.id, l.alight.id].join(SEPARATOR)).join(','),
    depart: from.name,
    dlat: from.lat.toFixed(6),
    dlng: from.lng.toFixed(6),
    arrivee: to.name,
    alat: to.lat.toFixed(6),
    alng: to.lng.toFixed(6),
  })
  return `/trajet?${query}`
}

export function readLegs(query: URLSearchParams): TripLegRef[] {
  return (query.get('etapes') ?? '')
    .split(',')
    .map((part) => part.split(SEPARATOR))
    .filter((p) => p.length === 4 && p[0] && p.slice(1).every((n) => /^\d+$/.test(n)))
    .slice(0, 4)
    .map(([slug, direction, board, alight]) => ({ slug, direction: Number(direction), board: Number(board), alight: Number(alight) }))
}

/** Arrêts de la montée à la descente ; sur une boucle, on peut repasser par le terminus. */
function ride(direction: TripLeg['direction'], board: number, alight: number): StopSummary[] | null {
  const stops = direction.stops
  const loop = direction.is_loop && stops.length > 1 && stops[0].id === stops.at(-1)!.id
  const round = loop ? stops.slice(0, -1) : stops
  const from = round.findIndex((s) => s.id === board)
  if (from < 0) return null
  const path = loop ? [...round.slice(from), ...round.slice(0, from), round[from]] : round.slice(from)
  const to = path.findIndex((s, i) => i > 0 && s.id === alight)
  return to > 0 ? path.slice(0, to + 1) : null
}

/** Charge les lignes de chaque étape ; null si une étape ne correspond plus aux données. */
export async function fetchTrip(refs: TripLegRef[], signal?: AbortSignal): Promise<TripLeg[] | null> {
  const lines = await Promise.all(
    refs.map(async (ref) => {
      const response = await fetch(`${API_URL}/api/lines/${encodeURIComponent(ref.slug)}`, { headers: { Accept: 'application/json' }, signal })
      if (response.status === 404) return null
      if (!response.ok) throw new Error('Le chargement du trajet a échoué. Réessayez dans un instant.')
      return (await response.json()).data as LineDetail
    }),
  )

  const legs: TripLeg[] = []
  for (const [i, line] of lines.entries()) {
    const direction = line?.directions.find((d) => d.id === refs[i].direction)
    const stops = direction && ride(direction, refs[i].board, refs[i].alight)
    if (!line || !direction || !stops) return null
    legs.push({ line, direction, stops })
  }
  return legs
}
