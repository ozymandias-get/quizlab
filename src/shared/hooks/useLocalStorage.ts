import { Logger } from '@shared/lib/logger'

import { useCallback, useEffect, useRef, useState } from 'react'

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

  useEffect(() => {
    storedValueRef.current = storedValue
    serializedValueRef.current = serialize(storedValue)
  }, [storedValue, serialize])

  const syncState = useCallback(
    (rawValue: string | null) => {
      if (rawValue === null) {
        setStoredValue(initialValue)
        return
      }

      if (rawValue === serializedValueRef.current) return

      const parsed = deserialize(rawValue)
      if (parsed === INVALID_STORED_VALUE || (validate && !validate(parsed))) {
        return
      }
      setStoredValue(parsed)
    },
    [initialValue, deserialize, validate]
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
