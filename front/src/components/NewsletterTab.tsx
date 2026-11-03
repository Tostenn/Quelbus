import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowCounterClockwise, Check, EnvelopeSimple, PaperPlaneTilt, WarningCircle } from '@phosphor-icons/react'
import { adminSend, Unauthorized, type NewsletterAudience, type NewslettersPage } from '../lib/admin'
import { useAdmin } from '../lib/useAdmin'

type Draft = { subject: string; body: string; audience: NewsletterAudience }

const DRAFT_KEY = 'quelbus-newsletter-draft'
const EMPTY: Draft = {
  subject: '',
  body: '# Bonjour {prenom},\n\nVoici les nouveautés de QuelBus :\n\n- …\n\nÀ très vite,  \nL’équipe QuelBus',
  audience: 'tous',
}

// Brouillon gardé dans ce navigateur : rien n'est perdu si on recharge la page
function loadDraft(): Draft {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')
    if (saved && typeof saved.subject === 'string' && typeof saved.body === 'string') return { ...EMPTY, ...saved }
  } catch {
    // stockage indisponible
  }
  return EMPTY
}

function saveDraft(draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    // stockage indisponible
  }
}

const date = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function NewsletterTab() {
  const navigate = useNavigate()
  const [version, setVersion] = useState(0)
  const { data, error, loading } = useAdmin<NewslettersPage>('/newsletters', version)
  const [draft, setDraft] = useState<Draft>(loadDraft)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState<'test' | 'send' | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    saveDraft(next)
  }

  // Aperçu rendu par le serveur (même gabarit que l'email envoyé), mis à jour après une pause de frappe
  useEffect(() => {
    if (!draft.subject.trim() || !draft.body.trim()) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const result = await adminSend('/newsletters/preview', { subject: draft.subject, body: draft.body })
        if (!cancelled && result.ok) setPreview((result.data as { html: string }).html)
      } catch (e) {
        if (e instanceof Unauthorized) navigate('/connexion', { replace: true })
      }
    }, 600)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [draft.subject, draft.body, navigate])

  const audience = data?.audiences.find((a) => a.value === draft.audience)
  const count = audience?.count ?? 0

  async function run(kind: 'test' | 'send', path: string, body: object) {
    setBusy(kind)
    setNotice(null)
    setErrors({})
    try {
      const result = await adminSend(path, body)
      setNotice({ ok: result.ok, text: result.message })
      if (!result.ok) setErrors(result.errors)
      return result.ok
    } catch (e) {
      if (e instanceof Unauthorized) navigate('/connexion', { replace: true })
      return false
    } finally {
      setBusy(null)
    }
  }

  function sendTest() {
    run('test', '/newsletters/test', { subject: draft.subject, body: draft.body })
  }

  async function send(event: React.FormEvent) {
    event.preventDefault()
    const who = audience ? `${audience.label.toLowerCase()} (${count} personne${count > 1 ? 's' : ''})` : 'les inscrits'
    if (!window.confirm(`Envoyer « ${draft.subject} » à ${who} ? L’envoi ne peut pas être annulé.`)) return
    if (await run('send', '/newsletters', draft)) {
      setDraft(EMPTY)
      saveDraft(null)
      setPreview(null)
      setVersion((v) => v + 1)
    }
  }

  return (
    <div className="newsletter">
      <form className="admin-invite newsletter-form" onSubmit={send} noValidate>
        <h2 className="admin-section-title">Écrire une newsletter</h2>
        <p className="muted">
          Envoyée à chaque inscrit, avec son prénom, le lien du groupe WhatsApp et un lien de désinscription.
          {data && data.unsubscribed > 0 && ` ${data.unsubscribed} personne${data.unsubscribed > 1 ? 's se sont désinscrites' : ' s’est désinscrite'} et ne la recevront pas.`}
        </p>

        <div className="field">
          <label htmlFor="nl-subject">Objet</label>
          <input
            id="nl-subject"
            maxLength={150}
            value={draft.subject}
            onChange={(e) => update({ subject: e.target.value })}
            placeholder="Ex. : Les correspondances arrivent sur QuelBus"
            aria-invalid={errors.subject ? true : undefined}
            aria-describedby={errors.subject ? 'nl-subject-error' : undefined}
          />
          {errors.subject && (
            <p id="nl-subject-error" className="field-error">
              {errors.subject}
            </p>
          )}
        </div>

        <fieldset className="newsletter-audience">
          <legend>Destinataires</legend>
          {(data?.audiences ?? []).map((a) => (
            <label key={a.value} className={`profile-option${draft.audience === a.value ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="nl-audience"
                value={a.value}
                checked={draft.audience === a.value}
                onChange={() => update({ audience: a.value })}
              />
              <span className="profile-body">
                <span className="profile-title">{a.label}</span>
                <span className="profile-text">
                  {a.count} inscrit{a.count > 1 ? 's' : ''}
                </span>
              </span>
            </label>
          ))}
          {loading && !data && <p className="muted">Chargement…</p>}
          {errors.audience && <p className="field-error">{errors.audience}</p>}
        </fieldset>

        <div className="newsletter-editor">
          <div className="field">
            <label htmlFor="nl-body">Contenu (Markdown)</label>
            <textarea
              id="nl-body"
              rows={16}
              value={draft.body}
              onChange={(e) => update({ body: e.target.value })}
              aria-invalid={errors.body ? true : undefined}
              aria-describedby="nl-body-hint"
            />
            <p id="nl-body-hint" className="field-hint">
              <code># Titre</code> · <code>**gras**</code> · <code>[texte](https://lien)</code> · <code>- liste</code> ·{' '}
              <code>{'{prenom}'}</code> devient le prénom de chaque inscrit.
            </p>
            {errors.body && <p className="field-error">{errors.body}</p>}
          </div>

          <div className="newsletter-preview">
            <span className="field-label">Aperçu</span>
            {preview ? (
              <iframe title="Aperçu de la newsletter" srcDoc={preview} sandbox="" />
            ) : (
              <p className="muted newsletter-preview-empty">L’aperçu s’affiche dès que l’objet et le contenu sont remplis.</p>
            )}
          </div>
        </div>

        <div aria-live="polite">
          {notice && (
            <p className={notice.ok ? 'admin-notice' : 'form-alert'}>
              {notice.ok ? <Check size={20} aria-hidden="true" /> : <WarningCircle size={20} aria-hidden="true" />}
              {notice.text}
            </p>
          )}
        </div>

        <div className="newsletter-actions">
          <button type="button" className="btn btn-ghost" disabled={busy !== null} onClick={sendTest}>
            <EnvelopeSimple aria-hidden="true" />
            {busy === 'test' ? 'Envoi…' : 'M’envoyer un test'}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy !== null || count === 0}>
            <PaperPlaneTilt aria-hidden="true" />
            {busy === 'send' ? 'Envoi…' : `Envoyer à ${count} inscrit${count > 1 ? 's' : ''}`}
          </button>
        </div>
      </form>

      <h2 className="admin-section-title">Newsletters envoyées</h2>
      {error && <p className="form-alert">{error}</p>}
      {data && !data.data.length && <p className="muted">Aucune newsletter envoyée pour l’instant.</p>}
      {data && data.data.length > 0 && (
        <ul className="admin-list">
          {data.data.map((n) => (
            <li key={n.id} className="admin-item">
              <div className="admin-item-head">
                <strong>{n.subject}</strong>
                <span className="muted">{date(n.created_at)}</span>
              </div>
              <p className="muted">
                {n.audience_label} · {n.recipients} destinataire{n.recipients > 1 ? 's' : ''}
                {n.sent_by && ` · par ${n.sent_by}`}
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  update({ subject: n.subject, body: n.body, audience: n.audience })
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                <ArrowCounterClockwise aria-hidden="true" />
                Reprendre ce contenu
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
