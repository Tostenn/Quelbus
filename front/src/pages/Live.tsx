import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Broadcast, CaretRight, MagnifyingGlass, UsersThree, X } from '@phosphor-icons/react'
import LineBadge from '../components/LineBadge'
import type { MapFocus } from '../components/LiveMap'
import type { LineSummary } from '../lib/api'
import { CITIES, cityAt, type City } from '../lib/cities'
import { normalize } from '../lib/search'
import { ageSeconds, seenLabel, useAllLiveBuses, useNow, type LiveBus } from '../lib/trips'
import { useApi } from '../lib/useApi'
import { setCity, useCity } from '../lib/useCity'
import { usePageMeta } from '../lib/usePageMeta'

const LiveMap = lazy(() => import('../components/LiveMap'))

type Snap = 'peek' | 'half' | 'full'

/** Hauteurs du panneau, en px, selon la place disponible */
function snapHeight(snap: Snap, available: number): number {
  if (snap === 'peek') return Math.min(196, available * 0.4)
  if (snap === 'half') return Math.min(available * 0.55, 480)
  return available - 56
}

const cityBounds = (city: City): [[number, number], [number, number]] => [
  [city.bounds[0], city.bounds[1]],
  [city.bounds[2], city.bounds[3]],
]

const busText = (bus: LiveBus) =>
  normalize(
    [bus.line?.ref, bus.line?.name, bus.direction?.destination, bus.direction?.name, bus.last_stop?.name, bus.next_stop?.name]
      .filter(Boolean)
      .join(' '),
  )

