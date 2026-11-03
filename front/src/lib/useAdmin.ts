import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { adminGet, Unauthorized } from './admin'

/** Lecture d'une ressource du tableau de bord ; incrémenter `version` la recharge. */
export function useAdmin<T>(path: string, version = 0) {
  const navigate = useNavigate()
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: '' })
  const key = `${path}#${version}`

  useEffect(() => {
    const controller = new AbortController()
    adminGet<T>(path, controller.signal)
      .then((data) => setState({ key, data }))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (e instanceof Unauthorized) return navigate('/connexion', { replace: true })
        setState({ key, error: (e as Error).message })
      })
    return () => controller.abort()
  }, [path, key, navigate])

  const loading = state.key !== key
  return { data: loading ? undefined : state.data, error: loading ? undefined : state.error, loading }
}
