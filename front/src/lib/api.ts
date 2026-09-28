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
  | { ok: true; message: string }
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
    return { ok: true, message: data.message ?? 'Merci, votre inscription est enregistrée.' }
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
