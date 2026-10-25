import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { Check, PaperPlaneTilt, Trash, UserPlus, WarningCircle } from '@phosphor-icons/react'
import DayChart from '../components/DayChart'
import {
  adminGet,
  adminSend,
  getToken,
  Unauthorized,
  type AdminReport,
  type AdminUser,
  type DonationsPage,
  type AdminStats,
  type AdminSubscriber,
  type Page,
} from '../lib/admin'
import { SITE_URL } from '../lib/config'
import { usePageMeta } from '../lib/usePageMeta'

type Tab = 'stats' | 'donations' | 'reports' | 'subscribers' | 'admins'

const TABS: { value: Tab; label: string }[] = [
  { value: 'stats', label: 'Statistiques' },
  { value: 'reports', label: 'Signalements' },
  { value: 'subscribers', label: 'Inscrits' },
  { value: 'donations', label: 'Dons' },
  { value: 'admins', label: 'Admins' },
]

const isTab = (value: string | null): value is Tab => TABS.some((t) => t.value === value)

const date = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function useAdmin<T>(path: string, version = 0) {
  const navigate = useNavigate()
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: '' })
  const key = `${path}#${version}`

  useEffect(() => {
    const controller = new AbortController()
    adminGet<T>(path, controller.signal)
      .then((data) => setState({ key, data }))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (e instanceof Unauthorized) return navigate('/connexion', { replace: true })
        setState({ key, error: (e as Error).message })
      })
    return () => controller.abort()
  }, [path, key, navigate])

  const loading = state.key !== key
  return { data: loading ? undefined : state.data, error: loading ? undefined : state.error, loading }
}

