import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { SearchResult } from '@/lib/api'
import { plural, TYPE_LABELS, walkLabel } from '@/lib/search'
import LineBadge from './LineBadge'
import { FareInfo, ServiceLine } from './ServiceInfo'
import { StopStep } from './Stops'
import { colors } from './theme'
import { Card, Muted } from './ui'

export function openLine(slug: string, ids?: { direction: number; board?: number; alight?: number }) {
  router.push({
    pathname: '/ligne/[slug]',
    params: {
      slug,
      ...(ids ? { sens: String(ids.direction) } : {}),
      ...(ids?.board ? { montee: String(ids.board) } : {}),
      ...(ids?.alight ? { descente: String(ids.alight) } : {}),
    },
  })
}

export default function ResultCard({ result, best = false }: { result: SearchResult; best?: boolean }) {
  const { line, direction, board, alight, stops } = result
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Ouvre le trajet sur la carte"
      onPress={() => openLine(line.slug, { direction: direction.id, board: board.id, alight: alight.id })}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card highlight={best}>
        {best && <Text style={styles.best}>Le plus pratique</Text>}
        <View style={styles.head}>
          <LineBadge refNumber={line.ref} type={line.type} accent={best} size="lg" />
          <View style={styles.headText}>
            <Text style={styles.direction}>{direction.name}</Text>
            <Muted>
              {TYPE_LABELS[line.type]} · {plural(stops, 'arrêt')} entre montée et descente
            </Muted>
            <FareInfo fare={line.fare} accepts_student_card={line.accepts_student_card} />
            <ServiceLine schedules={direction.schedules} />
          </View>
        </View>
        <View style={styles.legs}>
          <StopStep kind="board" label="Montez à" name={board.name} walk={walkLabel(board.walk)} />
          <StopStep kind="alight" label="Descendez à" name={alight.name} walk={walkLabel(alight.walk)} />
        </View>
        <View style={styles.more}>
          <Text style={styles.moreText}>Voir le trajet sur la carte</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.accentInk} />
        </View>
      </Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  best: { color: colors.accentInk, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  headText: { flex: 1, gap: 4 },
  direction: { fontSize: 17, fontWeight: '800', color: colors.ink },
  legs: { gap: 12, paddingTop: 4 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  moreText: { color: colors.accentInk, fontWeight: '700' },
})
