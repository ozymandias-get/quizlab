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
export function useDebouncedValue<T>(input: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(input)

  useEffect(() => {
    if (delayMs <= 0) {
      setDebounced(input)
      return
    }

    const handle = window.setTimeout(() => {
      setDebounced(input)
    }, delayMs)

    return () => {
      window.clearTimeout(handle)
    }
  }, [input, delayMs])

  return debounced
}
