import { IdentificationCard } from '@phosphor-icons/react'
import { fareLabel, type Fare } from '../lib/fares'

/** « 200 F · Carte étudiant acceptée » ; rien de ce qu'on ne sait pas. */
export default function FareInfo({ fare, accepts_student_card }: Partial<Fare>) {
  if (fare == null && accepts_student_card == null) return null
  return (
    <span className="fare-info">
      {fare != null && <strong>{fareLabel(fare)}</strong>}
      {accepts_student_card != null && (
        <span className={accepts_student_card ? 'student-yes' : 'student-no'}>
          <IdentificationCard size={16} aria-hidden="true" />
          {accepts_student_card ? 'Carte étudiant acceptée' : 'Carte étudiant non acceptée'}
        </span>
      )}
    </span>
  )
}
