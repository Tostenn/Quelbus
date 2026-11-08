import { useQuery } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import LineBadge from '@/components/LineBadge'
import { openLine } from '@/components/ResultCard'
import { colors } from '@/components/theme'
import { Card, ErrorView, Loading, Muted, SectionTitle, ui } from '@/components/ui'
import { fetchStop } from '@/lib/api'
import { ApiError } from '@/lib/http'
import { plural, TYPE_LABELS } from '@/lib/search'

export default function StopScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const stop = useQuery({ queryKey: ['stop', slug], queryFn: ({ signal }) => fetchStop(slug, signal) })

  if (stop.isPending) return <Loading />
  if (stop.isError) {
    return (
      <ErrorView
        message={stop.error instanceof ApiError ? stop.error.message : 'Chargement impossible.'}
        onRetry={() => stop.refetch()}
      />
    )
  }

  const data = stop.data
  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Stack.Screen options={{ title: 'Arrêt' }} />
      <Text style={ui.title}>{data.name}</Text>
      {data.city && <Muted>{data.city.name}</Muted>}

      <SectionTitle>{plural(data.lines.length, 'ligne')} à cet arrêt</SectionTitle>
      {data.lines.length === 0 && <Muted>Aucune ligne relevée à cet arrêt.</Muted>}
      {data.lines.map(({ line, direction }) => (
        <Pressable
          key={direction.id}
          accessibilityRole="button"
          onPress={() => openLine(line.slug, { direction: direction.id })}
          style={({ pressed }) => pressed && { opacity: 0.7 }}
        >
          <Card style={styles.lineRow}>
            <LineBadge refNumber={line.ref} type={line.type} size="sm" />
            <View style={{ flex: 1 }}>
              <Text style={ui.strong}>{direction.name}</Text>
              <Muted>{TYPE_LABELS[line.type]}</Muted>
            </View>
          </Card>
        </Pressable>
      ))}

      {data.nearby.length > 0 && (
        <>
          <SectionTitle>Arrêts à côté</SectionTitle>
          <Card style={{ paddingVertical: 4, gap: 0 }}>
            {data.nearby.map((n) => (
              <Pressable
                key={n.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/arret/[slug]', params: { slug: n.slug } })}
                style={({ pressed }) => [styles.nearby, pressed && { opacity: 0.6 }]}
              >
                <Text style={[ui.text, { flex: 1 }]}>{n.name}</Text>
                <Muted>{n.walk} m</Muted>
              </Pressable>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  nearby: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
})
