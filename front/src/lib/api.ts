import { API_URL } from './config'

export type Profile = 'utilisateur' | 'contributeur' | 'les_deux'

export type SubscriberPayload = {
  first_name: string
  last_name: string
  email: string
  profile: Profile
  message: string
  website: string
}

export type FieldErrors = Partial<Record<keyof SubscriberPayload, string>>

export type SubmitResult =
  | { ok: true; message: string; created: boolean }
  | { ok: false; message: string; errors: FieldErrors }

export async function submitSubscriber(payload: SubscriberPayload): Promise<SubmitResult> {
  let response: Response
  try {
    response = await fetch(`${API_URL}/api/subscribers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    return {
      ok: false,
      message: 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.',
      errors: {},
    }
  }

  const data = await response.json().catch(() => ({}))

  if (response.ok) {
    // 201 : nouvelle inscription (email de confirmation envoyé) ; 200 : adresse déjà inscrite.
    return { ok: true, message: data.message ?? 'Merci, votre inscription est enregistrée.', created: response.status === 201 }
  }

  if (response.status === 422) {
    const errors: FieldErrors = {}
    for (const [field, messages] of Object.entries<string[]>(data.errors ?? {})) {
      errors[field as keyof SubscriberPayload] = messages[0]
    }
    return { ok: false, message: 'Certains champs sont à corriger.', errors }
  }

  if (response.status === 429) {
    return { ok: false, message: 'Trop de tentatives. Patientez une minute puis réessayez.', errors: {} }
  }

  return { ok: false, message: 'Une erreur est survenue. Réessayez dans un instant.', errors: {} }
}


export type LineType = 'sotra' | 'gbaka' | 'woro-woro' | 'autre'

export type Place = { name: string; lat: number; lng: number }

export type Suggestion = Place & { stops: number }

export type ResultStop = { id: number; name: string; slug: string; lat: number; lng: number; walk: number }

export type SearchResult = {
  line: { id: number; ref: string | null; name: string; slug: string; type: LineType }
  direction: { id: number; name: string; origin_label: string | null; destination_label: string | null }
  board: ResultStop
  alight: ResultStop
  stops: number
  walk: number
}

export type SearchResponse = {
  radius: number
  requested_radius: number
  expanded: boolean
  walkable: boolean
  distance: number
  results: SearchResult[]
}

export type SearchParams = { from: Place; to: Place; radius: number; types: LineType[] }

export async function fetchSuggestions(query: string, signal?: AbortSignal): Promise<Suggestion[]> {
  const response = await fetch(`${API_URL}/api/suggest?${new URLSearchParams({ q: query })}`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
  return data.data ?? []
}

export async function fetchSearch({ from, to, radius, types }: SearchParams, signal?: AbortSignal): Promise<SearchResponse> {
  const query = new URLSearchParams({
    from_lat: String(from.lat),
    from_lng: String(from.lng),
    to_lat: String(to.lat),
    to_lng: String(to.lng),
    radius: String(radius),
  })
  types.forEach((type) => query.append('types[]', type))

  const response = await fetch(`${API_URL}/api/search?${query}`, { headers: { Accept: 'application/json' }, signal })
  if (response.status === 429) throw new Error('Trop de recherches. Patientez une minute puis réessayez.')
  if (!response.ok) throw new Error('La recherche a échoué. Réessayez dans un instant.')
  return response.json()
}

export type LineSummary = {
  id: number
  ref: string | null
  name: string
  slug: string
  type: LineType
  category: string | null
  directions_count: number
}

export type StopSummary = { id: number; name: string; slug: string; lat: number; lng: number }

export type LineDetail = Omit<LineSummary, 'directions_count'> & {
  operator: string | null
  directions: { id: number; name: string; is_loop: boolean; stops: StopSummary[] }[]
}

export type StopDetail = StopSummary & {
  lines: { line: Pick<LineSummary, 'id' | 'ref' | 'name' | 'slug' | 'type'>; direction: { id: number; name: string } }[]
  nearby: { id: number; name: string; slug: string; walk: number }[]
}
