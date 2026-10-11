import { useEffect, useState } from 'react'
import { API_URL } from './config'

type State<T> = { path: string; data?: T; error?: string; notFound?: boolean }

export function useApi<T>(path: string) {
  const [state, setState] = useState<State<T>>({ path: '' })
  const [retries, setRetries] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_URL}/api${path}`, { headers: { Accept: 'application/json' }, signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) return setState({ path, notFound: true })
        if (!response.ok) return setState({ path, error: 'Le chargement a échoué. Réessayez dans un instant.' })
        const json = await response.json()
        setState({ path, data: json.data })
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setState({ path, error: 'Impossible de joindre le serveur. Vérifiez votre connexion.' })
      })
    return () => controller.abort()
  }, [path, retries])

  const loading = state.path !== path
  return {
    data: loading ? undefined : state.data,
    error: loading ? undefined : state.error,
    notFound: !loading && state.notFound === true,
    loading,
    retry: () => {
      setState({ path: '' })
      setRetries((n) => n + 1)
    },
  }
}
