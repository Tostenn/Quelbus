import type { Place } from './api'

export type City = { slug: string; name: string; bounds: [number, number, number, number] }

/**
 * Villes desservies, avec leur emprise (sud, ouest, nord, est).
 * Copie de la table `cities` de l'API (voir scraper/interior.py) : gardée ici pour savoir tout de suite,
 * sans appel réseau, si une position est dans une ville couverte.
 */
export const CITIES: City[] = [
  { slug: 'abidjan', name: 'Abidjan', bounds: [5.15, -4.3, 5.6, -3.7] },
  { slug: 'bouake', name: 'Bouaké', bounds: [7.6, -5.12, 7.78, -4.95] },
  { slug: 'korhogo', name: 'Korhogo', bounds: [9.38, -5.7, 9.53, -5.55] },
  { slug: 'san-pedro', name: 'San-Pédro', bounds: [4.7, -6.7, 4.82, -6.58] },
  { slug: 'yamoussoukro', name: 'Yamoussoukro', bounds: [6.75, -5.35, 6.88, -5.2] },
]

export function cityAt({ lat, lng }: Pick<Place, 'lat' | 'lng'>): City | null {
  return CITIES.find(({ bounds: [s, w, n, e] }) => lat >= s && lat <= n && lng >= w && lng <= e) ?? null
}

export function cityName(slug: string | null | undefined): string {
  return CITIES.find((c) => c.slug === slug)?.name ?? 'Abidjan'
}

/** « à Abidjan », « à Bouaké ». */
export const inCity = (slug: string | null | undefined) => `à ${cityName(slug)}`
