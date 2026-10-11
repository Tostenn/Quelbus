import { Link } from 'react-router'
import { ArrowRight, PersonSimpleWalk } from '@phosphor-icons/react'
import LineBadge from './LineBadge'
import type { Place, SearchResult } from '../lib/api'
import { TYPE_LABELS, walkLabel } from '../lib/search'

type Props = { result: SearchResult; from: Place; best?: boolean }

export default function ResultCard({ result, from, best = false }: Props) {
  const { line, direction, board, alight, stops } = result
  // Seule une vraie position GPS est montrée sur la carte de la ligne
  const here = from.name === 'Ma position' ? `&ici=${from.lat.toFixed(6)},${from.lng.toFixed(6)}` : ''

  return (
    <article className={`result-card${best ? ' is-best' : ''}`}>
      <header className="result-head">
        <LineBadge refNumber={line.ref} type={line.type} accent={best} size="lg" />
        <div>
          <h3 className="result-direction">{direction.name}</h3>
          <p className="muted">
            {TYPE_LABELS[line.type]} · {stops} arrêt{stops > 1 ? 's' : ''} entre montée et descente
          </p>
        </div>
      </header>
      <ol className="result-legs">
        <li className="result-leg">
          <span className="pin pin-from" aria-hidden="true" />
          <div>
            <span className="field-label">Montez à</span>
            <span className="result-stop">{board.name}</span>
            <span className="muted walk">
              <PersonSimpleWalk size={16} aria-hidden="true" />
              {walkLabel(board.walk)}
            </span>
          </div>
        </li>
        <li className="result-leg">
          <span className="pin pin-to" aria-hidden="true" />
          <div>
            <span className="field-label">Descendez à</span>
            <span className="result-stop">{alight.name}</span>
            <span className="muted walk">
              <PersonSimpleWalk size={16} aria-hidden="true" />
              {walkLabel(alight.walk)}
            </span>
          </div>
        </li>
      </ol>
      <Link className="text-link" to={`/lignes/${line.slug}?sens=${direction.id}&montee=${board.id}&descente=${alight.id}${here}`}>
        Voir le trajet sur la carte <ArrowRight size={16} />
      </Link>
    </article>
  )
}
