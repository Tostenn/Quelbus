import { useState } from 'react'
import { useLocation } from 'react-router'
import { CheckCircle, Flag, WarningCircle } from '@phosphor-icons/react'
import { REPORT_KINDS, submitReport, type ReportPayload } from '../lib/api'

type Props = { lineId?: number; stopId?: number }

export default function ReportForm({ lineId, stopId }: Props) {
  const { pathname, search } = useLocation()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ kind: '' as ReportPayload['kind'], message: '', email: '', website: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [alert, setAlert] = useState('')

  if (status === 'sent') {
    return (
      <div className="notice report-done" role="status">
        <CheckCircle size={24} aria-hidden="true" />
        <p>{alert}</p>
      </div>
    )
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost btn-sm report-toggle" onClick={() => setOpen(true)}>
        <Flag />
        Signaler une erreur
      </button>
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setStatus('sending')
    const result = await submitReport({ ...form, page: pathname + search, line_id: lineId, stop_id: stopId })
    if (result.ok) {
      setAlert(result.message)
      setStatus('sent')
    } else {
      setErrors(result.errors)
      setAlert(result.message)
      setStatus('idle')
    }
  }

  return (
    <form className="report-form" onSubmit={submit} noValidate>
      <h2 className="section-title">Signaler une erreur</h2>
      {alert && (
        <p className="form-alert" role="alert">
          <WarningCircle size={20} aria-hidden="true" /> {alert}
        </p>
      )}
      <div className="field">
        <label htmlFor="report-kind">Qu’est-ce qui ne va pas&nbsp;?</label>
        <select
          id="report-kind"
          value={form.kind}
          aria-invalid={errors.kind ? true : undefined}
          onChange={(e) => setForm({ ...form, kind: e.target.value as ReportPayload['kind'] })}
        >
          <option value="">Choisir…</option>
          {Object.entries(REPORT_KINDS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {errors.kind && <p className="field-error">{errors.kind}</p>}
      </div>
      <div className="field">
        <label htmlFor="report-message">Détails</label>
        <textarea
          id="report-message"
          rows={4}
          placeholder="Ex. : l’arrêt Mosquée Adjamé est de l’autre côté de la route."
          value={form.message}
          aria-invalid={errors.message ? true : undefined}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
        {errors.message && <p className="field-error">{errors.message}</p>}
      </div>
      <div className="field">
        <label htmlFor="report-email">
          Email <span className="optional">(facultatif, pour vous répondre)</span>
        </label>
        <input
          id="report-email"
          type="email"
          autoComplete="email"
          value={form.email}
          aria-invalid={errors.email ? true : undefined}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        {errors.email && <p className="field-error">{errors.email}</p>}
      </div>
      <input
        className="honeypot"
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={form.website}
        onChange={(e) => setForm({ ...form, website: e.target.value })}
      />
      <div className="report-actions">
        <button type="submit" className="btn btn-primary" disabled={status === 'sending'}>
          {status === 'sending' ? 'Envoi…' : 'Envoyer'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </form>
  )
}
