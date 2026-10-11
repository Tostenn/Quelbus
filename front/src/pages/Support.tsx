import { Link } from 'react-router'
import { ArrowRight, Bug, Code, Heart, ShareNetwork } from '@phosphor-icons/react'
import { DONATE_URL, DONATE_WAVE_URL } from '../lib/config'
import { usePageMeta } from '../lib/usePageMeta'

const amounts = [
  { value: '500 F', label: 'Un garba' },
  { value: '1 000 F', label: 'Un aller-retour en gbaka pour vérifier une ligne' },
  { value: '5 000 F', label: 'Un vrai coup de pouce' },
]

export default function Support() {
  usePageMeta(
    'Soutenir QuelBus : offrez un garba à l’équipe | QuelBus',
    'QuelBus est gratuit et sans publicité. Un don par Mobile Money ou carte aide à payer le serveur, les cartes et le temps passé à vérifier les lignes.',
  )

  return (
    <section className="section page-section">
      <div className="container narrow">
        <p className="eyebrow">Soutenir le projet</p>
        <h1 className="page-title">Offrez un garba à l’équipe</h1>
        <p className="lead">
          QuelBus est gratuit, sans publicité et le restera. Si l’appli vous a évité de rater votre bus, un petit don
          aide à la faire tourner.
        </p>

        <ul className="amounts">
          {amounts.map((a) => (
            <li key={a.value}>
              <strong>{a.value}</strong>
              <span>{a.label}</span>
            </li>
          ))}
        </ul>

        {DONATE_URL || DONATE_WAVE_URL ? (
          <div className="donate-actions">
            {DONATE_URL && (
              <a className="btn btn-primary btn-lg" href={DONATE_URL} target="_blank" rel="noreferrer">
                <Heart weight="fill" />
                Faire un don
              </a>
            )}
            {DONATE_WAVE_URL && (
              <a className="btn btn-ghost btn-lg" href={DONATE_WAVE_URL} target="_blank" rel="noreferrer">
                Donner avec Wave
              </a>
            )}
            <p className="form-note">
              Mobile Money (Wave, Orange Money, MTN) ou carte bancaire. Vous choisissez le montant sur la page de paiement.
            </p>
          </div>
        ) : (
          <div className="notice">
            <Heart size={24} aria-hidden="true" />
            <p>Les dons ouvrent très prochainement. En attendant, les autres coups de main ci-dessous comptent tout autant.</p>
          </div>
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
