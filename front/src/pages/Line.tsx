import { lazy, Suspense } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowsLeftRight } from '@phosphor-icons/react'
import LineBadge from '../components/LineBadge'
import LoadError from '../components/LoadError'
import NotFound from '../components/NotFound'
import ReportForm from '../components/ReportForm'
import type { LineDetail } from '../lib/api'
import { lineTitle, TYPE_LABELS } from '../lib/search'
import { useApi } from '../lib/useApi'
import { usePageMeta } from '../lib/usePageMeta'

const LineMap = lazy(() => import('../components/LineMap'))
const NO_GEOMETRY: [number, number][][] = []

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

  if (notFound) return <NotFound what="Cette ligne" />

  // Venant d'une recherche : montée et descente mises en évidence
  const board = stops.findIndex((s) => String(s.id) === query.get('montee'))
  const alight = stops.findIndex((s) => String(s.id) === query.get('descente'))
  const trip = board >= 0 && alight > board
  // Position GPS transmise par la recherche
  const [userLat, userLng] = (query.get('ici') ?? '').split(',').map(Number)
  const hasUser = query.has('ici') && Number.isFinite(userLat) && Number.isFinite(userLng)

  return (
    <section className="section page-section">
      <div className="container narrow">
        <p className="breadcrumb">
          <Link to="/lignes">Lignes</Link> / {line ? lineTitle(line) : '…'}
        </p>

        {loading && <p className="muted">Chargement de la ligne…</p>}
        {error && <LoadError message={error} onRetry={retry} />}

        {line && direction && (
          <>
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

            <Suspense fallback={<div className="line-map" />}>
              <LineMap
                stops={stops}
                geometry={direction.geometry ?? NO_GEOMETRY}
                board={board}
                alight={alight}
                userLat={hasUser ? userLat : undefined}
                userLng={hasUser ? userLng : undefined}
              />
            </Suspense>
            {(trip || hasUser) && (
              <ul className="map-legend">
                {hasUser && (
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

            <ol className="stop-list">
              {stops.map((stop, i) => {
                const ride = trip && i > board && i < alight
                const role = i === board ? (trip ? 'Votre montée' : 'Vous êtes ici') : trip && i === alight ? 'Votre descente' : null
                return (
                  <li
                    key={`${stop.id}-${i}`}
                    className={`stop-item${i === board ? ' is-key is-board' : ''}${trip && i === alight ? ' is-key is-alight' : ''}${ride ? ' is-ride' : ''}${trip && (i < board || i > alight) ? ' is-off' : ''}`}
                  >
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
          </>
        )}
      </div>
    </section>
  )
}
