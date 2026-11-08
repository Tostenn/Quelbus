import { useEffect, useRef, useState } from 'react'
import { NavigationArrow, SpinnerGap } from '@phosphor-icons/react'
import type { Place } from '../lib/api'
import { cityAt } from '../lib/cities'

const KEY = 'quelbus:invite-position'
/** Après « Plus tard », on ne redemande pas avant une semaine. */
const SNOOZE_MS = 7 * 24 * 3600 * 1000

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(KEY))
    return at > 0 && Date.now() - at < SNOOZE_MS
  } catch {
    return false
  }
}

function snooze() {
  try {
    localStorage.setItem(KEY, String(Date.now()))
  } catch {
    // stockage indisponible : on redemandera à la prochaine recherche
  }
}

type Props = {
  /** Des bus ont été trouvés : c'est le bon moment pour demander. */
  ready: boolean
  /** Le départ vient déjà de la position du téléphone. */
  usedPosition: boolean
  /** Nom du départ tapé, proposé à côté de « Partir d'ici ». */
  fromName: string
  /** Le voyageur choisit de partir de sa position. */
  onPosition: (place: Place) => void
}

type Step = 'ask' | 'locating' | 'denied' | 'found'

/** Invite, une fois les bus trouvés, à partager sa position : meilleurs résultats, et une aide pour tous. */
export default function LocationPrompt({ ready, usedPosition, fromName, onPosition }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [step, setStep] = useState<Step>('ask')
  const [here, setHere] = useState<Place | null>(null)

  useEffect(() => {
    if (!ready || usedPosition || snoozed() || !('geolocation' in navigator)) return
    let cancelled = false
    const show = () => {
      if (!cancelled && dialog.current && !dialog.current.open) dialog.current.showModal()
    }
    // Déjà autorisée : rien à demander
    const permissions = navigator.permissions?.query({ name: 'geolocation' })
    if (!permissions) {
      show()
    } else {
      permissions.then((p) => p.state !== 'granted' && show()).catch(show)
    }
    return () => {
      cancelled = true
    }
  }, [ready, usedPosition])

  function close() {
    snooze()
    dialog.current?.close()
  }

  function share() {
    setStep('locating')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const place = { name: 'Ma position', lat: coords.latitude, lng: coords.longitude }
        // Hors des villes couvertes : rien à proposer, la recherche reste telle quelle
        if (!cityAt(place)) {
          dialog.current?.close()
          return
        }
        setHere(place)
        setStep('found')
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          snooze()
          setStep('denied')
        } else {
          setStep('ask')
          dialog.current?.close()
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <dialog ref={dialog} className="arrival location-prompt" aria-labelledby="position-titre" onCancel={snooze}>
      <span className="arrival-icon" aria-hidden="true">
        <NavigationArrow size={30} weight="fill" />
      </span>
      <h2 id="position-titre">{step === 'found' ? 'Merci, position trouvée' : 'C’est mieux avec votre position'}</h2>
      {step === 'found' ? (
        <p>
          Voulez-vous chercher le bus depuis là où vous êtes, ou garder le départ <strong>{fromName}</strong>&nbsp;?
        </p>
      ) : step === 'denied' ? (
        <p>
          La localisation est bloquée pour QuelBus. Vous pouvez l’autoriser dans les réglages de votre navigateur, puis
          toucher «&nbsp;Utiliser ma position&nbsp;» dans la recherche.
        </p>
      ) : (
        <>
          <p>QuelBus part de là où vous êtes&nbsp;: l’arrêt le plus proche, le chemin à pied, les bus autour de vous.</p>
          <p className="location-prompt-help">
            Et une fois dans le bus, «&nbsp;Je suis dans ce bus&nbsp;» le montre en direct aux autres voyageurs. C’est
            comme ça que vous faites avancer QuelBus.
          </p>
        </>
      )}
      <div className="arrival-actions">
        {step === 'found' ? (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                dialog.current?.close()
                if (here) onPosition(here)
              }}
            >
              <NavigationArrow />
              Partir d’ici
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => dialog.current?.close()}>
              Garder {fromName}
            </button>
          </>
        ) : step === 'denied' ? (
          <button type="button" className="btn btn-primary" onClick={close}>
            Compris
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-primary" onClick={share} disabled={step === 'locating'}>
              {step === 'locating' ? <SpinnerGap className="spin" /> : <NavigationArrow />}
              {step === 'locating' ? 'Localisation…' : 'Partager ma position'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={close}>
              Plus tard
            </button>
          </>
        )}
      </div>
    </dialog>
  )
}
