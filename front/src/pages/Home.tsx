import { Link } from 'react-router'
import SearchForm from '../components/SearchForm'
import {
  ArrowRight,
  Bus,
  Code,
  Crosshair,
  GithubLogo,
  MapPin,
  MapTrifold,
  UsersThree,
} from '@phosphor-icons/react'
import { REPO_URL } from '../lib/config'
import { usePageMeta } from '../lib/usePageMeta'

const steps = [
  {
    icon: Crosshair,
    title: 'Où êtes-vous ?',
    text: 'Votre position est détectée par le téléphone, ou vous la tapez vous-même : un quartier, un carrefour, un arrêt.',
  },
  {
    icon: MapPin,
    title: 'Où allez-vous ?',
    text: 'Tapez un lieu connu : « Mosquée d’Adjamé », « Gare Nord », « Marché de Cocody »… La liste se complète toute seule.',
  },
  {
    icon: Bus,
    title: 'Montez dans le bon bus',
    text: 'QuelBus affiche les lignes directes (SOTRA, gbakas, wôrô-wôrôs) qui passent à moins de 300 m de vous et de votre destination, dans le bon sens.',
  },
]

const contributions = [
  {
    icon: Bus,
    title: 'Vous prenez le bus tous les jours',
    text: 'Testez l’application, signalez une ligne fausse ou un arrêt manquant. Votre connaissance du terrain vaut de l’or.',
  },
  {
    icon: Code,
    title: 'Vous êtes développeur ou designer',
    text: 'Laravel, React, cartes Leaflet, accessibilité, performance sur petits téléphones : il y a de quoi faire.',
  },
  {
    icon: MapTrifold,
    title: 'Vous aimez les cartes',
    text: 'Les données viennent d’OpenStreetMap. Placer et nommer les arrêts SOTRA améliore QuelBus… et la carte de tous.',
  },
]

const roadmap = [
  { label: 'Fait', title: 'On rassemble la communauté', text: 'Page de présentation, inscriptions, premiers contributeurs.' },
  { label: 'Fait', title: 'Import des lignes', text: '606 lignes SOTRA, gbakas et wôrô-wôrôs, 6 400 arrêts, issus d’OpenStreetMap.' },
  { label: 'Maintenant', title: 'Recherche « quel bus prendre »', text: 'Départ, destination, lignes directes. Une première version à tester.' },
  { label: 'Après', title: 'Pages lignes, arrêts et lieux', text: 'Une fiche par ligne et par lieu, cartes, signalement d’erreurs.' },
]

export default function Home() {
  usePageMeta('Quel bus prendre à Abidjan ? | QuelBus')

  return (
    <>
      <section className="hero section-dark">
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="dot-live" aria-hidden="true" /> Projet open source · Abidjan
            </p>
            <h1>
              Quel bus prendre&nbsp;? <span className="accent">On vous le dit.</span>
            </h1>
            <p className="lead">
              Indiquez d’où vous partez et où vous allez&nbsp;: QuelBus vous montre les lignes qui y vont{' '}
              <strong>directement</strong>, où monter et où descendre. Gratuit, libre, fait à Abidjan.
            </p>
          </div>

          <div className="hero-search">
            <div className="search-card">
              <SearchForm />
            </div>
            <p className="hero-note">
              Première version, en test. Une ligne fausse ou manquante&nbsp;?{' '}
              <Link to="/contact?profil=contributeur">
                <UsersThree size={16} /> Aidez-nous à corriger
              </Link>
            </p>
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
              vraiment, tous les jours&nbsp;: <em>« pour aller à Adjamé depuis Angré, je prends quelle ligne&nbsp;? »</em>
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
                <span className="step-icon" aria-hidden="true">
                  <step.icon size={24} />
                </span>
                <span className="step-label">Étape {i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>

          <div className="honest">
            <div>
              <h3>Ce que QuelBus fait</h3>
              <ul className="check-list">
                <li>Les lignes directes, sans correspondance&nbsp;: SOTRA, gbakas, wôrô-wôrôs</li>
                <li>Où monter, où descendre, et combien marcher</li>
                <li>Le bon sens de la ligne, pas l’inverse</li>
                <li>Fonctionne sur les petits téléphones et en 3G</li>
              </ul>
            </div>
            <div>
              <h3>Ce qu’il ne fait pas (encore)</h3>
              <ul className="cross-list">
                <li>Les horaires et le temps réel</li>
                <li>Les bateaux-bus et le métro</li>
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
                <c.icon size={28} className="card-icon" aria-hidden="true" />
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </div>
            ))}
          </div>
          <div className="hero-actions">
            <Link className="btn btn-primary btn-lg" to="/contact?profil=contributeur">
              Je veux contribuer
              <ArrowRight />
            </Link>
            {REPO_URL && (
              <a className="btn btn-ghost-light btn-lg" href={REPO_URL} target="_blank" rel="noreferrer">
                <GithubLogo />
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
              <li key={r.title} className={`roadmap-item${i === 2 ? ' is-current' : ''}`}>
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
            <ArrowRight />
          </Link>
        </div>
      </section>
    </>
  )
}
