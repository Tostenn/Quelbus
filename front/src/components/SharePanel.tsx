import { useState } from 'react'
import {
  Check,
  FacebookLogo,
  LinkedinLogo,
  LinkSimple,
  ShareNetwork,
  TelegramLogo,
  WhatsappLogo,
  XLogo,
} from '@phosphor-icons/react'
import type { Profile } from '../lib/api'
import { SITE_URL } from '../lib/config'

type ShareCopy = { title: string; text: string; message: string; url: string }

// Ce qu'on affiche et ce qu'on propose de partager dépend de ce que la personne a choisi.
const copies: Record<Profile, ShareCopy> = {
  utilisateur: {
    title: 'Faites passer le mot',
    text: 'Vous connaissez quelqu’un qui se perd dans les lignes SOTRA ? Envoyez-lui QuelBus : plus on sera nombreux au lancement, plus vite l’appli sera utile à tout le monde.',
    message:
      'Je viens de m’inscrire sur QuelBus, une appli gratuite qui dit quel bus SOTRA prendre à Abidjan. Inscris-toi aussi pour être prévenu du lancement 👉',
    url: `${SITE_URL}/`,
  },
  contributeur: {
    title: 'Aidez-nous à trouver d’autres contributeurs',
    text: 'Un projet open source avance plus vite à plusieurs. Partagez-le avec les développeurs, designers et passionnés de cartes autour de vous.',
    message:
      'Je contribue à QuelBus, un projet open source pour savoir quel bus SOTRA prendre à Abidjan. On cherche des devs, des designers et des gens qui connaissent bien les lignes. Rejoins-nous 👉',
    url: `${SITE_URL}/contact?profil=contributeur`,
  },
  les_deux: {
    title: 'Embarquez vos proches',
    text: 'Vous allez l’utiliser et aider à le construire, merci ! Invitez vos proches à s’inscrire, et vos amis développeurs ou cartographes à nous rejoindre.',
    message:
      'Je rejoins QuelBus, une appli gratuite et open source pour savoir quel bus SOTRA prendre à Abidjan. Inscris-toi pour le lancement, ou viens nous aider à la construire 👉',
    url: `${SITE_URL}/`,
  },
}

export default function SharePanel({ profile }: { profile: Profile }) {
  const { title, text, message, url } = copies[profile]
  const [copied, setCopied] = useState(false)
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const m = encodeURIComponent(message)
  const u = encodeURIComponent(url)
  const networks = [
    { name: 'Facebook', icon: FacebookLogo, href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { name: 'X', icon: XLogo, href: `https://twitter.com/intent/tweet?text=${m}&url=${u}` },
    { name: 'LinkedIn', icon: LinkedinLogo, href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { name: 'Telegram', icon: TelegramLogo, href: `https://t.me/share/url?url=${u}&text=${m}` },
  ]

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${message} ${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      window.prompt('Copiez ce lien :', url)
    }
  }

  return (
    <div className="share">
      <h2 className="share-title">{title}</h2>
      <p className="share-text">{text}</p>

      <a
        className="btn btn-whatsapp btn-lg btn-block"
        href={`https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`}
        target="_blank"
        rel="noreferrer"
      >
        <WhatsappLogo size={24} weight="fill" />
        Partager sur WhatsApp
      </a>

      <div className="share-grid">
        {networks.map(({ name, icon: Icon, href }) => (
          <a key={name} className="share-btn" href={href} target="_blank" rel="noreferrer" aria-label={`Partager sur ${name}`}>
            <Icon size={22} />
            <span>{name}</span>
          </a>
        ))}
        <button type="button" className="share-btn" onClick={copyLink}>
          {copied ? <Check size={22} /> : <LinkSimple size={22} />}
          <span aria-live="polite">{copied ? 'Copié !' : 'Copier'}</span>
        </button>
        {canNativeShare && (
          <button
            type="button"
            className="share-btn"
            onClick={() => navigator.share({ title: 'QuelBus', text: message, url }).catch(() => {})}
          >
            <ShareNetwork size={22} />
            <span>Autres</span>
          </button>
        )}
      </div>
    </div>
  )
}
