import { useState } from 'react'
import { Play } from '@phosphor-icons/react'

const YOUTUBE_ID = 'PMgsQNd7_Sw'

// Le lecteur YouTube n'est chargé qu'au clic : la page reste légère et rien n'est envoyé à YouTube avant.
export default function PresentationVideo() {
  const [playing, setPlaying] = useState(false)
  const [thumbFailed, setThumbFailed] = useState(false)

  return (
    <section className="section section-video" aria-labelledby="video-title">
      <div className="container">
        <h2 id="video-title">QuelBus en 30 secondes</h2>
        <p className="lead">D’où vous partez, où vous allez, et le bon bus. Rien de plus.</p>
        <div className="video-frame">
          {playing ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}?autoplay=1&rel=0&playsinline=1`}
              title="Vidéo de présentation de QuelBus"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <button type="button" className="video-facade" onClick={() => setPlaying(true)}>
              {!thumbFailed && (
                <img
                  src={`https://i.ytimg.com/vi/${YOUTUBE_ID}/hqdefault.jpg`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={() => setThumbFailed(true)}
                />
              )}
              <span className="video-play" aria-hidden="true">
                <Play size={30} weight="fill" />
              </span>
              <span className="visually-hidden">Lire la vidéo de présentation de QuelBus</span>
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
