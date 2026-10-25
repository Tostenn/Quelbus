import type { Place } from './api'

// Mémoire de session : la destination cherchée et les lieux déjà partagés.
// Sert à la page ligne pour reproposer le partage s'il n'a pas été fait avant.
const LAST_KEY = 'quelbus-destination'
const SHARED_KEY = 'quelbus-partage'
const placeKey = (p: Place) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`

export function rememberDestination(place: Place) {
  try {
    sessionStorage.setItem(LAST_KEY, JSON.stringify(place))
  } catch {
    // stockage indisponible : le partage reste proposé, sans plus
  }
}

export function lastDestination(): Place | null {
  try {
    const place = JSON.parse(sessionStorage.getItem(LAST_KEY) ?? 'null') as Place | null
    return place && typeof place.lat === 'number' && typeof place.lng === 'number' && place.name ? place : null
  } catch {
    return null
  }
}

export function wasShared(place: Place): boolean {
  try {
    return (sessionStorage.getItem(SHARED_KEY) ?? '').split('|').includes(placeKey(place))
  } catch {
    return false
  }
}

export function markShared(place: Place) {
  try {
    const list = (sessionStorage.getItem(SHARED_KEY) ?? '').split('|').filter(Boolean)
    if (!list.includes(placeKey(place))) sessionStorage.setItem(SHARED_KEY, [...list, placeKey(place)].join('|'))
  } catch {
    // rien à faire
  }
}
