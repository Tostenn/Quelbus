import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Check, WarningCircle } from '@phosphor-icons/react'
import AuthCard, { PasswordField } from '../components/AuthCard'
import { login, resetPassword } from '../lib/admin'
import { usePageMeta } from '../lib/usePageMeta'

const MIN_LENGTH = 12

/** Nouveau mot de passe : depuis le lien « mot de passe oublié » ou une invitation d'admin. */
export default function ResetPassword() {
  const [query] = useSearchParams()
  const token = query.get('token') ?? ''
  const email = query.get('email') ?? ''
  const invitation = query.get('invitation') === '1'
  usePageMeta(invitation ? 'Activer mon accès | QuelBus' : 'Nouveau mot de passe | QuelBus')

  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirmation?: string }>({})
  const [alert, setAlert] = useState('')
  const [expired, setExpired] = useState(false)
  const [sending, setSending] = useState(false)

  if (!token || !email) {
    return (
      <AuthCard title="Lien incomplet" intro="Ce lien ne contient pas toutes les informations. Ouvrez-le à nouveau depuis l’email, ou demandez-en un nouveau.">
        <Link className="btn btn-primary btn-block" to="/mot-de-passe-oublie">
          Recevoir un nouveau lien
        </Link>
      </AuthCard>
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const next = {
      password: password.length < MIN_LENGTH ? `Au moins ${MIN_LENGTH} caractères.` : undefined,
      confirmation: confirmation !== password ? 'Les deux mots de passe ne correspondent pas.' : undefined,
    }
    setErrors(next)
    setAlert('')
    if (next.password || next.confirmation) return

    setSending(true)
    const result = await resetPassword({ token, email, password, password_confirmation: confirmation, invitation })
    if (!result.ok) {
      setSending(false)
      setExpired('token' in result.errors)
      setAlert(result.message)
      return
    }
    // Mot de passe enregistré : connexion directe
    const session = await login(email, password)
    navigate(session.ok ? '/admin' : '/connexion', { replace: true })
  }

  return (
    <AuthCard
      title={invitation ? 'Activez votre accès' : 'Nouveau mot de passe'}
      intro={
        invitation ? (
          <>
            Choisissez le mot de passe du compte <strong>{email}</strong>.
          </>
        ) : (
          <>
            Pour le compte <strong>{email}</strong>. Vos autres sessions seront déconnectées.
          </>
        )
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        {alert && (
          <div className="form-alert" role="alert">
            <WarningCircle size={20} aria-hidden="true" />
            <span>
              {alert}
              {expired && (
                <>
                  {' '}
                  <Link to="/mot-de-passe-oublie" state={{ email }}>
                    Recevoir un nouveau lien
                  </Link>
                </>
              )}
            </span>
          </div>
        )}
        <PasswordField
          label="Mot de passe"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          hint={`${MIN_LENGTH} caractères minimum. Une phrase facile à retenir fonctionne bien.`}
          error={errors.password}
        />
        <PasswordField
          label="Confirmez le mot de passe"
          autoComplete="new-password"
          value={confirmation}
          onChange={setConfirmation}
          error={errors.confirmation}
        />
        <button type="submit" className="btn btn-primary btn-block" disabled={sending}>
          <Check aria-hidden="true" />
          {sending ? 'Enregistrement…' : invitation ? 'Activer mon accès' : 'Enregistrer et me connecter'}
        </button>
      </form>
    </AuthCard>
  )
}
