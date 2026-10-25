import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Bug, Code, Heart, LockSimple, ShareNetwork, WarningCircle } from '@phosphor-icons/react'
import { startDonation } from '../lib/api'
import { DONATIONS_ENABLED } from '../lib/config'
import { usePageMeta } from '../lib/usePageMeta'

const amounts = [
  { value: 500, label: 'Un garba' },
  { value: 1000, label: 'Un aller-retour en gbaka' },
  { value: 2000, label: 'Une ligne vérifiée' },
  { value: 5000, label: 'Un vrai coup de pouce' },
]

const MIN = 200

export default function Support() {
  usePageMeta(
    'Soutenir QuelBus : offrez un garba à l’équipe | QuelBus',
    'QuelBus est gratuit et sans publicité. Un don par Mobile Money (Wave, Orange, MTN) ou carte aide à payer le serveur, les cartes et le temps passé à vérifier les lignes.',
  )
  // Une seule sélection : un montant proposé, ou « autre » avec le champ libre
  const [choice, setChoice] = useState<number | 'autre'>(1000)
  const [custom, setCustom] = useState('')
  const [form, setForm] = useState({ name: '', email: '', message: '', website: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [alert, setAlert] = useState('')
  const [sending, setSending] = useState(false)

  const value = choice === 'autre' ? Number(custom) : choice

  function choose(next: number | 'autre') {
    setChoice(next)
    setErrors({})
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!Number.isInteger(value) || value < MIN) {
      setErrors({ amount: `Le don minimum est de ${MIN} F.` })
      return
    }
    setSending(true)
    setAlert('')
    const result = await startDonation({ ...form, amount: value })
    if (result.ok) {
      window.location.assign(result.url)
      return
    }
    setSending(false)
    setErrors(result.errors)
    setAlert(result.message)
  }

  return (
    <section className="section page-section">
      <div className="container narrow">
        <h1 className="page-title">Offrez un garba à l’équipe</h1>
        <p className="lead">
          QuelBus est gratuit, sans publicité et le restera. Si l’appli vous a évité de rater votre bus, un petit don
          aide à la faire tourner.
        </p>

        {!DONATIONS_ENABLED && (
          <div className="notice donate-soon">
            <Heart size={24} aria-hidden="true" />
            <p>Les dons ouvrent très prochainement. En attendant, les autres coups de main ci-dessous comptent tout autant.</p>
          </div>
        )}

        {DONATIONS_ENABLED && (
          <form className="donate-form" onSubmit={submit} noValidate>
            {alert && (
              <p className="form-alert" role="alert">
                <WarningCircle size={20} aria-hidden="true" /> {alert}
              </p>
            )}

            <fieldset className="amounts">
              <legend className="field-label">Montant</legend>
              {amounts.map((a) => (
                <label key={a.value} className={`amount-option${choice === a.value ? ' is-selected' : ''}`}>
                  <input type="radio" name="amount" value={a.value} checked={choice === a.value} onChange={() => choose(a.value)} />
                  <strong>{a.value.toLocaleString('fr-FR')} F</strong>
                  <span>{a.label}</span>
                </label>
              ))}
              <label className={`amount-option amount-other${choice === 'autre' ? ' is-selected' : ''}`}>
                <input type="radio" name="amount" value="autre" checked={choice === 'autre'} onChange={() => choose('autre')} />
                <strong>Autre montant</strong>
                <span>Vous choisissez</span>
              </label>
            </fieldset>

            {choice === 'autre' && (
              <div className="field">
                <label htmlFor="don-libre">
                  Montant <span className="optional">(en francs CFA, {MIN} F minimum)</span>
                </label>
                <input
                  id="don-libre"
                  type="number"
                  inputMode="numeric"
                  min={MIN}
                  step={50}
                  placeholder="Ex. 1 500"
                  autoFocus
                  value={custom}
                  aria-invalid={errors.amount ? true : undefined}
                  onChange={(e) => {
                    setCustom(e.target.value)
                    setErrors({})
                  }}
                />
              </div>
            )}
            {errors.amount && <p className="field-error">{errors.amount}</p>}

            <div className="form-row donate-row">
              <div className="field">
                <label htmlFor="don-nom">
                  Prénom <span className="optional">(facultatif)</span>
                </label>
                <input id="don-nom" autoComplete="given-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="don-email">
                  Email <span className="optional">(pour le reçu)</span>
                </label>
                <input
                  id="don-email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  aria-invalid={errors.email ? true : undefined}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                {errors.email && <p className="field-error">{errors.email}</p>}
              </div>
            </div>

            <div className="field">
              <label htmlFor="don-message">
                Un mot pour l’équipe <span className="optional">(facultatif)</span>
              </label>
              <textarea id="don-message" rows={2} maxLength={500} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
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

            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={sending}>
              <Heart weight="fill" />
              {sending ? 'Ouverture du paiement…' : Number.isInteger(value) && value > 0 ? `Donner ${value.toLocaleString('fr-FR')} F` : 'Donner'}
            </button>
            <p className="form-note donate-note">
              <LockSimple size={14} aria-hidden="true" /> Paiement sécurisé par Paystack&nbsp;: Wave, Orange Money, MTN ou carte
              bancaire.
            </p>
          </form>
        )}

        <h2 className="section-title">À quoi sert votre don</h2>
        <ul className="check-list">
          <li>Le serveur et le nom de domaine qui font tourner QuelBus</li>
          <li>Les cartes, qui coûtent plus cher quand le site est très utilisé</li>
          <li>Le temps passé à vérifier les lignes sur le terrain et à corriger les erreurs</li>
        </ul>

        <h2 className="section-title">Pas de don&nbsp;? Aidez autrement</h2>
        <ul className="help-list">
          <li>
            <ShareNetwork size={22} aria-hidden="true" />
            <span>Parlez de QuelBus à ceux qui se perdent dans les lignes.</span>
          </li>
          <li>
            <Bug size={22} aria-hidden="true" />
            <span>Signalez une ligne ou un arrêt faux depuis sa page.</span>
          </li>
          <li>
            <Code size={22} aria-hidden="true" />
            <span>
              Code, design ou terrain&nbsp;:{' '}
              <Link to="/contact?profil=contributeur">
                rejoignez les contributeurs <ArrowRight size={14} />
              </Link>
            </span>
          </li>
        </ul>
      </div>
    </section>
  )
}
