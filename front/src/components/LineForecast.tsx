import { ClockCountdown, NavigationArrow, SpinnerGap } from '@phosphor-icons/react'
import { basisLabel, clock, inLabel, minutesUntil, upcoming, useArrivals, usePosition } from '../lib/arrivals'
import { useNow } from '../lib/trips'

type Props = {
  directionId: number
  /** Position déjà connue (venue d'une recherche, ou suivie sur la page) */
  known: { lat: number; lng: number } | null
}

/**
 * Prochain bus estimé à l'arrêt le plus proche, quand aucun bus n'est en direct sur ce sens.
 * N'apparaît que pour un sens qui a des passages relevés ; il faut la position de l'usager.
 */
export default function LineForecast({ directionId, known }: Props) {
  const here = usePosition()
  const position = known ?? here.position
  const { arrivals, loaded } = useArrivals(position, directionId)
  const now = useNow(30000)
  const arrival = arrivals[0]
  const next = arrival ? upcoming(arrival, now) : []

  if (!position) {
    return (
      <div className="forecast">
        <p className="forecast-title">
          <ClockCountdown size={20} aria-hidden="true" />
          Quand passe le prochain&nbsp;?
        </p>
        <p className="muted">
          Pas de bus en direct sur ce sens. Avec votre position, on estime son passage à l’arrêt le plus proche, d’après
          les trajets partagés par les voyageurs.
        </p>
        {here.state === 'denied' ? (
          <p className="field-error">Localisation refusée : autorisez-la dans les réglages du navigateur.</p>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={here.request} disabled={here.state === 'locating'}>
            {here.state === 'locating' ? <SpinnerGap className="spin" aria-hidden="true" /> : <NavigationArrow aria-hidden="true" />}
            {here.state === 'locating' ? 'Localisation…' : 'Estimer près de moi'}
          </button>
        )}
      </div>
    )
  }

  if (!loaded) return null

  if (!arrival || !next.length) {
    return (
      <div className="forecast">
        <p className="forecast-title">
          <ClockCountdown size={20} aria-hidden="true" />
          Quand passe le prochain&nbsp;?
        </p>
        <p className="muted">Aucun passage relevé près de vous dans les trois prochaines heures.</p>
      </div>
    )
  }

  const [first, ...later] = next
  const minutes = minutesUntil(first.at, now)
  return (
    <div className="forecast" aria-live="polite">
      <p className="forecast-title">
        <ClockCountdown size={20} aria-hidden="true" />
        Prochain bus estimé à {arrival.stop.name}
      </p>
      <p className="forecast-time">
        <strong>vers {clock(first.at)}</strong> <span>{inLabel(minutes)}</span>
      </p>
      {later.length > 0 && <p className="muted">Puis vers {later.map((n) => clock(n.at)).join(', ')}</p>}
      <p className="forecast-basis">
        Estimation, pas un bus en direct&nbsp;: {basisLabel(first.days)} à cette heure-là.
        {arrival.stop.walk_m > 30 && ` Arrêt à ${arrival.stop.walk_m} m de vous.`}
      </p>
    </div>
  )
}
