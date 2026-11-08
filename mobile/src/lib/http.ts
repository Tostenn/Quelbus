import { API_URL } from './config'

/** Erreur montrable telle quelle à l'usager. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message)
  }
}

const TIMEOUT_MS = 15000

/** GET JSON sur l'API, avec délai maximal et messages d'erreur en français. */
export async function getJson<T>(path: string, params?: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const url = `${API_URL}/api${path}${params?.toString() ? `?${params}` : ''}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort)

  let response: Response
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal })
  } catch {
    if (signal?.aborted) throw new ApiError('Requête annulée.')
    throw new ApiError('Impossible de joindre QuelBus. Vérifiez votre connexion et réessayez.')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }

  if (response.status === 404) throw new ApiError('Introuvable.', 404)
  if (response.status === 429) throw new ApiError('Trop de demandes. Patientez une minute puis réessayez.', 429)
  if (!response.ok) throw new ApiError('Le serveur a rencontré un problème. Réessayez dans un instant.', response.status)
  return (await response.json()) as T
}
