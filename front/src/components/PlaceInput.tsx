import { useId, useRef, useState, type ReactNode } from 'react'
import { MapPin } from '@phosphor-icons/react'
import { fetchSuggestions, type Place, type Suggestion } from '../lib/api'

type Props = {
  label: string
  placeholder: string
  value: Place | null
  onChange: (place: Place | null) => void
  pin: 'from' | 'to'
  error?: string
  action?: ReactNode
}

export default function PlaceInput({ label, placeholder, value, onChange, pin, error, action }: Props) {
  const id = useId()
  const [text, setText] = useState(value?.name ?? '')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const request = useRef<AbortController | null>(null)

  // « Ma position » choisie depuis le formulaire
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    if (value) setText(value.name)
  }

  function search(query: string) {
    window.clearTimeout(timer.current)
    request.current?.abort()
    if (query.trim().length < 2) {
      setSuggestions([])
      setLoading(false)
      return
    }
    setLoading(true)
    timer.current = window.setTimeout(() => {
      const controller = new AbortController()
      request.current = controller
      fetchSuggestions(query, controller.signal)
        .then((items) => {
          setSuggestions(items)
          setActive(items.length ? 0 : -1)
          setLoading(false)
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return
          setSuggestions([])
          setLoading(false)
        })
    }, 200)
  }

  function choose(suggestion: Suggestion) {
    const place = { name: suggestion.name, lat: suggestion.lat, lng: suggestion.lng }
    setText(place.name)
    setOpen(false)
    setSuggestions([])
    onChange(place)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !suggestions.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault()
      choose(suggestions[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && text.trim().length >= 2 && !value
  const listId = `${id}-list`

  return (
    <div className="place-field">
      <label htmlFor={id} className="place-label">
        <span className={`pin pin-${pin}`} aria-hidden="true" />
        {label}
      </label>
      <div className="place-combo">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            if (value) onChange(null)
            search(e.target.value)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {showList && (
          <ul id={listId} role="listbox" className="place-list" aria-label={label}>
            {suggestions.map((s, i) => (
              <li
                key={`${s.name}-${s.lat}-${s.lng}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`place-option${i === active ? ' is-active' : ''}`}
                // mousedown : avant le blur du champ
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(s)
                }}
                onMouseEnter={() => setActive(i)}
              >
                <MapPin size={18} aria-hidden="true" />
                <span>
                  {s.name}
                  {s.stops > 1 && <span className="place-meta"> · {s.stops} arrêts</span>}
                </span>
              </li>
            ))}
            {!suggestions.length && (
              <li className="place-empty" role="presentation">
                {loading ? 'Recherche…' : 'Aucun arrêt ne correspond. Essayez un autre nom.'}
              </li>
            )}
          </ul>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
      {action}
    </div>
  )
}
