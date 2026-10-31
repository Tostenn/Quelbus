import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { CheckCircle, Flag, WarningCircle, X } from '@phosphor-icons/react'
import { REPORT_KINDS, submitReport, type ReportPayload } from '../lib/api'

type Props = { lineId?: number; stopId?: number }

const EMPTY = { kind: '' as ReportPayload['kind'], message: '', email: '', website: '' }

// Fenêtre de signalement : s'ouvre par le bas sur mobile, au centre sur grand écran.
export default function ReportForm({ lineId, stopId }: Props) {
  const { pathname, search } = useLocation()
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [alert, setAlert] = useState('')

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  function close() {
    setOpen(false)
    // Après un envoi réussi, on repart d'un formulaire vide.
    if (status === 'sent') {
      setForm(EMPTY)
      setStatus('idle')
      setAlert('')
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setStatus('sending')
    const result = await submitReport({ ...form, page: pathname + search, line_id: lineId, stop_id: stopId })
    if (result.ok) {
      setErrors({})
      setAlert(result.message)
      setStatus('sent')
    } else {
      setErrors(result.errors)
      setAlert(result.message)
      setStatus('idle')
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm report-toggle" onClick={() => setOpen(true)}>
        <Flag />
        Signaler une erreur
      </button>

      <dialog
        ref={dialog}
        className="report-sheet"
        aria-labelledby="report-title"
        onClose={close}
        onClick={(e) => e.target === e.currentTarget && close()}
      >
        <span className="sheet-handle" aria-hidden="true" />
        <button type="button" className="sheet-close" aria-label="Fermer" onClick={close}>
          <X size={22} />
        </button>

        {status === 'sent' ? (
          <div className="report-done" role="status">
            <CheckCircle size={72} weight="fill" aria-hidden="true" />
            <h2 id="report-title">Merci&nbsp;! On corrige.</h2>
            <p>{alert}</p>
            <button type="button" className="btn btn-primary" onClick={close}>
              Fermer
            </button>
          </div>
        ) : (
          <form className="report-form" onSubmit={submit} noValidate>
            <h2 id="report-title">Signaler une erreur</h2>
            {alert && (
              <p className="form-alert" role="alert">
                <WarningCircle size={20} aria-hidden="true" /> {alert}
              </p>
            )}

            <fieldset className="report-kinds" aria-invalid={errors.kind ? true : undefined}>
              <legend>Qu’est-ce qui ne va pas&nbsp;?</legend>
              {Object.entries(REPORT_KINDS).map(([value, label]) => (
                <label key={value} className="report-kind">
                  <input
                    type="radio"
                    name="report-kind"
                    value={value}
                    checked={form.kind === value}
                    onChange={() => setForm({ ...form, kind: value as ReportPayload['kind'] })}
                  />
                  <span>{label}</span>
                </label>
              ))}
              {errors.kind && <p className="field-error">{errors.kind}</p>}
            </fieldset>

            <div className="field">
              <label htmlFor="report-message">Détails</label>
              <textarea
                id="report-message"
                rows={3}
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

            <button type="submit" className="btn btn-primary" disabled={status === 'sending'}>
              {status === 'sending' ? 'Envoi…' : 'Envoyer'}
            </button>
          </form>
        )}
      </dialog>
    </>
  )
}
