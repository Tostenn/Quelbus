import { ArrowClockwise, WarningCircle } from '@phosphor-icons/react'

export default function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="notice notice-error">
      <WarningCircle size={24} aria-hidden="true" />
      <div>
        <p>{message}</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
          <ArrowClockwise />
          Réessayer
        </button>
      </div>
    </div>
  )
}
