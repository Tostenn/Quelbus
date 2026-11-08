import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native'
import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import type { StopSummary } from '@/lib/api'
import { MAP_STYLE_URL } from '@/lib/config'
import { boundsOf } from '@/lib/geo'
import { colors } from './theme'

type Props = {
  /** Tracé : segments de points [lat, lng], comme renvoyés par l'API */
  geometry?: [number, number][][]
  stops: StopSummary[]
  color: string
  boardId?: number
  alightId?: number
  user?: { lat: number; lng: number } | null
  height?: number
}

/**
 * Carte d'un sens de ligne : tracé, arrêts, montée et descente mises en avant.
 * Entre la montée et la descente, le tracé est plein ; ailleurs il est pâli.
 */
export default function LineMap({ geometry, stops, color, boardId, alightId, user, height = 300 }: Props) {
  const { route, stopPoints, highlights, bounds } = useMemo(() => {
    // Sans tracé relevé, on relie les arrêts dans l'ordre
    const segments = geometry?.length ? geometry : [stops.map((s) => [s.lat, s.lng] as [number, number])]
    const lines = segments.filter((seg) => seg.length > 1).map((seg) => seg.map(([lat, lng]) => [lng, lat]))

    const boardIndex = stops.findIndex((s) => s.id === boardId)
    const alightIndex = stops.findIndex((s) => s.id === alightId)
    const ride = boardIndex >= 0 && alightIndex > boardIndex ? stops.slice(boardIndex, alightIndex + 1) : []

    const focus = ride.length ? ride : stops
    const focusPoints: [number, number][] = focus.map((s) => [s.lng, s.lat])
    if (user && ride.length) focusPoints.push([user.lng, user.lat])

    return {
      route: {
        type: 'FeatureCollection' as const,
        features: [
          ...lines.map((coordinates) => ({
            type: 'Feature' as const,
            properties: { kind: 'route' },
            geometry: { type: 'LineString' as const, coordinates },
          })),
          ...(ride.length > 1
            ? [
                {
                  type: 'Feature' as const,
                  properties: { kind: 'ride' },
                  geometry: { type: 'LineString' as const, coordinates: ride.map((s) => [s.lng, s.lat]) },
                },
              ]
            : []),
        ],
      },
      stopPoints: {
        type: 'FeatureCollection' as const,
        features: stops.map((s) => ({
          type: 'Feature' as const,
          properties: { name: s.name },
          geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
        })),
      },
      highlights: {
        type: 'FeatureCollection' as const,
        features: [
          ...stops
            .filter((s) => s.id === boardId || s.id === alightId)
            .map((s) => ({
              type: 'Feature' as const,
              properties: { kind: s.id === boardId ? 'board' : 'alight', name: s.name },
              geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
            })),
          ...(user
            ? [
                {
                  type: 'Feature' as const,
                  properties: { kind: 'user', name: 'Vous' },
                  geometry: { type: 'Point' as const, coordinates: [user.lng, user.lat] },
                },
              ]
            : []),
        ],
      },
      bounds: boundsOf(focusPoints),
    }
  }, [geometry, stops, boardId, alightId, user])

  return (
    <View style={[styles.wrap, { height }]}>
      <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE_URL} touchPitch={false} touchRotate={false} compass={false}>
        {bounds && <Camera initialViewState={{ bounds, padding: { top: 40, right: 40, bottom: 40, left: 40 } }} />}

        <GeoJSONSource id="route" data={route}>
          <Layer
            id="route-line"
            type="line"
            filter={['==', ['get', 'kind'], 'route']}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': color, 'line-width': 4, 'line-opacity': boardId ? 0.35 : 0.9 }}
          />
          <Layer
            id="ride-line"
            type="line"
            filter={['==', ['get', 'kind'], 'ride']}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': color, 'line-width': 6 }}
          />
        </GeoJSONSource>

        <GeoJSONSource id="stops" data={stopPoints}>
          <Layer
            id="stop-dots"
            type="circle"
            paint={{
              'circle-radius': 4,
              'circle-color': '#ffffff',
              'circle-stroke-color': color,
              'circle-stroke-width': 2,
            }}
          />
        </GeoJSONSource>

        <GeoJSONSource id="highlights" data={highlights}>
          <Layer
            id="highlight-dots"
            type="circle"
            paint={{
              'circle-radius': ['match', ['get', 'kind'], 'user', 7, 9],
              'circle-color': [
                'match',
                ['get', 'kind'],
                'board',
                colors.board,
                'alight',
                colors.alight,
                '#2f6fd6',
              ],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 3,
            }}
          />
          <Layer
            id="highlight-labels"
            type="symbol"
            filter={['!=', ['get', 'kind'], 'user']}
            layout={{
              'text-field': ['get', 'name'],
              'text-size': 13,
              'text-offset': [0, 1.4],
              'text-anchor': 'top',
              'text-font': ['Noto Sans Bold'],
            }}
            paint={{ 'text-color': colors.ink, 'text-halo-color': '#ffffff', 'text-halo-width': 2 }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft },
})
