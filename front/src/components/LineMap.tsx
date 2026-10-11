import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { StopSummary } from '../lib/api'

type Props = {
  stops: StopSummary[]
  geometry: [number, number][][]
  board?: number
  alight?: number
  userLat?: number
  userLng?: number
  /** Suivi en direct : la carte suit l'utilisateur et la marche vers l'arrêt disparaît une fois à bord. */
  follow?: boolean
  onBoard?: boolean
}

const COLORS = { line: '#8a8175', ride: '#ce5b22', user: '#1f6fd1' }

const BUS = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="15" rx="2"/><path d="M5 11h14M8 21v-3M16 21v-3"/></svg>'
const FLAG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21V4M6 4h11l-2 4 2 4H6"/></svg>'

function pin(className: string, html = '', size = 32) {
  return L.divIcon({ className: `map-pin ${className}`, html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

export default function LineMap({ stops, geometry, board = -1, alight = -1, userLat, userLng, follow = false, onBoard = false }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const userRef = useRef<{ marker: L.Marker; walk: L.Polyline } | null>(null)
  // Position au chargement : sert seulement à cadrer la carte
  const [firstUser] = useState<[number, number] | null>(() =>
    userLat !== undefined && userLng !== undefined ? [userLat, userLng] : null,
  )

  useEffect(() => {
    if (!container.current || !stops.length) return

    const map = L.map(container.current, { scrollWheelZoom: false })
    mapRef.current = map
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    }).addTo(map)

    const trip = board >= 0 && alight > board
    const route = geometry.length ? geometry : [stops.map((s) => [s.lat, s.lng] as [number, number])]
    L.polyline(route, { color: COLORS.line, weight: 5, opacity: trip ? 0.5 : 0.9 }).addTo(map)

    stops.forEach((stop, i) => {
      const off = trip && (i < board || i > alight)
      L.circleMarker([stop.lat, stop.lng], {
        radius: 5,
        color: off ? COLORS.line : '#1a1613',
        weight: 2.5,
        fillColor: '#fff',
        fillOpacity: 1,
        opacity: off ? 0.6 : 1,
      })
        .bindTooltip(`${i + 1}. ${stop.name}`)
        .addTo(map)
    })

    const focus: L.LatLngExpression[] = []
    if (board >= 0) {
      const b = stops[board]
      L.marker([b.lat, b.lng], { icon: pin('map-pin-board', BUS), zIndexOffset: 1000 })
        .bindTooltip(`Montez à ${b.name}`, { direction: 'top', offset: [0, -14] })
        .addTo(map)
      focus.push([b.lat, b.lng])
    }
    if (trip) {
      const ride = stops.slice(board, alight + 1).map((s) => [s.lat, s.lng] as [number, number])
      L.polyline(ride, { color: COLORS.ride, weight: 6 }).addTo(map)
      focus.push(...ride)
      const a = stops[alight]
      L.marker([a.lat, a.lng], { icon: pin('map-pin-alight', FLAG), zIndexOffset: 1000 })
        .bindTooltip(`Descendez à ${a.name}`, { direction: 'top', offset: [0, -14] })
        .addTo(map)
    }
    if (firstUser) focus.push(firstUser)

    map.fitBounds(L.latLngBounds(focus.length > 1 ? focus : route.flat()), { padding: [28, 28], maxZoom: 17 })

    return () => {
      map.remove()
      mapRef.current = null
      userRef.current = null
    }
  }, [stops, geometry, board, alight, firstUser])

  // Position de l'utilisateur : déplacée sans reconstruire la carte
  useEffect(() => {
    const map = mapRef.current
    if (!map || userLat === undefined || userLng === undefined) return

    const here: [number, number] = [userLat, userLng]
    if (!userRef.current) {
      const marker = L.marker(here, { icon: pin('map-pin-user', '', 20), zIndexOffset: 2000 })
        .bindTooltip('Vous êtes ici', { direction: 'top', offset: [0, -10] })
        .addTo(map)
      const walk = L.polyline([], { color: COLORS.user, weight: 4, dashArray: '2 8', lineCap: 'round' }).addTo(map)
      userRef.current = { marker, walk }
    }
    userRef.current.marker.setLatLng(here)
    userRef.current.walk.setLatLngs(board >= 0 && !onBoard ? [here, [stops[board].lat, stops[board].lng]] : [])
    if (follow) map.panTo(here, { animate: true })
  }, [userLat, userLng, board, stops, follow, onBoard])

  return <div ref={container} className="line-map" role="img" aria-label="Carte de la ligne et de ses arrêts" />
}
