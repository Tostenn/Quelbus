import { Link, useParams } from 'react-router'
import { PersonSimpleWalk } from '@phosphor-icons/react'
import LineBadge from '../components/LineBadge'
import LoadError from '../components/LoadError'
import NotFound from '../components/NotFound'
import ReportForm from '../components/ReportForm'
import SearchForm from '../components/SearchForm'
import type { StopDetail } from '../lib/api'
import { useApi } from '../lib/useApi'
import { usePageMeta } from '../lib/usePageMeta'

export default function Stop() {
  const { slug = '' } = useParams()
  const { data: stop, error, notFound, loading, retry } = useApi<StopDetail>(`/stops/${encodeURIComponent(slug)}`)

  const refs = [...new Set(stop?.lines.map((l) => l.line.ref).filter(Boolean))]
  usePageMeta(
    stop ? `Arrêt ${stop.name} : quelles lignes de bus y passent ? | QuelBus` : 'Arrêt de bus | QuelBus',
    stop
      ? `${stop.lines.length} ligne${stop.lines.length > 1 ? 's' : ''} passe${stop.lines.length > 1 ? 'nt' : ''} à l’arrêt ${stop.name} à Abidjan${refs.length ? ` : ${refs.slice(0, 8).join(', ')}` : ''}.`
      : undefined,
  )

  if (notFound) return <NotFound what="Cet arrêt" />

  return (
    <section className="section page-section">
      <div className="container narrow">
        <p className="breadcrumb">
          <Link to="/lignes">Lignes</Link> / Arrêt
        </p>

        {loading && <p className="muted">Chargement de l’arrêt…</p>}
        {error && <LoadError message={error} onRetry={retry} />}

        {stop && (
          <>
            <h1 className="page-title">{stop.name}</h1>
            <p className="lead">
              {stop.lines.length} ligne{stop.lines.length > 1 ? 's' : ''} s’arrête{stop.lines.length > 1 ? 'nt' : ''} ici.
            </p>

            <ul className="line-list">
              {stop.lines.map(({ line, direction }) => (
                <li key={direction.id}>
                  <Link className="line-row" to={`/lignes/${line.slug}?sens=${direction.id}&montee=${stop.id}`}>
                    <LineBadge refNumber={line.ref} type={line.type} size="sm" />
                    <span className="line-row-name">{direction.name}</span>
                  </Link>
                </li>
              ))}
            </ul>

            <h2 className="section-title">Partir d’ici</h2>
            <div className="search-card">
              <SearchForm key={stop.id} initialFrom={{ name: stop.name, lat: stop.lat, lng: stop.lng }} />
            </div>

            {stop.nearby.length > 0 && (
              <>
                <h2 className="section-title">Arrêts à proximité</h2>
                <ul className="nearby-list">
                  {stop.nearby.map((s) => (
                    <li key={s.id}>
                      <Link to={`/arrets/${s.slug}`}>{s.name}</Link>
                      <span className="muted walk">
                        <PersonSimpleWalk size={16} aria-hidden="true" /> {s.walk} m
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <ReportForm stopId={stop.id} />
          </>
        )}
      </div>
    </section>
  )
}
