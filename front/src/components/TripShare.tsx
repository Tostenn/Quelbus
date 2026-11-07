import { Broadcast, Bus, Check, StopCircle, WarningCircle } from '@phosphor-icons/react'
import { seenLabel, useTripSharing, type LiveBus } from '../lib/trips'

type Props = {
  directionId: number
  /** Bus en direct sur ce sens */
  buses: LiveBus[]
  sharing: boolean
  onSharingChange: (sharing: boolean) => void
}

const ENDED = {
  ended: { ok: true, text: 'Voyage terminé, merci ! Vos passages aux arrêts aideront les prochains voyageurs.' },
  off_route: { ok: false, text: 'Votre position ne suit pas cette ligne : le partage s’est arrêté. Vérifiez le sens choisi.' },
  denied: { ok: false, text: 'Localisation refusée : impossible de partager la position du bus.' },
  error: { ok: false, text: 'Le partage n’a pas pu démarrer. Vérifiez votre connexion et réessayez.' },
}

/** Bus en direct sur ce sens, et partage anonyme de sa position par l'usager qui est à bord. */
export default function TripShare({ directionId, buses, sharing, onSharingChange }: Props) {
  const state = useTripSharing(directionId, sharing, () => onSharingChange(false))
  const done = state.phase in ENDED ? ENDED[state.phase as keyof typeof ENDED] : null

  return (
    <div className="trip-share">
      {buses.length > 0 && (
        <ul className="live-buses" aria-label="Bus en direct">
          {buses.map((bus, i) => (
            <li key={i}>
              <Bus size={18} weight="fill" aria-hidden="true" />
              <span>
                {bus.last_stop ? `Passé à ${bus.last_stop.name}` : 'Au départ'} {seenLabel(bus.seen_seconds_ago)}
                {bus.next_stop && <span className="muted"> · prochain arrêt : {bus.next_stop.name}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {sharing ? (
        <div className="trip-share-live" role="status">
          <Broadcast size={20} weight="bold" aria-hidden="true" className="live-icon" />
          <span>
            {state.phase === 'starting'
              ? 'Démarrage du partage…'
              : `Vous partagez la position du bus · ${state.sent} position${state.sent > 1 ? 's' : ''} envoyée${state.sent > 1 ? 's' : ''}`}
            {state.offline && state.pending > 0 && <span className="muted"> · pas de réseau, {state.pending} en attente</span>}
          </span>
          <button type="button" className="live-stop" onClick={() => onSharingChange(false)}>
            <StopCircle size={18} aria-hidden="true" /> Arrêter
          </button>
        </div>
      ) : (
        <div className="trip-share-offer">
          <p>
            <strong>Vous êtes dans ce bus&nbsp;?</strong> Partagez sa position pour que les autres voient où il est.
            C’est anonyme, l’écran reste allumé, et vous arrêtez quand vous voulez.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => onSharingChange(true)}>
            <Broadcast aria-hidden="true" />
            Je suis dans ce bus
          </button>
        </div>
      )}

      {!sharing && done && (
        <p className={done.ok ? 'admin-notice' : 'form-alert'} role="status">
          {done.ok ? <Check size={20} aria-hidden="true" /> : <WarningCircle size={20} aria-hidden="true" />}
          {done.text}
        </p>
      )}
    </div>
  )
}
