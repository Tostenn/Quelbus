import { useState } from 'react'
import { Check, LinkSimple, WhatsappLogo } from '@phosphor-icons/react'
import type { Place } from '../lib/api'
import { markShared } from '../lib/meeting'
import { meetingName, rendezvousUrl } from '../lib/search'

export default function MeetingShare({ to }: { to: Place }) {
  const [copied, setCopied] = useState(false)
  const url = rendezvousUrl(to)
  const place = meetingName(to)
  const message = `Je vais à ${place}. Rejoins-moi là-bas : ouvre ce lien, dis où tu es, et QuelBus te montre quel bus prendre.\n${url}`

  async function copy() {
    markShared(to)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      window.prompt('Copiez ce lien :', url)
    }
  }

  return (
    <div className="meeting-share">
      <p>
        Quelqu’un doit vous rejoindre à <strong>{place}</strong>&nbsp;? Envoyez-lui ce lieu&nbsp;: il verra quel bus
        prendre depuis là où il est.
      </p>
      <div className="meeting-actions">
        <a
          className="btn btn-whatsapp btn-sm"
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          onClick={() => markShared(to)}
        >
          <WhatsappLogo size={20} weight="fill" aria-hidden="true" />
          Envoyer sur WhatsApp
        </a>
        <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <LinkSimple aria-hidden="true" />}
          <span aria-live="polite">{copied ? 'Lien copié' : 'Copier le lien'}</span>
        </button>
      </div>
    </div>
  )
}
