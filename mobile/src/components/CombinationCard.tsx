import Ionicons from '@expo/vector-icons/Ionicons'
import { Fragment } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Combination, CombinationLeg } from '@/lib/api'
import { fareLabel, totalFare } from '@/lib/fares'
import { lineShort, plural, SAME_STOP_M, sameName, TYPE_LABELS, walkLabel } from '@/lib/search'
import LineBadge from './LineBadge'
import { openLine } from './ResultCard'
import { StopStep } from './Stops'
import { colors, rideColors } from './theme'
import { Card, Muted } from './ui'

/** Marche pour rejoindre l'arrêt de la ligne suivante. */
function changeWalk(previous: CombinationLeg, leg: CombinationLeg): string {
  if (leg.board.walk < SAME_STOP_M) return 'Au même arrêt'
  const walk = sameName(previous.alight.name, leg.board.name)
    ? `L’arrêt du ${lineShort(leg.line)} est à ${walkLabel(leg.board.walk)}`
    : `${walkLabel(leg.board.walk)} depuis ${previous.alight.name}`
  return leg.lines_here >= 5 ? `${walk} · ${leg.lines_here} lignes y passent` : walk
}

/** Trajet avec changement(s). Chaque tronçon s'ouvre sur la carte de sa ligne. */
export default function CombinationCard({ combination, best = false }: { combination: Combination; best?: boolean }) {
  const { legs, changes } = combination
  const last = legs[legs.length - 1]
  if (!last) return null
  const total = totalFare(legs.map((l) => ({ fare: l.line.fare ?? null, accepts_student_card: null })))

  return (
    <Card highlight={best}>
      {best && <Text style={styles.best}>Le plus pratique</Text>}
      <View style={styles.badges}>
        {legs.map((leg, i) => (
          <Fragment key={leg.direction.id}>
            {i > 0 && <Ionicons name="arrow-forward" size={18} color={colors.muted} />}
            <LineBadge refNumber={leg.line.ref} type={leg.line.type} accent={best && leg.line.type === 'sotra'} size="lg" />
          </Fragment>
        ))}
      </View>
      <Muted>
        {plural(changes, 'changement')} · {plural(combination.stops, 'arrêt')} · {combination.walk} m à pied au total
        {total !== null ? ` · ${fareLabel(total)} en tout` : ''}
      </Muted>

      <View style={styles.steps}>
        {legs.map((leg, i) => {
          const previous = legs[i - 1]
          return (
            <Fragment key={leg.direction.id}>
              {previous ? (
                <StopStep kind="change" label="Changez à" name={leg.board.name} walk={changeWalk(previous, leg)} />
              ) : (
                <StopStep kind="board" label="Montez à" name={leg.board.name} walk={walkLabel(leg.board.walk)} />
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityHint="Ouvre ce tronçon sur la carte"
                onPress={() => openLine(leg.line.slug, { direction: leg.direction.id, board: leg.board.id, alight: leg.alight.id })}
                style={({ pressed }) => [styles.ride, { borderLeftColor: rideColors[leg.line.type] }, pressed && styles.pressed]}
              >
                <View style={styles.rideHead}>
                  <LineBadge refNumber={leg.line.ref} type={leg.line.type} size="sm" />
                  <Text style={styles.rideText}>
                    {TYPE_LABELS[leg.line.type]} direction{' '}
                    <Text style={styles.strong}>{leg.direction.destination_label ?? leg.direction.name}</Text>
                  </Text>
                </View>
                <Muted>
                  {plural(leg.stops, 'arrêt')}, descendez à <Text style={styles.strong}>{leg.alight.name}</Text>
                </Muted>
                <View style={styles.more}>
                  <Text style={styles.moreText}>Voir sur la carte</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.accentInk} />
                </View>
              </Pressable>
            </Fragment>
          )
        })}
        <StopStep
          kind="alight"
          label="Arrivée"
          name={last.alight.name}
          walk={`${walkLabel(last.alight.walk)} jusqu’à votre destination`}
        />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  best: { color: colors.accentInk, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  steps: { gap: 12, paddingTop: 4 },
  ride: { marginLeft: 6, paddingLeft: 18, paddingVertical: 6, borderLeftWidth: 3, gap: 4 },
  rideHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rideText: { flex: 1, color: colors.ink, fontSize: 14 },
  strong: { fontWeight: '700', color: colors.ink },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  moreText: { color: colors.accentInk, fontWeight: '700', fontSize: 13 },
  pressed: { opacity: 0.7 },
})
