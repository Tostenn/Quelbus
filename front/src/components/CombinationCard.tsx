import { Fragment } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ArrowsLeftRight, PersonSimpleWalk } from '@phosphor-icons/react'
import LineBadge from './LineBadge'
import type { Combination, Place } from '../lib/api'
import { fareLabel, totalFare } from '../lib/fares'
import { lineShort, SAME_STOP_M, sameName, TYPE_LABELS, walkLabel } from '../lib/search'
import { tripUrl } from '../lib/trip'

type Props = { combination: Combination; from: Place; to: Place; best?: boolean }

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

export default function CombinationCard({ combination, from, to, best = false }: Props) {
  const { legs, changes } = combination
  const last = legs[legs.length - 1]
  const total = totalFare(legs.map((l) => ({ fare: l.line.fare ?? null, accepts_student_card: null })))
  return (
    <Link className={`result-card combination-card${best ? ' is-best' : ''}`} to={tripUrl(combination, from, to)}>
      <div className="combination-head">
        <span className="combination-badges" aria-label={legs.map((l) => l.line.ref ?? TYPE_LABELS[l.line.type]).join(', puis ')}>
          {legs.map((leg, i) => (
            <Fragment key={leg.direction.id}>
              {i > 0 && <ArrowRight size={18} aria-hidden="true" />}
              <LineBadge refNumber={leg.line.ref} type={leg.line.type} accent={best && leg.line.type === 'sotra'} size="lg" />
            </Fragment>
          ))}
        </span>
        <span className="muted">
          {plural(changes, 'changement')} · {plural(combination.stops, 'arrêt')} · {combination.walk} m à pied au total
          {total !== null && (
            <>
              {' · '}
              <strong className="fare-total">{fareLabel(total)} en tout</strong>
            </>
          )}
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
                    {leg.board.walk < SAME_STOP_M ? (
                      'Au même arrêt'
                    ) : (
                      <>
                        <PersonSimpleWalk size={16} aria-hidden="true" />
                        {sameName(legs[i - 1].alight.name, leg.board.name)
                          ? `L’arrêt du ${lineShort(leg.line)} est à ${walkLabel(leg.board.walk)}`
                          : `${walkLabel(leg.board.walk)} depuis ${legs[i - 1].alight.name}`}
                      </>
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
      <span className="result-more">
        Voir tout le trajet sur la carte <ArrowRight size={16} aria-hidden="true" />
      </span>
    </Link>
  )
}
