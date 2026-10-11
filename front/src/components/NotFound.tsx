import { Link } from 'react-router'
import { usePageMeta } from '../lib/usePageMeta'

export default function NotFound({ what = 'Cette page' }: { what?: string }) {
  usePageMeta('Page introuvable | QuelBus')

  return (
    <section className="section page-section">
      <div className="container narrow empty-state">
        <h1 className="page-title">{what} n’existe pas ou plus.</h1>
        <p className="muted">Le lien est peut-être ancien, ou la ligne a changé depuis.</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to="/recherche">
            Chercher un trajet
          </Link>
          <Link className="btn btn-ghost" to="/lignes">
            Voir toutes les lignes
          </Link>
        </div>
      </div>
    </section>
  )
}
