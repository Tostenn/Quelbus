import { Link } from 'react-router'
import { REPO_URL } from '../lib/config'
import { usePageMeta } from '../lib/usePageMeta'

export default function About() {
  usePageMeta(
    'À propos de QuelBus : sources des données et limites | QuelBus',
    'D’où viennent les lignes et les arrêts de QuelBus, ce que l’application fait et ne fait pas, et comment aider.',
  )

  return (
    <section className="section page-section">
      <div className="container narrow prose">
        <h1 className="page-title">À propos</h1>
        <p className="lead">
          QuelBus répond à une question simple&nbsp;: depuis ici, quel bus prendre pour aller là-bas, sans changer en
          route&nbsp;?
        </p>

        <h2 className="section-title">D’où viennent les données</h2>
        <p>
          Les lignes, leurs arrêts et leurs tracés viennent d’
          <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>
          , la carte libre construite par ses contributeurs. Ils sont publiés sous{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            licence ODbL
          </a>
          &nbsp;: © OpenStreetMap contributors. On y trouve 606 lignes à Abidjan&nbsp;: bus SOTRA, gbakas et
          wôrô-wôrôs.
        </p>

        <h2 className="section-title">Ce qu’il faut savoir</h2>
        <ul className="check-list">
          <li>Les distances à pied sont à vol d’oiseau&nbsp;: comptez un peu plus en vrai.</li>
          <li>Pas d’horaires ni de temps réel, et pas encore de trajets avec correspondance.</li>
          <li>Une ligne peut avoir changé depuis sa saisie. En cas de doute, demandez au chauffeur.</li>
        </ul>

        <h2 className="section-title">Site indépendant</h2>
        <p>
          QuelBus n’est pas affilié à la SOTRA ni à aucun transporteur. C’est un projet libre et gratuit, dont le code
          est ouvert{REPO_URL ? ' ' : ''}
          {REPO_URL && (
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              sur GitHub
            </a>
          )}
          .
        </p>

        <h2 className="section-title">Une erreur&nbsp;?</h2>
        <p>
          Chaque page de ligne et d’arrêt a un bouton «&nbsp;Signaler une erreur&nbsp;». Vous pouvez aussi{' '}
          <Link to="/contact?profil=contributeur">rejoindre les contributeurs</Link> ou corriger directement la carte sur
          OpenStreetMap.
        </p>
      </div>
    </section>
  )
}
