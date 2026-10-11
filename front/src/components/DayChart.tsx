import { useState } from 'react'
import type { DayStat } from '../lib/admin'

type Props = { title: string; days: DayStat[]; metric: 'visits' | 'searches' }

const W = 600
const H = 160
const GAP = 2

const dayLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

/** Barres par jour sur 30 jours : une seule série, le titre sert de légende. */
export default function DayChart({ title, days, metric }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...days.map((d) => d[metric]))
  const step = W / days.length
  const bar = step - GAP
  const total = days.reduce((sum, d) => sum + d[metric], 0)
  const active = hover !== null ? days[hover] : null

  return (
    <figure className="day-chart">
      <figcaption>
        <span className="day-chart-title">{title}</span>
        <span className="day-chart-total">{total.toLocaleString('fr-FR')} sur 30 jours</span>
      </figcaption>
      <div className="day-chart-plot" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="day-chart-axis" />
          {days.map((d, i) => {
            const h = d[metric] ? Math.max(4, (d[metric] / max) * (H - 8)) : 0
            return (
              <g key={d.date}>
                {h > 0 && (
                  <path
                    className={`day-chart-bar${hover === i ? ' is-hover' : ''}`}
                    d={`M${i * step + GAP / 2},${H} v${-(h - 4)} q0,-4 4,-4 h${bar - 8} q4,0 4,4 v${h - 4} z`}
                  />
                )}
                {/* Zone de survol plus large que la barre */}
                <rect x={i * step} y="0" width={step} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
              </g>
            )
          })}
        </svg>
        {active && hover !== null && (
          <div className="day-chart-tip" style={{ left: `${((hover + 0.5) / days.length) * 100}%` }}>
            <strong>{active[metric].toLocaleString('fr-FR')}</strong> · {dayLabel(active.date)}
          </div>
        )}
      </div>
      <div className="day-chart-ticks" aria-hidden="true">
        <span>{dayLabel(days[0].date)}</span>
        <span>Aujourd’hui</span>
      </div>
      <table className="visually-hidden">
        <caption>{title} par jour</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{dayLabel(d.date)}</th>
              <td>{d[metric]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
