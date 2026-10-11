import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowClockwise, HourglassMedium, House, MagnifyingGlass, SpinnerGap, WarningCircle, WhatsappLogo } from '@phosphor-icons/react'
import Celebration from '../components/Celebration'
import { fetchDonation, type DonationInfo } from '../lib/api'
import { SITE_URL } from '../lib/config'
import { usePageMeta } from '../lib/usePageMeta'

// Un paiement Mobile Money peut mettre quelques secondes à être confirmé
const POLL_EVERY = 3000
const POLL_FOR = 45000

type State = { donation?: DonationInfo | null; error?: string; done: boolean }

export default function Thanks() {
  usePageMeta('Merci pour votre don | QuelBus')
  const [query] = useSearchParams()
  const reference = query.get('reference') ?? query.get('trxref') ?? ''
  const [state, setState] = useState<State>({ done: !reference })

  useEffect(() => {
    if (!reference) return
    const start = Date.now()
    let timer: number | undefined
    let stopped = false

    const check = () => {
      fetchDonation(reference)
        .then((donation) => {
          if (stopped) return
          const waiting = donation?.status === 'pending' && Date.now() - start < POLL_FOR
          setState({ donation, done: !waiting })
          if (waiting) timer = window.setTimeout(check, POLL_EVERY)
        })
        .catch((e: Error) => {
          if (!stopped) setState({ error: e.message, done: true })
        })
    }
    check()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [reference])

  const { donation, error, done } = state
  const amount = donation ? `${donation.amount.toLocaleString('fr-FR')} F` : ''
  const share = encodeURIComponent(`J’ai soutenu QuelBus, l’appli gratuite qui dit quel bus prendre à Abidjan. Essaie 👉 ${SITE_URL}/`)

  if (donation?.status === 'success') {
    return (
      <section className="section page-section thanks">
        <div className="container narrow thanks-inner">
          <Celebration />
          <h1 className="page-title thanks-title">Merci{donation.name ? ` ${donation.name}` : ''}&nbsp;!</h1>
          <p className="lead">
            Votre don de <strong>{amount}</strong> est bien arrivé. Grâce à vous, QuelBus reste gratuit pour tout
            Abidjan.
          </p>
          <div className="thanks-actions">
            <a className="btn btn-primary" href={`https://wa.me/?text=${share}`} target="_blank" rel="noreferrer">
              <WhatsappLogo />
              Le dire à vos proches
            </a>
            <Link className="btn btn-ghost" to="/recherche">
              <MagnifyingGlass />
              Trouver mon bus
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="section page-section">
      <div className="container narrow">
        {!done && (
          <div className="thanks-wait" role="status">
            <SpinnerGap size={40} className="spin" aria-hidden="true" />
            <h1 className="page-title">Confirmation du paiement…</h1>
            <p className="muted">On vérifie votre don auprès de Paystack. Gardez cette page ouverte quelques secondes.</p>
          </div>
        )}

        {done && !reference && <Problem title="Aucun paiement à confirmer." text="Ce lien ne correspond à aucun don." />}

        {done && error && (
          <Problem title="Vérification impossible pour le moment." text={`${error} Votre paiement, s’il a abouti, sera confirmé automatiquement.`} retry />
        )}

        {done && donation === null && <Problem title="Don introuvable." text="La référence de ce paiement est inconnue." />}

        {done && donation?.status === 'pending' && (
          <div className="empty-state" role="status">
            <HourglassMedium size={36} aria-hidden="true" className="thanks-icon" />
            <h1 className="page-title">Paiement en cours de confirmation</h1>
            <p className="muted">
              Votre opérateur n’a pas encore confirmé le paiement de {amount}. Ça peut prendre quelques minutes&nbsp;:
              rechargez cette page un peu plus tard. Si vous avez validé sur votre téléphone, rien d’autre à faire.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              <ArrowClockwise />
              Vérifier à nouveau
            </button>
          </div>
        )}

        {done && (donation?.status === 'failed' || donation?.status === 'abandoned') && (
          <Problem
            title="Le paiement n’a pas abouti."
            text="Aucun montant n’a été prélevé. Vous pouvez réessayer, avec un autre moyen de paiement si besoin."
            again
          />
        )}
      </div>
    </section>
  )
}

function Problem({ title, text, retry = false, again = false }: { title: string; text: string; retry?: boolean; again?: boolean }) {
  return (
    <div className="empty-state">
      <WarningCircle size={36} aria-hidden="true" className="thanks-icon" />
      <h1 className="page-title">{title}</h1>
      <p className="muted">{text}</p>
      <div className="thanks-actions">
        {retry && (
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            <ArrowClockwise />
            Réessayer
          </button>
        )}
        {again && (
          <Link className="btn btn-primary" to="/soutenir">
            Refaire un don
          </Link>
        )}
        <Link className="btn btn-ghost" to="/">
          <House />
          Retour à l’accueil
        </Link>
      </div>
    </div>
  )
}
