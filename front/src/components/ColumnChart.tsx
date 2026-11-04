import { useState } from 'react'

type Props = {
  title: string
  values: number[]
  /** Libellé de chaque colonne, pour l'infobulle et le tableau accessible */
  labels: string[]
  /** Libellés affichés sous l'axe (quelques-uns seulement) */
  ticks: string[]
}

const W = 600
const H = 140
const GAP = 4

/** Colonnes d'une seule série (heures, jours) : le titre sert de légende. */
export default function ColumnChart({ title, values, labels, ticks }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...values)
  const step = W / values.length
  const bar = step - GAP
  const radius = Math.min(4, bar / 2)

  return (
    <figure className="day-chart">
      <figcaption>
        <span className="day-chart-title">{title}</span>
      </figcaption>
      <div className="day-chart-plot" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="day-chart-axis" />
          {values.map((v, i) => {
            const h = v ? Math.max(radius * 2, (v / max) * (H - 8)) : 0
            return (
              <g key={labels[i]}>
                {h > 0 && (
                  <path
                    className={`day-chart-bar${hover === i ? ' is-hover' : ''}`}
                    d={`M${i * step + GAP / 2},${H} v${-(h - radius)} q0,${-radius} ${radius},${-radius} h${bar - radius * 2} q${radius},0 ${radius},${radius} v${h - radius} z`}
                  />
                )}
                <rect x={i * step} y="0" width={step} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
              </g>
            )
          })}
        </svg>
        {hover !== null && (
          <div className="day-chart-tip" style={{ left: `${((hover + 0.5) / values.length) * 100}%` }}>
            <strong>{values[hover].toLocaleString('fr-FR')}</strong> · {labels[hover]}
          </div>
        )}
      </div>
      <div className="day-chart-ticks" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <table className="visually-hidden">
        <caption>{title}</caption>
        <tbody>
          {values.map((v, i) => (
            <tr key={labels[i]}>
              <th scope="row">{labels[i]}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
