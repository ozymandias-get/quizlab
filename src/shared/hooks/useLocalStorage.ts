import { useState, useEffect, useCallback, useRef, type Dispatch, type SetStateAction } from 'react'
import { Logger } from '@shared/lib/logger'

const isClient = typeof window !== 'undefined'
const LOCAL_STORAGE_SYNC_EVENT = 'local-storage'
const INVALID_STORED_VALUE = Symbol('INVALID_STORED_VALUE')

const getStorageItem = (key: string): string | null => {
  if (!isClient) return null
  try {
    return localStorage.getItem(key)
  } catch (error) {
    Logger.warn(`localStorage erişim hatası (get "${key}"):`, error)
    return null
  }
}

const setStorageItem = (key: string, value: string): boolean => {
  if (!isClient) return false
  try {
    localStorage.setItem(key, value)
    window.dispatchEvent(
      new CustomEvent<LocalStorageChangeDetail>(LOCAL_STORAGE_SYNC_EVENT, {
        detail: { key, value }
      })
    )
    return true
  } catch (error) {
    Logger.warn(`localStorage yazma hatası (set "${key}"):`, error)
    return false
  }
}

type SetValue<T> = Dispatch<SetStateAction<T>>

interface LocalStorageChangeDetail {
  key: string
  value: string
}

const isLocalStorageChangeEvent = (
  event: Event
): event is CustomEvent<LocalStorageChangeDetail> => {
  return (
    'detail' in event &&
    typeof (event as CustomEvent<LocalStorageChangeDetail>).detail?.key === 'string' &&
    typeof (event as CustomEvent<LocalStorageChangeDetail>).detail?.value === 'string'
  )
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

const matchesInitialShape = (initialValue: unknown, parsed: unknown): boolean => {
  if (initialValue === null || initialValue === undefined) return true
  if (Array.isArray(initialValue)) return Array.isArray(parsed)
  if (isPlainObject(initialValue)) return isPlainObject(parsed)
  return typeof parsed === typeof initialValue
}

const parseJsonValue = <T>(rawValue: string): T | typeof INVALID_STORED_VALUE => {
  try {
    return JSON.parse(rawValue) as T
  } catch {
    return INVALID_STORED_VALUE
  }
}

const safeStringify = <T>(value: T): string | null => {
  try {
    return JSON.stringify(value)
  } catch {
    return null
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
    (value) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValueRef.current) : value
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
    serialize: (val) => val,
    deserialize: (raw) => raw,
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
