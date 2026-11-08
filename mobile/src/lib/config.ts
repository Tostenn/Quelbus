/** Adresse de l'API Laravel. Surchargée par EXPO_PUBLIC_API_URL (ex. une API locale pendant le dev). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://api.quelbus.ci').replace(/\/$/, '')
export const SITE_URL = 'https://quelbus.ci'

/** Fond de carte vectoriel libre, données OpenStreetMap, sans clé d'API. */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
