import { Link } from 'react-router'
import { ArrowRight, ArrowsLeftRight, Info, PersonSimpleWalk, WarningCircle } from '@phosphor-icons/react'
import ResultCard from './ResultCard'
import CombinationCard from './CombinationCard'
import type { Place, SearchResponse } from '../lib/api'
import { formatDistance } from '../lib/search'

type Props = {
  data: SearchResponse
  from: Place
  to: Place
  radius: number
  filtered?: boolean
  onAllTypes?: () => void
}

/** Lignes directes et combinaisons d'une recherche, dans l'ordre le plus pratique. */
export default function SearchResults({ data, from, to, radius, filtered = false, onAllTypes }: Props) {
  const count = data.results.length
  const combinations = data.combinations ?? []
  const combosFirst = combinations.length > 0 && data.prefer === 'combinations'

  const direct = count > 0 && (
    <>
      {data.expanded && (
        <div className="notice">
          <Info size={24} aria-hidden="true" />
          <p>
            {combosFirst
              ? <>Sans changement, il faut marcher jusqu’à <strong>{data.radius} m</strong>&nbsp;:</>
              : <>Aucune ligne directe à moins de {radius} m. Voici les lignes à moins de <strong>{data.radius} m</strong> à pied.</>}
          </p>
        </div>
      )}
      <p className="results-count">
        {count} ligne{count > 1 ? 's' : ''} directe{count > 1 ? 's' : ''}
      </p>
      {data.results.map((result, i) => (
        <ResultCard key={result.line.id} result={result} from={from} best={i === 0 && !combosFirst} />
      ))}
    </>
  )

  const combos = combinations.length > 0 && (
    <>
      {combosFirst && (
        <div className="notice">
          <ArrowsLeftRight size={24} aria-hidden="true" />
          <p>
            {count > 0 ? 'Les lignes directes font beaucoup marcher.' : 'Aucune ligne directe pour ce trajet.'} QuelBus vous
            propose de <strong>combiner {combinations[0].changes > 1 ? 'plusieurs lignes' : 'deux lignes'}</strong>, comme le font les
            habitués.
          </p>
        </div>
      )}
      <p className="results-count">
        {combinations.length} combinaison{combinations.length > 1 ? 's' : ''} avec changement
      </p>
      {combinations.map((combination, i) => (
        <CombinationCard
          key={combination.legs.map((l) => l.direction.id).join('-')}
          combination={combination}
          from={from}
          to={to}
          best={i === 0 && combosFirst}
        />
      ))}
    </>
  )

  return (
    <div className="results">
      {data.walkable && (
        <div className="notice">
          <PersonSimpleWalk size={24} aria-hidden="true" />
          <p>
            Votre destination est à <strong>{formatDistance(data.distance)}</strong>&nbsp;: vous pouvez y aller à pied.
          </p>
        </div>
      )}

      {combosFirst ? (
        <>
          {combos}
          {direct}
        </>
      ) : (
        <>
          {direct}
          {combos}
        </>
      )}

      {count === 0 && combinations.length === 0 && !data.walkable && (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">
            <WarningCircle size={26} />
          </span>
          <h2>Aucune ligne trouvée, même avec un changement</h2>
          <p className="muted">
            Aucune ligne directe à {data.radius} m à pied, ni de combinaison raisonnable de deux ou trois lignes. Essayez un point
            de départ ou d’arrivée un peu différent, par exemple une gare ou un grand carrefour proche.
          </p>
          {filtered && onAllTypes && (
            <button type="button" className="btn btn-primary" onClick={onAllTypes}>
              Chercher avec tous les transports
            </button>
          )}
          <Link className="text-link" to="/contact?profil=contributeur">
            Une ligne manque&nbsp;? Aidez-nous à l’ajouter <ArrowRight size={16} />
          </Link>
        </div>
      )}

      <p className="form-note">
        Les données peuvent être incomplètes ou dépassées.
        {combinations.length > 0 && ' Les changements sont calculés d’après le tracé des lignes : demandez confirmation au chauffeur en cas de doute.'}
      </p>
    </div>
  )
}
