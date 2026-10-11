import { useEffect, useRef, useState } from 'react'
import { Bus, MapPin, MagnifyingGlass, Path, UsersThree, type Icon } from '@phosphor-icons/react'
import { useApi } from '../lib/useApi'

type PublicStats = { lines: number; stops: number; visits: number; searches: number }

// En dessous, un compteur public dessert plus qu'il ne rassure
const PUBLIC_THRESHOLD = 1000

function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      requestAnimationFrame(() => setShown(value))
      return
    }
    let frame = 0
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 1200)
        setShown(Math.round(value * (1 - (1 - t) ** 3)))
        if (t < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value])

  return (
    <span ref={ref} aria-hidden="true">
      {shown.toLocaleString('fr-FR')}
    </span>
  )
}

export default function StatsBand() {
  const { data } = useApi<PublicStats>('/stats')
  if (!data) return null

  const items: { icon: Icon; value: number; label: string }[] = [
    { icon: Bus, value: data.lines, label: 'lignes de bus' },
    { icon: MapPin, value: data.stops, label: 'arrêts sur la carte' },
    { icon: Path, value: 3, label: 'transports : SOTRA, gbaka, wôrô‑wôrô' },
  ]
  if (data.searches >= PUBLIC_THRESHOLD) items.push({ icon: MagnifyingGlass, value: data.searches, label: 'trajets recherchés' })
  if (data.visits >= PUBLIC_THRESHOLD) items.push({ icon: UsersThree, value: data.visits, label: 'visites' })

  return (
    <section className="stats-band" aria-labelledby="chiffres">
      <div className="container">
        <h2 id="chiffres" className="stats-title">
          Tout Abidjan, ligne par ligne
        </h2>
        <ul className="stats-list">
          {items.map(({ icon: ItemIcon, value, label }) => (
            <li key={label}>
              <span className="stats-icon" aria-hidden="true">
                <ItemIcon size={22} weight="bold" />
              </span>
              <strong className="stats-value">
                <CountUp value={value} />
                <span className="visually-hidden">{value.toLocaleString('fr-FR')}</span>
              </strong>
              <span className="stats-label">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
