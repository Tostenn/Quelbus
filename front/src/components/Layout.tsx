import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { GithubLogo } from '@phosphor-icons/react'
import Logo from './Logo'
import { REPO_URL } from '../lib/config'

export default function Layout() {
  const { pathname, hash } = useLocation()

  // Remonte en haut à chaque changement de page, ou descend jusqu'à l'ancre demandée.
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView()
    } else {
      window.scrollTo(0, 0)
    }
  }, [pathname, hash])

  return (
    <div className="page">
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" aria-label="QuelBus, accueil">
            {/* La clé change à chaque page : le logo est recréé et son animation rejouée. */}
            <Logo key={pathname} animated />
          </Link>
          <nav className="nav" aria-label="Navigation principale">
            <Link className="nav-link hide-sm" to="/#comment">
              Comment ça marche
            </Link>
            <Link className="nav-link hide-sm" to="/#open-source">
              Open source
            </Link>
            <NavLink className="btn btn-dark btn-sm" to="/contact">
              Rejoindre
            </NavLink>
          </nav>
        </div>
      </header>

      <main id="contenu">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <Logo />
            <p>Quel bus SOTRA prendre à Abidjan&nbsp;? Un projet libre, gratuit et ouvert aux contributions.</p>
          </div>
          <div className="footer-links">
            <Link to="/contact">Être prévenu du lancement</Link>
            <Link to="/contact?profil=contributeur">Contribuer</Link>
            {REPO_URL && (
              <a className="icon-link" href={REPO_URL} target="_blank" rel="noreferrer">
                <GithubLogo size={18} />
                Code source
              </a>
            )}
          </div>
          <p className="footer-legal">
            Site indépendant, non affilié à la SOTRA. Données de lignes et d'arrêts&nbsp;:{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              © contributeurs OpenStreetMap
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  )
}
