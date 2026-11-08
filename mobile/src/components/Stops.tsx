import Ionicons from '@expo/vector-icons/Ionicons'
import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors } from './theme'
import { FieldLabel } from './ui'

/** Point coloré d'une étape : montée (vert), changement (bleu), descente (orange). */
export function Pin({ kind }: { kind: 'board' | 'change' | 'alight' }) {
  const color = kind === 'board' ? colors.board : kind === 'change' ? colors.change : colors.alight
  return <View style={[styles.pin, { borderColor: color }]} />
}

/** Une étape : « Montez à … », avec la marche en dessous. */
export function StopStep({
  kind,
  label,
  name,
  walk,
}: {
  kind: 'board' | 'change' | 'alight'
  label: string
  name: string
  walk?: ReactNode
}) {
  return (
    <View style={styles.step}>
      <Pin kind={kind} />
      <View style={styles.stepBody}>
        <FieldLabel>{label}</FieldLabel>
        <Text style={styles.stopName}>{name}</Text>
        {walk ? (
          <View style={styles.walk}>
            <Ionicons name="walk-outline" size={15} color={colors.muted} />
            <Text style={styles.walkText}>{walk}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pin: { width: 14, height: 14, borderRadius: 7, borderWidth: 4, backgroundColor: '#fff', marginTop: 3 },
  stepBody: { flex: 1, gap: 2 },
  stopName: { fontSize: 16, fontWeight: '700', color: colors.ink },
  walk: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  walkText: { color: colors.muted, fontSize: 13, flexShrink: 1 },
})
