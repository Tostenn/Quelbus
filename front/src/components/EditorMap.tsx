import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Plus } from '@phosphor-icons/react'

export type EditorStop = { key: string; id?: number; name: string; lat: number; lng: number }

type Props = {
  stops: EditorStop[]
  selected: number
  /** Emprise de la ville (sud, ouest, nord, est), pour cadrer une ligne sans arrêts */
  bounds: [number, number, number, number]
  onAdd: (lat: number, lng: number) => void
  onMove: (index: number, lat: number, lng: number) => void
  onSelect: (index: number) => void
}

const COLORS = { line: '#8a8175', stop: '#1a1613', selected: '#ce5b22' }

function numberIcon(n: number, selected: boolean) {
  return L.divIcon({
    className: `editor-pin${selected ? ' is-selected' : ''}`,
    html: String(n),
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

/** Carte d'édition : un clic ajoute un arrêt, on déplace un arrêt en le faisant glisser. */
export default function EditorMap({ stops, selected, bounds, onAdd, onMove, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  // Les gestionnaires Leaflet gardent la dernière version des callbacks
  const handlers = useRef({ onAdd, onMove, onSelect })
  useEffect(() => {
    handlers.current = { onAdd, onMove, onSelect }
  })

  // Carte créée une fois, cadrée sur les arrêts connus ou sur la ville
  const initial = useRef({ stops, bounds })
  useEffect(() => {
    if (!container.current) return
    const map = L.map(container.current)
    mapRef.current = map
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)

    const { stops: first, bounds: [s, w, n, e] } = initial.current
    if (first.length > 1) map.fitBounds(L.latLngBounds(first.map((p) => [p.lat, p.lng])), { padding: [36, 36] })
    else if (first.length === 1) map.setView([first[0].lat, first[0].lng], 15)
    else map.fitBounds([[s, w], [n, e]])

    map.on('click', (event: L.LeafletMouseEvent) => handlers.current.onAdd(event.latlng.lat, event.latlng.lng))

    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    layer.clearLayers()
    if (stops.length > 1) {
      L.polyline(stops.map((p) => [p.lat, p.lng] as [number, number]), { color: COLORS.line, weight: 4, dashArray: '6 6' }).addTo(layer)
    }
    stops.forEach((stop, i) => {
      L.marker([stop.lat, stop.lng], { icon: numberIcon(i + 1, i === selected), draggable: true, zIndexOffset: i === selected ? 1000 : 0 })
        .bindTooltip(stop.name || 'Arrêt sans nom', { direction: 'top', offset: [0, -12] })
        .on('click', () => handlers.current.onSelect(i))
        .on('dragend', (event) => {
          const { lat, lng } = (event.target as L.Marker).getLatLng()
          handlers.current.onMove(i, lat, lng)
        })
        .addTo(layer)
    })
  }, [stops, selected])

  return (
    <div className="editor-map-wrap">
      <div ref={container} className="editor-map" />
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => {
          const center = mapRef.current?.getCenter()
          if (center) onAdd(center.lat, center.lng)
        }}
      >
        <Plus aria-hidden="true" />
        Ajouter un arrêt au centre de la carte
      </button>
    </div>
  )
}
