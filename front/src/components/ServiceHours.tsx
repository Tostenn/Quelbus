import { Clock } from '@phosphor-icons/react'
import { DAY_LABELS, hourLabel, serviceState, todaySchedule, type Schedule } from '../lib/fares'

const STATE_LABELS = {
  avant: 'Le service n’a pas encore commencé',
  'en-service': 'En service',
  termine: 'Plus de départ du terminus aujourd’hui',
}

/** Premier et dernier départ d'un sens, avec l'état du service à l'heure qu'il est. */
export default function ServiceHours({ schedules }: { schedules: Schedule[] }) {
  if (!schedules.length) {
    return (
      <p className="muted service-unknown">
        <Clock size={18} aria-hidden="true" /> Horaires pas encore relevés pour ce sens. Vous les connaissez&nbsp;?
        Signalez-les ci-dessous.
      </p>
    )
  }

  const service = serviceState(schedules)
  const today = todaySchedule(schedules)
  const sources = [...new Set(schedules.map((s) => s.source).filter(Boolean))]

  return (
    <section className="service-hours" aria-labelledby="horaires-titre">
      <h2 id="horaires-titre" className="service-title">
        <Clock size={20} aria-hidden="true" /> Départs du terminus
        {service && <span className={`service-state is-${service.state}`}>{STATE_LABELS[service.state]}</span>}
      </h2>
      <dl className="service-list">
        {schedules.map((s) => (
          <div key={s.day_type} className={s === today ? 'is-today' : undefined}>
            <dt>{DAY_LABELS[s.day_type]}</dt>
            <dd>
              {hourLabel(s.first_departure)} – {hourLabel(s.last_departure)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="form-note">
        Premier et dernier départ au terminus : le bus passe à votre arrêt un peu plus tard.
        {sources.length > 0 && ` Source : ${sources.join(' ; ')}.`}
      </p>
    </section>
  )
}
