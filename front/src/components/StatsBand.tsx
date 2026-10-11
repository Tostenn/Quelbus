import { useApi } from '../lib/useApi'

type PublicStats = { lines: number; stops: number; visits: number; searches: number }

// En dessous, un compteur public dessert plus qu'il ne rassure
const PUBLIC_THRESHOLD = 1000

const format = (n: number) => n.toLocaleString('fr-FR')

export default function StatsBand() {
  const { data } = useApi<PublicStats>('/stats')
  if (!data) return null

  const items = [
    { value: format(data.lines), label: 'lignes de bus' },
    { value: format(data.stops), label: 'arrêts géolocalisés' },
    { value: '3', label: 'transports : SOTRA, gbaka, wôrô-wôrô' },
  ]
  if (data.searches >= PUBLIC_THRESHOLD) items.push({ value: format(data.searches), label: 'trajets recherchés' })
  if (data.visits >= PUBLIC_THRESHOLD) items.push({ value: format(data.visits), label: 'visites' })

  return (
    <section className="stats-band" aria-label="QuelBus en chiffres">
      <ul className="container stats-list">
        {items.map((item) => (
          <li key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
