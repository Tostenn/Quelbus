import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowsDownUp, Crosshair, MagnifyingGlass, SpinnerGap } from '@phosphor-icons/react'
import PlaceInput from './PlaceInput'
import type { LineType, Place } from '../lib/api'
import { isInAbidjan, RADII, searchToQuery } from '../lib/search'

type Props = {
  initialFrom?: Place | null
  initialTo?: Place | null
  radius?: number
  types?: LineType[]
  onSubmitted?: () => void
}

type GeoState = 'idle' | 'locating' | 'denied' | 'unavailable' | 'outside'

const geoMessages: Record<Exclude<GeoState, 'idle' | 'locating'>, string> = {
  denied: 'Localisation refusée. Tapez votre quartier ou un arrêt.',
  unavailable: 'Position introuvable. Tapez votre quartier ou un arrêt.',
  outside: 'Vous semblez être hors d’Abidjan. Tapez votre point de départ.',
}

export default function SearchForm({ initialFrom = null, initialTo = null, radius = RADII[0], types = [], onSubmitted }: Props) {
  const navigate = useNavigate()
  const [from, setFrom] = useState<Place | null>(initialFrom)
  const [to, setTo] = useState<Place | null>(initialTo)
  const [geo, setGeo] = useState<GeoState>('idle')
  const [errors, setErrors] = useState<{ from?: string; to?: string }>({})
  // Change à chaque inversion : les champs repartent des nouvelles valeurs
  const [swapKey, setSwapKey] = useState(0)

  function locate() {
    if (!('geolocation' in navigator)) {
      setGeo('unavailable')
      return
    }
    setGeo('locating')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const place = { name: 'Ma position', lat: coords.latitude, lng: coords.longitude }
        if (!isInAbidjan(place)) {
          setGeo('outside')
          return
        }
        setGeo('idle')
        setFrom(place)
        setErrors((e) => ({ ...e, from: undefined }))
      },
      (error) => setGeo(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const next = {
      from: from ? undefined : 'Choisissez votre point de départ dans la liste, ou utilisez votre position.',
      to: to ? undefined : 'Choisissez votre destination dans la liste.',
    }
    setErrors(next)
    if (!from || !to) return

    navigate(`/recherche?${searchToQuery({ from, to, radius, types })}`)
    onSubmitted?.()
  }

  return (
    <form className="search-form" onSubmit={submit} noValidate>
      <PlaceInput
        key={`from-${swapKey}`}
        label="Où êtes-vous ?"
        placeholder="Quartier, carrefour, arrêt…"
        pin="from"
        value={from}
        onChange={(place) => {
          setFrom(place)
          if (place) setErrors((e) => ({ ...e, from: undefined }))
        }}
        error={errors.from}
        action={
          <>
            <div className="place-actions">
              <button type="button" className="btn-locate" onClick={locate} disabled={geo === 'locating'}>
                {geo === 'locating' ? <SpinnerGap className="spin" /> : <Crosshair />}
                {geo === 'locating' ? 'Localisation…' : 'Utiliser ma position'}
              </button>
              <button
                type="button"
                className="btn-swap"
                aria-label="Inverser départ et destination"
                title="Inverser"
                onClick={() => {
                  setFrom(to)
                  setTo(from)
                  setErrors({})
                  setSwapKey((k) => k + 1)
                }}
              >
                <ArrowsDownUp />
              </button>
            </div>
            {geo !== 'idle' && geo !== 'locating' && (
              <p className="geo-message" role="status">
                {geoMessages[geo]}
              </p>
            )}
          </>
        }
      />

      <PlaceInput
        key={`to-${swapKey}`}
        label="Où allez-vous ?"
        placeholder="Mosquée d’Adjamé, Gare Nord…"
        pin="to"
        value={to}
        onChange={(place) => {
          setTo(place)
          if (place) setErrors((e) => ({ ...e, to: undefined }))
        }}
        error={errors.to}
      />

      <button type="submit" className="btn btn-primary btn-lg btn-block">
        <MagnifyingGlass />
        Trouver mon bus
      </button>
    </form>
  )
}
