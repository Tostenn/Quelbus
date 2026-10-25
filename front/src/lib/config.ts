export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')
export const REPO_URL: string = import.meta.env.VITE_REPO_URL ?? 'https://github.com/Tostenn/Quelbus'
export const SITE_URL = 'https://quelbus.ci'
// Dons Paystack : « on » une fois le compte Paystack validé
export const DONATIONS_ENABLED = import.meta.env.VITE_DONATIONS === 'on'
