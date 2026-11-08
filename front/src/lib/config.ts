export const API_URL = (import.meta.env.VITE_API_URL ?? 'https://api.quelbus.ci').replace(/\/$/, '')
export const REPO_URL: string = import.meta.env.VITE_REPO_URL ?? 'https://github.com/Tostenn/Quelbus'
export const SITE_URL = 'https://quelbus.ci'

/** Temps réel (Pusher) : clé publique et région. Sans clé, les bus en direct se rafraîchissent toutes les 20 s. */
export const PUSHER_KEY: string = import.meta.env.VITE_PUSHER_KEY ?? ''
export const PUSHER_CLUSTER: string = import.meta.env.VITE_PUSHER_CLUSTER || 'eu'
