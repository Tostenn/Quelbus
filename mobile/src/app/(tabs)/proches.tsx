import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import LineBadge from '@/components/LineBadge'
import { openLine } from '@/components/ResultCard'
import { colors } from '@/components/theme'
import { Button, Card, Empty, ErrorView, Loading, Muted, ui } from '@/components/ui'
import { fetchArrivals, fetchNearestStop } from '@/lib/api'
import { basisLabel, clock, inLabel, minutesUntil, sortedUpcoming } from '@/lib/arrivals'
import { ApiError } from '@/lib/http'
import { locationMessage, useLocation } from '@/lib/location'

/** Heure courante, rafraîchie toutes les 30 s pour les « dans 5 min ». */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export default function NearbyScreen() {
  const { position, status, request } = useLocation({ auto: true })
  const now = useNow()
  const key = position ? [position.lat.toFixed(3), position.lng.toFixed(3)] : null

  const arrivals = useQuery({
    queryKey: ['arrivals', key],
    queryFn: ({ signal }) => fetchArrivals(position!, undefined, signal),
    enabled: Boolean(position),
    staleTime: 30000,
    refetchInterval: 60000,
  })
  const nearest = useQuery({
    queryKey: ['nearest', key],
    queryFn: ({ signal }) => fetchNearestStop(position!.lat, position!.lng, signal),
    enabled: Boolean(position),
  })

  if (!position) {
    if (status === 'locating') return <Loading label="Localisation…" />
    return (
      <Empty icon="time-outline" title="Les bus bientôt près de vous">
        <Muted style={{ textAlign: 'center' }}>
          Les passages habituels aux arrêts proches, estimés d’après les trajets déjà partagés.
        </Muted>
        {locationMessage[status] && <Text style={styles.error}>{locationMessage[status]}</Text>}
        <Button label="Partager ma position" icon="locate" onPress={request} />
      </Empty>
    )
  }
  if (arrivals.isPending) return <Loading label="Recherche des passages…" />
  if (arrivals.isError) {
    return (
      <ErrorView
        message={arrivals.error instanceof ApiError ? arrivals.error.message : 'Chargement impossible.'}
        onRetry={() => arrivals.refetch()}
      />
    )
  }

  const items = sortedUpcoming(arrivals.data, now)

  return (
    <FlatList
      style={ui.screen}
      contentContainerStyle={ui.content}
      data={items}
      keyExtractor={(item) => String(item.arrival.direction.id)}
      refreshControl={
        <RefreshControl
          refreshing={arrivals.isRefetching}
          onRefresh={() => {
            request()
            arrivals.refetch()
          }}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: 4, marginBottom: 4 }}>
          <Text style={ui.title}>Bientôt près de vous</Text>
          {nearest.data && (
            <Muted>
              Arrêt le plus proche : {nearest.data.name} ({nearest.data.walk} m)
            </Muted>
          )}
          <Muted>Estimations d’après les passages relevés, pas du temps réel.</Muted>
        </View>
      }
      ListEmptyComponent={
        <Card>
          <Text style={ui.strong}>Aucun passage estimé pour l’instant.</Text>
          <Muted>Il faut que des trajets aient déjà été partagés sur les lignes proches.</Muted>
        </Card>
      }
      renderItem={({ item: { arrival, next } }) => {
        const first = next[0]!
        return (
          <Pressable
            accessibilityRole="button"
            onPress={() => openLine(arrival.line.slug, { direction: arrival.direction.id })}
            style={({ pressed }) => pressed && { opacity: 0.7 }}
          >
            <Card style={styles.row}>
              <LineBadge refNumber={arrival.line.ref} type={arrival.line.type} size="md" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={ui.strong} numberOfLines={1}>
                  Vers {arrival.direction.destination ?? arrival.direction.name}
                </Text>
                <Muted>
                  {arrival.stop.name}
                  {arrival.stop.walk_m > 30 ? ` · ${arrival.stop.walk_m} m` : ''}
                </Muted>
                <Text style={styles.basis}>{basisLabel(first.days)}</Text>
              </View>
              <View style={styles.time}>
                <Text style={styles.in}>{inLabel(minutesUntil(first.at, now))}</Text>
                <Muted>vers {clock(first.at)}</Muted>
              </View>
            </Card>
          </Pressable>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  time: { alignItems: 'flex-end', maxWidth: 120 },
  in: { fontWeight: '800', color: colors.accentInk, fontSize: 15, textAlign: 'right' },
  basis: { color: colors.faint, fontSize: 12 },
  error: { color: colors.danger, textAlign: 'center' },
})
