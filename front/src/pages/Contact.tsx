import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  Bus,
  Check,
  CircleNotch,
  Code,
  PaperPlaneTilt,
  UsersThree,
  WarningCircle,
  type Icon,
} from '@phosphor-icons/react'
import { submitSubscriber, type FieldErrors, type Profile, type SubscriberPayload } from '../lib/api'

const profiles: { value: Profile; icon: Icon; title: string; text: string }[] = [
  { value: 'utilisateur', icon: Bus, title: 'Je veux utiliser QuelBus', text: 'Prévenez-moi quand l’application est prête.' },
  { value: 'contributeur', icon: Code, title: 'Je veux contribuer', text: 'Code, design, données, tests sur le terrain…' },
  { value: 'les_deux', icon: UsersThree, title: 'Les deux', text: 'Je veux l’utiliser et donner un coup de main.' },
]

const messagePlaceholders: Record<Profile, string> = {
  utilisateur: 'Ex. : je vais souvent d’Abobo au Plateau, j’aimerais savoir quelle ligne prendre.',
  contributeur: 'Ex. : je suis développeur React, ou je connais bien les lignes de Yopougon.',
  les_deux: 'Ex. : je prends la 81 tous les jours et je peux aider à vérifier les arrêts.',
}

function initialProfile(value: string | null): Profile {
  return profiles.some((p) => p.value === value) ? (value as Profile) : 'utilisateur'
}

export default function Contact() {
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState<SubscriberPayload>({
    first_name: '',
    last_name: '',
    email: '',
    profile: initialProfile(searchParams.get('profil')),
    message: '',
    website: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [feedback, setFeedback] = useState('')

  function update<K extends keyof SubscriberPayload>(field: K, value: SubscriberPayload[K]) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('sending')
    const result = await submitSubscriber(form)
    setFeedback(result.message)
    if (result.ok) {
      setStatus('done')
    } else {
      setErrors(result.errors)
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <section className="section">
        <div className="container narrow">
          <div className="success" role="status">
            <span className="success-mark" aria-hidden="true">
              <Check size={30} />
            </span>
            <h1>C’est noté, {form.first_name}&nbsp;!</h1>
            <p className="lead">{feedback}</p>
            {form.profile !== 'utilisateur' && (
              <p>
                Merci de vouloir contribuer. On revient vers vous à <strong>{form.email}</strong> avec les premières
                pistes pour mettre la main à la pâte.
              </p>
            )}
            <p>Le meilleur coup de pouce&nbsp;: partagez QuelBus autour de vous.</p>
            <Link className="btn btn-dark" to="/">
              Retour à l’accueil
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const fieldProps = (field: 'first_name' | 'last_name' | 'email') => ({
    id: field,
    name: field,
    value: form[field],
    onChange: (e: ChangeEvent<HTMLInputElement>) => update(field, e.target.value),
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `${field}-error` : undefined,
  })

  return (
    <section className="section">
      <div className="container contact-grid">
        <div className="contact-intro">
          <p className="eyebrow">Rejoindre QuelBus</p>
          <h1>Soyez prévenu du lancement, ou aidez-nous à le construire.</h1>
          <p className="lead">
            QuelBus est un projet open source, en cours de construction. Laissez vos coordonnées&nbsp;: on vous écrit
            quand la plateforme est en ligne.
          </p>
          <ul className="check-list">
            <li>Un email au lancement, pas de spam</li>
            <li>Vos données ne sont ni vendues ni partagées</li>
            <li>Un simple message pour être retiré de la liste</li>
          </ul>
        </div>

        <form className="form-card" onSubmit={handleSubmit} noValidate>
          <fieldset className="profile-choice">
            <legend>Comment souhaitez-vous participer&nbsp;?</legend>
            {profiles.map((p) => (
              <label key={p.value} className={`profile-option${form.profile === p.value ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="profile"
                  value={p.value}
                  checked={form.profile === p.value}
                  onChange={() => update('profile', p.value)}
                />
                <span className="profile-body">
                  <span className="profile-title">{p.title}</span>
                  <span className="profile-text">{p.text}</span>
                </span>
                <p.icon size={26} className="profile-icon" aria-hidden="true" />
              </label>
            ))}
            {errors.profile && <p className="field-error">{errors.profile}</p>}
          </fieldset>

          <div className="form-row">
            <div className="field">
              <label htmlFor="first_name">Prénom</label>
              <input {...fieldProps('first_name')} type="text" autoComplete="given-name" required maxLength={100} />
              {errors.first_name && (
                <p className="field-error" id="first_name-error">
                  {errors.first_name}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="last_name">Nom</label>
              <input {...fieldProps('last_name')} type="text" autoComplete="family-name" required maxLength={100} />
              {errors.last_name && (
                <p className="field-error" id="last_name-error">
                  {errors.last_name}
                </p>
              )}
            </div>
          </div>

          <div className="field">
            <label htmlFor="email">Adresse email</label>
            <input {...fieldProps('email')} type="email" autoComplete="email" inputMode="email" required />
            {errors.email && (
              <p className="field-error" id="email-error">
                {errors.email}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="message">
              Un mot pour nous <span className="optional">(facultatif)</span>
            </label>
            <textarea
              id="message"
              name="message"
              rows={4}
              maxLength={2000}
              value={form.message}
              placeholder={messagePlaceholders[form.profile]}
              onChange={(e) => update('message', e.target.value)}
            />
            {errors.message && <p className="field-error">{errors.message}</p>}
          </div>

          {/* Champ piège pour les robots, invisible pour les humains. */}
          <div className="honeypot" aria-hidden="true">
            <label htmlFor="website">Site web</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => update('website', e.target.value)}
            />
          </div>

          {status === 'error' && feedback && (
            <p className="form-alert" role="alert">
              <WarningCircle size={22} aria-hidden="true" />
              {feedback}
            </p>
          )}

          <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? (
              <>
                <CircleNotch className="spin" aria-hidden="true" />
                Envoi…
              </>
            ) : (
              <>
                <PaperPlaneTilt aria-hidden="true" />
                Je m’inscris
              </>
            )}
          </button>
          <p className="form-note">
            En vous inscrivant, vous acceptez d’être contacté par email au sujet de QuelBus. Rien d’autre.
          </p>
        </form>
      </div>
    </section>
  )
}
