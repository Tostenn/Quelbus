import { useQuery } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Chip from '@/components/Chip'
import LineBadge from '@/components/LineBadge'
import LineMap from '@/components/LineMap'
import { FareInfo, ServiceLine } from '@/components/ServiceInfo'
import { Pin } from '@/components/Stops'
import { colors, rideColors } from '@/components/theme'
import { Card, ErrorView, FieldLabel, Loading, Muted, SectionTitle, ui } from '@/components/ui'
import { fetchLine } from '@/lib/api'
import { DAY_LABELS, hourLabel } from '@/lib/fares'
import { ApiError } from '@/lib/http'
import { useLocation } from '@/lib/location'
import { lineTitle, plural, TYPE_LABELS } from '@/lib/search'

const toNumber = (value: string | undefined) => (value && /^\d+$/.test(value) ? Number(value) : undefined)

export default function LineScreen() {
  const params = useLocalSearchParams<{ slug: string; sens?: string; montee?: string; descente?: string }>()
  const boardId = toNumber(params.montee)
  const alightId = toNumber(params.descente)
  const [directionId, setDirectionId] = useState(toNumber(params.sens))
  const { position } = useLocation({ auto: true })

  const line = useQuery({
    queryKey: ['line', params.slug],
    queryFn: ({ signal }) => fetchLine(params.slug, signal),
  })

  if (line.isPending) return <Loading />
  if (line.isError) {
    const notFound = line.error instanceof ApiError && line.error.status === 404
    return (
      <ErrorView
        message={notFound ? 'Cette ligne n’existe plus.' : line.error instanceof ApiError ? line.error.message : 'Chargement impossible.'}
        onRetry={notFound ? undefined : () => line.refetch()}
      />
    )
  }

  const data = line.data
  const direction = data.directions.find((d) => d.id === directionId) ?? data.directions[0]
  // Les arrêts mis en avant n'ont de sens que dans le sens d'où vient la recherche
  const fromSearch = direction && direction.id === toNumber(params.sens)
  const board = fromSearch ? boardId : undefined
  const alight = fromSearch ? alightId : undefined

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Stack.Screen options={{ title: lineTitle(data) }} />

      <View style={styles.head}>
        <LineBadge refNumber={data.ref} type={data.type} size="lg" />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.name}>{data.name}</Text>
          <Muted>
            {TYPE_LABELS[data.type]}
            {data.operator ? ` · ${data.operator}` : ''}
            {data.city ? ` · ${data.city.name}` : ''}
          </Muted>
          <FareInfo fare={data.fare} accepts_student_card={data.accepts_student_card} />
        </View>
      </View>

      {data.directions.length > 1 && (
        <>
          <FieldLabel>Sens</FieldLabel>
          <View style={styles.chips}>
            {data.directions.map((d) => (
              <Chip key={d.id} label={d.name} selected={d.id === direction?.id} onPress={() => setDirectionId(d.id)} />
            ))}
          </View>
        </>
      )}

      {direction ? (
        <>
          {direction.stops.length > 0 && (
            <LineMap
              // Nouvelle carte à chaque sens : elle se recadre sur son tracé
              key={direction.id}
              geometry={direction.geometry}
              stops={direction.stops}
              color={rideColors[data.type]}
              boardId={board}
              alightId={alight}
              user={position}
            />
          )}

          <ServiceLine schedules={direction.schedules} />
          {direction.is_partial && (
            <Text style={styles.note}>Seuls les terminus sont connus : les arrêts intermédiaires restent à relever.</Text>
          )}

          {direction.schedules.length > 0 && (
            <Card>
              <FieldLabel>Départs du terminus</FieldLabel>
              {direction.schedules.map((s) => (
                <View key={s.day_type} style={styles.schedule}>
                  <Text style={ui.text}>{DAY_LABELS[s.day_type]}</Text>
                  <Text style={ui.strong}>
                    {hourLabel(s.first_departure)} – {hourLabel(s.last_departure)}
                  </Text>
                </View>
              ))}
            </Card>
          )}

          <SectionTitle>{plural(direction.stops.length, 'arrêt')}</SectionTitle>
          <Card style={{ paddingVertical: 8, gap: 0 }}>
            {direction.stops.map((stop, i) => {
              const kind = stop.id === board ? 'board' : stop.id === alight ? 'alight' : null
              return (
                <Pressable
                  key={`${stop.id}-${i}`}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/arret/[slug]', params: { slug: stop.slug } })}
                  style={({ pressed }) => [styles.stop, pressed && { opacity: 0.6 }]}
                >
                  {kind ? <Pin kind={kind} /> : <View style={[styles.stopDot, { borderColor: rideColors[data.type] }]} />}
                  <Text style={[styles.stopName, kind && ui.strong]} numberOfLines={2}>
                    {stop.name}
                  </Text>
                  {kind && <Text style={styles.stopTag}>{kind === 'board' ? 'Montée' : 'Descente'}</Text>}
                </Pressable>
              )
            })}
          </Card>
        </>
      ) : (
        <Muted>Aucun sens relevé pour cette ligne.</Muted>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  name: { fontSize: 20, fontWeight: '800', color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { color: colors.accentInk, fontSize: 14, lineHeight: 20 },
  schedule: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  stopDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, backgroundColor: '#fff', marginHorizontal: 1 },
  stopName: { flex: 1, fontSize: 15, color: colors.ink },
  stopTag: { fontSize: 12, fontWeight: '800', color: colors.accentInk, textTransform: 'uppercase' },
})
