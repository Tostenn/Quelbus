type Props = { animated?: boolean }

// Même géométrie que Maquette/logo/quelbus-symbole.svg : départ creux, ligne, arrivée orange.
const RING = 'M0 40a40 40 0 1 0 80 0a40 40 0 1 0 -80 0ZM24 40a16 16 0 1 0 32 0a16 16 0 1 0 -32 0Z'

export default function Logo({ animated = false }: Props) {
  return (
    <span className={`logo${animated ? ' logo-animated' : ''}`}>
      <svg className="logo-mark" viewBox="0 0 216 80" aria-hidden="true" focusable="false">
        <path className="logo-from" fillRule="evenodd" d={RING} />
        <rect className="logo-line" x="76" y="28" width="68" height="24" />
        {animated && <rect className="logo-bus" x="84" y="22" width="28" height="36" rx="8" />}
        <circle className="logo-to" cx="178" cy="40" r="38" />
      </svg>
      <span className="logo-word">quelbus</span>
    </span>
  )
}
