import { Link } from 'react-router'
import { ArrowRight } from '@phosphor-icons/react'
import { useAllLiveBuses } from '../lib/trips'

/** Accès à la carte des bus en direct, avec le nombre de bus en ce moment. */
export default function LiveTeaser() {
  const { buses, loaded } = useAllLiveBuses()
  const count = buses.length

  return (
    <Link className="live-teaser" to="/en-direct">
      <span className={`live-dot${count ? '' : ' is-off'}`} aria-hidden="true" />
      <span className="live-teaser-text">
        <strong>{!loaded ? 'Bus en direct' : count ? `${count} bus en direct en ce moment` : 'Les bus en direct'}</strong>
        <span>{count ? 'Voyez où ils sont sur la carte' : 'La carte se remplit quand les voyageurs partagent leur bus'}</span>
      </span>
      <ArrowRight aria-hidden="true" />
    </Link>
  )
}
