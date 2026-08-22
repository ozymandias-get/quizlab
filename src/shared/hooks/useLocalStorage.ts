import { queryClient as globalQueryClient } from '@app/providers/queryClient'
import { Logger } from '@shared/lib/logger'
import { QUERY_KEYS } from '@shared/query/queryKeys'

import { QueryClientContext } from '@tanstack/react-query'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'

import type { SetValue } from './localStorageUtils'
import {
  getStorageItem,
  identityDeserialize,
  identitySerialize,
  INVALID_STORED_VALUE,
  isClient,
  isLocalStorageChangeEvent,
  LOCAL_STORAGE_SYNC_EVENT,
  matchesInitialShape,
  parseJsonValue,
  safeStringify,
  setStorageItem
} from './localStorageUtils'

/**
 * Maps storage keys to their React Query keys for automatic invalidation.
 * When a storage key mutates externally (other tab / other hook instance),
 * the corresponding query cache must be refreshed to avoid stale-state overwrite.
 */
function getQueryKeysForStorageKey(key: string): unknown[][] {
  // Sessions — the only localStorage-backed React Query cache with a dedicated key
  if (key === 'quizlab_api_chat_sessions_v2') {
    return [QUERY_KEYS.AI.SESSIONS as unknown as unknown[]]
  }
  // Generic fallback: any query that was keyed by the raw storage key
  return [[key]]
}

function invalidateQueriesForStorageKey(
  client: { invalidateQueries: (filters: unknown) => void } | null,
  key: string
): void {
  if (!client) return
  try {
    const keys = getQueryKeysForStorageKey(key)
    for (const qk of keys) {
      client.invalidateQueries({ queryKey: qk } as never)
    }
    // Also invalidate any query whose key contains the storage key (covers
    // custom keys used directly as queryKey in tests)
    client.invalidateQueries({
      predicate: (query: { queryKey: unknown[] }) =>
        Array.isArray(query.queryKey) && query.queryKey.includes(key)
    } as never)
  } catch {
    // Never let query invalidation break storage sync
  }
}

/**
 * Base logic for all local storage hooks to avoid code duplication.
 */
function useBaseStorage<T>({
  key,
  initialValue,
  serialize,
  deserialize,
  validate
}: {
  key: string
  initialValue: T
  serialize: (val: T) => string | null
  deserialize: (raw: string) => T | typeof INVALID_STORED_VALUE
  validate?: (val: T) => boolean
}): [T, SetValue<T>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (!isClient) return initialValue
    try {
      const item = getStorageItem(key)
      if (item === null) return initialValue

      const parsed = deserialize(item)
      if (parsed === INVALID_STORED_VALUE) return initialValue

      if (validate && !validate(parsed)) {
        Logger.warn(`useLocalStorage: Validation failed for key "${key}". Resetting to initial.`)
        return initialValue
      }
      return parsed
    } catch (error) {
      Logger.warn(`useLocalStorage: Error reading key "${key}":`, error)
      return initialValue
    }
  })

  const storedValueRef = useRef(storedValue)
  const serializedValueRef = useRef<string | null>(serialize(storedValue))

  // QueryClient for single-source-of-truth invalidation — prefer contextual client
  // (tests create their own QueryClient) and fall back to the global singleton.
  // Uses QueryClientContext directly to avoid the "rules-of-hooks" violation that
  // `try { useQueryClient() }` would trigger.
  const queryClientFromContext = useContext(
    QueryClientContext as unknown as React.Context<
      { invalidateQueries: (f: unknown) => void } | undefined
    >
  ) as { invalidateQueries: (f: unknown) => void } | undefined
  const effectiveQueryClient =
    (queryClientFromContext as { invalidateQueries: (f: unknown) => void } | null) ??
    (globalQueryClient as unknown as { invalidateQueries: (f: unknown) => void })

  useEffect(() => {
    storedValueRef.current = storedValue
    serializedValueRef.current = serialize(storedValue)
  }, [storedValue, serialize])

  const syncState = useCallback(
    (rawValue: string | null) => {
      if (rawValue === null) {
        setStoredValue(initialValue)
        invalidateQueriesForStorageKey(effectiveQueryClient, key)
        return
      }

      if (rawValue === serializedValueRef.current) return

      const parsed = deserialize(rawValue)
      if (parsed === INVALID_STORED_VALUE || (validate && !validate(parsed))) {
        return
      }
      setStoredValue(parsed)
      invalidateQueriesForStorageKey(effectiveQueryClient, key)
    },
    [initialValue, deserialize, validate, key, effectiveQueryClient]
  )

  useEffect(() => {
    if (!isClient) return

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) syncState(e.newValue)
    }

    const handleLocalChange = (e: Event) => {
      if (isLocalStorageChangeEvent(e) && e.detail.key === key) {
        syncState(e.detail.value)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener(LOCAL_STORAGE_SYNC_EVENT, handleLocalChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener(LOCAL_STORAGE_SYNC_EVENT, handleLocalChange)
    }
  }, [key, syncState])

  const setValue: SetValue<T> = useCallback(
    (val) => {
      try {
        const valueToStore =
          typeof val === 'function' ? (val as (prev: T) => T)(storedValueRef.current) : val
        const serialized = serialize(valueToStore)

        if (validate && !validate(valueToStore)) {
          Logger.warn(`useLocalStorage: Invalid value for key "${key}":`, valueToStore)
          return
        }

        if (serialized !== null && serialized !== serializedValueRef.current) {
          setStoredValue(valueToStore)
          setStorageItem(key, serialized)
        }
      } catch (error) {
        Logger.warn(`useLocalStorage: Error saving key "${key}":`, error)
      }
    },
    [key, serialize, validate]
  )

  return [storedValue, setValue]
}

export function useLocalStorage<T>(key: string, initialValue: T): [T, SetValue<T>] {
  return useBaseStorage<T>({
    key,
    initialValue,
    serialize: safeStringify,
    deserialize: parseJsonValue,
    validate: (val) => matchesInitialShape(initialValue, val)
  })
}

export function useLocalStorageString(
  key: string,
  initialValue: string,
  validValues: string[] | null = null
): [string, SetValue<string>] {
  const validate = useCallback(
    (val: string) => {
      if (!validValues || validValues.length === 0) return true
      return validValues.includes(val)
    },
    [validValues]
  )

  const [storedValue, setValue] = useBaseStorage<string>({
    key,
    initialValue,
    serialize: identitySerialize,
    deserialize: identityDeserialize,
    validate
  })

  // Ensure current value is valid if validValues changes
  useEffect(() => {
    if (validValues && validValues.length > 0 && !validValues.includes(storedValue)) {
      const item = getStorageItem(key)
      if (item && validValues.includes(item)) {
        setValue(item)
      } else {
        setValue(initialValue)
      }
    }
  }, [validValues, key, initialValue, storedValue, setValue])

  return [storedValue, setValue]
}

export function useLocalStorageBoolean(
  key: string,
  initialValue: boolean = false
): [boolean, SetValue<boolean>, () => void] {
  const [storedValue, setValue] = useBaseStorage<boolean>({
    key,
    initialValue,
    serialize: (val) => val.toString(),
    deserialize: (raw) => (raw === 'true' ? true : raw === 'false' ? false : INVALID_STORED_VALUE),
    validate: (val) => typeof val === 'boolean'
  })

  const toggle = useCallback(() => {
    setValue((prev) => !prev)
  }, [setValue])

  return [storedValue, setValue, toggle]
}
