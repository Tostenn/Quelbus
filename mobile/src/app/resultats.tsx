import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import Chip from '@/components/Chip'
import CombinationCard from '@/components/CombinationCard'
import ResultCard from '@/components/ResultCard'
import { colors } from '@/components/theme'
import { Button, Card, Empty, ErrorView, FieldLabel, Loading, Muted, ui } from '@/components/ui'
import { fetchSearch, type SearchResponse } from '@/lib/api'
import { ApiError } from '@/lib/http'
import { formatDistance, plural, RADII } from '@/lib/search'
import { setState, useAppState } from '@/lib/store'

function Summary({ data }: { data: SearchResponse }) {
  const count = data.results.length
  const notes: string[] = []
  if (data.expanded) notes.push(`Rien à ${data.requested_radius} m : on a élargi la marche à ${data.radius} m.`)
  if (data.walkable) notes.push(`Votre destination n’est qu’à ${formatDistance(data.distance)} : vous pouvez aussi y aller à pied.`)
  return (
    <View style={{ gap: 4 }}>
      <Text style={ui.title}>
        {count > 0
          ? plural(count, 'ligne directe')
          : data.combinations.length > 0
            ? 'Avec changement'
            : 'Aucune ligne trouvée'}
      </Text>
      <Muted>À vol d’oiseau : {formatDistance(data.distance)}</Muted>
      {notes.map((note) => (
        <Text key={note} style={styles.note}>
          {note}
        </Text>
      ))}
    </View>
  )
}

export default function ResultsScreen() {
  const from = useAppState((s) => s.from)
  const to = useAppState((s) => s.to)
  const types = useAppState((s) => s.types)
  const radius = useAppState((s) => s.radius)

  const search = useQuery({
    queryKey: ['search', from, to, types, radius],
    queryFn: ({ signal }) => fetchSearch({ from: from!, to: to!, types, radius }, signal),
    enabled: Boolean(from && to),
  })

  if (!from || !to) {
    return (
      <Empty icon="navigate-outline" title="Choisissez un départ et une destination">
        <Button label="Retour" variant="ghost" onPress={() => router.back()} />
      </Empty>
    )
  }
  if (search.isPending) return <Loading label="Recherche des lignes…" />
  if (search.isError) {
    return (
      <ErrorView
        message={search.error instanceof ApiError ? search.error.message : 'La recherche a échoué.'}
        onRetry={() => search.refetch()}
      />
    )
  }

  const data = search.data
  const direct = data.results.map((result, i) => (
    <ResultCard key={`d-${result.direction.id}-${result.board.id}`} result={result} best={i === 0 && data.prefer === 'direct'} />
  ))
  const combos = data.combinations.map((combination, i) => (
    <CombinationCard
      key={`c-${combination.legs.map((l) => l.direction.id).join('-')}`}
      combination={combination}
      best={i === 0 && data.prefer === 'combinations'}
    />
  ))
  const sections: ReactNode[] = data.prefer === 'combinations' ? [...combos, ...direct] : [...direct, ...combos]

  return (
    <ScrollView
      style={ui.screen}
      contentContainerStyle={ui.content}
      refreshControl={<RefreshControl refreshing={search.isRefetching} onRefresh={() => void search.refetch()} />}
    >
      <Card style={styles.trip}>
        <Text style={styles.tripText} numberOfLines={1}>
          <Text style={{ color: colors.board }}>● </Text>
          {from.name}
        </Text>
        <Text style={styles.tripText} numberOfLines={1}>
          <Text style={{ color: colors.alight }}>● </Text>
          {to.name}
        </Text>
      </Card>

      <Summary data={data} />

      {sections.length === 0 ? (
        <Card>
          <Text style={ui.strong}>Pas de ligne connue entre ces deux lieux.</Text>
          <Muted>
            Essayez d’accepter plus de marche, ou un lieu proche plus connu. Le réseau est encore en cours de relevé :
            vos signalements sur quelbus.ci nous aident à le compléter.
          </Muted>
        </Card>
      ) : (
        sections
      )}

      <FieldLabel>Marche maximale jusqu’à l’arrêt</FieldLabel>
      <View style={styles.chips}>
        {RADII.map((r) => (
          <Chip key={r} label={`${r} m`} selected={radius === r} onPress={() => setState({ radius: r })} />
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  trip: { gap: 6, paddingVertical: 12 },
  tripText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  note: { color: colors.accentInk, fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
})
