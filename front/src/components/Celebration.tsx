import { Heart } from '@phosphor-icons/react'

const COLORS = ['#ce5b22', '#f0a27a', '#2f7d4a', '#1f6fd1', '#e9b949', '#1a1613']

// Tirées une fois au chargement du module : le rendu reste pur
const PIECES = Array.from({ length: 42 }, (_, i) => ({
  left: Math.random() * 100,
  delay: Math.random() * 0.9,
  duration: 2.4 + Math.random() * 1.8,
  drift: (Math.random() - 0.5) * 160,
  spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540),
  color: COLORS[i % COLORS.length],
  round: i % 3 === 0,
}))

/** Cœur qui éclot et confettis, joués une fois après un don confirmé. */
export default function Celebration() {
  return (
    <div className="celebration" aria-hidden="true">
      <div className="confetti">
        {PIECES.map((p, i) => (
          <span
            key={i}
            className={p.round ? 'is-round' : ''}
            style={
              {
                left: `${p.left}%`,
                background: p.color,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                '--drift': `${p.drift}px`,
                '--spin': `${p.spin}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <span className="celebration-ring" />
      <span className="celebration-heart">
        <Heart size={48} weight="fill" />
      </span>
    </div>
  )
}
