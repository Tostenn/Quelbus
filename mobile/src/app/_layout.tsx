import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { colors } from '@/components/theme'
import { ApiError } from '@/lib/http'
import { hydrate } from '@/lib/store'

SplashScreen.preventAutoHideAsync().catch(() => {})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      // Réseau mobile instable : on réessaie, sauf quand réessayer ne changera rien
      retry: (count, error) => !(error instanceof ApiError && (error.status === 404 || error.status === 429)) && count < 2,
    },
  },
})

export default function RootLayout() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    hydrate().finally(() => {
      setReady(true)
      SplashScreen.hideAsync().catch(() => {})
    })
  }, [])

  if (!ready) return null

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '800' },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="lieu" options={{ presentation: 'modal', title: 'Choisir un lieu' }} />
        <Stack.Screen name="resultats" options={{ title: 'Vos bus' }} />
        <Stack.Screen name="ligne/[slug]" options={{ title: '' }} />
        <Stack.Screen name="arret/[slug]" options={{ title: '' }} />
      </Stack>
    </QueryClientProvider>
  )
}
