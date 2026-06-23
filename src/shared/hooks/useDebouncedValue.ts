import { useEffect, useState } from 'react'

/**
 * Returns a value that only updates after `delayMs` of stable input. Useful
 * for debouncing search inputs, sliders, and any other "value changes on every
 * keystroke" pattern that drives an expensive filter/calculation downstream.
 *
 * Trailing-edge semantics: the first update is delayed by `delayMs`, then
 * subsequent updates within the window collapse into a single emit.
 *
 * @example
 *   const [search, setSearch] = useState('')
 *   const debouncedSearch = useDebouncedValue(search, 200)
 *   // `debouncedSearch` is the value to feed into expensive filters.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    if (delayMs <= 0) {
      setDebounced(value)
      return
    }

    const handle = window.setTimeout(() => {
      setDebounced(value)
    }, delayMs)

    return () => {
      window.clearTimeout(handle)
    }
  }, [value, delayMs])

  return debounced
}
