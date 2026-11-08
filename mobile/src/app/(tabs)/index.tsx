import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Chip from '@/components/Chip'
import { colors, radius } from '@/components/theme'
import { Button, Card, FieldLabel, Muted, ui } from '@/components/ui'
import type { LineType, Place } from '@/lib/api'
import { CITIES, cityAt } from '@/lib/cities'
import { locationMessage, useLocation } from '@/lib/location'
import { MY_POSITION, TYPE_FILTERS } from '@/lib/search'
import { choosePlace, setState, swapPlaces, useAppState, useCity } from '@/lib/store'

function PlaceField({
  field,
  place,
  placeholder,
}: {
  field: 'from' | 'to'
  place: Place | null
  placeholder: string
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${field === 'from' ? 'Départ' : 'Arrivée'} : ${place?.name ?? 'à choisir'}`}
      onPress={() => router.push({ pathname: '/lieu', params: { field } })}
      style={({ pressed }) => [styles.field, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.dot, { backgroundColor: field === 'from' ? colors.board : colors.alight }]} />
      <View style={styles.fieldBody}>
        <FieldLabel>{field === 'from' ? 'Où êtes-vous ?' : 'Où allez-vous ?'}</FieldLabel>
        <Text style={[styles.fieldValue, !place && styles.placeholder]} numberOfLines={1}>
          {place?.name ?? placeholder}
        </Text>
      </View>
    </Pressable>
  )
}

export default function TripScreen() {
  const from = useAppState((s) => s.from)
  const to = useAppState((s) => s.to)
  const types = useAppState((s) => s.types)
  const city = useCity()
  const { status, request } = useLocation()

  const locate = async () => {
    const position = await request()
    if (!position) return
    choosePlace('from', { name: MY_POSITION, ...position }, false)
    // On suit la ville où l'on se trouve
    const here = cityAt(position)
    if (here) setState({ city: here.slug })
  }

  const toggleType = (type: LineType) =>
    setState((s) => ({ types: s.types.includes(type) ? s.types.filter((t) => t !== type) : [...s.types, type] }))

  const message = locationMessage[status]
  const outside = from && from.name === MY_POSITION && !cityAt(from)

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <Text style={ui.title}>Quel bus prendre ?</Text>
      <Muted>Indiquez d’où vous partez et où vous allez : QuelBus trouve les lignes qui y vont.</Muted>

      <Card style={styles.form}>
        <PlaceField field="from" place={from} placeholder="Choisir le départ" />
        <View style={styles.separator}>
          <View style={styles.line} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Inverser départ et arrivée"
            onPress={swapPlaces}
            hitSlop={10}
            style={styles.swap}
          >
            <Ionicons name="swap-vertical" size={18} color={colors.ink} />
          </Pressable>
        </View>
        <PlaceField field="to" place={to} placeholder="Choisir la destination" />
      </Card>

      <Button
        label={status === 'locating' ? 'Localisation…' : 'Partir de ma position'}
        icon="locate"
        variant="ghost"
        loading={status === 'locating'}
        onPress={locate}
      />
      {message && <Text style={styles.error}>{message}</Text>}
      {outside && (
        <Text style={styles.error}>
          Vous semblez hors des villes couvertes ({CITIES.map((c) => c.name).join(', ')}).
        </Text>
      )}

      <FieldLabel>Types de transport</FieldLabel>
      <View style={styles.chips}>
        <Chip label="Tous" selected={types.length === 0} onPress={() => setState({ types: [] })} />
        {TYPE_FILTERS.map(({ value, label }) => (
          <Chip key={value} label={label} selected={types.includes(value)} onPress={() => toggleType(value)} />
        ))}
      </View>

      <FieldLabel>Ville</FieldLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {CITIES.map((c) => (
          <Chip key={c.slug} label={c.name} selected={c.slug === city.slug} onPress={() => setState({ city: c.slug })} />
        ))}
      </ScrollView>

      <View style={{ marginTop: 8 }}>
        <Button
          label="Trouver mon bus"
          icon="search"
          disabled={!from || !to}
          onPress={() => router.push('/resultats')}
        />
      </View>
      {(!from || !to) && <Muted style={styles.hint}>Choisissez un départ et une destination.</Muted>}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  form: { padding: 0, gap: 0 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, minHeight: 72 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  fieldBody: { flex: 1, gap: 2 },
  fieldValue: { fontSize: 17, fontWeight: '700', color: colors.ink },
  placeholder: { color: colors.faint, fontWeight: '500' },
  separator: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  swap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20, borderRadius: radius },
  hint: { textAlign: 'center' },
})
