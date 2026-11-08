import Ionicons from '@expo/vector-icons/Ionicons'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import Chip from '@/components/Chip'
import LineBadge from '@/components/LineBadge'
import { openLine } from '@/components/ResultCard'
import { colors, radius } from '@/components/theme'
import { ErrorView, Loading, Muted, ui } from '@/components/ui'
import { fetchLines, type LineType } from '@/lib/api'
import { CITIES } from '@/lib/cities'
import { fareLabel } from '@/lib/fares'
import { ApiError } from '@/lib/http'
import { normalize, plural, TYPE_FILTERS, TYPE_LABELS } from '@/lib/search'
import { setState, useCity } from '@/lib/store'

export default function LinesScreen() {
  const city = useCity()
  const [text, setText] = useState('')
  const [type, setType] = useState<LineType | null>(null)
  const lines = useQuery({ queryKey: ['lines', city.slug], queryFn: ({ signal }) => fetchLines(city.slug, signal) })

  const filtered = useMemo(() => {
    const q = normalize(text.trim())
    return (lines.data ?? []).filter(
      (l) => (!type || l.type === type) && (!q || normalize(`${l.ref ?? ''} ${l.name}`).includes(q)),
    )
  }, [lines.data, text, type])

  return (
    <View style={ui.screen}>
      <View style={styles.filters}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Numéro ou nom de ligne"
            placeholderTextColor={colors.faint}
            style={styles.input}
            autoCorrect={false}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CITIES.map((c) => (
            <Chip key={c.slug} label={c.name} selected={c.slug === city.slug} onPress={() => setState({ city: c.slug })} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Tous" selected={type === null} onPress={() => setType(null)} />
          {TYPE_FILTERS.map(({ value, label }) => (
            <Chip key={value} label={label} selected={type === value} onPress={() => setType(value)} />
          ))}
        </ScrollView>
      </View>

      {lines.isPending ? (
        <Loading />
      ) : lines.isError ? (
        <ErrorView
          message={lines.error instanceof ApiError ? lines.error.message : 'Chargement impossible.'}
          onRetry={() => lines.refetch()}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(l) => String(l.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={lines.isRefetching} onRefresh={() => void lines.refetch()} />}
          ListHeaderComponent={<Muted>{plural(filtered.length, 'ligne')} à {city.name}</Muted>}
          ListEmptyComponent={<Muted style={{ textAlign: 'center', marginTop: 24 }}>Aucune ligne ne correspond.</Muted>}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => openLine(item.slug)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceSoft }]}
            >
              <LineBadge refNumber={item.ref} type={item.type} size="sm" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={ui.strong} numberOfLines={2}>
                  {item.name}
                </Text>
                <Muted>
                  {TYPE_LABELS[item.type]}
                  {item.fare != null ? ` · ${fareLabel(item.fare)}` : ''}
                </Muted>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    minHeight: 46,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, fontSize: 15, color: colors.ink, paddingVertical: 10 },
  chips: { gap: 8 },
  list: { padding: 16, gap: 8, paddingBottom: 48 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
})
