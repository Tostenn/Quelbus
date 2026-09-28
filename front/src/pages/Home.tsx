import { Link } from 'react-router'
import LineBadge from '../components/LineBadge'
import { REPO_URL } from '../lib/config'

const steps = [
  {
    title: 'Où êtes-vous ?',
    text: 'Votre position est détectée par le téléphone, ou vous la tapez vous-même : un quartier, un carrefour, un arrêt.',
  },
  {
    title: 'Où allez-vous ?',
    text: 'Tapez un lieu connu : « Mosquée d’Adjamé », « Gare Nord », « Marché de Cocody »… La liste se complète toute seule.',
  },
  {
    title: 'Montez dans le bon bus',
    text: 'QuelBus affiche les lignes SOTRA directes qui passent à moins de 300 m de vous et de votre destination, dans le bon sens.',
  },
]

const contributions = [
  {
    title: 'Vous prenez le bus tous les jours',
    text: 'Testez l’application, signalez une ligne fausse ou un arrêt manquant. Votre connaissance du terrain vaut de l’or.',
  },
  {
    title: 'Vous êtes développeur ou designer',
    text: 'Laravel, React, cartes Leaflet, accessibilité, performance sur petits téléphones : il y a de quoi faire.',
  },
  {
    title: 'Vous aimez les cartes',
    text: 'Les données viennent d’OpenStreetMap. Placer et nommer les arrêts SOTRA améliore QuelBus… et la carte de tous.',
  },
]

