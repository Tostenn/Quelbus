type Props = { refNumber: string; accent?: boolean; size?: 'sm' | 'md' | 'lg' }

export default function LineBadge({ refNumber, accent = false, size = 'md' }: Props) {
  return (
    <span className={`badge badge-${size}${accent ? ' badge-accent' : ''}`} aria-label={`Ligne ${refNumber}`}>
      {refNumber}
    </span>
  )
}
