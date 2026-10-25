import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { SignIn, WarningCircle } from '@phosphor-icons/react'
import AuthCard, { PasswordField } from '../components/AuthCard'
import { getToken, login } from '../lib/admin'
import { usePageMeta } from '../lib/usePageMeta'

export default function Login() {
  usePageMeta('Connexion | QuelBus')
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  if (getToken()) return <Navigate to="/admin" replace />

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSending(true)
    setError('')
    const result = await login(email, password)
    setSending(false)
    if (result.ok) navigate('/admin', { replace: true })
    else setError(result.message)
  }

  return (
    <AuthCard title="Tableau de bord" intro="Connectez-vous avec votre compte d’équipe.">
      <form className="auth-form" onSubmit={submit}>
        {error && (
          <p className="form-alert" role="alert">
            <WarningCircle size={20} aria-hidden="true" /> {error}
          </p>
        )}
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <PasswordField label="Mot de passe" autoComplete="current-password" value={password} onChange={setPassword} />
        <button type="submit" className="btn btn-primary btn-block" disabled={sending}>
          <SignIn aria-hidden="true" />
          {sending ? 'Connexion…' : 'Se connecter'}
        </button>
        <Link className="auth-link" to="/mot-de-passe-oublie" state={{ email }}>
          Mot de passe oublié&nbsp;?
        </Link>
      </form>
    </AuthCard>
  )
}
