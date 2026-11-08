import { Broadcast, Bus, Check, StopCircle, WarningCircle } from '@phosphor-icons/react'
import { ageSeconds, seenLabel, useNow, useTripSharing, type LiveBus } from '../lib/trips'

type Props = {
  lineId: number
  /** Sens imposé (l'usager vient d'une recherche) ; sinon il est déduit des premières positions */
  fixedDirectionId: number | null
  /** Bus en direct sur le sens affiché */
  buses: LiveBus[]
  sharing: boolean
  onSharingChange: (sharing: boolean) => void
  /** Sens trouvé : la page l'affiche */
  onDirection: (directionId: number) => void
}

const ENDED = {
  ended: { ok: true, text: 'Voyage terminé, merci ! Vos passages aux arrêts aideront les prochains voyageurs.' },
  off_route: { ok: false, text: 'Votre position ne suit pas cette ligne : le partage s’est arrêté. Êtes-vous dans le bon bus ?' },
  denied: { ok: false, text: 'Localisation refusée : impossible de partager la position du bus.' },
  error: { ok: false, text: 'Le partage n’a pas pu démarrer. Vérifiez votre connexion et réessayez.' },
}

/** Bus en direct sur ce sens, et partage anonyme de sa position par l'usager qui est à bord. */
export default function TripShare({ lineId, fixedDirectionId, buses, sharing, onSharingChange, onDirection }: Props) {
  const state = useTripSharing({ lineId, directionId: fixedDirectionId }, sharing, {
    onStop: () => onSharingChange(false),
    onDirection,
  })
  const now = useNow()
  const done = state.phase in ENDED ? ENDED[state.phase as keyof typeof ENDED] : null
  const finding = !fixedDirectionId && !state.directionId

  return (
    <div className="trip-share">
      {buses.length > 0 && (
        <ul className="live-buses" aria-label="Bus en direct">
          {buses.map((bus) => (
            <li key={bus.id}>
              <Bus size={18} weight="fill" aria-hidden="true" />
              <span>
                {bus.last_stop ? `Passé à ${bus.last_stop.name}` : 'Au départ'} {seenLabel(ageSeconds(bus, now))}
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
              : finding
                ? 'Partage en cours · on repère le sens du bus dès qu’il roule'
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
            C’est anonyme, le sens est trouvé tout seul, et vous arrêtez quand vous voulez.
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