export default function Live() {
  usePageMeta(
    'Les bus en direct | QuelBus',
    'Les bus SOTRA, gbakas et wôrô-wôrôs en ce moment sur la carte, grâce aux voyageurs qui partagent leur position.',
  )
  const { buses, loaded } = useAllLiveBuses()
  const now = useNow()
  const saved = useCity()
  const [city, chooseCity] = useState<City | null>(saved)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [snap, setSnap] = useState<Snap>('half')
  const [user, setUser] = useState<[number, number] | null>(null)
  // Chaque demande de recadrage a sa clé, même vers le même endroit
  const focusCount = useRef(0)
  const [focus, setFocus] = useState<MapFocus>(() => ({ bounds: cityBounds(saved), key: `ville-${saved.slug}` }))

  // Hauteur disponible pour le panneau (la page occupe l'écran sous l'en-tête)
  const page = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(600)
  useEffect(() => {
    const el = page.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.height))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Glisser le panneau
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const drag = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null)
  const height = dragHeight ?? snapHeight(snap, available)

  function onPointerDown(event: React.PointerEvent) {
    drag.current = { startY: event.clientY, startHeight: height, moved: false }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }
  function onPointerMove(event: React.PointerEvent) {
    if (!drag.current) return
    const delta = drag.current.startY - event.clientY
    if (Math.abs(delta) > 4) drag.current.moved = true
    if (drag.current.moved) setDragHeight(Math.max(120, Math.min(available - 40, drag.current.startHeight + delta)))
  }
  function onPointerUp() {
    const state = drag.current
    drag.current = null
    if (!state) return
    if (!state.moved) {
      // Simple appui sur la poignée : on passe à la hauteur suivante
      setSnap((s) => (s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek'))
      return
    }
    const current = dragHeight ?? height
    const nearest = (['peek', 'half', 'full'] as Snap[]).reduce((a, b) =>
      Math.abs(snapHeight(a, available) - current) <= Math.abs(snapHeight(b, available) - current) ? a : b,
    )
    setSnap(nearest)
    setDragHeight(null)
  }

  // Lignes (pour proposer leur fiche quand aucun bus ne correspond) : chargées seulement si on cherche
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const { data: lines } = useApi<LineSummary[]>(words.length ? '/lines' : '/lines?city=__aucune__')

  const inCity = useMemo(() => (city ? buses.filter((bus) => (bus.line?.city ?? 'abidjan') === city.slug) : buses), [buses, city])
  const shown = useMemo(
    () =>
      inCity
        .filter((bus) => words.every((w) => busText(bus).includes(w)))
        .sort((a, b) => (a.line?.ref ?? '').localeCompare(b.line?.ref ?? '', 'fr', { numeric: true })),
    [inCity, words],
  )
  const liveLines = new Set(buses.map((bus) => bus.line?.id))
  const otherLines = words.length
    ? (lines ?? [])
        .filter((line) => !liveLines.has(line.id) && (!city || (line.city ?? 'abidjan') === city.slug))
        .filter((line) => words.every((w) => normalize(`${line.ref ?? ''} ${line.name}`).includes(w)))
        .slice(0, 5)
    : []
  const selected = buses.find((bus) => bus.id === selectedId) ?? null

  function pickCity(next: City | null) {
    chooseCity(next)
    setSelectedId(null)
    if (next) {
      setCity(next.slug)
      setFocus({ bounds: cityBounds(next), key: `ville-${next.slug}-${++focusCount.current}` })
    } else if (buses.length) {
      const lats = buses.map((b) => b.lat)
      const lngs = buses.map((b) => b.lng)
      setFocus({ bounds: [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]], key: `tous-${++focusCount.current}` })
    }
  }

  function pickBus(bus: LiveBus) {
    setSelectedId(bus.id)
    setSnap('half')
    setFocus({ point: [bus.lat, bus.lng], zoom: 16, key: `bus-${bus.id}-${++focusCount.current}` })
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => {
        const here: [number, number] = [coords.latitude, coords.longitude]
        setUser(here)
        setFocus({ point: here, zoom: 15, key: `moi-${++focusCount.current}` })
        const where = cityAt({ lat: here[0], lng: here[1] })
        if (where && where.slug !== city?.slug) {
          chooseCity(where)
          setCity(where.slug)
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <div className="live-page" ref={page}>
      <Suspense fallback={<div className="live-map" />}>
        <LiveMap
          buses={inCity}
          selected={selectedId}
          focus={focus}
          user={user}
          onSelect={(id) => {
            setSelectedId(id)
            if (id) setSnap('half')
          }}
          onLocate={locate}
          bottomInset={height}
        />
      </Suspense>

      <section
        className={`live-sheet${dragHeight !== null ? ' is-dragging' : ''}`}
        style={{ height }}
        aria-label="Rechercher un bus en direct"
      >
        <div
          className="sheet-grip"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <button
            type="button"
            className="sheet-handle"
            aria-label={snap === 'full' ? 'Réduire le panneau' : 'Agrandir le panneau'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setSnap((s) => (s === 'full' ? 'peek' : s === 'peek' ? 'half' : 'full'))
              }
            }}
          />
        </div>

        {selected ? (
          <div className="sheet-body">
            <BusDetail bus={selected} now={now} onClose={() => setSelectedId(null)} />
          </div>
        ) : (
          <div className="sheet-body">
            <label className="filter-search sheet-search">
              <MagnifyingGlass aria-hidden="true" />
              <span className="visually-hidden">Chercher un bus</span>
              <input
                type="search"
                placeholder="Ligne, terminus ou arrêt : 81, Adjamé…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSnap((s) => (s === 'peek' ? 'half' : s))}
              />
            </label>

            <div className="sheet-cities" role="group" aria-label="Ville">
              <button type="button" className={city === null ? 'is-selected' : ''} aria-pressed={city === null} onClick={() => pickCity(null)}>
                Partout
              </button>
              {CITIES.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  className={city?.slug === c.slug ? 'is-selected' : ''}
                  aria-pressed={city?.slug === c.slug}
                  onClick={() => pickCity(c)}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <p className="sheet-summary" aria-live="polite">
              <span className={`live-dot${inCity.length ? '' : ' is-off'}`} aria-hidden="true" />
              {!loaded
                ? 'Recherche des bus en direct…'
                : inCity.length
                  ? `${inCity.length} bus en direct${city ? ` à ${city.name}` : ''}`
                  : `Aucun bus en direct${city ? ` à ${city.name}` : ''} pour l’instant`}
            </p>

            {shown.length > 0 && (
              <ul className="sheet-list">
                {shown.map((bus) => (
                  <li key={bus.id}>
                    <button type="button" className="sheet-row" onClick={() => pickBus(bus)}>
                      <LineBadge refNumber={bus.line?.ref ?? null} type={bus.line?.type} size="sm" />
                      <span className="sheet-row-text">
                        <span className="sheet-row-title">Vers {bus.direction?.destination ?? bus.direction?.name}</span>
                        <span className="muted">
                          {bus.last_stop ? `Passé à ${bus.last_stop.name}` : 'Au départ'} · {seenLabel(ageSeconds(bus, now))}
                        </span>
                      </span>
                      <CaretRight aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {loaded && words.length > 0 && shown.length === 0 && otherLines.length === 0 && (
              <p className="muted sheet-empty">Aucune ligne ne correspond à « {query} ».</p>
            )}

            {otherLines.length > 0 && (
              <>
                <h2 className="sheet-heading">Pas de bus en direct sur ces lignes</h2>
                <ul className="sheet-list">
                  {otherLines.map((line) => (
                    <li key={line.id}>
                      <Link className="sheet-row" to={`/lignes/${line.slug}`}>
                        <LineBadge refNumber={line.ref} type={line.type} size="sm" />
                        <span className="sheet-row-text">
                          <span className="sheet-row-title">{line.name}</span>
                          <span className="muted">Voir la fiche, les arrêts et les horaires</span>
                        </span>
                        <CaretRight aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {loaded && inCity.length === 0 && !words.length && (
              <div className="sheet-empty">
                <p>
                  Les bus apparaissent ici quand un voyageur à bord appuie sur <strong>« Je suis dans ce bus »</strong> dans
                  la fiche de sa ligne. Plus on est nombreux à partager, plus la carte se remplit.
                </p>
                <Link className="btn btn-primary" to="/lignes">
                  <Broadcast aria-hidden="true" />
                  Je suis dans un bus
                </Link>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function BusDetail({ bus, now, onClose }: { bus: LiveBus; now: number; onClose: () => void }) {
  return (
    <div className="bus-detail">
      <div className="bus-detail-head">
        <LineBadge refNumber={bus.line?.ref ?? null} type={bus.line?.type} accent size="lg" />
        <div>
          <h2 className="bus-detail-title">Vers {bus.direction?.destination ?? bus.direction?.name}</h2>
          <p className="muted">{bus.line?.name}</p>
        </div>
        <button type="button" className="btn-icon" aria-label="Fermer" onClick={onClose}>
          <X />
        </button>
      </div>
      <dl className="bus-detail-facts">
        <div>
          <dt>Dernier arrêt</dt>
          <dd>
            {bus.last_stop?.name ?? 'Au départ'} <span className="muted">· {seenLabel(ageSeconds(bus, now))}</span>
          </dd>
        </div>
        {bus.next_stop && (
          <div>
            <dt>Prochain arrêt</dt>
            <dd>{bus.next_stop.name}</dd>
          </div>
        )}
      </dl>
      <p className="muted bus-detail-reporters">
        <UsersThree size={16} aria-hidden="true" />
        {bus.reporters > 1 ? `${bus.reporters} voyageurs partagent sa position` : 'Un voyageur partage sa position'}
      </p>
      {bus.line && (
        <Link className="btn btn-primary btn-block" to={`/lignes/${bus.line.slug}?sens=${bus.direction_id}`}>
          Voir la ligne et ses arrêts
          <ArrowRight aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}
