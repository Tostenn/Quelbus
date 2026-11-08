import type { LineType } from './api'

// Pictos des véhicules pour les repères de carte (HTML brut pour Leaflet), dessinés sur une grille de 24.
const svg = (body: string, size: number) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

/** Bus SOTRA : caisse haute, pare-brise, deux roues */
const BUS = '<rect x="4.5" y="3" width="15" height="15" rx="2.5"/><path d="M4.5 10.5h15M8 21v-3M16 21v-3M8 14.5h.01M16 14.5h.01"/>'
/** Gbaka : minibus, avant incliné */
const VAN = '<path d="M2.5 16.5V8a2 2 0 0 1 2-2h10.2l4.8 5v5.5a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1z"/><path d="M2.5 11h17M10 6v5"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="16" cy="17.5" r="1.8"/>'
/** Wôrô-wôrô : taxi */
const CAR = '<path d="M3.5 16v-3.2L6.2 7h11.6l2.7 5.8V16a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/><path d="M3.5 12.5h17M10 4h4"/><circle cx="7.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/>'

const BODIES: Record<LineType, string> = { sotra: BUS, gbaka: VAN, 'woro-woro': CAR, autre: BUS }

export const VEHICLE_NAMES: Record<LineType, string> = { sotra: 'Bus', gbaka: 'Gbaka', 'woro-woro': 'Wôrô-wôrô', autre: 'Bus' }

export function vehicleSvg(type: LineType | undefined, size = 16): string {
  return svg(BODIES[type ?? 'sotra'] ?? BUS, size)
}
