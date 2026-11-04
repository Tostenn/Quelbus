import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LineType, Place } from '../lib/api'
import type { TripLeg } from '../lib/trip'

type Props = {
  legs: TripLeg[]
  from?: Place | null
  to?: Place | null
  userLat?: number
  userLng?: number
  /** Suivi en direct : la carte suit l'utilisateur. */
  follow?: boolean
}

// Même code couleur que les badges et la frise : orange pour le bus, bleu pour le gbaka, vert pour le wôrô-wôrô
const RIDE: Record<LineType, string> = { sotra: '#ce5b22', gbaka: '#2f5d7d', 'woro-woro': '#2f7d4a', autre: '#6b6259' }
const WALK = '#6b6259'

const BUS = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="15" rx="2"/><path d="M5 11h14M8 21v-3M16 21v-3"/></svg>'
const SWAP = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>'
const FLAG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21V4M6 4h11l-2 4 2 4H6"/></svg>'

function pin(className: string, html = '', size = 32) {
  return L.divIcon({ className: `map-pin ${className}`, html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

const walkLine = (points: L.LatLngExpression[]) => L.polyline(points, { color: WALK, weight: 4, dashArray: '2 9', lineCap: 'round' })

export default function TripMap({ legs, from, to, userLat, userLng, follow = false }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const userRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (!container.current || !legs.length) return

    const map = L.map(container.current, { scrollWheelZoom: false })
    mapRef.current = map
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    }).addTo(map)

    const focus: [number, number][] = []
    const first = legs[0].stops[0]
    const last = legs.at(-1)!.stops.at(-1)!

    if (from) {
      walkLine([[from.lat, from.lng], [first.lat, first.lng]]).addTo(map)
      focus.push([from.lat, from.lng])
    }
    if (to) {
      walkLine([[last.lat, last.lng], [to.lat, to.lng]]).addTo(map)
      focus.push([to.lat, to.lng])
    }

    legs.forEach((leg, k) => {
      const path = leg.stops.map((s) => [s.lat, s.lng] as [number, number])
      // Liseré blanc sous le trait : les lignes restent lisibles sur le fond de carte
      L.polyline(path, { color: '#fff', weight: 10, opacity: 0.9 }).addTo(map)
      L.polyline(path, { color: RIDE[leg.line.type], weight: 6 }).addTo(map)
      focus.push(...path)

      leg.stops.slice(1, -1).forEach((stop) => {
        L.circleMarker([stop.lat, stop.lng], { radius: 4, color: RIDE[leg.line.type], weight: 2.5, fillColor: '#fff', fillOpacity: 1 })
          .bindTooltip(stop.name)
          .addTo(map)
      })

      const board = leg.stops[0]
      if (k === 0) {
        L.marker([board.lat, board.lng], { icon: pin('map-pin-board', BUS), zIndexOffset: 1000 })
          .bindTooltip(`Montez à ${board.name}`, { direction: 'top', offset: [0, -14] })
          .addTo(map)
      } else {
        const previous = legs[k - 1].stops.at(-1)!
        if (previous.id !== board.id) walkLine([[previous.lat, previous.lng], [board.lat, board.lng]]).addTo(map)
        L.marker([board.lat, board.lng], { icon: pin('map-pin-change', SWAP), zIndexOffset: 1000 })
          .bindTooltip(`Changez à ${board.name}`, { direction: 'top', offset: [0, -14] })
          .addTo(map)
      }
    })

    L.marker([last.lat, last.lng], { icon: pin('map-pin-alight', FLAG), zIndexOffset: 1000 })
      .bindTooltip(`Descendez à ${last.name}`, { direction: 'top', offset: [0, -14] })
      .addTo(map)

    map.fitBounds(L.latLngBounds(focus), { padding: [28, 28], maxZoom: 16 })

    return () => {
      map.remove()
      mapRef.current = null
      userRef.current = null
    }
  }, [legs, from, to])

  // Position de l'utilisateur : déplacée sans reconstruire la carte
  useEffect(() => {
    const map = mapRef.current
    if (!map || userLat === undefined || userLng === undefined) return
    const here: [number, number] = [userLat, userLng]
    if (!userRef.current) {
      userRef.current = L.marker(here, { icon: pin('map-pin-user', '', 20), zIndexOffset: 2000 })
        .bindTooltip('Vous êtes ici', { direction: 'top', offset: [0, -10] })
        .addTo(map)
    }
    userRef.current.setLatLng(here)
    if (follow) map.panTo(here, { animate: true })
  }, [userLat, userLng, follow])

  return <div ref={container} className="line-map" role="img" aria-label="Carte du trajet complet, ligne par ligne" />
}
