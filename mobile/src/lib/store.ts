import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'
import type { LineType, Place } from './api'
import { CITIES, type City } from './cities'
import { RADII } from './search'

/** État du trajet en cours de saisie, et préférences gardées d'une ouverture à l'autre. */
export type AppState = {
  from: Place | null
  to: Place | null
  types: LineType[]
  radius: number
  city: string
  /** Derniers lieux choisis, le plus récent d'abord */
  recents: Place[]
}

const STORAGE_KEY = 'quelbus:state:v1'
const MAX_RECENTS = 8

let state: AppState = { from: null, to: null, types: [], radius: RADII[0], city: CITIES[0]!.slug, recents: [] }
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
  // On ne garde que les préférences : le trajet en cours repart de zéro à chaque ouverture
  const { city, recents, types } = state
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ city, recents, types })).catch(() => {})
}

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
  emit()
}

export function getState(): AppState {
  return state
}

const isPlace = (p: unknown): p is Place =>
  typeof p === 'object' &&
  p !== null &&
  typeof (p as Place).name === 'string' &&
  Number.isFinite((p as Place).lat) &&
  Number.isFinite((p as Place).lng)

/** Recharge les préférences enregistrées. Une donnée abîmée est ignorée, sans planter. */
export async function hydrate(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as Partial<AppState>
    state = {
      ...state,
      city: CITIES.some((c) => c.slug === saved.city) ? saved.city! : state.city,
      recents: Array.isArray(saved.recents) ? saved.recents.filter(isPlace).slice(0, MAX_RECENTS) : [],
      types: Array.isArray(saved.types)
        ? saved.types.filter((t): t is LineType => t === 'sotra' || t === 'gbaka' || t === 'woro-woro')
        : [],
    }
    listeners.forEach((listener) => listener())
  } catch {
    // stockage illisible : on garde les valeurs par défaut
  }
}

export function useAppState<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => select(state),
  )
}

export function useCity(): City {
  const slug = useAppState((s) => s.city)
  return CITIES.find((c) => c.slug === slug) ?? CITIES[0]!
}

/** Choisit le départ ou l'arrivée, et le garde dans les lieux récents (sauf « Ma position »). */
export function choosePlace(field: 'from' | 'to', place: Place, keepRecent = true) {
  setState((s) => ({
    [field]: place,
    recents: keepRecent
      ? [place, ...s.recents.filter((p) => p.name !== place.name)].slice(0, MAX_RECENTS)
      : s.recents,
  }))
}

export function swapPlaces() {
  setState((s) => ({ from: s.to, to: s.from }))
}
