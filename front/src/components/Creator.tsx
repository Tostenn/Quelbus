import { LinkedinLogo } from '@phosphor-icons/react'

export default function Creator() {
  return (
    <div className="creator">
      <img
        className="creator-photo"
        src="/tosten-kouya.jpg"
        alt="Tosten Kouya"
        width="120"
        height="120"
        loading="lazy"
      />
      <div>
        <p className="eyebrow">Derrière le projet</p>
        <h2 className="creator-name">Tosten Kouya</h2>
        <p className="creator-role">Full-Stack Developer &amp; Creator</p>
        <p className="creator-text">
          J’ai lancé QuelBus parce que trouver le bon bus à Abidjan ne devrait pas demander de connaître la ville par
          cœur. Le projet est libre&nbsp;: chaque correction rend la réponse plus juste pour tout le monde.
        </p>
        <a className="btn btn-ghost btn-sm" href="https://www.linkedin.com/in/tosten-kouya/" target="_blank" rel="noreferrer">
          <LinkedinLogo />
          Me suivre sur LinkedIn
        </a>
      </div>
    </div>
  )
}
