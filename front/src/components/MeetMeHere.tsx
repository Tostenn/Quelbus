import { useState } from 'react'
import { Check, LinkSimple, MapPin, SpinnerGap, UsersThree, WhatsappLogo } from '@phosphor-icons/react'
import PlaceInput from './PlaceInput'
import { fetchNearestStop, type Place } from '../lib/api'
import { isInAbidjan, rendezvousUrl } from '../lib/search'

type Step = 'idle' | 'locating' | 'manual' | 'ready'

const PROBLEMS = {
  denied: 'Position refusée. Choisissez le lieu du rendez-vous :',
  unavailable: 'Position introuvable. Choisissez le lieu du rendez-vous :',
  outside: 'Vous semblez être hors d’Abidjan. Choisissez le lieu du rendez-vous :',
}

// « Faire venir quelqu'un ici » : partage la position actuelle, une seule fois, sans définir de trajet.
// La personne qui reçoit le lien dit où elle est et voit quel bus prendre pour venir.
export default function MeetMeHere() {
  const [step, setStep] = useState<Step>('idle')
  const [problem, setProblem] = useState<keyof typeof PROBLEMS | null>(null)
  const [place, setPlace] = useState<Place | null>(null)
  const [copied, setCopied] = useState(false)

  function fail(reason: keyof typeof PROBLEMS) {
    setProblem(reason)
    setStep('manual')
  }

  function locate() {
    if (!('geolocation' in navigator)) return fail('unavailable')
    setStep('locating')
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const here = { name: 'la position partagée', lat: coords.latitude, lng: coords.longitude }
        if (!isInAbidjan(here)) return fail('outside')
        // L'arrêt le plus proche sert de repère ; sans lui, le lien marche quand même
        const stop = await fetchNearestStop(here.lat, here.lng).catch(() => null)
        setPlace(stop ? { ...here, name: `près de l’arrêt ${stop.name}` } : here)
        setStep('ready')
      },
      (error) => fail(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  }

  function choose(chosen: Place | null) {
    if (!chosen) return
    setPlace(chosen)
    setStep('ready')
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      window.prompt('Copiez ce lien :', url)
    }
  }

  if (step === 'ready' && place) {
    const url = rendezvousUrl(place)
    const where = place.name.startsWith('près de') ? `Je suis ${place.name}` : `Je suis à ${place.name}`
    const message = `${where}. Rejoins-moi : ouvre ce lien, dis où tu es, et QuelBus te montre quel bus prendre.\n${url}`
    return (
      <div className="meet-here is-ready">
        <p>
          <MapPin weight="fill" aria-hidden="true" />
          <span>
            Lieu du rendez-vous&nbsp;: <strong>{place.name}</strong>
          </span>
        </p>
        <div className="meeting-actions">
          <a
            className="btn btn-whatsapp btn-sm"
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
          >
            <WhatsappLogo size={20} weight="fill" aria-hidden="true" />
            Envoyer sur WhatsApp
          </a>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(url)}>
            {copied ? <Check aria-hidden="true" /> : <LinkSimple aria-hidden="true" />}
            <span aria-live="polite">{copied ? 'Lien copié' : 'Copier le lien'}</span>
          </button>
        </div>
        <p className="meet-note">Votre position est envoyée une seule fois. Elle n’est pas suivie.</p>
      </div>
    )
  }

  if (step === 'manual') {
    return (
      <div className="meet-here">
        <PlaceInput
          label={problem ? PROBLEMS[problem] : 'Lieu du rendez-vous'}
          placeholder="Un lieu, un arrêt…"
          value={null}
          onChange={choose}
          pin="to"
        />
      </div>
    )
  }

  return (
    <div className="meet-here">
      <button type="button" className="btn btn-ghost meet-button" onClick={locate} disabled={step === 'locating'}>
        {step === 'locating' ? <SpinnerGap className="spin" aria-hidden="true" /> : <UsersThree aria-hidden="true" />}
        {step === 'locating' ? 'Localisation…' : 'Faire venir quelqu’un ici'}
      </button>
      <p className="meet-note">Envoyez votre position sur WhatsApp&nbsp;: la personne verra quel bus prendre pour vous rejoindre.</p>
    </div>
  )
}
