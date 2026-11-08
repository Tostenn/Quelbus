import { Link } from 'react-router'
import Creator from '../components/Creator'
import LiveTeaser from '../components/LiveTeaser'
import SearchForm from '../components/SearchForm'
import MeetMeHere from '../components/MeetMeHere'
import PresentationVideo from '../components/PresentationVideo'
import StatsBand from '../components/StatsBand'
import { ArrowRight, GithubLogo } from '@phosphor-icons/react'
import { REPO_URL } from '../lib/config'
import { useState } from 'react'
import { usePageMeta } from '../lib/usePageMeta'
import { useMediaQuery } from '../lib/useMediaQuery'

const steps = [
  {
    title: 'Où êtes-vous ?',
    text: 'Le téléphone trouve votre position et la ville, ou vous tapez un quartier, un carrefour, un arrêt.',
  },
  {
    title: 'Où allez-vous ?',
    text: 'Un lieu connu suffit : « Mosquée d’Adjamé », « Gare Nord », « Marché de Cocody ». La liste se complète au fil de la frappe.',
  },
  {
    title: 'Montez dans le bon bus',
    text: 'Les lignes qui y vont directement, dans le bon sens, avec le prix, la carte étudiant et l’heure du dernier départ. Pas de ligne directe ? QuelBus vous dit où changer.',
  },
  {
    title: 'Suivez-le en direct',
    text: 'Dans le bus, appuyez sur « Je suis dans ce bus » : sa position apparaît pour ceux qui l’attendent. C’est anonyme, et chaque voyage partagé aide tout le monde.',
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
  const [meeting, setMeeting] = useState(false)
  // En large, l'accès au direct passe sous le titre, à gauche ; sur téléphone il suit la recherche
  const wide = useMediaQuery('(min-width: 980px)')
  usePageMeta(
    'Quel bus prendre ? Abidjan, Bouaké, Yamoussoukro… | QuelBus',
    'Quelle ligne prendre, où monter, combien ça coûte et où est le bus en ce moment. SOTRA, gbakas et wôrô-wôrôs, à Abidjan et dans quatre autres villes.',
  )

  return (
    <>
      <section className="hero section-dark">
        <div className="container hero-inner">
          <div className="hero-copy">
            <h1>
              Quel bus prendre&nbsp;? <span className="accent">On vous le dit.</span>
            </h1>
            <p className="lead">
              Dites d’où vous partez et où vous allez&nbsp;: QuelBus vous montre la ligne à prendre, où monter, combien
              ça coûte, et <strong>où est le bus en ce moment</strong>.
            </p>
            <p className="hero-cities">Abidjan · Bouaké · Korhogo · San-Pédro · Yamoussoukro</p>
            {wide && <LiveTeaser />}
          </div>

          <div className="hero-search">
            {!meeting && (
              <div className="search-card">
                <SearchForm cityPicker={false} />
              </div>
            )}
            {!wide && <LiveTeaser />}
            <MeetMeHere onActiveChange={setMeeting} />
            <p className="hero-note">
              Une ligne fausse ou un arrêt manquant&nbsp;?{' '}
              <Link to="/contact?profil=contributeur">Signalez-le, on corrige.</Link>
            </p>
          </div>
        </div>
      </section>

      <StatsBand />

      <PresentationVideo />

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
                <li>Sinon, où changer de bus pour finir le trajet</li>
                <li>Où monter, où descendre, et combien marcher</li>
                <li>Le prix du trajet et la carte étudiant</li>
                <li>Le premier et le dernier départ de chaque ligne</li>
                <li>Les bus en direct, grâce aux voyageurs</li>
                <li>Abidjan, Bouaké, Korhogo, San-Pédro et Yamoussoukro</li>
                <li>Un lien à envoyer pour qu’on vous rejoigne</li>
              </ul>
            </div>
            <div>
              <h3>Prochainement</h3>
              <ul className="next-list">
                <li>Dans combien de minutes arrive votre bus</li>
                <li>L’application mobile</li>
                <li>Les bateaux-bus et le métro</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-dark" id="open-source">
        <div className="container">
          <h2>Un bien commun, ville après ville</h2>
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
        </div>
      </section>

      <section className="section section-cta">
        <div className="container cta-box">
          <div>
            <h2>Être prévenu des nouveautés</h2>
            <p className="lead">
              Arrivée des bus en minutes, application mobile, nouvelles villes&nbsp;: un email quand c’est en ligne, jamais
              pour autre chose.
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
