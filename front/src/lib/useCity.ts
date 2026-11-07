import { useSyncExternalStore } from 'react'
import { CITIES, type City } from './cities'

const KEY = 'quelbus:ville'
const listeners = new Set<() => void>()

function read(): string {
  try {
    const slug = localStorage.getItem(KEY)
    if (slug && CITIES.some((c) => c.slug === slug)) return slug
  } catch {
    // stockage indisponible (navigation privée…) : on reste sur Abidjan
  }
  return CITIES[0].slug
}

/** Change la ville courante, partout dans l'app. */
export function setCity(slug: string) {
  try {
    localStorage.setItem(KEY, slug)
  } catch {
    // tant pis : le choix vaut pour cette page seulement
  }
  current = slug
  listeners.forEach((listener) => listener())
}

let current = read()

/** Ville où l'on cherche, gardée d'une visite à l'autre. */
export function useCity(): City {
  const slug = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
    () => CITIES[0].slug,
  )
  return CITIES.find((c) => c.slug === slug) ?? CITIES[0]
}
