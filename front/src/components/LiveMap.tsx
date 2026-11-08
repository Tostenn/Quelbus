import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Crosshair, Minus, Plus } from '@phosphor-icons/react'
import type { LiveBus } from '../lib/trips'
import { vehicleSvg } from '../lib/vehicles'

/** Ce que la carte doit montrer : une emprise (ville, tous les bus) ou un point (bus choisi, l'usager). */
export type MapFocus =
  | { bounds: [[number, number], [number, number]]; key: string }
  | { point: [number, number]; zoom: number; key: string }

type Props = {
  buses: LiveBus[]
  selected: string | null
  focus: MapFocus
  user: [number, number] | null
  onSelect: (id: string | null) => void
  onLocate: () => void
  /** Hauteur cachée par le panneau du bas : la carte se cadre au-dessus */
  bottomInset: number
}

/**
 * Repère d'un bus : picto du véhicule et numéro de ligne, dans une pastille centrée sur sa position.
 * La boîte Leaflet a exactement la taille de la pastille ; l'agrandissement du bus choisi se fait à l'intérieur,
 * sans toucher au positionnement de Leaflet.
 */
function busIcon(bus: LiveBus, selected: boolean) {
  const type = bus.line?.type ?? 'sotra'
  const ref = (bus.line?.ref ?? '').replace(/[<>&"]/g, '')
  const height = 34
  const width = ref ? 38 + ref.length * 9 : height
  return L.divIcon({
    className: 'live-marker',
    html: `<span class="live-chip live-chip-${type}${selected ? ' is-selected' : ''}${ref ? '' : ' is-round'}">${vehicleSvg(type, 18)}${ref ? `<b>${ref}</b>` : ''}<i></i></span>`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2],
  })
}

/** Carte plein écran des bus en direct : un repère par bus, numéro de ligne dessus. */
export default function LiveMap({ buses, selected, focus, user, onSelect, onLocate, bottomInset }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markers = useRef(new Map<string, L.Marker>())
  const userMarker = useRef<L.Marker | null>(null)
  const select = useRef(onSelect)
  useEffect(() => {
    select.current = onSelect
  })

  useEffect(() => {
    if (!container.current) return
    const map = L.map(container.current, { zoomControl: false, attributionControl: true })
    mapRef.current = map
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    map.setView([5.345, -4.024], 12)
    map.on('click', () => select.current(null))
    const registry = markers.current
    return () => {
      map.remove()
      mapRef.current = null
      registry.clear()
      userMarker.current = null
    }
  }, [])

  // Recadrage demandé (ville, bus choisi, position) : seulement quand la demande change
  const inset = useRef(bottomInset)
  useEffect(() => {
    inset.current = bottomInset
  }, [bottomInset])
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const padding = { paddingTopLeft: [24, 24] as L.PointTuple, paddingBottomRight: [24, inset.current + 24] as L.PointTuple }
    if ('bounds' in focus) {
      map.flyToBounds(focus.bounds, { ...padding, maxZoom: 15, duration: 0.6 })
    } else {
      // Le point visé reste visible au-dessus du panneau
      const target = map.project(focus.point, focus.zoom).add([0, inset.current / 2])
      map.flyTo(map.unproject(target, focus.zoom), focus.zoom, { duration: 0.6 })
    }
  }, [focus])

  // Bus : déplacés en place (pas de clignotement), ajoutés ou retirés au fil des messages
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const seen = new Set<string>()
    for (const bus of buses) {
      seen.add(bus.id)
      const existing = markers.current.get(bus.id)
      const isSelected = bus.id === selected
      if (existing) {
        existing.setLatLng([bus.lat, bus.lng])
        existing.setIcon(busIcon(bus, isSelected))
        existing.setZIndexOffset(isSelected ? 1000 : 0)
      } else {
        const marker = L.marker([bus.lat, bus.lng], { icon: busIcon(bus, isSelected), keyboard: true, title: `Ligne ${bus.line?.ref ?? ''}` })
          .on('click', (event) => {
            L.DomEvent.stopPropagation(event)
            select.current(bus.id)
          })
          .addTo(map)
        markers.current.set(bus.id, marker)
      }
    }
    for (const [id, marker] of markers.current) {
      if (!seen.has(id)) {
        marker.remove()
        markers.current.delete(id)
      }
    }
  }, [buses, selected])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !user) return
    if (!userMarker.current) {
      userMarker.current = L.marker(user, {
        icon: L.divIcon({ className: 'map-pin map-pin-user', iconSize: [18, 18], iconAnchor: [9, 9] }),
        interactive: false,
        zIndexOffset: 2000,
      }).addTo(map)
    }
    userMarker.current.setLatLng(user)
  }, [user])

  return (
    <div className="live-map-wrap">
      <div ref={container} className="live-map" role="application" aria-label="Carte des bus en direct" />
      <div className="live-map-tools">
        <button type="button" className="map-tool" aria-label="Me localiser" onClick={onLocate}>
          <Crosshair size={20} weight="bold" />
        </button>
        <button type="button" className="map-tool" aria-label="Zoomer" onClick={() => mapRef.current?.zoomIn()}>
          <Plus size={20} weight="bold" />
        </button>
        <button type="button" className="map-tool" aria-label="Dézoomer" onClick={() => mapRef.current?.zoomOut()}>
          <Minus size={20} weight="bold" />
        </button>
      </div>
    </div>
  )
}
