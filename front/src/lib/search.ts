import type { LineType, Place, SearchParams } from './api'

export const RADII = [300, 500, 800] as const

export const TYPE_FILTERS: { value: LineType | 'tous'; label: string }[] = [
  { value: 'tous', label: 'Tous' },
  { value: 'sotra', label: 'SOTRA' },
  { value: 'gbaka', label: 'Gbaka' },
  { value: 'woro-woro', label: 'Wôrô-wôrô' },
]

export const TYPE_LABELS: Record<LineType, string> = {
  sotra: 'Bus SOTRA',
  gbaka: 'Gbaka',
  'woro-woro': 'Wôrô-wôrô',
  autre: 'Autre',
}

// Grand Abidjan
const ABIDJAN = { minLat: 5.15, maxLat: 5.6, minLng: -4.3, maxLng: -3.7 }

export function isInAbidjan({ lat, lng }: Place): boolean {
  return lat >= ABIDJAN.minLat && lat <= ABIDJAN.maxLat && lng >= ABIDJAN.minLng && lng <= ABIDJAN.maxLng
}

// 80 m par minute environ
export function walkLabel(meters: number): string {
  return meters < 40 ? `${meters} m à pied` : `${meters} m à pied · ${Math.round(meters / 80) || 1} min`
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

export function searchToQuery({ from, to, radius, types }: SearchParams): string {
  const query = new URLSearchParams({
    depart: from.name,
    dlat: from.lat.toFixed(6),
    dlng: from.lng.toFixed(6),
    arrivee: to.name,
    alat: to.lat.toFixed(6),
    alng: to.lng.toFixed(6),
  })
  if (radius !== RADII[0]) query.set('rayon', String(radius))
  if (types.length) query.set('types', types.join(','))
  return query.toString()
}

function readPlace(query: URLSearchParams, name: string, lat: string, lng: string): Place | null {
  const place = { name: query.get(name) ?? '', lat: Number(query.get(lat)), lng: Number(query.get(lng)) }
  const valid = place.name && query.get(lat) && query.get(lng) && Number.isFinite(place.lat) && Number.isFinite(place.lng)
  return valid ? place : null
}

export function queryToSearch(query: URLSearchParams): SearchParams | null {
  const from = readPlace(query, 'depart', 'dlat', 'dlng')
  const to = readPlace(query, 'arrivee', 'alat', 'alng')
  if (!from || !to) return null

  const radius = Number(query.get('rayon'))
  const types = (query.get('types') ?? '')
    .split(',')
    .filter((t): t is LineType => t === 'sotra' || t === 'gbaka' || t === 'woro-woro')

  return { from, to, radius: (RADII as readonly number[]).includes(radius) ? radius : RADII[0], types }
}

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function lineTitle(line: { ref: string | null; type: LineType; name: string }): string {
  return line.ref ? `Ligne ${line.ref}` : `${TYPE_LABELS[line.type]} ${line.name}`
}
