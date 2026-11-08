/** Distance en mètres entre deux points (formule de haversine). */
export function distance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Emprise [ouest, sud, est, nord] d'une liste de points [lng, lat], ou null si elle est vide. */
export function boundsOf(points: [number, number][]): [number, number, number, number] | null {
  if (points.length === 0) return null
  let [west, south] = points[0]!
  let [east, north] = points[0]!
  for (const [lng, lat] of points) {
    west = Math.min(west, lng)
    east = Math.max(east, lng)
    south = Math.min(south, lat)
    north = Math.max(north, lat)
  }
  return [west, south, east, north]
}