const roadmap = [
  { label: 'Maintenant', title: 'On rassemble la communauté', text: 'Page de présentation, inscriptions, premiers contributeurs.' },
  { label: 'Ensuite', title: 'Import des lignes SOTRA', text: 'Lignes, sens et arrêts récupérés depuis OpenStreetMap, vérifiés ligne par ligne.' },
  { label: 'Puis', title: 'Recherche « quel bus prendre »', text: 'Départ, destination, lignes directes. Une version publique à tester.' },
  { label: 'Après', title: 'Pages lignes, arrêts et lieux', text: 'Une fiche par ligne et par lieu, cartes, signalement d’erreurs.' },
]

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="dot-live" aria-hidden="true" /> Projet open source · Abidjan
            </p>
            <h1>
              Quel bus prendre&nbsp;? <span className="accent">On vous le dit.</span>
            </h1>
            <p className="lead">
              Vous êtes ici, vous voulez aller là-bas. QuelBus vous montre les lignes SOTRA qui y vont{' '}
              <strong>directement</strong>, où monter et où descendre. Gratuit, libre, fait à Abidjan.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg" to="/contact">
                Être prévenu du lancement
              </Link>
              <Link className="btn btn-ghost btn-lg" to="/contact?profil=contributeur">
                Contribuer au projet
              </Link>
            </div>
            <p className="hero-note">En préparation. Laissez votre email, on vous écrit quand c’est prêt.</p>
          </div>

          <div className="hero-demo" aria-label="Exemple de résultat dans QuelBus">
            <div className="demo-query">
              <div className="demo-field">
                <span className="pin pin-from" aria-hidden="true" />
                <span>
                  <span className="field-label">Départ</span>
                  Angré 8e Tranche
                </span>
              </div>
              <div className="demo-field">
                <span className="pin pin-to" aria-hidden="true" />
                <span>
                  <span className="field-label">Destination</span>
                  Mosquée d’Adjamé
                </span>
              </div>
            </div>
            <div className="demo-result">
              <div className="demo-result-head">
                <LineBadge refNumber="81" accent size="lg" />
                <div>
                  <div className="demo-direction">Terminus Angré → Gare Nord</div>
                  <div className="muted">25 arrêts entre montée et descente</div>
                </div>
              </div>
              <div className="demo-legs">
                <div className="demo-leg">
                  <span className="pin pin-from" aria-hidden="true" />
                  <div>
                    <div className="field-label">Montez à</div>
                    <div className="demo-stop">Pharmacie Angré</div>
                    <div className="muted">120 m à pied</div>
                  </div>
                </div>
                <div className="demo-leg">
                  <span className="pin pin-to" aria-hidden="true" />
                  <div>
                    <div className="field-label">Descendez à</div>
                    <div className="demo-stop">Mosquée Adjamé</div>
                    <div className="muted">40 m à pied</div>
                  </div>
                </div>
              </div>
            </div>
            <p className="demo-caption">Exemple d’écran. Données illustratives.</p>
          </div>
        </div>
      </section>

      <section className="section section-problem">
        <div className="container problem-grid">
          <div>
            <p className="eyebrow">Le constat</p>
            <h2>Environ 70 lignes. Aucune réponse simple.</h2>
          </div>
          <div className="problem-points">
            <p>
              Les itinéraires SOTRA sont difficiles à retenir et l’information est éparpillée&nbsp;: affiches aux arrêts,
              site officiel, bouche-à-oreille.
            </p>
            <p>
              Les outils existants montrent les lignes une par une. Ils répondent mal à la question qu’on se pose
              vraiment, tous les jours&nbsp;: <em>« pour aller là-bas depuis ici, je prends quoi&nbsp;? »</em>
            </p>
          </div>
        </div>
      </section>

      <section className="section" id="comment">
        <div className="container">
          <p className="eyebrow">Comment ça marche</p>
          <h2>Trois étapes, une réponse.</h2>
          <ol className="steps">
            {steps.map((step, i) => (
              <li key={step.title} className="step">
                <span className="step-number">{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>

          <div className="honest">
            <div>
              <h3>Ce que QuelBus fait</h3>
              <ul className="check-list">
                <li>Les lignes SOTRA directes, sans correspondance</li>
                <li>Où monter, où descendre, et combien marcher</li>
                <li>Le bon sens de la ligne, pas l’inverse</li>
                <li>Fonctionne sur les petits téléphones et en 3G</li>
              </ul>
            </div>
            <div>
              <h3>Ce qu’il ne fait pas (encore)</h3>
              <ul className="cross-list">
                <li>Les horaires et le temps réel</li>
                <li>Les gbakas, wôrô-wôrôs et bateaux-bus</li>
                <li>Les trajets avec correspondance</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-dark" id="open-source">
        <div className="container">
          <p className="eyebrow eyebrow-light">Open source</p>
          <h2>Un bien commun pour Abidjan.</h2>
          <p className="lead lead-light">
            Le code est ouvert, les données viennent d’OpenStreetMap sous licence libre. Tout le monde peut vérifier,
            corriger et améliorer. Plus on est nombreux, plus les réponses sont justes.
          </p>
          <div className="cards">
            {contributions.map((c) => (
              <div key={c.title} className="card-dark">
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </div>
            ))}
          </div>
          <div className="hero-actions">
            <Link className="btn btn-primary btn-lg" to="/contact?profil=contributeur">
              Je veux contribuer
            </Link>
            {REPO_URL && (
              <a className="btn btn-ghost-light btn-lg" href={REPO_URL} target="_blank" rel="noreferrer">
                Voir le code source
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="eyebrow">Feuille de route</p>
          <h2>Où en est le projet.</h2>
          <ol className="roadmap">
            {roadmap.map((r, i) => (
              <li key={r.title} className={`roadmap-item${i === 0 ? ' is-current' : ''}`}>
                <span className="roadmap-stop" aria-hidden="true" />
                <div>
                  <span className="roadmap-label">{r.label}</span>
                  <h3>{r.title}</h3>
                  <p>{r.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section-cta">
        <div className="container cta-box">
          <div>
            <h2>Soyez parmi les premiers.</h2>
            <p className="lead">Prénom, nom, email. On vous écrit au lancement, pas avant, et jamais pour autre chose.</p>
          </div>
          <Link className="btn btn-primary btn-lg" to="/contact">
            Je m’inscris
          </Link>
        </div>
      </section>
    </>
  )
}
