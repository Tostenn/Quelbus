import { Fragment, lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowRight, ArrowsLeftRight, CaretDown, Crosshair, NavigationArrow, PersonSimpleWalk } from '@phosphor-icons/react'
import ArrivalDialog from '../components/ArrivalDialog'
import LineBadge from '../components/LineBadge'
import LoadError from '../components/LoadError'
import NotFound from '../components/NotFound'
import type { Place } from '../lib/api'
import { distance } from '../lib/geo'
import { de, lineShort, lineTitle, SAME_STOP_M, sameName, TYPE_LABELS, walkLabel } from '../lib/search'
import { fetchTrip, readLegs, type TripLeg } from '../lib/trip'
import { useLiveLocation } from '../lib/useLiveLocation'
import { usePageMeta } from '../lib/usePageMeta'

const TripMap = lazy(() => import('../components/TripMap'))
const ARRIVAL_RADIUS = 80

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

function readPlace(query: URLSearchParams, name: string, lat: string, lng: string): Place | null {
  const place = { name: query.get(name) ?? '', lat: Number(query.get(lat)), lng: Number(query.get(lng)) }
  return place.name && query.get(lat) && query.get(lng) && Number.isFinite(place.lat) && Number.isFinite(place.lng) ? place : null
}

/** Direction affichée : le terminus du sens, sans répéter le départ. */
const towards = (leg: TripLeg) => leg.direction.name.split('→').at(-1)?.trim() || leg.direction.name

type State = { key: string; legs?: TripLeg[] | null; error?: string }

