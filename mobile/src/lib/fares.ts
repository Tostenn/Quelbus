export type DayType = 'tous' | 'semaine' | 'samedi' | 'dimanche'

/** Plage de service d'un sens : premier et dernier départ au terminus. */
export type Schedule = {
  day_type: DayType
  first_departure: string // « 05:30 »
  last_departure: string
  source: string | null
  source_url: string | null
  observed_on: string | null
}

export type Fare = { fare: number | null; accepts_student_card: boolean | null }

export const DAY_LABELS: Record<DayType, string> = {
  tous: 'Tous les jours',
  semaine: 'Du lundi au vendredi',
  samedi: 'Le samedi',
  dimanche: 'Dimanche et jours fériés',
}

/** « 200 F » */
export const fareLabel = (fare: number) => `${String(Math.round(fare)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} F`

/** « 05:30 » -> « 5 h 30 », « 21:00 » -> « 21 h » */
export function hourLabel(time: string): string {
  const [h, m] = time.split(':')
  return m === '00' ? `${Number(h)} h` : `${Number(h)} h ${m}`
}

/**
 * Jour et heure à Abidjan, quel que soit le fuseau du téléphone.
 * Abidjan est à UTC toute l'année (pas d'heure d'été) : les getters UTC suffisent,
 * sans dépendre du support d'Intl et des fuseaux par le moteur JS.
 */
function abidjanNow(now: Date) {
  const weekday = (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const)[now.getUTCDay()]!
  const time = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
  return { weekday, time }
}

/** L'horaire qui vaut aujourd'hui : celui du type de jour, sinon « tous les jours ». */
export function todaySchedule(schedules: Schedule[] | undefined, now = new Date()): Schedule | null {
  if (!schedules?.length) return null
  const { weekday } = abidjanNow(now)
  const day: DayType = weekday === 'Sat' ? 'samedi' : weekday === 'Sun' ? 'dimanche' : 'semaine'
  return schedules.find((s) => s.day_type === day) ?? schedules.find((s) => s.day_type === 'tous') ?? null
}

export type ServiceState = { state: 'avant' | 'en-service' | 'termine'; schedule: Schedule }

export function serviceState(schedules: Schedule[] | undefined, now = new Date()): ServiceState | null {
  const schedule = todaySchedule(schedules, now)
  if (!schedule) return null
  const { time } = abidjanNow(now)
  const state = time < schedule.first_departure ? 'avant' : time > schedule.last_departure ? 'termine' : 'en-service'
  return { state, schedule }
}

/** Phrase courte pour un résultat : on parle des départs du terminus, pas du passage à l'arrêt. */
export function serviceLabel(service: ServiceState): string {
  const { state, schedule } = service
  if (state === 'avant') return `Premier départ du terminus à ${hourLabel(schedule.first_departure)}`
  if (state === 'termine') return `Plus de départ du terminus après ${hourLabel(schedule.last_departure)}`
  return `Départs du terminus jusqu’à ${hourLabel(schedule.last_departure)}`
}

/** Prix total d'un trajet, si on connaît le prix de chaque ligne. */
export function totalFare(lines: Fare[]): number | null {
  return lines.every((l) => l.fare !== null) ? lines.reduce((sum, l) => sum + (l.fare ?? 0), 0) : null
}
