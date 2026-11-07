import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, FloppyDisk, Plus, Trash, WarningCircle } from '@phosphor-icons/react'
import type { LineDetail } from '../lib/api'
import { adminSend, Unauthorized } from '../lib/admin'
import { DAY_LABELS, fareLabel, type DayType, type Schedule } from '../lib/fares'
import { useAdmin } from '../lib/useAdmin'

const FARE_TYPES = ['MONBUS', 'URBAIN', 'MARCHE', 'WIBUS', 'EXPRESS', 'NAVETTE', 'MONBATO']
const DAY_TYPES = Object.keys(DAY_LABELS) as DayType[]

type Notice = { ok: boolean; text: string } | null

/** Envoi d'un formulaire du tableau de bord, avec message de retour et session expirée gérée. */
function useSave() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function save(path: string, body: object, onDone: () => void) {
    setBusy(true)
    setNotice(null)
    setErrors({})
    try {
      const result = await adminSend(path, body, 'PUT')
      setNotice({ ok: result.ok, text: result.message })
      if (result.ok) onDone()
      else setErrors(result.errors)
    } catch (e) {
      if (e instanceof Unauthorized) navigate('/connexion', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return { busy, notice, errors, save }
}

function NoticeLine({ notice }: { notice: Notice }) {
  return (
    <div aria-live="polite">
      {notice && (
        <p className={notice.ok ? 'admin-notice' : 'form-alert'}>
          {notice.ok ? <Check size={20} aria-hidden="true" /> : <WarningCircle size={20} aria-hidden="true" />}
          {notice.text}
        </p>
      )}
    </div>
  )
}

/** Tarif, type de tarif et carte étudiant d'une ligne. */
export function FareEditor({ line, onSaved }: { line: LineDetail; onSaved: () => void }) {
  const [fare, setFare] = useState(line.fare === null ? '' : String(line.fare))
  const [fareType, setFareType] = useState(line.fare_type ?? '')
  const [student, setStudent] = useState(line.accepts_student_card === null ? '' : line.accepts_student_card ? 'oui' : 'non')
  const { busy, notice, errors, save } = useSave()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    save(
      `/lines/${line.id}/fare`,
      {
        fare: fare === '' ? null : Number(fare),
        fare_type: fareType || null,
        accepts_student_card: student === '' ? null : student === 'oui',
      },
      onSaved,
    )
  }

  return (
    <form className="admin-card fare-editor" onSubmit={submit} noValidate>
      <h3 className="admin-section-title">Tarif</h3>
      <div className="fare-editor-fields">
        <div className="field">
          <label htmlFor="tarif">Prix du trajet (F CFA)</label>
          <input
            id="tarif"
            inputMode="numeric"
            value={fare}
            placeholder="200"
            onChange={(e) => setFare(e.target.value.replace(/\D/g, ''))}
            aria-invalid={errors.fare ? true : undefined}
          />
          {errors.fare && <p className="field-error">{errors.fare}</p>}
        </div>
        <div className="field">
          <label htmlFor="type-tarif">Type</label>
          <select id="type-tarif" value={fareType} onChange={(e) => setFareType(e.target.value)}>
            <option value="">Non précisé</option>
            {FARE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="carte-etudiant">Carte étudiant</label>
          <select id="carte-etudiant" value={student} onChange={(e) => setStudent(e.target.value)}>
            <option value="">On ne sait pas</option>
            <option value="oui">Acceptée</option>
            <option value="non">Non acceptée</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          <FloppyDisk aria-hidden="true" />
          {busy ? 'Enregistrement…' : 'Enregistrer le tarif'}
        </button>
      </div>
      <NoticeLine notice={notice} />
    </form>
  )
}

type Row = Pick<Schedule, 'day_type' | 'first_departure' | 'last_departure'> & { source: string }

/** Premier et dernier départ d'un sens, par type de jour. */
export function SchedulesEditor({ direction, onSaved }: { direction: LineDetail['directions'][number]; onSaved: () => void }) {
  const [rows, setRows] = useState<Row[]>(() =>
    direction.schedules.map((s) => ({ ...s, source: s.source ?? '' })),
  )
  const { busy, notice, errors, save } = useSave()
  const free = DAY_TYPES.filter((d) => !rows.some((r) => r.day_type === d))
  const update = (i: number, patch: Partial<Row>) => setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)))

  return (
    <div className="admin-card">
      <h3 className="admin-section-title">Horaires · {direction.name}</h3>
      <p className="muted">Premier et dernier départ au terminus. Un seul horaire par type de jour.</p>
      {rows.length === 0 && <p className="muted">Aucun horaire pour ce sens.</p>}
      <ul className="schedule-rows">
        {rows.map((row, i) => (
          <li key={row.day_type}>
            <select aria-label="Jours" value={row.day_type} onChange={(e) => update(i, { day_type: e.target.value as DayType })}>
              {[row.day_type, ...free].map((d) => (
                <option key={d} value={d}>
                  {DAY_LABELS[d]}
                </option>
              ))}
            </select>
            <input type="time" aria-label="Premier départ" value={row.first_departure} onChange={(e) => update(i, { first_departure: e.target.value })} />
            <input type="time" aria-label="Dernier départ" value={row.last_departure} onChange={(e) => update(i, { last_departure: e.target.value })} />
            <input aria-label="Source" placeholder="Source : affiche, chauffeur…" value={row.source} onChange={(e) => update(i, { source: e.target.value })} />
            <button type="button" className="btn-icon btn-danger" aria-label={`Retirer l’horaire ${DAY_LABELS[row.day_type]}`} onClick={() => setRows(rows.filter((_, k) => k !== i))}>
              <Trash />
            </button>
            {(errors[`schedules.${i}.first_departure`] || errors[`schedules.${i}.last_departure`] || errors[`schedules.${i}.day_type`]) && (
              <p className="field-error">
                {errors[`schedules.${i}.first_departure`] ?? errors[`schedules.${i}.last_departure`] ?? errors[`schedules.${i}.day_type`]}
              </p>
            )}
          </li>
        ))}
      </ul>
      <div className="editor-actions">
        {free.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setRows([...rows, { day_type: free[0], first_departure: '05:30', last_departure: '21:00', source: '' }])}
          >
            <Plus aria-hidden="true" />
            Ajouter un horaire
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => save(`/directions/${direction.id}/schedules`, { schedules: rows.map((r) => ({ ...r, source: r.source || null })) }, onSaved)}
        >
          <FloppyDisk aria-hidden="true" />
          {busy ? 'Enregistrement…' : 'Enregistrer les horaires'}
        </button>
      </div>
      <NoticeLine notice={notice} />
    </div>
  )
}

