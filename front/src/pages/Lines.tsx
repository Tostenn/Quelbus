import { useState } from 'react'
import { Link } from 'react-router'
import { MagnifyingGlass } from '@phosphor-icons/react'
import LineBadge from '../components/LineBadge'
import LoadError from '../components/LoadError'
import type { LineSummary, LineType } from '../lib/api'
import { normalize, TYPE_FILTERS, TYPE_LABELS } from '../lib/search'
import { useApi } from '../lib/useApi'
import { usePageMeta } from '../lib/usePageMeta'

const ORDER: LineType[] = ['sotra', 'gbaka', 'woro-woro', 'autre']

export default function Lines() {
  usePageMeta(
    'Toutes les lignes de bus d’Abidjan : SOTRA, gbaka, wôrô-wôrô | QuelBus',
    'La liste des lignes de bus SOTRA, gbakas et wôrô-wôrôs d’Abidjan, avec leurs arrêts dans l’ordre.',
  )
  const { data, error, loading, retry } = useApi<LineSummary[]>('/lines')
  const [query, setQuery] = useState('')
  const [type, setType] = useState<LineType | 'tous'>('tous')

  const words = normalize(query).split(/\s+/).filter(Boolean)
  const lines = (data ?? []).filter((line) => {
    if (type !== 'tous' && line.type !== type) return false
    const text = normalize(`${line.ref ?? ''} ${line.name} ${line.category ?? ''}`)
    return words.every((word) => text.includes(word))
  })

  return (
    <section className="section page-section">
      <div className="container narrow">
        <h1 className="page-title">Les lignes d’Abidjan</h1>
        <p className="lead">Bus SOTRA, gbakas et wôrô-wôrôs, avec leurs arrêts dans l’ordre.</p>

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
