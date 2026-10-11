import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { SignOut } from '@phosphor-icons/react'
import DayChart from '../components/DayChart'
import {
  adminGet,
  getToken,
  logout,
  Unauthorized,
  type AdminReport,
  type AdminStats,
  type AdminSubscriber,
  type Page,
} from '../lib/admin'
import { SITE_URL } from '../lib/config'
import { usePageMeta } from '../lib/usePageMeta'

type Tab = 'stats' | 'reports' | 'subscribers'

const TABS: { value: Tab; label: string }[] = [
  { value: 'stats', label: 'Statistiques' },
  { value: 'reports', label: 'Signalements' },
  { value: 'subscribers', label: 'Retours' },
]

const date = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function useAdmin<T>(path: string) {
  const navigate = useNavigate()
  const [state, setState] = useState<{ path: string; data?: T; error?: string }>({ path: '' })

  useEffect(() => {
    const controller = new AbortController()
    adminGet<T>(path, controller.signal)
      .then((data) => setState({ path, data }))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (e instanceof Unauthorized) return navigate('/connexion', { replace: true })
        setState({ path, error: (e as Error).message })
      })
    return () => controller.abort()
  }, [path, navigate])

  const loading = state.path !== path
  return { data: loading ? undefined : state.data, error: loading ? undefined : state.error, loading }
}

export default function Admin() {
  usePageMeta('Tableau de bord | QuelBus')
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('stats')

  if (!getToken()) return <Navigate to="/connexion" replace />

  return (
    <section className="section page-section">
      <div className="container">
        <div className="admin-head">
          <h1 className="page-title">Tableau de bord</h1>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              await logout()
              navigate('/connexion', { replace: true })
            }}
          >
            <SignOut />
            Déconnexion
          </button>
        </div>

        <div className="segmented admin-tabs" role="tablist" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={tab === t.value ? 'is-selected' : ''}
              onClick={() => setTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'stats' && <StatsTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'subscribers' && <SubscribersTab />}
      </div>
    </section>
  )
}

function StatsTab() {
  const { data, error, loading } = useAdmin<{ data: AdminStats }>('/stats')
  if (loading) return <p className="muted">Chargement…</p>
  if (error || !data) return <p className="form-alert">{error}</p>
  const { totals, days } = data.data

  const tiles = [
    { label: 'Visites', value: totals.visits },
    { label: 'Trajets recherchés', value: totals.searches },
    { label: 'Signalements', value: totals.reports },
    { label: 'Inscrits', value: totals.subscribers },
    { label: 'Lignes', value: totals.lines },
    { label: 'Arrêts', value: totals.stops },
  ]

  return (
    <>
      <ul className="stat-tiles">
        {tiles.map((t) => (
          <li key={t.label}>
            <span className="stat-label">{t.label}</span>
            <strong className="stat-value">{t.value.toLocaleString('fr-FR')}</strong>
          </li>
        ))}
      </ul>
      <div className="charts">
        <DayChart title="Visites par jour" days={days} metric="visits" />
        <DayChart title="Trajets recherchés par jour" days={days} metric="searches" />
      </div>
    </>
  )
}

function Pager({ page, last, onChange }: { page: number; last: number; onChange: (page: number) => void }) {
  if (last <= 1) return null
  return (
    <div className="pager">
      <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Précédent
      </button>
      <span className="muted">
        Page {page} sur {last}
      </span>
      <button type="button" className="btn btn-ghost btn-sm" disabled={page >= last} onClick={() => onChange(page + 1)}>
        Suivant
      </button>
    </div>
  )
}

function ReportsTab() {
  const [page, setPage] = useState(1)
  const { data, error, loading } = useAdmin<Page<AdminReport>>(`/reports?page=${page}`)
  if (loading) return <p className="muted">Chargement…</p>
  if (error || !data) return <p className="form-alert">{error}</p>
  if (!data.data.length) return <p className="muted">Aucun signalement pour l’instant.</p>

  return (
    <>
      <p className="results-count">{data.total} signalement{data.total > 1 ? 's' : ''}</p>
      <ul className="admin-list">
        {data.data.map((r) => (
          <li key={r.id} className="admin-item">
            <div className="admin-item-head">
              <strong>{r.kind_label}</strong>
              <span className="muted">{date(r.created_at)}</span>
            </div>
            <p>{r.message}</p>
            <p className="muted">
              {r.line_name && `Ligne ${r.line_ref ?? ''} ${r.line_name} · `}
              {r.stop_name && `Arrêt ${r.stop_name} · `}
              <a href={`${SITE_URL}${r.page}`} target="_blank" rel="noreferrer">
                Voir la page
              </a>
              {r.email && (
                <>
                  {' · '}
                  <a href={`mailto:${r.email}`}>{r.email}</a>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
      <Pager page={data.current_page} last={data.last_page} onChange={setPage} />
    </>
  )
}

function SubscribersTab() {
  const [page, setPage] = useState(1)
  const { data, error, loading } = useAdmin<Page<AdminSubscriber>>(`/subscribers?page=${page}`)
  if (loading) return <p className="muted">Chargement…</p>
  if (error || !data) return <p className="form-alert">{error}</p>
  if (!data.data.length) return <p className="muted">Aucun inscrit pour l’instant.</p>

  const profiles: Record<string, string> = { utilisateur: 'Utilisateur', contributeur: 'Contributeur', les_deux: 'Les deux' }

  return (
    <>
      <p className="results-count">{data.total} inscrit{data.total > 1 ? 's' : ''}</p>
      <ul className="admin-list">
        {data.data.map((s) => (
          <li key={s.id} className="admin-item">
            <div className="admin-item-head">
              <strong>
                {s.first_name} {s.last_name}
              </strong>
              <span className="muted">{date(s.created_at)}</span>
            </div>
            <p className="muted">
              {profiles[s.profile] ?? s.profile} · <a href={`mailto:${s.email}`}>{s.email}</a>
            </p>
            {s.message && <p className="admin-quote">{s.message}</p>}
          </li>
        ))}
      </ul>
      <Pager page={data.current_page} last={data.last_page} onChange={setPage} />
    </>
  )
}