type Change = {
  id: number
  field: 'fare' | 'schedules' | 'stops'
  direction: string | null
  user: string | null
  before: unknown
  after: unknown
  created_at: string
}

function describe(change: Change): string {
  if (change.field === 'fare') {
    const fare = (v: unknown) => {
      const f = (v as { fare: number | null } | null)?.fare
      return f == null ? '?' : fareLabel(f)
    }
    return `Tarif : ${fare(change.before)} → ${fare(change.after)}`
  }
  const count = (v: unknown) => (Array.isArray(v) ? v.length : 0)
  if (change.field === 'schedules') return `Horaires de ${change.direction} (${count(change.after)} type${count(change.after) > 1 ? 's' : ''} de jour)`
  return `Arrêts de ${change.direction} : ${count(change.before)} → ${count(change.after)}`
}

/** Qui a modifié quoi sur cette ligne. */
export function ChangesList({ lineId, version }: { lineId: number; version: number }) {
  const { data } = useAdmin<{ data: Change[] }>(`/lines/${lineId}/changes`, version)
  if (!data?.data.length) return null
  return (
    <div className="admin-card">
      <h3 className="admin-section-title">Historique</h3>
      <ul className="change-list">
        {data.data.map((c) => (
          <li key={c.id}>
            <span>{describe(c)}</span>
            <span className="muted">
              {c.user ?? 'Commande ou compte supprimé'} · {new Date(c.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
