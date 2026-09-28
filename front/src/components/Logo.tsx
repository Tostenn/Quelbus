type Props = { animated?: boolean }

export default function Logo({ animated = false }: Props) {
  return (
    <span className={`logo${animated ? ' logo-animated' : ''}`}>
      <span className="logo-mark" aria-hidden="true">
        <span className="logo-from" />
        <span className="logo-line" />
        <span className="logo-to" />
        {animated && <span className="logo-bus" />}
      </span>
      <span className="logo-word">quelbus</span>
    </span>
  )
}
