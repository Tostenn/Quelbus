import { useId, useState, type ReactNode } from 'react'
import { Eye, EyeSlash } from '@phosphor-icons/react'

/** Cadre commun des pages d'accès au tableau de bord : connexion, oubli, nouveau mot de passe. */
export default function AuthCard({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className="section auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{title}</h1>
        {intro && <p className="auth-intro">{intro}</p>}
        {children}
      </div>
    </section>
  )
}

type PasswordFieldProps = {
  label: ReactNode
  value: string
  onChange: (value: string) => void
  autoComplete: 'current-password' | 'new-password'
  hint?: string
  error?: string
}

export function PasswordField({ label, value, onChange, autoComplete, hint, error }: PasswordFieldProps) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={visible}
        >
          {visible ? <EyeSlash size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  )
}
