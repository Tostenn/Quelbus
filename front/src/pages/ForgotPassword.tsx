import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { ArrowLeft, EnvelopeSimple, PaperPlaneTilt, WarningCircle } from '@phosphor-icons/react'
import AuthCard from '../components/AuthCard'
import { forgotPassword } from '../lib/admin'
import { usePageMeta } from '../lib/usePageMeta'

export default function ForgotPassword() {
  usePageMeta('Mot de passe oublié | QuelBus')
  const location = useLocation()
  const [email, setEmail] = useState<string>((location.state as { email?: string } | null)?.email ?? '')
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSending(true)
    setError('')
    const result = await forgotPassword(email)
    setSending(false)
    if (result.ok) setSent(result.message)
    else setError(result.message)
  }

  if (sent) {
    return (
      <AuthCard title="Vérifiez vos emails">
        <div className="auth-done">
          <EnvelopeSimple size={28} aria-hidden="true" />
          <p>{sent}</p>
        </div>
        <Link className="btn btn-ghost btn-block" to="/connexion">
          <ArrowLeft aria-hidden="true" />
          Retour à la connexion
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Mot de passe oublié" intro="Indiquez votre email : vous recevrez un lien pour choisir un nouveau mot de passe.">
      <form className="auth-form" onSubmit={submit}>
        {error && (
          <p className="form-alert" role="alert">
            <WarningCircle size={20} aria-hidden="true" /> {error}
          </p>
        )}
        <div className="field">
          <label htmlFor="forgot-email">Email</label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={sending}>
          <PaperPlaneTilt aria-hidden="true" />
          {sending ? 'Envoi…' : 'Recevoir le lien'}
        </button>
        <Link className="auth-link" to="/connexion">
          Retour à la connexion
        </Link>
      </form>
    </AuthCard>
  )
}
