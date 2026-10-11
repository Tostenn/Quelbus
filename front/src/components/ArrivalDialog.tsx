import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { FlagCheckered } from '@phosphor-icons/react'

type Props = { open: boolean; stopName: string; onClose: () => void }

export default function ArrivalDialog({ open, stopName, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      navigator.vibrate?.([120, 80, 120])
    }
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog ref={dialog} className="arrival" aria-labelledby="arrivee-titre" onClose={onClose}>
      <span className="arrival-icon" aria-hidden="true">
        <FlagCheckered size={30} weight="fill" />
      </span>
      <h2 id="arrivee-titre">Vous êtes arrivé&nbsp;!</h2>
      <p>
        Descendez à <strong>{stopName}</strong>. Merci d’avoir voyagé avec QuelBus, bonne route&nbsp;!
      </p>
      <div className="arrival-actions">
        <button type="button" className="btn btn-primary" onClick={() => dialog.current?.close()}>
          Merci
        </button>
        <Link className="btn btn-ghost" to="/recherche" onClick={() => dialog.current?.close()}>
          Nouveau trajet
        </Link>
      </div>
    </dialog>
  )
}
