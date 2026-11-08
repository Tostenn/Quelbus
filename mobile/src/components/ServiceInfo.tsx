import Ionicons from '@expo/vector-icons/Ionicons'
import { StyleSheet, Text, View } from 'react-native'
import type { Schedule } from '@/lib/fares'
import { fareLabel, serviceLabel, serviceState } from '@/lib/fares'
import { colors } from './theme'

/** « 200 F · Carte étudiant acceptée » ; rien de ce qu'on ne sait pas. */
export function FareInfo({ fare, accepts_student_card }: { fare?: number | null; accepts_student_card?: boolean | null }) {
  if (fare == null && accepts_student_card == null) return null
  return (
    <View style={styles.row}>
      {fare != null && <Text style={styles.fare}>{fareLabel(fare)}</Text>}
      {accepts_student_card != null && (
        <View style={styles.row}>
          <Ionicons name="id-card-outline" size={15} color={accepts_student_card ? colors.success : colors.muted} />
          <Text style={[styles.small, { color: accepts_student_card ? colors.success : colors.muted }]}>
            {accepts_student_card ? 'Carte étudiant acceptée' : 'Carte étudiant non acceptée'}
          </Text>
        </View>
      )}
    </View>
  )
}

/** Plage de service du jour : « Départs du terminus jusqu'à 21 h ». */
export function ServiceLine({ schedules }: { schedules?: Schedule[] }) {
  const service = serviceState(schedules)
  if (!service) return null
  const color = service.state === 'en-service' ? colors.success : colors.danger
  return (
    <View style={styles.row}>
      <Ionicons name="time-outline" size={15} color={color} />
      <Text style={[styles.small, { color }]}>{serviceLabel(service)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  fare: { fontWeight: '800', color: colors.ink, fontSize: 14 },
  small: { fontSize: 13 },
})
