import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { CaretDown, CaretLeft, CaretRight, ClockCountdown, NavigationArrow, SpinnerGap } from '@phosphor-icons/react'
import LineBadge from './LineBadge'
import { basisLabel, clock, inLabel, minutesUntil, upcoming, type Arrival } from '../lib/arrivals'

type Props = {
  arrivals: Arrival[]
  /** Position connue de l'usager */
  located: boolean
  locating: boolean
  denied: boolean
  now: number
  onLocate: () => void
}

/**
 * « Bientôt près de vous » : les bus qui passent d'habitude aux arrêts proches et qui ne sont pas en direct.
 * Section pliable ; les cartes défilent à l'horizontale, avec une pagination.
 */
export default function NearbyArrivals({ arrivals, located, locating, denied, now, onLocate }: Props) {
  const [open, setOpen] = useState(true)
  const track = useRef<HTMLUListElement>(null)
  const [page, setPage] = useState({ index: 0, count: 1 })

  const items = arrivals
    .map((arrival) => ({ arrival, next: upcoming(arrival, now) }))
    .filter((item) => item.next.length > 0)
    .sort((a, b) => Date.parse(a.next[0].at) - Date.parse(b.next[0].at))

  // Pages = largeurs visibles du rail
  useEffect(() => {
    const el = track.current
    if (!el) return
    const measure = () =>
      setPage({
        index: Math.round(el.scrollLeft / Math.max(1, el.clientWidth)),
        count: Math.max(1, Math.round(el.scrollWidth / Math.max(1, el.clientWidth))),
      })
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [open, items.length])

  // Position connue mais rien à annoncer : la section se retire
  if (located && items.length === 0) return null

  const go = (delta: number) => {
    const el = track.current
    if (el) el.scrollBy({ left: delta * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <section className="nearby" aria-labelledby="nearby-title">
      <button type="button" className="nearby-toggle" aria-expanded={open} aria-controls="nearby-body" onClick={() => setOpen((v) => !v)}>
        <ClockCountdown size={18} aria-hidden="true" />
        <span id="nearby-title">Bientôt près de vous</span>
        {items.length > 0 && <span className="nearby-count">{items.length}</span>}
        <span className="nearby-hint">estimé</span>
        <CaretDown className="nearby-caret" aria-hidden="true" />
      </button>

      {open && (
        <div id="nearby-body" className="nearby-body">
          {!located ? (
            <div className="nearby-ask">
              <p className="muted">
                Les bus qui passent à votre arrêt sans être en direct, estimés d’après les trajets déjà partagés.
              </p>
              {denied ? (
                <p className="field-error">Localisation refusée : autorisez-la dans les réglages du navigateur.</p>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm" onClick={onLocate} disabled={locating}>
                  {locating ? <SpinnerGap className="spin" aria-hidden="true" /> : <NavigationArrow aria-hidden="true" />}
                  {locating ? 'Localisation…' : 'Partager ma position'}
                </button>
              )}
            </div>
          ) : (
            <>
              <ul className="nearby-track" ref={track}>
                {items.map(({ arrival, next }) => (
                  <li key={arrival.direction.id}>
                    <Link className="nearby-card" to={`/lignes/${arrival.line.slug}?sens=${arrival.direction.id}`}>
                      <span className="nearby-card-head">
                        <LineBadge refNumber={arrival.line.ref} type={arrival.line.type} size="sm" />
                        <span className="nearby-card-dest">Vers {arrival.direction.destination ?? arrival.direction.name}</span>
                      </span>
                      <span className="nearby-card-time">
                        <strong>{inLabel(minutesUntil(next[0].at, now))}</strong>
                        <span>vers {clock(next[0].at)}</span>
                      </span>
                      <span className="nearby-card-stop">
                        {arrival.stop.name}
                        {arrival.stop.walk_m > 30 ? ` · ${arrival.stop.walk_m} m` : ''}
                      </span>
                      <span className="nearby-card-basis">{basisLabel(next[0].days)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {page.count > 1 && (
                <div className="nearby-pager">
                  <button type="button" className="btn-icon" aria-label="Précédents" onClick={() => go(-1)} disabled={page.index === 0}>
                    <CaretLeft />
                  </button>
                  <span aria-live="polite">
                    {page.index + 1} / {page.count}
                  </span>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label="Suivants"
                    onClick={() => go(1)}
                    disabled={page.index >= page.count - 1}
                  >
                    <CaretRight />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
