import { useState } from 'react'

// Sur téléphone, la version verticale remplit l'écran ; ailleurs, la 16:9
const MOBILE_QUERY = '(max-width: 640px)'

export default function PresentationVideo() {
  const [vertical] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches)
  const name = vertical ? 'quelbus-presentation-vertical' : 'quelbus-presentation'

  return (
    <section className="section section-video" aria-labelledby="video-title">
      <div className="container">
        <h2 id="video-title">QuelBus en 30 secondes</h2>
        <p className="lead">D’où vous partez, où vous allez, et le bon bus. Rien de plus.</p>
        <div className={`video-frame${vertical ? ' is-vertical' : ''}`}>
          <video
            controls
            playsInline
            preload="none"
            poster={`/video/${name}-poster.jpg`}
            aria-label="Vidéo de présentation de QuelBus"
          >
            <source src={`/video/${name}.mp4`} type="video/mp4" />
          </video>
        </div>
      </div>
    </section>
  )
}
