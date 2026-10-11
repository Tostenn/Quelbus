import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { SignIn, WarningCircle } from '@phosphor-icons/react'
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
    const result = await login(email, password)
    setSending(false)
    if (result.ok) navigate('/admin', { replace: true })
    else setError(result.message)
  }

  return (
    <section className="section page-section">
      <div className="container login">
        <h1 className="page-title">Connexion</h1>
        <p className="muted">Accès réservé au tableau de bord de QuelBus.</p>
        <form className="form-card login-form" onSubmit={submit}>
          {error && (
            <p className="form-alert" role="alert">
              <WarningCircle size={20} aria-hidden="true" /> {error}
            </p>
          )}
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="login-password">Mot de passe</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={sending}>
            <SignIn />
            {sending ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </section>
  )
}
