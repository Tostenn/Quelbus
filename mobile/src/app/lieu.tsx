import Ionicons from '@expo/vector-icons/Ionicons'
import { useQuery } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, radius } from '@/components/theme'
import { FieldLabel, Muted, ui, type IconName } from '@/components/ui'
import { fetchSuggestions, type Place } from '@/lib/api'
import { cityAt } from '@/lib/cities'
import { ApiError } from '@/lib/http'
import { locationMessage, useLocation } from '@/lib/location'
import { MY_POSITION, plural } from '@/lib/search'
import { choosePlace, setState, useAppState, useCity } from '@/lib/store'

/** Valeur retardée : on n'interroge l'API qu'une fois la frappe arrêtée. */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function Row({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceSoft }]}
    >
      <Ionicons name={icon} size={20} color={colors.muted} />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Muted>{subtitle}</Muted> : null}
      </View>
    </Pressable>
  )
}

export default function PlacePicker() {
  const { field: rawField } = useLocalSearchParams<{ field?: string }>()
  const field = rawField === 'to' ? 'to' : 'from'
  const city = useCity()
  const recents = useAppState((s) => s.recents)
  const [text, setText] = useState('')
  const query = useDebounced(text.trim(), 250)
  const { status, request } = useLocation()

  const suggestions = useQuery({
    queryKey: ['suggest', city.slug, query],
    queryFn: ({ signal }) => fetchSuggestions(query.slice(0, 100), city.slug, signal),
    enabled: query.length >= 2,
    staleTime: 10 * 60 * 1000,
  })

  const pick = (place: Place, keepRecent = true) => {
    choosePlace(field, place, keepRecent)
    router.back()
  }

  const pickMyPosition = async () => {
    const position = await request()
    if (!position) return
    const here = cityAt(position)
    if (here) setState({ city: here.slug })
    pick({ name: MY_POSITION, ...position }, false)
  }

  const searching = query.length >= 2
  const message = locationMessage[status]

  return (
    <View style={ui.screen}>
      <Stack.Screen options={{ title: field === 'from' ? 'Départ' : 'Destination' }} />
      <View style={styles.search}>
        <Ionicons name="search" size={20} color={colors.muted} />
        <TextInput
          autoFocus
          value={text}
          onChangeText={setText}
          placeholder={`Un lieu, un arrêt, un quartier ${field === 'from' ? '' : 'de destination '}à ${city.name}`}
          placeholderTextColor={colors.faint}
          style={styles.input}
          returnKeyType="search"
          autoCorrect={false}
          maxLength={100}
        />
        {text.length > 0 && (
          <Pressable accessibilityLabel="Effacer" onPress={() => setText('')} hitSlop={10}>
            <Ionicons name="close-circle" size={20} color={colors.faint} />
          </Pressable>
        )}
      </View>

      <FlatList
        keyboardShouldPersistTaps="handled"
        data={searching ? (suggestions.data ?? []) : recents}
        keyExtractor={(item, index) => `${item.name}-${item.lat}-${item.lng}-${index}`}
        ListHeaderComponent={
          <View>
            <Row
              icon="locate"
              title={status === 'locating' ? 'Localisation…' : MY_POSITION}
              subtitle="Utiliser la position du téléphone"
              onPress={pickMyPosition}
            />
            {message && <Text style={styles.error}>{message}</Text>}
            {!searching && recents.length > 0 && (
              <View style={styles.sectionHead}>
                <FieldLabel>Récents</FieldLabel>
              </View>
            )}
            {searching && suggestions.isFetching && !suggestions.data && (
              <ActivityIndicator style={{ margin: 24 }} color={colors.accent} />
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Row
            icon={searching ? 'location-outline' : 'time-outline'}
            title={item.name}
            subtitle={'stops' in item && typeof item.stops === 'number' && item.stops > 0 ? plural(item.stops, 'arrêt') : undefined}
            onPress={() => pick({ name: item.name, lat: item.lat, lng: item.lng })}
          />
        )}
        ListEmptyComponent={
          searching && suggestions.isSuccess ? (
            <Muted style={styles.empty}>Aucun lieu trouvé pour « {query} » à {city.name}.</Muted>
          ) : searching && suggestions.isError ? (
            <Text style={[styles.error, styles.empty]}>
              {suggestions.error instanceof ApiError ? suggestions.error.message : 'La recherche a échoué.'}
            </Text>
          ) : !searching ? (
            <Muted style={styles.empty}>Tapez au moins deux lettres : « Adjamé », « Cocody Angré », « Gare de Bassam »…</Muted>
          ) : undefined
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    paddingHorizontal: 14,
    minHeight: 52,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.ink },
  sectionHead: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  error: { color: colors.danger, paddingHorizontal: 20, paddingBottom: 8, lineHeight: 20 },
  empty: { paddingHorizontal: 20, paddingTop: 16, textAlign: 'center' },
})
