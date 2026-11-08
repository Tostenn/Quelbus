import type { Arrival } from './api'

/** Minutes avant un passage estimé (négatif s'il est passé). */
export const minutesUntil = (at: string, now: number) => Math.round((Date.parse(at) - now) / 60000)

/** « 7 h 21 », à l'heure d'Abidjan (UTC) quel que soit le fuseau du téléphone. */
export function clock(at: string): string {
  const d = new Date(at)
  return `${d.getUTCHours()} h ${String(d.getUTCMinutes()).padStart(2, '0')}`
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

/** Lignes qui passent bientôt, la plus proche dans le temps d'abord. */
export function sortedUpcoming(arrivals: Arrival[], now: number) {
  return arrivals
    .map((arrival) => ({ arrival, next: upcoming(arrival, now) }))
    .filter((item) => item.next.length > 0)
    .sort((a, b) => Date.parse(a.next[0]!.at) - Date.parse(b.next[0]!.at))
}
