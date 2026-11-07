import { lazy, Suspense, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowDown, ArrowsClockwise, ArrowUp, Check, FloppyDisk, MagnifyingGlass, Trash, WarningCircle } from '@phosphor-icons/react'
import LineBadge from './LineBadge'
import type { EditorStop } from './EditorMap'
import { ChangesList, FareEditor, SchedulesEditor } from './FareEditors'
import type { LineDetail, LineSummary } from '../lib/api'
import { adminSend, Unauthorized } from '../lib/admin'
import { CITIES } from '../lib/cities'
import { normalize } from '../lib/search'
import { useApi } from '../lib/useApi'
import { setCity, useCity } from '../lib/useCity'

const EditorMap = lazy(() => import('./EditorMap'))
const MAX_SHOWN = 50

type Direction = LineDetail['directions'][number]

let nextKey = 0
const keyed = (stop: Omit<EditorStop, 'key'>): EditorStop => ({ ...stop, key: `s${nextKey++}` })

/** Saisie des arrêts d'une ligne : d'abord pour les villes de l'intérieur, dont on n'a que les terminus. */
export default function LineEditorTab() {
  const city = useCity()
  const { data: lines, error, loading } = useApi<LineSummary[]>(`/lines?city=${city.slug}`)
  const [query, setQuery] = useState('')
  const [slug, setSlug] = useState<string | null>(null)

  const words = normalize(query).split(/\s+/).filter(Boolean)
  const matching = (lines ?? []).filter((line) => words.every((w) => normalize(`${line.ref ?? ''} ${line.name}`).includes(w)))
  // Abidjan compte des centaines de lignes : on en montre 50, la recherche fait le reste
  const shown = matching.slice(0, MAX_SHOWN)

  return (
    <div className="line-editor">
      <div className="line-editor-pick">
        <label className="city-select">
          <span>Ville</span>
          <select
            value={city.slug}
            onChange={(e) => {
              setCity(e.target.value)
              setSlug(null)
            }}
          >
            {CITIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-search">
          <MagnifyingGlass aria-hidden="true" />
          <span className="visually-hidden">Chercher une ligne</span>
          <input type="search" placeholder="Numéro ou terminus" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {loading && <p className="muted">Chargement des lignes…</p>}
      {error && <p className="form-alert">{error}</p>}
      {lines && !lines.length && (
        <p className="muted">Aucune ligne à {city.name} pour l’instant : importez d’abord le fichier des lignes de l’intérieur.</p>
      )}

      {!slug && matching.length > MAX_SHOWN && (
        <p className="muted">
          {matching.length} lignes : les {MAX_SHOWN} premières sont affichées, cherchez par numéro ou par terminus.
        </p>
      )}

      {slug ? (
        <LineEditor key={slug} slug={slug} bounds={city.bounds} onBack={() => setSlug(null)} />
      ) : (
        <ul className="line-list">
          {shown.map((line) => (
            <li key={line.id}>
              <button type="button" className="line-row" onClick={() => setSlug(line.slug)}>
                <LineBadge refNumber={line.ref} type={line.type} size="sm" />
                <span className="line-row-name">{line.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function LineEditor({ slug, bounds, onBack }: { slug: string; bounds: [number, number, number, number]; onBack: () => void }) {
  const { data: line, error, loading, retry } = useApi<LineDetail>(`/lines/${encodeURIComponent(slug)}`)
  const [directionId, setDirectionId] = useState<number | null>(null)
  // Chaque enregistrement recharge la ligne et l'historique
  const [version, setVersion] = useState(0)
  const saved = () => {
    setVersion((v) => v + 1)
    retry()
  }

  if (loading) return <p className="muted">Chargement de la ligne…</p>
  if (error || !line) return <p className="form-alert">{error ?? 'Ligne introuvable.'}</p>

  const direction = line.directions.find((d) => d.id === directionId) ?? line.directions[0]
  const other = line.directions.find((d) => d.id !== direction.id)

  return (
    <div className="line-editor-body">
      <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
        ← Toutes les lignes
      </button>
      <header className="line-header">
        <LineBadge refNumber={line.ref} type={line.type} accent size="lg" />
        <h2 className="admin-section-title">{line.name}</h2>
      </header>
      <FareEditor key={`fare-${version}`} line={line} onSaved={saved} />
      {line.directions.length > 1 && (
        <div className="segmented" role="group" aria-label="Sens">
          {line.directions.map((d) => (
            <button
              key={d.id}
              type="button"
              className={d.id === direction.id ? 'is-selected' : ''}
              aria-pressed={d.id === direction.id}
              onClick={() => setDirectionId(d.id)}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}
      {/* Clé : changer de sens ou recharger repart des arrêts enregistrés */}
      <SchedulesEditor key={`horaires-${direction.id}-${version}`} direction={direction} onSaved={saved} />
      <StopsEditor key={`${direction.id}-${version}`} direction={direction} other={other} bounds={bounds} onSaved={saved} />
      <ChangesList lineId={line.id} version={version} />
    </div>
  )
}

function StopsEditor({
  direction,
  other,
  bounds,
  onSaved,
}: {
  direction: Direction
  other?: Direction
  bounds: [number, number, number, number]
  onSaved: () => void
}) {
  const navigate = useNavigate()
  const [stops, setStops] = useState<EditorStop[]>(() => direction.stops.map((s) => keyed(s)))
  const [selected, setSelected] = useState(-1)
  const [complete, setComplete] = useState(!direction.is_partial)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  function change(next: EditorStop[], select = selected) {
    setStops(next)
    setSelected(Math.min(select, next.length - 1))
    setDirty(true)
    setNotice(null)
  }

  function add(lat: number, lng: number) {
    // Inséré après l'arrêt sélectionné, sinon juste avant le terminus d'arrivée
    const at = selected >= 0 ? selected + 1 : Math.max(stops.length - 1, 0)
    const next = [...stops]
    next.splice(at, 0, keyed({ name: '', lat, lng }))
    change(next, at)
    window.setTimeout(() => document.getElementById(`arret-nom-${at}`)?.focus(), 0)
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= stops.length) return
    const next = [...stops]
    const [stop] = next.splice(from, 1)
    next.splice(to, 0, stop)
    change(next, to)
  }

  async function save() {
    setBusy(true)
    setNotice(null)
    try {
      const result = await adminSend(
        `/directions/${direction.id}/stops`,
        { stops: stops.map(({ id, name, lat, lng }) => ({ id, name, lat, lng })), complete },
        'PUT',
      )
      setNotice({ ok: result.ok, text: result.message })
      if (result.ok) {
        setDirty(false)
        onSaved()
      }
    } catch (e) {
      if (e instanceof Unauthorized) navigate('/connexion', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stops-editor">
      <p className="muted">
        Cliquez sur la carte pour ajouter un arrêt après celui qui est sélectionné, faites glisser un numéro pour le
        déplacer. Déplacer un arrêt le déplace pour toutes les lignes qui y passent.
      </p>

      <Suspense fallback={<div className="editor-map" />}>
        <EditorMap
          stops={stops}
          selected={selected}
          bounds={bounds}
          onAdd={add}
          onMove={(i, lat, lng) => change(stops.map((s, k) => (k === i ? { ...s, lat, lng } : s)), i)}
          onSelect={setSelected}
        />
      </Suspense>

      {stops.length === 0 && <p className="muted">Aucun arrêt : commencez par placer le terminus de départ.</p>}
      <ol className="editor-stops">
        {stops.map((stop, i) => (
          <li key={stop.key} className={i === selected ? 'is-selected' : ''} onClick={() => setSelected(i)}>
            <span className="stop-number">{String(i + 1).padStart(2, '0')}</span>
            <label className="visually-hidden" htmlFor={`arret-nom-${i}`}>
              Nom de l’arrêt {i + 1}
            </label>
            <input
              id={`arret-nom-${i}`}
              value={stop.name}
              placeholder="Nom de l’arrêt"
              onFocus={() => setSelected(i)}
              onChange={(e) => change(stops.map((s, k) => (k === i ? { ...s, name: e.target.value } : s)), i)}
            />
            <span className="editor-stop-actions">
              <button type="button" className="btn-icon" aria-label={`Monter l’arrêt ${i + 1}`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                <ArrowUp />
              </button>
              <button
                type="button"
                className="btn-icon"
                aria-label={`Descendre l’arrêt ${i + 1}`}
                disabled={i === stops.length - 1}
                onClick={() => move(i, i + 1)}
              >
                <ArrowDown />
              </button>
              <button
                type="button"
                className="btn-icon btn-danger"
                aria-label={`Retirer l’arrêt ${i + 1}`}
                onClick={() => change(stops.filter((_, k) => k !== i), i - 1)}
              >
                <Trash />
              </button>
            </span>
          </li>
        ))}
      </ol>

      <label className="editor-complete">
        <input type="checkbox" checked={complete} onChange={(e) => {
            setComplete(e.target.checked)
            setDirty(true)
          }} />
        Tous les arrêts de ce sens sont relevés (la fiche ligne n’affichera plus « terminus seulement »)
      </label>

      <div className="editor-actions">
        {other && other.stops.length > 1 && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (stops.length && !window.confirm('Remplacer les arrêts de ce sens par ceux de l’autre sens, dans l’ordre inverse ?')) return
              change([...other.stops].reverse().map((s) => keyed(s)), -1)
            }}
          >
            <ArrowsClockwise aria-hidden="true" />
            Reprendre l’autre sens, inversé
          </button>
        )}
        <button type="button" className="btn btn-primary" disabled={busy || !dirty} onClick={save}>
          <FloppyDisk aria-hidden="true" />
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      <div aria-live="polite">
        {notice && (
          <p className={notice.ok ? 'admin-notice' : 'form-alert'}>
            {notice.ok ? <Check size={20} aria-hidden="true" /> : <WarningCircle size={20} aria-hidden="true" />}
            {notice.text}
          </p>
        )}
      </div>
    </div>
  )
}
