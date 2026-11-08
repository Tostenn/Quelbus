import type { LineType } from './api'

export const RADII = [300, 500, 800] as const

export const TYPE_FILTERS: { value: LineType; label: string }[] = [
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

/** Nom donné à la position GPS de l'usager. */
export const MY_POSITION = 'Ma position'

// 80 m par minute environ
export function walkLabel(meters: number): string {
  return meters < 40 ? `${meters} m à pied` : `${meters} m à pied · ${Math.round(meters / 80) || 1} min`
}

/** En dessous, deux arrêts se confondent sur place : on parle du « même arrêt ». */
export const SAME_STOP_M = 40

const normalizeName = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Un même arrêt existe souvent deux fois, une de chaque côté de la route. */
export function sameName(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b)
}

/** Comment on nomme une ligne à l'oral : « le 90 », « le gbaka ». */
export function lineShort(line: { ref: string | null; type: LineType }): string {
  return line.ref ?? (line.type === 'gbaka' ? 'gbaka' : line.type === 'woro-woro' ? 'wôrô-wôrô' : 'bus')
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function lineTitle(line: { ref: string | null; type: LineType; name: string }): string {
  return line.ref ? `Ligne ${line.ref}` : `${TYPE_LABELS[line.type]} ${line.name}`
}

export const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`
