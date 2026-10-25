import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { ArrowSquareOut, GithubLogo, SignOut } from '@phosphor-icons/react'
import Logo from './Logo'
import { getToken, logout } from '../lib/admin'
import { API_URL, DONATIONS_ENABLED, REPO_URL } from '../lib/config'

// Pages de l'équipe : en-tête réduit, sans menu public ni pied de page
const STAFF_PAGES = ['/admin', '/connexion', '/mot-de-passe']

export default function Layout() {
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  const staff = STAFF_PAGES.some((p) => pathname.startsWith(p))

  // Remonte en haut à chaque changement de page, ou descend jusqu'à l'ancre demandée.
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView()
    } else {
      window.scrollTo(0, 0)
    }
  }, [pathname, hash])

  // Une visite par session, comptée sans cookie ni donnée personnelle
  useEffect(() => {
    try {
      if (sessionStorage.getItem('quelbus-visit')) return
      sessionStorage.setItem('quelbus-visit', '1')
    } catch {
      return
    }
    fetch(`${API_URL}/api/visits`, { method: 'POST', keepalive: true }).catch(() => {})
  }, [])

  return (
    <div className="page">
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" aria-label="QuelBus, accueil">
            {/* Animé une seule fois, à l'ouverture du site */}
            <Logo animated />
          </Link>
          {staff ? (
            <nav className="nav" aria-label="Navigation de l’équipe">
              {/* Connecté sur mobile : le logo ramène déjà au site */}
              <Link className={`nav-link${pathname.startsWith('/admin') ? ' hide-sm' : ''}`} to="/">
                Voir le site <ArrowSquareOut size={16} aria-hidden="true" />
              </Link>
              {pathname.startsWith('/admin') && getToken() && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    await logout()
                    navigate('/connexion', { replace: true })
                  }}
                >
                  <SignOut aria-hidden="true" />
                  Déconnexion
                </button>
              )}
            </nav>
          ) : (
            <nav className="nav" aria-label="Navigation principale">
              <NavLink className="nav-link" to="/lignes">
                Lignes
              </NavLink>
              <Link className="nav-link hide-sm" to="/#comment">
                Comment ça marche
              </Link>
              <Link className="nav-link hide-sm" to="/#open-source">
                Open source
              </Link>
              <NavLink className="nav-link hide-sm" to="/contact">
                Rejoindre
              </NavLink>
              <NavLink className="btn btn-dark btn-sm" to="/recherche">
                Rechercher
              </NavLink>
            </nav>
          )}
        </div>
      </header>

      <main id="contenu">
        <Outlet />
      </main>

      {!staff && (
        <footer className="site-footer">
          <div className="container footer-inner">
            <div className="footer-brand">
              <Logo />
              <p>Quel bus prendre à Abidjan&nbsp;? Un projet libre, gratuit et ouvert aux contributions.</p>
            </div>
            <div className="footer-links">
              <Link to="/lignes">Toutes les lignes</Link>
              <Link to="/a-propos">À propos</Link>
              {DONATIONS_ENABLED && <Link to="/soutenir">Soutenir</Link>}
              <Link to="/contact">Être prévenu des nouveautés</Link>
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
      )}
    </div>
  )
}
