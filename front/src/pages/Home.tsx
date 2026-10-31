import { Link } from 'react-router'
import Creator from '../components/Creator'
import SearchForm from '../components/SearchForm'
import MeetMeHere from '../components/MeetMeHere'
import StatsBand from '../components/StatsBand'
import { ArrowRight, GithubLogo, Heart } from '@phosphor-icons/react'
import { DONATIONS_ENABLED, REPO_URL } from '../lib/config'
import { usePageMeta } from '../lib/usePageMeta'

const steps = [
  {
    title: 'Où êtes-vous ?',
    text: 'Le téléphone trouve votre position, ou vous tapez un quartier, un carrefour, un arrêt.',
  },
  {
    title: 'Où allez-vous ?',
    text: 'Un lieu connu suffit : « Mosquée d’Adjamé », « Gare Nord », « Marché de Cocody ». La liste se complète au fil de la frappe.',
  },
  {
    title: 'Montez dans le bon bus',
    text: 'QuelBus affiche les lignes directes (SOTRA, gbakas, wôrô-wôrôs) qui passent près de vous et de votre destination, dans le bon sens.',
  },
]

const contributions = [
  {
    title: 'Vous prenez le bus tous les jours',
    text: 'Une ligne a changé, un arrêt manque ? Chaque page de ligne a un bouton « Signaler une erreur ». Vous connaissez le terrain mieux que n’importe quelle carte.',
  },
  {
    title: 'Vous êtes développeur ou designer',
    text: 'Laravel, React, cartes Leaflet, accessibilité, performance sur petits téléphones : les tickets sont ouverts sur GitHub.',
  },
  {
    title: 'Vous aimez les cartes',
    text: 'Les données viennent d’OpenStreetMap. Placer et nommer un arrêt SOTRA améliore QuelBus et la carte de tout le monde.',
  },
]

export default function Home() {
  usePageMeta('Quel bus prendre à Abidjan ? | QuelBus')

  return (
    <>
      <section className="hero section-dark">
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-mark" aria-hidden="true">
                <span className="em-from" />
                <span className="em-line" />
                <span className="em-to" />
                <span className="em-bus" />
              </span>
              Projet open source · Abidjan
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
            <MeetMeHere />
            <p className="hero-note">
              Une ligne fausse ou un arrêt manquant&nbsp;?{' '}
              <Link to="/contact?profil=contributeur">Signalez-le, on corrige.</Link>
            </p>
          </div>
        </div>
      </section>

      <StatsBand />

      <section className="section section-problem">
        <div className="container problem-grid">
          <h2>Des centaines de lignes, aucune réponse simple</h2>
          <div className="problem-points">
            <p>
              Les itinéraires SOTRA sont difficiles à retenir et l’information est éparpillée&nbsp;: affiches aux arrêts,
              site officiel, bouche-à-oreille.
            </p>
            <p>
              Les outils existants montrent les lignes une par une. Ils répondent mal à la question qu’on se pose
              vraiment, tous les jours&nbsp;: <em>«&nbsp;pour aller à Adjamé depuis Angré, je prends quelle ligne&nbsp;?&nbsp;»</em>
            </p>
          </div>
        </div>
      </section>

      <section className="section" id="comment">
        <div className="container">
          <h2>Comment ça marche</h2>
          <ol className="route">
            {steps.map((step, i) => (
              <li key={step.title} className={`route-item${i === steps.length - 1 ? ' is-end' : ''}`}>
                <span className="route-stop" aria-hidden="true" />
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="scope">
            <div>
              <h3>Ce que fait QuelBus</h3>
              <ul className="check-list">
                <li>Les lignes directes&nbsp;: SOTRA, gbakas, wôrô-wôrôs</li>
                <li>Où monter, où descendre, et combien marcher</li>
                <li>Le bon sens de la ligne, pas l’inverse</li>
                <li>Un lien à envoyer pour qu’on vous rejoigne</li>
                <li>Fonctionne sur les petits téléphones et en 3G</li>
              </ul>
            </div>
            <div>
              <h3>Prochainement</h3>
              <ul className="next-list">
                <li>Les horaires et le temps réel</li>
                <li>Les trajets avec correspondance</li>
                <li>Les bateaux-bus et le métro</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-dark" id="open-source">
        <div className="container">
          <h2>Un bien commun pour Abidjan</h2>
          <p className="lead lead-light">
            Le code est ouvert, les données viennent d’OpenStreetMap sous licence libre. Tout le monde peut vérifier,
            corriger et améliorer. Plus on est nombreux, plus les réponses sont justes.
          </p>
          <ul className="contrib-list">
            {contributions.map((c) => (
              <li key={c.title}>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </li>
            ))}
          </ul>
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
          <Creator />
          {DONATIONS_ENABLED && (
            <Link className="support-card" to="/soutenir">
              <Heart size={26} weight="fill" aria-hidden="true" />
              <span>
                <strong>QuelBus vous a aidé&nbsp;?</strong> Offrez un garba à l’équipe, par Mobile Money ou carte.
              </span>
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
        </div>
      </section>

      <section className="section section-cta">
        <div className="container cta-box">
          <div>
            <h2>Être prévenu des nouveautés</h2>
            <p className="lead">
              Horaires, correspondances, nouvelles lignes&nbsp;: un email quand c’est en ligne, jamais pour autre chose.
            </p>
          </div>
          <Link className="btn btn-primary btn-lg" to="/contact">
            M’inscrire
            <ArrowRight />
          </Link>
        </div>
      </section>
    </>
  )
}
