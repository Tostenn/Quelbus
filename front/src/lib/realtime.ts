import type Pusher from 'pusher-js'
import { PUSHER_CLUSTER, PUSHER_KEY } from './config'

/** Le temps réel est-il configuré ? Sinon, les pages interrogent l'API à intervalle régulier. */
export const REALTIME = PUSHER_KEY !== ''

let client: Promise<Pusher> | null = null

/** Une seule connexion pour tout le site, chargée à la première page qui en a besoin. */
function connect(): Promise<Pusher> {
  client ??= import('pusher-js').then(({ default: PusherClient }) => new PusherClient(PUSHER_KEY, { cluster: PUSHER_CLUSTER }))
  return client
}

/**
 * Écoute un événement sur un canal public. Renvoie la fonction qui arrête l'écoute.
 * Sans clé Pusher, ne fait rien : l'appelant garde son rafraîchissement régulier.
 */
export function listen<T>(channel: string, event: string, callback: (data: T) => void): () => void {
  if (!REALTIME) return () => {}
  let stopped = false
  let cleanup = () => {}
  connect()
    .then((pusher) => {
      if (stopped) return
      const subscription = pusher.subscribe(channel)
      subscription.bind(event, callback)
      cleanup = () => {
        subscription.unbind(event, callback)
        // Un autre composant peut écouter le même canal : on ne se désabonne que si plus personne n'écoute
        if (!subscription.callbacks.get(event)?.length) pusher.unsubscribe(channel)
      }
    })
    .catch(() => {})
  return () => {
    stopped = true
    cleanup()
  }
}
