export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')
export const REPO_URL: string = import.meta.env.VITE_REPO_URL ?? 'https://github.com/Tostenn/Quelbus'
export const SITE_URL = 'https://quelbus.monradar.ci'
// Liens de don (page Paystack ou CinetPay, lien Wave) : vides = dons pas encore ouverts
export const DONATE_URL: string = import.meta.env.VITE_DONATE_URL ?? ''
export const DONATE_WAVE_URL: string = import.meta.env.VITE_DONATE_WAVE_URL ?? ''
