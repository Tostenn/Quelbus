import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowsLeftRight, Crosshair, NavigationArrow } from '@phosphor-icons/react'
import ArrivalDialog from '../components/ArrivalDialog'
import LineBadge from '../components/LineBadge'
import LoadError from '../components/LoadError'
import NotFound from '../components/NotFound'
import ReportForm from '../components/ReportForm'
import type { LineDetail } from '../lib/api'
import { distance } from '../lib/geo'
import { lineTitle, TYPE_LABELS } from '../lib/search'
import { useApi } from '../lib/useApi'
import { useLiveLocation } from '../lib/useLiveLocation'
import { usePageMeta } from '../lib/usePageMeta'

const LineMap = lazy(() => import('../components/LineMap'))
const NO_GEOMETRY: [number, number][][] = []
const ARRIVAL_RADIUS = 80

export default function Line() {
  const { slug = '' } = useParams()
  const [query, setQuery] = useSearchParams()
  const { data: line, error, notFound, loading, retry } = useApi<LineDetail>(`/lines/${encodeURIComponent(slug)}`)

  const direction = line?.directions.find((d) => String(d.id) === query.get('sens')) ?? line?.directions[0]
  const stops = direction?.stops ?? []

  usePageMeta(
    line ? `${lineTitle(line)} : ${line.name}, tous les arrêts | QuelBus` : 'Ligne de bus | QuelBus',
    line && direction
      ? `${lineTitle(line)} (${TYPE_LABELS[line.type]}) à Abidjan, ${direction.name} : ${stops.length} arrêts, de ${stops
          .slice(0, 4)
          .map((s) => s.name)
          .join(', ')}… jusqu’à ${stops.at(-1)?.name}.`
      : undefined,
  )

  // Venant d'une recherche : montée et descente mises en évidence
  const board = stops.findIndex((s) => String(s.id) === query.get('montee'))
  const alight = stops.findIndex((s) => String(s.id) === query.get('descente'))
  const trip = board >= 0 && alight > board

  // Position transmise par la recherche, puis suivie en direct
  const [startLat, startLng] = (query.get('ici') ?? '').split(',').map(Number)
  const hasStart = query.has('ici') && Number.isFinite(startLat) && Number.isFinite(startLng)
  const [tracking, setTracking] = useState(hasStart)
  const { position, denied } = useLiveLocation(tracking && board >= 0)
  const userLat = position?.lat ?? (hasStart ? startLat : undefined)
  const userLng = position?.lng ?? (hasStart ? startLng : undefined)

  let current = -1
  let currentDistance = Infinity
  if (position) {
    stops.forEach((s, i) => {
      const d = distance(position.lat, position.lng, s.lat, s.lng)
      if (d < currentDistance) [current, currentDistance] = [i, d]
    })
  }
  const onBoard = trip && current > board && current <= alight
  const toAlight = position && trip ? distance(position.lat, position.lng, stops[alight].lat, stops[alight].lng) : Infinity
  const toBoard = position && board >= 0 ? distance(position.lat, position.lng, stops[board].lat, stops[board].lng) : Infinity
  const arrived = toAlight < ARRIVAL_RADIUS

  const [dismissed, setDismissed] = useState(false)

  // La liste suit l'arrêt en cours
  const lastScrolled = useRef(-1)
  useEffect(() => {
    if (!tracking || current < 0 || current === lastScrolled.current) return
    lastScrolled.current = current
    // scroll-margin-top (CSS) garde l'arrêt sous la carte collée en haut
    document.getElementById(`arret-${current}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [tracking, current])

  if (notFound) return <NotFound what="Cette ligne" />

  return (
    <section className="section page-section">
      <div className="container">
        <p className="breadcrumb">
          <Link to="/lignes">Lignes</Link> / {line ? lineTitle(line) : '…'}
        </p>

        {loading && <p className="muted">Chargement de la ligne…</p>}
        {error && <LoadError message={error} onRetry={retry} />}

        {line && direction && (
          <div className={`line-layout${tracking ? ' is-tracking' : ''}`}>
            <div className="line-head">
              <header className="line-header">
                <LineBadge refNumber={line.ref} type={line.type} accent size="lg" />
                <div>
                  <h1 className="line-title">{direction.name}</h1>
                  <p className="muted">
                    {TYPE_LABELS[line.type]}
                    {line.category && line.type !== 'sotra' ? ` · ${line.category}` : ''} · {stops.length} arrêts
                    {direction.is_loop ? ' · boucle' : ''}
                  </p>
                </div>
              </header>

              {line.directions.length > 1 && (
                <div className="segmented directions" role="group" aria-label="Sens">
                  <ArrowsLeftRight aria-hidden="true" />
                  {line.directions.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={d.id === direction.id ? 'is-selected' : ''}
                      aria-pressed={d.id === direction.id}
                      onClick={() => setQuery({ sens: String(d.id) })}
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <aside className="line-aside">
              {board >= 0 && (
                <div className="live-bar" role="status">
                  {tracking ? (
                    <>
                      <NavigationArrow weight="fill" aria-hidden="true" className="live-icon" />
                      <span>
                        {denied
                          ? 'Localisation refusée : le suivi est arrêté.'
                          : !position
                            ? 'Recherche de votre position…'
                            : onBoard
                              ? current < alight
                                ? `Prochain arrêt : ${stops[current + 1].name} · encore ${alight - current} arrêt${alight - current > 1 ? 's' : ''}`
                                : `Descendez ici : ${stops[alight].name}`
                              : `Rejoignez l’arrêt ${stops[board].name} · ${Math.round(toBoard)} m`}
                      </span>
                      <button type="button" className="live-stop" onClick={() => setTracking(false)}>
                        Arrêter
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn-locate" onClick={() => setTracking(true)}>
                      <Crosshair />
                      Suivre ma position pendant le trajet
                    </button>
                  )}
                </div>
              )}

              <Suspense fallback={<div className="line-map" />}>
                <LineMap
                  stops={stops}
                  geometry={direction.geometry ?? NO_GEOMETRY}
                  board={board}
                  alight={alight}
                  userLat={userLat}
                  userLng={userLng}
                  follow={tracking && position !== null}
                  onBoard={onBoard}
                />
              </Suspense>

              {(trip || userLat !== undefined) && (
                <ul className="map-legend">
                  {userLat !== undefined && (
                    <li>
                      <span className="map-pin map-pin-user legend-pin" aria-hidden="true" /> Vous
                    </li>
                  )}
                  <li>
                    <span className="map-pin map-pin-board legend-pin" aria-hidden="true" /> Montée
                  </li>
                  {trip && (
                    <li>
                      <span className="map-pin map-pin-alight legend-pin" aria-hidden="true" /> Descente
                    </li>
                  )}
                </ul>
              )}
            </aside>

            <div className="line-main">
              <ol className="stop-list">
                {stops.map((stop, i) => {
                  const ride = trip && i > board && i < alight
                  const role =
                    tracking && i === current && currentDistance < 150
                      ? 'Vous êtes ici'
                      : i === board
                        ? trip
                          ? 'Votre montée'
                          : 'Vous êtes ici'
                        : trip && i === alight
                          ? 'Votre descente'
                          : null
                  const classes = [
                    'stop-item',
                    i === board && 'is-key is-board',
                    trip && i === alight && 'is-key is-alight',
                    ride && 'is-ride',
                    trip && (i < board || i > alight) && 'is-off',
                    tracking && i === current && 'is-current',
                  ]
                  return (
                    <li key={`${stop.id}-${i}`} id={`arret-${i}`} className={classes.filter(Boolean).join(' ')}>
                      <span className="stop-number">{String(i + 1).padStart(2, '0')}</span>
                      <span className="stop-dot" aria-hidden="true" />
                      <span>
                        <Link to={`/arrets/${stop.slug}`} className="stop-name">
                          {stop.name}
                        </Link>
                        {role && <span className="stop-role">{role}</span>}
                      </span>
                    </li>
                  )
                })}
              </ol>

              <p className="form-note">
                Données&nbsp;:{' '}
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                  © OpenStreetMap contributors
                </a>
                . Elles peuvent être incomplètes ou dépassées.
              </p>
              <ReportForm lineId={line.id} />
            </div>
          </div>
        )}
      </div>

      {trip && (
        <ArrivalDialog
          open={arrived && !dismissed}
          stopName={stops[alight]?.name ?? ''}
          onClose={() => {
            setDismissed(true)
            setTracking(false)
          }}
        />
      )}
    </section>
  )
}
