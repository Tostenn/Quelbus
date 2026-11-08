import type { LineType } from '@/lib/api'

/** Couleurs du site quelbus.ci (front/src/index.css). */
export const colors = {
  bg: '#faf7f2',
  surface: '#ffffff',
  surfaceSoft: '#f6f1e9',
  ink: '#1a1613',
  muted: '#6b6259',
  faint: '#8a8175',
  border: '#e6dfd5',
  borderStrong: '#dcd3c6',
  accent: '#ce5b22',
  accentInk: '#9e4014',
  danger: '#b3261e',
  success: '#2f7d4a',
  board: '#2f7d4a',
  alight: '#ce5b22',
  change: '#2f5d7d',
} as const

export const typeColors: Record<LineType, string> = {
  sotra: colors.ink,
  gbaka: '#2f5d7d',
  'woro-woro': '#2f7d4a',
  autre: colors.muted,
}

/** Couleur du tracé d'une ligne sur la carte. */
export const rideColors: Record<LineType, string> = {
  sotra: colors.accent,
  gbaka: '#2f5d7d',
  'woro-woro': '#2f7d4a',
  autre: colors.muted,
}

export const radius = 14
export const space = 16
