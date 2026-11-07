import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { MagnifyingGlass } from '@phosphor-icons/react'
import LineBadge from '../components/LineBadge'
import LoadError from '../components/LoadError'
import type { LineSummary, LineType } from '../lib/api'
import { CITIES, cityName } from '../lib/cities'
import { setCity, useCity } from '../lib/useCity'
import { normalize, TYPE_FILTERS, TYPE_LABELS } from '../lib/search'
import { useApi } from '../lib/useApi'
import { usePageMeta } from '../lib/usePageMeta'

const ORDER: LineType[] = ['sotra', 'gbaka', 'woro-woro', 'autre']

export default function Lines() {
  const [params, setParams] = useSearchParams()
  const saved = useCity()
  const { data, error, loading, retry } = useApi<LineSummary[]>('/lines')
  const [query, setQuery] = useState('')
  const [type, setType] = useState<LineType | 'tous'>('tous')

  // Villes qui ont au moins une ligne, dans l'ordre de CITIES
  const served = CITIES.filter((c) => (data ?? []).some((line) => (line.city ?? 'abidjan') === c.slug))
  const wanted = CITIES.find((c) => c.slug === params.get('ville'))?.slug ?? saved.slug
  // Ville sans ligne pour l'instant : on montre Abidjan
  const city = !data || served.some((c) => c.slug === wanted) ? wanted : 'abidjan'
  const abidjan = city === 'abidjan'
  const name = cityName(city)
  usePageMeta(
    abidjan
      ? 'Toutes les lignes de bus d’Abidjan : SOTRA, gbaka, wôrô-wôrô | QuelBus'
      : `Les lignes de bus SOTRA à ${name} | QuelBus`,
    abidjan
      ? 'La liste des lignes de bus SOTRA, gbakas et wôrô-wôrôs d’Abidjan, avec leurs arrêts dans l’ordre.'
      : `La liste des lignes de bus SOTRA à ${name}, avec leurs terminus.`,
  )
  const inCity = (data ?? []).filter((line) => (line.city ?? 'abidjan') === city)
  const types = new Set(inCity.map((line) => line.type))

  const words = normalize(query).split(/\s+/).filter(Boolean)
  const lines = inCity.filter((line) => {
    if (types.size > 1 && type !== 'tous' && line.type !== type) return false
    const text = normalize(`${line.ref ?? ''} ${line.name} ${line.category ?? ''}`)
    return words.every((word) => text.includes(word))
  })

  return (
    <section className="section page-section">
      <div className="container narrow">
        <h1 className="page-title">Les lignes {abidjan ? 'd’Abidjan' : `de ${name}`}</h1>
        <p className="lead">
          {abidjan
            ? 'Bus SOTRA, gbakas et wôrô-wôrôs, avec leurs arrêts dans l’ordre.'
            : 'Bus SOTRA. Pour l’instant, on connaît surtout les terminus : les arrêts sont en cours de relevé.'}
        </p>

        {served.length > 1 && (
          <div className="segmented city-filter" role="group" aria-label="Ville">
            {served.map((c) => (
              <button
                key={c.slug}
                type="button"
                className={c.slug === city ? 'is-selected' : ''}
                aria-pressed={c.slug === city}
                onClick={() => {
                  setType('tous')
                  setCity(c.slug)
                  setParams(c.slug === 'abidjan' ? {} : { ville: c.slug }, { replace: true })
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="line-filters">
          <label className="filter-search">
            <MagnifyingGlass aria-hidden="true" />
            <span className="visually-hidden">Chercher une ligne</span>
            <input
              type="search"
              placeholder="Numéro ou nom : 81, Adjamé…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {types.size > 1 && (
            <div className="segmented" role="group" aria-label="Transport">
              {TYPE_FILTERS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={t.value === type ? 'is-selected' : ''}
                  aria-pressed={t.value === type}
                  onClick={() => setType(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && <p className="muted">Chargement des lignes…</p>}
        {error && <LoadError message={error} onRetry={retry} />}

        {data && !lines.length && <p className="muted">Aucune ligne ne correspond à « {query} ».</p>}

        {ORDER.map((t) => {
          const group = lines.filter((line) => line.type === t)
          if (!group.length) return null
          return (
            <div key={t} className="line-group">
              <h2 className="line-group-title">
                {TYPE_LABELS[t]} <span className="muted">· {group.length}</span>
              </h2>
              <ul className="line-list">
                {group.map((line) => (
                  <li key={line.id}>
                    <Link className="line-row" to={`/lignes/${line.slug}`}>
                      <LineBadge refNumber={line.ref} type={line.type} size="sm" />
                      <span>
                        <span className="line-row-name">{line.name}</span>
                        {line.category && t !== 'sotra' && <span className="muted"> · {line.category}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
