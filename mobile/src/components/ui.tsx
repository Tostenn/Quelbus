import Ionicons from '@expo/vector-icons/Ionicons'
import type { ComponentProps, ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import { colors, radius, space } from './theme'

export type IconName = ComponentProps<typeof Ionicons>['name']

export function Card({ children, style, highlight }: { children: ReactNode; style?: StyleProp<ViewStyle>; highlight?: boolean }) {
  return <View style={[styles.card, highlight && styles.cardHighlight, style]}>{children}</View>
}

type ButtonProps = {
  label: string
  onPress: () => void
  icon?: IconName
  variant?: 'primary' | 'ghost'
  disabled?: boolean
  loading?: boolean
}

export function Button({ label, onPress, icon, variant = 'primary', disabled, loading }: ButtonProps) {
  const primary = variant === 'primary'
  const tint = primary ? '#fff' : colors.ink
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonGhost,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? <ActivityIndicator color={tint} /> : icon ? <Ionicons name={icon} size={20} color={tint} /> : null}
      <Text style={[styles.buttonLabel, { color: tint }]}>{label}</Text>
    </Pressable>
  )
}

/** Chargement centré. */
export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  )
}

/** Erreur avec bouton « Réessayer ». */
export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={40} color={colors.faint} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && <Button label="Réessayer" icon="refresh" variant="ghost" onPress={onRetry} />}
    </View>
  )
}

export function Empty({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={40} color={colors.faint} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {children}
    </View>
  )
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.muted, style]}>{children}</Text>
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.fieldLabel}>{children}</Text>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>
}

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space, gap: 12, paddingBottom: space * 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  strong: { fontWeight: '700', color: colors.ink },
  text: { fontSize: 15, color: colors.ink, lineHeight: 21 },
})

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space,
    gap: 10,
  },
  cardHighlight: { borderColor: colors.accent, borderWidth: 2 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.75 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: space * 2 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  errorText: { color: colors.ink, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  fieldLabel: { color: colors.faint, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 8 },
})
