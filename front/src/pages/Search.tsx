import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ArrowClockwise, PencilSimple, WarningCircle } from '@phosphor-icons/react'
import SearchForm from '../components/SearchForm'
import SearchResults from '../components/SearchResults'
import MeetingShare from '../components/MeetingShare'
import MeetMeHere from '../components/MeetMeHere'
import { rememberDestination } from '../lib/meeting'
import { usePageMeta } from '../lib/usePageMeta'
import { fetchSearch, type LineType, type SearchResponse } from '../lib/api'
import {
  queryToDestination,
  queryToSearch,
  RADII,
  searchToQuery,
  TYPE_FILTERS,
} from '../lib/search'

type State = { key: string; data?: SearchResponse; error?: string }

export default function Search() {
  usePageMeta('Quel bus prendre ? Lignes et correspondances à Abidjan | QuelBus')
  const [query, setQuery] = useSearchParams()
  const params = queryToSearch(query)
  const key = params ? searchToQuery(params) : ''

  const [state, setState] = useState<State>({ key: '' })
  const [retries, setRetries] = useState(0)
  const [editing, setEditing] = useState(false)
  const [meeting, setMeeting] = useState(false)

  useEffect(() => {
    const search = queryToSearch(new URLSearchParams(key))
    if (!search) return
    rememberDestination(search.to)
    const controller = new AbortController()
    fetchSearch(search, controller.signal)
      .then((data) => setState({ key, data }))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        const message = e instanceof TypeError ? 'Impossible de joindre le serveur. Vérifiez votre connexion.' : String((e as Error).message)
        setState({ key, error: message })
      })
    return () => controller.abort()
  }, [key, retries])

  // Lien de rendez-vous reçu : la destination est connue, il manque le départ de la personne
  const meetingPoint = params ? null : queryToDestination(query)
  if (meetingPoint) {
    return (
      <section className="section search-page">
        <div className="container narrow">
          <h1 className="search-title">
            On vous attend {meetingPoint.name.startsWith('près de') ? '' : 'à '}
            {meetingPoint.name}
          </h1>
          <p className="lead">Dites où vous êtes&nbsp;: QuelBus cherche aussitôt le bus qui vous y emmène.</p>
          <div className="search-card">
            <SearchForm initialTo={meetingPoint} autoSubmit />
          </div>
        </div>
      </section>
    )
  }

  if (!params) {
    return (
      <section className="section search-page">
        <div className="container narrow">
          <h1 className="search-title">Quel bus prendre&nbsp;?</h1>
          <p className="lead">Indiquez d’où vous partez et où vous allez.</p>
          {!meeting && (
            <div className="search-card">
              <SearchForm />
            </div>
          )}
          <MeetMeHere onActiveChange={setMeeting} />
        </div>
      </section>
    )
  }

  const loading = state.key !== key
  const data = loading ? undefined : state.data
  const error = loading ? undefined : state.error
  const activeType = params.types.length === 1 ? params.types[0] : 'tous'

  function update(changes: { radius?: number; types?: LineType[] }) {
    setQuery(searchToQuery({ ...params!, ...changes }))
  }

  return (
    <section className="section search-page">
      <div className="container narrow">
        <div className="trip-summary">
          <div className="trip-places">
            <span className="trip-place">
              <span className="pin pin-from" aria-hidden="true" />
              {params.from.name}
            </span>
            <span className="trip-place">
              <span className="pin pin-to" aria-hidden="true" />
              {params.to.name}
            </span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
            <PencilSimple />
            {editing ? 'Fermer' : 'Modifier'}
          </button>
        </div>

        {data && !editing && <MeetingShare to={params.to} />}

        {editing && (
          <div className="search-card">
            <SearchForm
              key={key}
              initialFrom={params.from}
              initialTo={params.to}
              radius={params.radius}
              types={params.types}
              onSubmitted={() => setEditing(false)}
            />
          </div>
        )}

        <div className="filters">
          <fieldset className="segmented">
            <legend className="field-label">Marche max</legend>
            {RADII.map((r) => (
              <button
                key={r}
                type="button"
                className={r === params.radius ? 'is-selected' : ''}
                aria-pressed={r === params.radius}
                onClick={() => update({ radius: r })}
              >
                {r} m
              </button>
            ))}
          </fieldset>
          <fieldset className="segmented">
            <legend className="field-label">Transport</legend>
            {TYPE_FILTERS.map((t) => (
              <button
                key={t.value}
                type="button"
                className={t.value === activeType ? 'is-selected' : ''}
                aria-pressed={t.value === activeType}
                onClick={() => update({ types: t.value === 'tous' ? [] : [t.value] })}
              >
                {t.label}
              </button>
            ))}
          </fieldset>
        </div>

        <div aria-live="polite" aria-busy={loading}>
          {loading && (
            <div className="results">
              <p className="results-count results-loading">Recherche des lignes…</p>
              {[0, 1].map((i) => (
                <div key={i} className="result-card skeleton" aria-hidden="true" />
              ))}
            </div>
          )}

          {error && (
            <div className="notice notice-error">
              <WarningCircle size={24} aria-hidden="true" />
              <div>
                <p>{error}</p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setState({ key: '' })
                    setRetries((n) => n + 1)
                  }}
                >
                  <ArrowClockwise />
                  Réessayer
                </button>
              </div>
            </div>
          )}

          {data && <SearchResults data={data} from={params.from} to={params.to} radius={params.radius} filtered={activeType !== 'tous'} onAllTypes={() => update({ types: [] })} />}
        </div>
      </div>
    </section>
  )
}