export default function Admin() {
  usePageMeta('Tableau de bord | QuelBus')
  const [query, setQuery] = useSearchParams()
  const requested = query.get('onglet')
  const tab: Tab = isTab(requested) ? requested : 'stats'
  const { data: me } = useAdmin<{ user: { id: number; name: string } }>('/me')

  if (!getToken()) return <Navigate to="/connexion" replace />

  return (
    <section className="section admin-page">
      <div className="container">
        <div className="admin-head">
          <h1 className="admin-title">Tableau de bord</h1>
          {me && <p className="muted">Connecté en tant que {me.user.name}</p>}
        </div>

        <div className="admin-tabs" role="tablist" aria-label="Sections du tableau de bord">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              id={`onglet-${t.value}`}
              aria-selected={tab === t.value}
              aria-controls="panneau-admin"
              className={tab === t.value ? 'is-selected' : ''}
              onClick={() => setQuery(t.value === 'stats' ? {} : { onglet: t.value }, { replace: true })}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div id="panneau-admin" role="tabpanel" aria-labelledby={`onglet-${tab}`} className="admin-panel">
          {tab === 'stats' && <StatsTab />}
          {tab === 'donations' && <DonationsTab />}
          {tab === 'reports' && <ReportsTab />}
          {tab === 'subscribers' && <SubscribersTab />}
          {tab === 'admins' && <AdminsTab />}
        </div>
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
      <p className="admin-meta">
        Depuis le lancement · Dons reçus&nbsp;: {totals.donations_amount.toLocaleString('fr-FR')}&nbsp;F · Données&nbsp;:{' '}
        {totals.lines.toLocaleString('fr-FR')} lignes, {totals.stops.toLocaleString('fr-FR')} arrêts
      </p>
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

const STATUS: Record<string, string> = { success: 'Reçu', pending: 'En attente', failed: 'Échoué', abandoned: 'Abandonné' }
const CHANNELS: Record<string, string> = { mobile_money: 'Mobile Money', card: 'Carte', apple_pay: 'Apple Pay', bank: 'Banque' }

function DonationsTab() {
  const [page, setPage] = useState(1)
  const { data, error, loading } = useAdmin<DonationsPage>(`/donations?page=${page}`)
  if (loading) return <p className="muted">Chargement…</p>
  if (error || !data) return <p className="form-alert">{error}</p>

  return (
    <>
      <ul className="stat-tiles">
        <li>
          <span className="stat-label">Total reçu</span>
          <strong className="stat-value">{data.totals.amount.toLocaleString('fr-FR')} F</strong>
        </li>
        <li>
          <span className="stat-label">Dons confirmés</span>
          <strong className="stat-value">{data.totals.count}</strong>
        </li>
        <li>
          <span className="stat-label">En attente</span>
          <strong className="stat-value">{data.totals.pending}</strong>
        </li>
      </ul>
      {!data.data.length ? (
        <p className="muted admin-empty">Aucun don pour l’instant.</p>
      ) : (
        <ul className="admin-list">
          {data.data.map((d) => (
            <li key={d.id} className="admin-item">
              <div className="admin-item-head">
                <strong>
                  {d.amount.toLocaleString('fr-FR')} F · {d.name || 'Anonyme'}
                </strong>
                <span className={`status-badge status-${d.status}`}>{STATUS[d.status] ?? d.status}</span>
              </div>
              {d.message && <p className="admin-quote">{d.message}</p>}
              <p className="muted">
                {date(d.paid_at ?? d.created_at)}
                {d.channel && ` · ${CHANNELS[d.channel] ?? d.channel}`}
                {d.email && (
                  <>
                    {' · '}
                    <a href={`mailto:${d.email}`}>{d.email}</a>
                  </>
                )}
                {' · '}
                <code>{d.reference}</code>
              </p>
            </li>
          ))}
        </ul>
      )}
      <Pager page={data.current_page} last={data.last_page} onChange={setPage} />
    </>
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

const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5)
  if (days <= 0) return 'aujourd’hui'
  if (days === 1) return 'hier'
  return `il y a ${days} jours`
}

function AdminsTab() {
  const navigate = useNavigate()
  const [version, setVersion] = useState(0)
  const { data, error, loading } = useAdmin<{ data: AdminUser[] }>('/users', version)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // Session expirée pendant une action : retour à la connexion
  async function run(key: string, action: () => ReturnType<typeof adminSend>) {
    setBusy(key)
    setNotice(null)
    try {
      const result = await action()
      setNotice({ ok: result.ok, text: result.message })
      if (result.ok) setVersion((v) => v + 1)
      return result
    } catch (e) {
      if (e instanceof Unauthorized) navigate('/connexion', { replace: true })
      return null
    } finally {
      setBusy(null)
    }
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault()
    setErrors({})
    const result = await run('invite', () => adminSend('/users', { name, email }))
    if (!result) return
    if (result.ok) {
      setName('')
      setEmail('')
    } else {
      setErrors(result.errors)
    }
  }

  function remove(user: AdminUser) {
    if (!window.confirm(`Retirer l’accès de ${user.name} (${user.email}) ? Sa session sera fermée.`)) return
    run(`remove-${user.id}`, () => adminSend(`/users/${user.id}`, {}, 'DELETE'))
  }

  return (
    <div className="admins">
      <form className="admin-invite" onSubmit={invite} noValidate>
        <h2 className="admin-section-title">Ajouter un admin</h2>
        <p className="muted">
          Il reçoit un email pour choisir son mot de passe (lien valable 3&nbsp;jours). Tous les admins ont les mêmes
          droits.
        </p>
        <div className="admin-invite-fields">
          <div className="field">
            <label htmlFor="admin-name">Nom</label>
            <input
              id="admin-name"
              autoComplete="off"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'admin-name-error' : undefined}
            />
            {errors.name && (
              <p id="admin-name-error" className="field-error">
                {errors.name}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'admin-email-error' : undefined}
            />
            {errors.email && (
              <p id="admin-email-error" className="field-error">
                {errors.email}
              </p>
            )}
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy === 'invite'}>
            <UserPlus aria-hidden="true" />
            {busy === 'invite' ? 'Envoi…' : 'Envoyer l’invitation'}
          </button>
        </div>
      </form>

      <div aria-live="polite">
        {notice && (
          <p className={notice.ok ? 'admin-notice' : 'form-alert'}>
            {notice.ok ? <Check size={20} aria-hidden="true" /> : <WarningCircle size={20} aria-hidden="true" />}
            {notice.text}
          </p>
        )}
      </div>

      <h2 className="admin-section-title">Accès au tableau de bord</h2>
      {loading && !data && <p className="muted">Chargement…</p>}
      {error && <p className="form-alert">{error}</p>}
      {data && (
        <ul className="admin-list">
          {data.data.map((u) => (
            <li key={u.id} className="admin-item admin-user">
              <div>
                <strong>
                  {u.name}
                  {u.is_me && <span className="muted"> (vous)</span>}
                </strong>
                <p className="muted">
                  <a href={`mailto:${u.email}`}>{u.email}</a>
                </p>
              </div>
              <span className={`status-badge ${u.last_login_at ? 'status-success' : 'status-pending'}`}>
                {u.last_login_at ? `Connecté ${ago(u.last_login_at)}` : 'Invitation en attente'}
              </span>
              {!u.is_me && (
                <div className="admin-user-actions">
                  {!u.last_login_at && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy !== null}
                      onClick={() => run(`resend-${u.id}`, () => adminSend(`/users/${u.id}/invitation`))}
                    >
                      <PaperPlaneTilt aria-hidden="true" />
                      {busy === `resend-${u.id}` ? 'Envoi…' : 'Renvoyer l’invitation'}
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm btn-danger" disabled={busy !== null} onClick={() => remove(u)}>
                    <Trash aria-hidden="true" />
                    Retirer
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
