import { describe, expect, it } from '@jest/globals'
import type { Arrival } from '../api'
import { clock, inLabel, minutesUntil, sortedUpcoming } from '../arrivals'

const arrival = (id: number, times: string[]): Arrival => ({
  line: { id, ref: String(id), name: `Ligne ${id}`, slug: `l-${id}`, type: 'sotra', city: 'abidjan' },
  direction: { id, name: 'Aller', destination: 'Plateau' },
  stop: { id: 1, name: 'Arrêt', slug: 'arret', walk_m: 50 },
  next: times.map((at) => ({ at, in_minutes: 0, days: 3 })),
})

describe('arrivals', () => {
  const now = Date.parse('2026-11-09T07:00:00Z')

  it('compte les minutes et les annonce', () => {
    expect(minutesUntil('2026-11-09T07:12:00Z', now)).toBe(12)
    expect(inLabel(0)).toBe('d’un instant à l’autre')
    expect(inLabel(12)).toBe('dans 12 min')
    expect(inLabel(65)).toBe('dans 1 h 05')
    expect(inLabel(120)).toBe('dans 2 h')
  })

  it('donne l’heure d’Abidjan', () => {
    expect(clock('2026-11-09T07:05:00Z')).toBe('7 h 05')
  })

  it('garde les passages à venir, le plus proche d’abord', () => {
    const items = sortedUpcoming(
      [
        arrival(1, ['2026-11-09T07:20:00Z']),
        arrival(2, ['2026-11-09T06:30:00Z']), // passé : retiré
        arrival(3, ['2026-11-09T06:59:00Z', '2026-11-09T07:40:00Z']), // 1 min de retard : gardé
      ],
      now,
    )
    expect(items.map((i) => i.arrival.line.id)).toEqual([3, 1])
  })
})
