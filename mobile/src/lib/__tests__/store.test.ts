import { describe, expect, it, jest } from '@jest/globals'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { choosePlace, getState, hydrate, swapPlaces } from '../store'

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock hoisté : pas d'import possible ici
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

describe('store', () => {
  it('ignore une sauvegarde abîmée', async () => {
    await AsyncStorage.setItem('quelbus:state:v1', '{pas du json')
    await expect(hydrate()).resolves.toBeUndefined()
    expect(getState().city).toBe('abidjan')
  })

  it('filtre les valeurs inconnues', async () => {
    await AsyncStorage.setItem(
      'quelbus:state:v1',
      JSON.stringify({ city: 'paris', types: ['gbaka', 'avion'], recents: [{ name: 'Plateau', lat: 5.32, lng: -4.02 }, { name: 'x' }] }),
    )
    await hydrate()
    expect(getState().city).toBe('abidjan')
    expect(getState().types).toEqual(['gbaka'])
    expect(getState().recents).toEqual([{ name: 'Plateau', lat: 5.32, lng: -4.02 }])
  })

  it('garde les lieux récents sans doublon, et inverse départ et arrivée', () => {
    const a = { name: 'Adjamé', lat: 5.35, lng: -4.02 }
    const b = { name: 'Plateau', lat: 5.32, lng: -4.02 }
    choosePlace('from', a)
    choosePlace('to', b)
    choosePlace('from', a)
    expect(getState().recents.filter((p) => p.name === 'Adjamé')).toHaveLength(1)
    swapPlaces()
    expect(getState().from).toEqual(b)
    expect(getState().to).toEqual(a)
  })
})
