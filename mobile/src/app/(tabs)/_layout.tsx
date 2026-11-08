import Ionicons from '@expo/vector-icons/Ionicons'
import { Tabs } from 'expo-router/js-tabs'
import { colors } from '@/components/theme'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontWeight: '800', color: colors.ink },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontWeight: '700' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trajet',
          headerTitle: 'QuelBus',
          tabBarIcon: ({ color, size }) => <Ionicons name="navigate" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="proches"
        options={{
          title: 'Près de moi',
          tabBarIcon: ({ color, size }) => <Ionicons name="time" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="lignes"
        options={{
          title: 'Lignes',
          tabBarIcon: ({ color, size }) => <Ionicons name="bus" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  )
}
