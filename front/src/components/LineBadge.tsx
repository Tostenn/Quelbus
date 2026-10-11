import type { LineType } from '../lib/api'

type Props = { refNumber: string | null; type?: LineType; accent?: boolean; size?: 'sm' | 'md' | 'lg' }

/** Sans numéro (gbaka, wôrô-wôrô), le badge affiche le type de transport. */
const typeShort: Record<LineType, string> = { sotra: 'Bus', gbaka: 'Gbaka', 'woro-woro': 'Wôrô', autre: 'Bus' }

export default function LineBadge({ refNumber, type = 'sotra', accent = false, size = 'md' }: Props) {
  const label = refNumber ?? typeShort[type]
  return (
    <span
      className={`badge badge-${size}${accent ? ' badge-accent' : ''}${refNumber ? '' : ' badge-text'} badge-${type}`}
      aria-label={refNumber ? `Ligne ${refNumber}` : typeShort[type]}
    >
      {label}
    </span>
  )
}
