import { Fragment } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ArrowsLeftRight, PersonSimpleWalk } from '@phosphor-icons/react'
import LineBadge from './LineBadge'
import type { Combination, CombinationLeg, Place } from '../lib/api'
import { TYPE_LABELS, walkLabel } from '../lib/search'

type Props = { combination: Combination; from: Place; best?: boolean }

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

function legUrl(leg: CombinationLeg, here: string) {
  return `/lignes/${leg.line.slug}?sens=${leg.direction.id}&montee=${leg.board.id}&descente=${leg.alight.id}${here}`
}

export default function CombinationCard({ combination, from, best = false }: Props) {
  const { legs, changes } = combination
  const last = legs[legs.length - 1]
  // Seule une vraie position GPS est montrée sur la carte de la première ligne
  const here = from.name === 'Ma position' ? `&ici=${from.lat.toFixed(6)},${from.lng.toFixed(6)}` : ''

  return (
    <article className={`result-card combination-card${best ? ' is-best' : ''}`}>
      <div className="combination-head">
        <span className="combination-badges" aria-label={legs.map((l) => l.line.ref ?? TYPE_LABELS[l.line.type]).join(', puis ')}>
          {legs.map((leg, i) => (
            <Fragment key={leg.direction.id}>
              {i > 0 && <ArrowRight size={18} aria-hidden="true" />}
              <LineBadge refNumber={leg.line.ref} type={leg.line.type} accent={best && i === 0} size="lg" />
            </Fragment>
          ))}
        </span>
        <span className="muted">
          {plural(changes, 'changement')} · {plural(combination.stops, 'arrêt')} · {combination.walk} m à pied au total
        </span>
      </div>

      <ol className="combination-steps">
        {legs.map((leg, i) => (
          <Fragment key={leg.direction.id}>
            {i === 0 ? (
              <li className="combination-stop">
                <span className="pin pin-board" aria-hidden="true" />
                <div>
                  <span className="field-label">Montez à</span>
                  <span className="result-stop">{leg.board.name}</span>
                  <span className="muted walk">
                    <PersonSimpleWalk size={16} aria-hidden="true" />
                    {walkLabel(leg.board.walk)}
                  </span>
                </div>
              </li>
            ) : (
              <li className="combination-stop is-change">
                <span className="pin pin-change" aria-hidden="true" />
                <div>
                  <span className="field-label">
                    <ArrowsLeftRight size={13} aria-hidden="true" /> Changez à
                  </span>
                  <span className="result-stop">{leg.board.name}</span>
                  <span className="muted walk">
                    {leg.board.walk > 0 ? (
                      <>
                        <PersonSimpleWalk size={16} aria-hidden="true" />
                        {walkLabel(leg.board.walk)} depuis {legs[i - 1].alight.name}
                      </>
                    ) : (
                      'Au même arrêt'
                    )}
                    {leg.lines_here >= 5 && ` · ${leg.lines_here} lignes y passent`}
                  </span>
                </div>
              </li>
            )}

            <li className={`combination-ride ride-${leg.line.type}`}>
              <span className="combination-track" aria-hidden="true" />
              <div>
                <span className="combination-line">
                  <LineBadge refNumber={leg.line.ref} type={leg.line.type} size="sm" />
                  <span>
                    {TYPE_LABELS[leg.line.type]} direction <strong>{leg.direction.destination_label ?? leg.direction.name}</strong>
                  </span>
                </span>
                <span className="muted">
                  {plural(leg.stops, 'arrêt')}, descendez à <strong>{leg.alight.name}</strong>
                </span>
                <Link className="combination-map" to={legUrl(leg, i === 0 ? here : '')}>
                  Voir sur la carte <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </li>
          </Fragment>
        ))}

        <li className="combination-stop">
          <span className="pin pin-to" aria-hidden="true" />
          <div>
            <span className="field-label">Arrivée</span>
            <span className="result-stop">{last.alight.name}</span>
            <span className="muted walk">
              <PersonSimpleWalk size={16} aria-hidden="true" />
              {walkLabel(last.alight.walk)} jusqu’à votre destination
            </span>
          </div>
        </li>
      </ol>
    </article>
  )
}
