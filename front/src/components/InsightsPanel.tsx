import { Fragment, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight } from '@phosphor-icons/react'
import ColumnChart from './ColumnChart'
import LineBadge from './LineBadge'
import type { InsightLine, Insights } from '../lib/admin'
import { useAdmin } from '../lib/useAdmin'

const PERIODS = [7, 30, 90] as const

const fr = (n: number) => n.toLocaleString('fr-FR')
const pct = (n: number | null) => (n === null ? '–' : `${n.toLocaleString('fr-FR')} %`)

const HOURS = Array.from({ length: 24 }, (_, h) => `${h} h`)
const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const TYPES: Record<string, string> = { sotra: 'SOTRA', gbaka: 'Gbaka', 'woro-woro': 'Wôrô-wôrô', autre: 'Autre' }

type Row = { key: string; label: ReactNode; value: number; detail?: ReactNode }

/** Classement : une barre par ligne, proportionnelle au premier. */
function RankList({ title, note, rows, empty = 'Pas encore de données sur la période.' }: { title: string; note?: string; rows: Row[]; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <section className="insight-card">
      <h3 className="insight-title">{title}</h3>
      {note && <p className="insight-note">{note}</p>}
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ol className="rank-list">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="rank-head">
                <span className="rank-label">{r.label}</span>
                <strong className="rank-value">{fr(r.value)}</strong>
              </div>
              {r.value > 0 && <span className="rank-bar" style={{ width: `${(r.value / max) * 100}%` }} aria-hidden="true" />}
              {r.detail && <span className="rank-detail">{r.detail}</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function Badges({ lines }: { lines: InsightLine[] }) {
  return (
    <span className="rank-badges">
      {lines.map((l, i) => (
        <Fragment key={i}>
          {i > 0 && <ArrowRight size={12} aria-label="puis" />}
          <LineBadge refNumber={l.ref} type={l.type} size="sm" />
        </Fragment>
      ))}
    </span>
  )
}

function place(p: { area: string; name: string | null }) {
  const [lat, lng] = p.area.split(',')
  return (
    <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`} target="_blank" rel="noreferrer">
      {p.name ?? `zone ${p.area}`}
    </a>
  )
}

/** Usage de l'appli : ce que les gens cherchent, ce qu'on leur répond, ce qui manque. */
export default function InsightsPanel() {
  const [days, setDays] = useState<number>(30)
  const { data, error, loading } = useAdmin<{ data: Insights }>(`/insights?jours=${days}`)

  const periodPicker = (
    <fieldset className="segmented insight-period">
      <legend className="field-label">Période</legend>
      {PERIODS.map((p) => (
        <button key={p} type="button" className={p === days ? 'is-selected' : ''} aria-pressed={p === days} onClick={() => setDays(p)}>
          {p} jours
        </button>
      ))}
    </fieldset>
  )

  if (loading) return <div className="insights">{periodPicker}<p className="muted">Chargement…</p></div>
  if (error || !data) return <p className="form-alert">{error}</p>
  const { summary: s } = data.data
  const d = data.data

  const growth =
    s.growth === null ? 'Pas de période précédente à comparer' : `${s.growth > 0 ? '+' : ''}${fr(s.growth)} % sur les ${days} jours précédents`

  const tiles = [
    { label: 'Recherches', value: fr(s.searches), hint: growth },
    { label: 'Avec une réponse', value: pct(s.answered_rate), hint: `${fr(s.none)} sans aucune ligne` },
    { label: 'Trajets différents', value: fr(s.routes), hint: `${fr(s.routes_published)} pages trajet publiées sur ${fr(s.routes_indexed)}` },
    { label: 'Recherches par visite', value: s.searches_per_visit === null ? '–' : fr(s.searches_per_visit), hint: `${fr(s.visits)} visites` },
    { label: 'Départ par GPS', value: pct(s.gps_rate), hint: 'Le reste est saisi à la main' },
    { label: 'Signalements', value: s.reports_per_1000 === null ? '–' : fr(s.reports_per_1000), hint: `pour 1 000 recherches (${fr(s.reports)} au total)` },
  ]

  const outcomes: Row[] = [
    { key: 'direct', label: 'Une ligne directe', value: s.direct },
    { key: 'combination', label: 'Une combinaison de lignes', value: s.combination },
    { key: 'walk', label: 'À pied (trop près pour un bus)', value: s.walk },
    { key: 'none', label: 'Aucune réponse', value: s.none },
  ]

  const hourTicks = ['0 h', '6 h', '12 h', '18 h', '23 h']

  return (
    <div className="insights">
      <div className="insights-head">
        <h2 className="admin-section-title">Usage de l’appli</h2>
        {periodPicker}
      </div>

      <ul className="stat-tiles">
        {tiles.map((t) => (
          <li key={t.label}>
            <span className="stat-label">{t.label}</span>
            <strong className="stat-value">{t.value}</strong>
            <span className="stat-hint">{t.hint}</span>
          </li>
        ))}
      </ul>

      <div className="insight-grid">
        <RankList
          title="Trajets les plus recherchés"
          note="Avec les lignes proposées. Une page publique existe à partir de 3 recherches."
          rows={d.routes.map((r) => ({
            key: r.slug,
            label: (
              <Link to={`/trajets/${r.slug}`}>
                {r.from} → {r.to}
              </Link>
            ),
            value: r.count,
            detail: r.options.length ? (
              <span className="rank-options">
                {r.options.map((o, i) => (
                  <Badges key={i} lines={o} />
                ))}
              </span>
            ) : (
              <span className="muted">Aucune ligne</span>
            ),
          }))}
        />
        <RankList title="Réponses données" note="Ce que QuelBus a trouvé pour chaque recherche." rows={outcomes} />
        <RankList
          title="Départs les plus fréquents"
          rows={d.departures.map((p) => ({ key: p.slug, label: <Link to={`/arrets/${p.slug}`}>{p.name}</Link>, value: p.count }))}
        />
        <RankList
          title="Destinations les plus demandées"
          rows={d.destinations.map((p) => ({ key: p.slug, label: <Link to={`/arrets/${p.slug}`}>{p.name}</Link>, value: p.count }))}
        />
        <RankList
          title="Lignes les plus proposées"
          note="Nombre de recherches où la ligne apparaît dans les résultats."
          rows={d.lines_proposed.map((l) => ({
            key: l.line.slug,
            label: (
              <Link className="rank-line" to={`/lignes/${l.line.slug}`}>
                <LineBadge refNumber={l.line.ref} type={l.line.type} size="sm" /> {l.line.name}
              </Link>
            ),
            value: l.count,
            detail: `${fr(l.first)} fois en premier choix`,
          }))}
        />
        <RankList
          title="Fiches ligne les plus consultées"
          rows={d.lines_viewed.map((l) => ({
            key: l.line.slug,
            label: (
              <Link className="rank-line" to={`/lignes/${l.line.slug}`}>
                <LineBadge refNumber={l.line.ref} type={l.line.type} size="sm" /> {l.line.name}
              </Link>
            ),
            value: l.count,
          }))}
        />
        <RankList
          title="Combinaisons les plus proposées"
          note="Quand il n’y a pas de ligne directe : les correspondances que les gens font vraiment."
          rows={d.combinations.map((c) => ({
            key: c.lines.map((l) => l.slug).join('|'),
            label: <Badges lines={c.lines} />,
            value: c.count,
          }))}
        />
        <RankList
          title="Trajets sans réponse"
          note="Là où il manque une ligne ou des arrêts : la priorité pour compléter les données."
          empty="Aucun trajet sans réponse sur la période."
          rows={d.unanswered.map((u) => ({
            key: `${u.from.area}|${u.to.area}`,
            label: (
              <>
                {place(u.from)} → {place(u.to)}
              </>
            ),
            value: u.count,
          }))}
        />
      </div>

      <div className="charts">
        <ColumnChart title="Recherches par heure" values={d.hours} labels={HOURS} ticks={hourTicks} />
        <ColumnChart title="Recherches par jour de la semaine" values={d.weekdays} labels={WEEKDAYS} ticks={['Lundi', 'Dimanche']} />
      </div>

      <p className="admin-meta">
        Filtre de transport utilisé dans {pct(s.filtered_rate)} des recherches
        {d.types.length > 0 && ` (${d.types.map((t) => `${t.types.split(',').map((x) => TYPES[x] ?? x).join(' + ')} : ${fr(t.count)}`).join(', ')})`}
        {' '}· {fr(s.line_views)} fiches ligne ouvertes · Heures d’Abidjan
      </p>
    </div>
  )
}
