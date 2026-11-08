import { describe, expect, it } from '@jest/globals'
import { fareLabel, hourLabel, serviceLabel, serviceState, todaySchedule, totalFare, type Schedule } from '../fares'

const schedule = (day_type: Schedule['day_type'], first: string, last: string): Schedule => ({
  day_type,
  first_departure: first,
  last_departure: last,
  source: null,
  source_url: null,
  observed_on: null,
})

describe('fares', () => {
  it('formate les prix en francs CFA', () => {
    expect(fareLabel(200)).toBe('200 F')
    expect(fareLabel(1500)).toBe('1 500 F')
  })

  it('formate les heures', () => {
    expect(hourLabel('05:30')).toBe('5 h 30')
    expect(hourLabel('21:00')).toBe('21 h')
  })

  it('choisit l’horaire du jour, à l’heure d’Abidjan (UTC)', () => {
    const schedules = [schedule('semaine', '05:00', '22:00'), schedule('dimanche', '06:00', '20:00')]
    // Dimanche 8 novembre 2026, 23 h 30 UTC : encore dimanche à Abidjan
    expect(todaySchedule(schedules, new Date('2026-11-08T23:30:00Z'))?.day_type).toBe('dimanche')
    // Lundi
    expect(todaySchedule(schedules, new Date('2026-11-09T08:00:00Z'))?.day_type).toBe('semaine')
    // Samedi sans horaire propre ni « tous les jours »
    expect(todaySchedule(schedules, new Date('2026-11-07T08:00:00Z'))).toBeNull()
  })

  it('dit si la ligne est en service', () => {
    const schedules = [schedule('tous', '05:30', '21:00')]
    expect(serviceState(schedules, new Date('2026-11-09T04:00:00Z'))?.state).toBe('avant')
    expect(serviceState(schedules, new Date('2026-11-09T12:00:00Z'))?.state).toBe('en-service')
    const late = serviceState(schedules, new Date('2026-11-09T22:00:00Z'))!
    expect(late.state).toBe('termine')
    expect(serviceLabel(late)).toBe('Plus de départ du terminus après 21 h')
    expect(serviceState(undefined)).toBeNull()
  })

  it('n’additionne les prix que s’ils sont tous connus', () => {
    expect(totalFare([{ fare: 200, accepts_student_card: null }, { fare: 300, accepts_student_card: null }])).toBe(500)
    expect(totalFare([{ fare: 200, accepts_student_card: null }, { fare: null, accepts_student_card: null }])).toBeNull()
  })
})
