import { StyleSheet, Text, View } from 'react-native'
import type { LineType } from '@/lib/api'
import { colors, typeColors } from './theme'

type Props = { refNumber: string | null; type?: LineType; accent?: boolean; size?: 'sm' | 'md' | 'lg' }

const typeShort: Record<LineType, string> = { sotra: 'Bus', gbaka: 'Gbaka', 'woro-woro': 'Wôrô', autre: 'Bus' }

const sizes = {
  sm: { width: 46, height: 36, fontSize: 16 },
  md: { width: 54, height: 44, fontSize: 19 },
  lg: { width: 62, height: 52, fontSize: 22 },
}

export default function LineBadge({ refNumber, type = 'sotra', accent = false, size = 'md' }: Props) {
  const label = refNumber ?? typeShort[type]
  const { width, height, fontSize } = sizes[size]
  return (
    <View
      accessibilityLabel={refNumber ? `Ligne ${refNumber}` : typeShort[type]}
      style={[styles.badge, { minWidth: width, height, backgroundColor: accent ? colors.accent : typeColors[type] }]}
    >
      <Text
        style={[styles.label, { fontSize: refNumber ? fontSize : fontSize * 0.62 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  label: { color: '#fff', fontWeight: '800' },
})
