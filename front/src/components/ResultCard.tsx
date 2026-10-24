import { Link } from 'react-router'
import { ArrowRight, PersonSimpleWalk, WhatsappLogo } from '@phosphor-icons/react'
import LineBadge from './LineBadge'
import type { Place, SearchResult } from '../lib/api'
import { TYPE_LABELS, walkLabel } from '../lib/search'
// import { WhatsappLogoIcon } from '@phosphor-icons/react/dist/ssr'
// import { latLng } from 'leaflet'

type Props = { result: SearchResult; from: Place; best?: boolean }

export default function ResultCard({ result, from, best = false }: Props) {
  const { line, direction, board, alight, stops } = result
  // Seule une vraie position GPS est montrée sur la carte de la ligne
  const here = from.name === 'Ma position' ? `&ici=${from.lat.toFixed(6)},${from.lng.toFixed(6)}` : ''

  // Partage d'itinéraire whatsapp
    const handleWhatsAppShare = (e:React.MouseEvent)=>{
      e.stopPropagation();
      const path = `/recherche?arrivee=${encodeURIComponent(alight.name)}&alat=${alight.lat}&alng=${alight.lng}`;
      const globalLink = `${window.location.origin}` + path;
      let message = `
salut, rejoins moi à l'arrêt ${alight.name}
calcule ton trajet par ici: ${globalLink}
`;
       let encodedMessage = encodeURIComponent(message);
       window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    }
  return (
    <Link
      className={`result-card${best ? ' is-best' : ''}`}
      to={`/lignes/${line.slug}?sens=${direction.id}&montee=${board.id}&descente=${alight.id}${here}`}
    >
      <span className="result-head">
        <LineBadge refNumber={line.ref} type={line.type} accent={best} size="lg" />
        <span>
          <span className="result-direction">{direction.name}</span>
          <span className="muted">
            {TYPE_LABELS[line.type]} · {stops} arrêt{stops > 1 ? 's' : ''} entre montée et descente
          </span>
        </span>
      </span>
      <span className="result-legs">
        <span className="result-leg">
          <span className="pin pin-board" aria-hidden="true" />
          <span>
            <span className="field-label">Montez à</span>
            <span className="result-stop">{board.name}</span>
            <span className="muted walk">
              <PersonSimpleWalk size={16} aria-hidden="true" />
              {walkLabel(board.walk)}
            </span>
          </span>
        </span>
        <span className="result-leg">
          <span className="pin pin-to" aria-hidden="true" />
          <span>
            <span className="field-label">Descendez à</span>
            <span className="result-stop">{alight.name}</span>
            <span className="muted walk">
              <PersonSimpleWalk size={16} aria-hidden="true" />
              {walkLabel(alight.walk)}
            </span>
          </span>
        </span>
      </span>
      <span className="result-more">
        Voir le trajet sur la carte <ArrowRight size={16} aria-hidden="true" />
      </span>
      <button type="button" onClick={handleWhatsAppShare} className="btn-share-whatsapp">Partager
          <WhatsappLogo size={20} weight="fill" aria-hidden="true" />
      </button>
    </Link>
  )
}
