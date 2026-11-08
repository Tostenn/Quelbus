import { describe, expect, it } from '@jest/globals'
import { boundsOf, distance } from '../geo'
import { formatDistance, lineShort, lineTitle, sameName, walkLabel } from '../search'

describe('search helpers', () => {
  it('annonce la marche', () => {
    expect(walkLabel(20)).toBe('20 m à pied')
    expect(walkLabel(240)).toBe('240 m à pied · 3 min')
  })

  it('formate les distances', () => {
    expect(formatDistance(850)).toBe('850 m')
    expect(formatDistance(2340)).toBe('2,3 km')
  })

  it('reconnaît un même arrêt malgré accents et casse', () => {
    expect(sameName('Mosquée d’Adjamé', 'mosquee d adjame')).toBe(true)
    expect(sameName('Plateau', 'Treichville')).toBe(false)
  })

  it('nomme les lignes', () => {
    expect(lineShort({ ref: '90', type: 'sotra' })).toBe('90')
    expect(lineShort({ ref: null, type: 'gbaka' })).toBe('gbaka')
    expect(lineTitle({ ref: null, type: 'woro-woro', name: 'Cocody' })).toBe('Wôrô-wôrô Cocody')
  })

  it('calcule distances et emprises', () => {
    expect(Math.round(distance(5.3, -4.0, 5.3, -4.0))).toBe(0)
    expect(distance(5.3, -4.0, 5.31, -4.0)).toBeGreaterThan(1100)
    expect(boundsOf([])).toBeNull()
    expect(boundsOf([[-4.0, 5.3], [-3.9, 5.4]])).toEqual([-4.0, 5.3, -3.9, 5.4])
  })
})
