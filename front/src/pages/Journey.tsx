import { Link, useParams } from 'react-router'
import { ArrowRight } from '@phosphor-icons/react'
import JsonLd from '../components/JsonLd'
import LoadError from '../components/LoadError'
import NotFound from '../components/NotFound'
import SearchForm from '../components/SearchForm'
import SearchResults from '../components/SearchResults'
import type { RouteDetail, SearchResponse } from '../lib/api'
import { RADII, lineTitle, searchToQuery } from '../lib/search'
import { breadcrumb } from '../lib/seo'
import { useApi } from '../lib/useApi'
import { usePageMeta } from '../lib/usePageMeta'

/** La réponse en une phrase, pour la description et les données structurées. */
function answer(from: string, to: string, search: SearchResponse): string {
  const direct = search.results[0]
  const combination = search.combinations?.[0]
  if (combination && (search.prefer === 'combinations' || !direct)) {
    const lines = combination.legs.map((leg) => lineTitle(leg.line)).join(', puis ')
    return `Pour aller de ${from} à ${to}, prenez ${lines} : montez à ${combination.legs[0].board.name} et changez à ${combination.legs[0].alight.name}.`
  }
  if (direct) {
    return `Pour aller de ${from} à ${to}, prenez la ${lineTitle(direct.line).toLowerCase()} : montez à ${direct.board.name}, descendez à ${direct.alight.name}.`
  }
  if (search.walkable) return `${to} est à quelques minutes à pied de ${from}.`
  return `Aucune ligne connue ne relie encore ${from} à ${to}.`
}

/** Trajet déjà recherché par d'autres : « Quel bus pour aller de A à B ? ». */
export default function Journey() {
  const { slug = '' } = useParams()
  const { data: route, error, notFound, loading, retry } = useApi<RouteDetail>(`/routes/${encodeURIComponent(slug)}`)

  const question = route ? `Quel bus prendre pour aller de ${route.from.name} à ${route.to.name} ?` : ''
  const summary = route ? answer(route.from.name, route.to.name, route.search) : undefined
  usePageMeta(route ? `${question.replace(' ?', '')} | QuelBus` : 'Trajet en bus à Abidjan | QuelBus', summary)

  if (notFound) return <NotFound what="Ce trajet" />

  const from = route && { name: route.from.name, lat: route.from.lat, lng: route.from.lng }
  const to = route && { name: route.to.name, lat: route.to.lat, lng: route.to.lng }

  return (
    <section className="section page-section">
      <div className="container narrow">
        <p className="breadcrumb">
          <Link to="/recherche">Recherche</Link> / Trajet
        </p>

        {loading && <p className="muted">Chargement du trajet…</p>}
        {error && <LoadError message={error} onRetry={retry} />}

        {route && from && to && (
          <>
            <JsonLd
              data={[
                {
                  '@context': 'https://schema.org',
                  '@type': 'FAQPage',
                  mainEntity: [{ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: summary } }],
                },
                breadcrumb([
                  { name: 'Recherche', path: '/recherche' },
                  { name: `${route.from.name} → ${route.to.name}`, path: `/trajets/${route.slug}` },
                ]),
              ]}
            />
            <h1 className="page-title">
              Quel bus pour aller de {route.from.name} à {route.to.name}&nbsp;?
            </h1>
            <p className="lead">{summary}</p>

            <SearchResults data={route.search} from={from} to={to} radius={RADII[0]} />

            <p>
              <Link className="text-link" to={`/recherche?${searchToQuery({ from, to, radius: RADII[0], types: [] })}`}>
                Ouvrir dans la recherche <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </p>

            <h2 className="section-title">Partir d’ailleurs</h2>
            <div className="search-card">
              <SearchForm key={route.slug} initialTo={to} />
            </div>

            {route.to_same_place.length > 0 && (
              <>
                <h2 className="section-title">Aller à {route.to.name} depuis…</h2>
                <ul className="nearby-list">
                  {route.to_same_place.map((r) => (
                    <li key={r.slug}>
                      <Link to={`/trajets/${r.slug}`}>{r.name}</Link>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {route.from_same_place.length > 0 && (
              <>
                <h2 className="section-title">Depuis {route.from.name}, aller à…</h2>
                <ul className="nearby-list">
                  {route.from_same_place.map((r) => (
                    <li key={r.slug}>
                      <Link to={`/trajets/${r.slug}`}>{r.name}</Link>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <p className="form-note">
              Arrêts de <Link to={`/arrets/${route.from.slug}`}>{route.from.name}</Link> et de{' '}
              <Link to={`/arrets/${route.to.slug}`}>{route.to.name}</Link>&nbsp;: toutes les lignes qui y passent.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