export default function Trip() {
  const navigate = useNavigate()
  const [query] = useSearchParams()
  const key = query.toString()
  const refs = useMemo(() => readLegs(new URLSearchParams(key)), [key])
  const from = useMemo(() => readPlace(new URLSearchParams(key), 'depart', 'dlat', 'dlng'), [key])
  const to = useMemo(() => readPlace(new URLSearchParams(key), 'arrivee', 'alat', 'alng'), [key])

  const [state, setState] = useState<State>({ key: '' })
  const [retries, setRetries] = useState(0)
  useEffect(() => {
    if (!refs.length) return
    const controller = new AbortController()
    fetchTrip(refs, controller.signal)
      .then((legs) => setState({ key, legs }))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setState({ key, error: e instanceof TypeError ? 'Impossible de joindre le serveur. Vérifiez votre connexion.' : String((e as Error).message) })
      })
    return () => controller.abort()
  }, [key, refs, retries])

  const loading = refs.length > 0 && state.key !== key
  const legs = loading ? undefined : state.legs
  const first = legs?.[0].stops[0]
  const last = legs?.at(-1)?.stops.at(-1)
  const startWalk = from && first ? Math.round(distance(from.lat, from.lng, first.lat, first.lng)) : 0
  const endWalk = to && last ? Math.round(distance(last.lat, last.lng, to.lat, to.lng)) : 0
  const title = from && to ? `${from.name}\u00a0→ ${to.name}` : first && last ? `${first.name}\u00a0→ ${last.name}` : 'Votre trajet'

  usePageMeta(
    `${title} : trajet avec changement | QuelBus`,
    legs ? `${legs.map((l) => lineTitle(l.line)).join(' puis ')} : où monter, où changer et où descendre.` : undefined,
  )

  // Suivi en direct sur tout le trajet : l'arrêt le plus proche donne l'étape en cours
  const [tracking, setTracking] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const { position, denied } = useLiveLocation(tracking && !!legs)
  const points = useMemo(() => (legs ?? []).flatMap((leg, k) => leg.stops.map((stop, i) => ({ stop, k, i, n: leg.stops.length }))), [legs])
  let current = -1
  let currentDistance = Infinity
  if (position) {
    points.forEach((p, g) => {
      const d = distance(position.lat, position.lng, p.stop.lat, p.stop.lng)
      if (d < currentDistance) [current, currentDistance] = [g, d]
    })
  }
  const here = current >= 0 ? points[current] : null
  const arrived = !!position && !!last && distance(position.lat, position.lng, last.lat, last.lng) < ARRIVAL_RADIUS

  if (!refs.length || legs === null) return <NotFound what="Ce trajet" />

  function liveText(): string {
    if (denied) return 'Localisation refusée : le suivi est arrêté.'
    if (!position || !here || !legs) return 'Recherche de votre position…'
    const leg = legs[here.k]
    const next = legs[here.k + 1]
    const atStop = currentDistance < 150
    if (here.i === 0 && (here.k === 0 || atStop)) {
      return atStop
        ? `Montez ici : ${lineTitle(leg.line)} direction ${towards(leg)}`
        : `Rejoignez l’arrêt ${leg.stops[0].name} · ${Math.round(currentDistance)} m`
    }
    if (here.i === here.n - 1) {
      return next
        ? `Descendez ici : ${leg.stops.at(-1)!.name}. Ensuite : ${lineTitle(next.line)} à ${next.stops[0].name}`
        : `Descendez ici : ${leg.stops.at(-1)!.name}`
    }
    const left = here.n - 1 - here.i
    return `${lineTitle(leg.line)} · prochain arrêt ${leg.stops[here.i + 1].name} · descente dans ${plural(left, 'arrêt')}`
  }

  return (
    <section className="section page-section">
      <div className="container">
        <p className="breadcrumb">
          <button type="button" className="back-link" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/recherche'))}>
            <ArrowLeft size={16} aria-hidden="true" /> Résultats
          </button>
        </p>

        {loading && <p className="muted">Chargement du trajet…</p>}
        {!loading && state.error && (
          <LoadError
            message={state.error}
            onRetry={() => {
              setState({ key: '' })
              setRetries((n) => n + 1)
            }}
          />
        )}

        {legs && first && last && (
          <div className={`line-layout trip-layout${tracking ? ' is-tracking' : ''}`}>
            <div className="line-head">
              <h1 className="trip-title">{title}</h1>
              <p className="trip-lines">
                {legs.map((leg, k) => (
                  <Fragment key={k}>
                    {k > 0 && <ArrowRight size={18} aria-hidden="true" />}
                    <LineBadge refNumber={leg.line.ref} type={leg.line.type} accent={leg.line.type === 'sotra'} size="md" />
                  </Fragment>
                ))}
                <span className="muted">
                  {plural(legs.length - 1, 'changement')} · {plural(legs.reduce((n, l) => n + l.stops.length - 1, 0), 'arrêt')}
                </span>
              </p>
            </div>

            <aside className="line-aside">
              <div className="live-bar" role="status">
                {tracking ? (
                  <>
                    <NavigationArrow weight="fill" aria-hidden="true" className="live-icon" />
                    <span>{liveText()}</span>
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
              <Suspense fallback={<div className="line-map" />}>
                <TripMap legs={legs} from={from} to={to} userLat={position?.lat} userLng={position?.lng} follow={tracking && !!position} />
              </Suspense>
              <ul className="map-legend">
                <li>
                  <span className="map-pin map-pin-board legend-pin" aria-hidden="true" /> Montée
                </li>
                <li>
                  <span className="map-pin map-pin-change legend-pin" aria-hidden="true" /> Changement
                </li>
                <li>
                  <span className="map-pin map-pin-alight legend-pin" aria-hidden="true" /> Arrivée
                </li>
                <li>
                  <span className="legend-walk" aria-hidden="true" /> À pied
                </li>
              </ul>
            </aside>

            <ol className="line-main trip-steps">
              {from && (
                <li className="trip-walk">
                  <PersonSimpleWalk size={18} aria-hidden="true" />
                  <span>
                    {from.name === 'Ma position' ? (
                      <>Depuis votre position, {walkLabel(startWalk)} jusqu’à l’arrêt</>
                    ) : sameName(from.name, first.name) ? (
                      <>L’arrêt est à {walkLabel(startWalk)}</>
                    ) : (
                      <>
                        De <strong>{from.name}</strong>, {walkLabel(startWalk)} jusqu’à l’arrêt
                      </>
                    )}
                  </span>
                </li>
              )}

              {legs.map((leg, k) => {
                const board = leg.stops[0]
                const alight = leg.stops.at(-1)!
                const middle = leg.stops.slice(1, -1)
                const previous = k > 0 ? legs[k - 1].stops.at(-1)! : null
                const walk = previous && previous.id !== board.id ? Math.round(distance(previous.lat, previous.lng, board.lat, board.lng)) : 0
                const active = here?.k === k
                return (
                  <Fragment key={k}>
                    {previous && (
                      <li className="trip-change">
                        <span className="trip-change-icon" aria-hidden="true">
                          <ArrowsLeftRight size={16} weight="bold" />
                        </span>
                        <span>
                          {walk < SAME_STOP_M ? (
                            <>
                              <strong>Changement</strong> au même arrêt
                            </>
                          ) : sameName(previous.name, board.name) ? (
                            // Même arrêt des deux côtés de la route : on dit où aller, pas deux fois le même nom
                            <>
                              <strong>Changement à {board.name}</strong> · l’arrêt du {lineShort(leg.line)} est à {walkLabel(walk)}
                            </>
                          ) : (
                            <>
                              <strong>Changement</strong> · {walkLabel(walk)} {de(previous.name)} à {board.name}
                            </>
                          )}
                        </span>
                      </li>
                    )}

                    <li className={`trip-leg ride-${leg.line.type}${active ? ' is-active' : ''}`}>
                      <div className="trip-leg-head">
                        <LineBadge refNumber={leg.line.ref} type={leg.line.type} accent={leg.line.type === 'sotra'} size="lg" />
                        <div>
                          <p className="trip-leg-title">
                            {TYPE_LABELS[leg.line.type]} direction {towards(leg)}
                          </p>
                          <p className="muted">{plural(leg.stops.length - 1, 'arrêt')}</p>
                        </div>
                      </div>

                      <ol className="trip-stops">
                        <li className={`trip-stop is-key${k === 0 ? ' is-board' : ' is-change'}`}>
                          <span className="trip-dot" aria-hidden="true" />
                          <span>
                            <span className="stop-role">Montez à</span>
                            <Link to={`/arrets/${board.slug}`} className="stop-name">
                              {board.name}
                            </Link>
                          </span>
                        </li>

                        {middle.length > 0 && (
                          <li className="trip-stop trip-middle">
                            <span className="trip-dot" aria-hidden="true" />
                            <details open={active}>
                              <summary>
                                {plural(middle.length, 'arrêt')} sans descendre <CaretDown size={14} aria-hidden="true" />
                              </summary>
                              <ol>
                                {middle.map((stop, i) => (
                                  <li key={`${stop.id}-${i}`} className={here && here.k === k && here.i === i + 1 ? 'is-current' : ''}>
                                    {stop.name}
                                  </li>
                                ))}
                              </ol>
                            </details>
                          </li>
                        )}

                        <li className={`trip-stop is-key${k === legs.length - 1 ? ' is-alight' : ' is-change'}`}>
                          <span className="trip-dot" aria-hidden="true" />
                          <span>
                            <span className="stop-role">Descendez à</span>
                            <Link to={`/arrets/${alight.slug}`} className="stop-name">
                              {alight.name}
                            </Link>
                          </span>
                        </li>
                      </ol>

                      <Link className="trip-line-link" to={`/lignes/${leg.line.slug}?sens=${leg.direction.id}&montee=${board.id}&descente=${alight.id}`}>
                        Tous les arrêts de la ligne <ArrowRight size={15} aria-hidden="true" />
                      </Link>
                    </li>
                  </Fragment>
                )
              })}

              {to && (
                <li className="trip-walk">
                  <PersonSimpleWalk size={18} aria-hidden="true" />
                  <span>
                    {sameName(to.name, last.name) ? (
                      <>Votre destination est à {walkLabel(endWalk)}</>
                    ) : (
                      <>
                        {walkLabel(endWalk)} jusqu’à <strong>{to.name}</strong>
                      </>
                    )}
                  </span>
                </li>
              )}

              <li className="trip-note form-note">
                Changements calculés d’après le tracé des lignes, sans horaires. En cas de doute, demandez au chauffeur. Données&nbsp;:{' '}
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                  © OpenStreetMap contributors
                </a>
                .
              </li>
            </ol>
          </div>
        )}
      </div>

      <ArrivalDialog
        open={tracking && arrived && !dismissed}
        stopName={last?.name ?? ''}
        onClose={() => {
          setDismissed(true)
          setTracking(false)
        }}
      />
    </section>
  )
}
