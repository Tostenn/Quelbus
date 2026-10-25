import { API_URL } from './config'

const TOKEN_KEY = 'quelbus-admin-token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // stockage indisponible : la session ne survivra pas au rechargement
  }
}

export class Unauthorized extends Error {}

export async function login(email: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
  let response: Response
  try {
    response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  } catch {
    return { ok: false, message: 'Impossible de joindre le serveur.' }
  }
  const data = await response.json().catch(() => ({}))
  if (response.ok && data.token) {
    setToken(data.token)
    return { ok: true }
  }
  if (response.status === 429) return { ok: false, message: 'Trop de tentatives. Patientez une minute.' }
  return { ok: false, message: data.errors?.email?.[0] ?? 'Connexion impossible.' }
}

export async function logout() {
  const token = getToken()
  setToken(null)
  if (token) {
    await fetch(`${API_URL}/api/admin/logout`, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    }).catch(() => {})
  }
}

type FormResult = { ok: true; message: string } | { ok: false; message: string; errors: Record<string, string> }

async function postForm(path: string, body: object, token?: string | null, method = 'POST'): Promise<FormResult & { data?: unknown }> {
  let response: Response
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: method === 'DELETE' ? undefined : JSON.stringify(body),
    })
  } catch {
    return { ok: false, message: 'Impossible de joindre le serveur. Vérifiez votre connexion.', errors: {} }
  }
  if (response.status === 401 && token) {
    setToken(null)
    throw new Unauthorized()
  }
  const data = await response.json().catch(() => ({}))
  if (response.ok) return { ok: true, message: data.message ?? '', data: data.data }
  if (response.status === 429) return { ok: false, message: 'Trop de tentatives. Patientez une minute.', errors: {} }
  const errors: Record<string, string> = {}
  for (const [field, messages] of Object.entries((data.errors ?? {}) as Record<string, string[]>)) errors[field] = messages[0]
  return { ok: false, message: Object.values(errors)[0] ?? data.message ?? 'L’opération a échoué.', errors }
}

export function forgotPassword(email: string) {
  return postForm('/password/forgot', { email })
}

export function resetPassword(payload: { token: string; email: string; password: string; password_confirmation: string; invitation: boolean }) {
  return postForm('/password/reset', payload)
}

/** Appels d'écriture du tableau de bord (ajout, renvoi, retrait d'admin). */
export function adminSend(path: string, body: object = {}, method: 'POST' | 'DELETE' = 'POST') {
  return postForm(`/admin${path}`, body, getToken() ?? '', method)
}

export type AdminUser = {
  id: number
  name: string
  email: string
  created_at: string
  last_login_at: string | null
  is_me: boolean
}

export async function adminGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}/api/admin${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${getToken() ?? ''}` },
    signal,
  })
  if (response.status === 401) {
    setToken(null)
    throw new Unauthorized()
  }
  if (!response.ok) throw new Error('Le chargement a échoué.')
  return response.json()
}

export type DayStat = { date: string; visits: number; searches: number }

export type AdminStats = {
  totals: {
    visits: number
    searches: number
    reports: number
    subscribers: number
    donations: number
    donations_amount: number
    lines: number
    stops: number
  }
  days: DayStat[]
}

export type Page<T> = { data: T[]; current_page: number; last_page: number; total: number }

export type AdminReport = {
  id: number
  kind_label: string
  message: string
  email: string | null
  page: string
  created_at: string
  line_ref: string | null
  line_name: string | null
  stop_name: string | null
}

export type AdminDonation = {
  id: number
  reference: string
  amount: number
  status: 'pending' | 'success' | 'failed' | 'abandoned'
  name: string | null
  email: string | null
  message: string | null
  channel: string | null
  paid_at: string | null
  created_at: string
}

export type DonationsPage = Page<AdminDonation> & { totals: { amount: number; count: number; pending: number } }

export type AdminSubscriber = {
  id: number
  first_name: string
  last_name: string
  email: string
  profile: string
  message: string | null
  created_at: string
}
