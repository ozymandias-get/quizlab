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
  if (initialValue === null || initialValue === undefined) {
    return true
  }

  if (Array.isArray(initialValue)) {
    return Array.isArray(parsed)
  }

  if (isPlainObject(initialValue)) {
    return isPlainObject(parsed)
  }

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

export function useLocalStorage<T>(key: string, initialValue: T): [T, SetValue<T>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (!isClient) return initialValue

    try {
      const item = getStorageItem(key)
      if (item === null) return initialValue

      const parsed = parseJsonValue<T>(item)
      if (parsed === INVALID_STORED_VALUE) {
        Logger.warn(`useLocalStorage: "${key}" için değer okunamadı.`)
        return initialValue
      }

      if (!matchesInitialShape(initialValue, parsed)) {
        const initialType = Array.isArray(initialValue)
          ? 'Array'
          : isPlainObject(initialValue)
            ? 'Object'
            : typeof initialValue
        const parsedType = Array.isArray(parsed)
          ? 'Array'
          : isPlainObject(parsed)
            ? 'Object'
            : typeof parsed
        Logger.warn(
          `useLocalStorage: Type mismatch for key "${key}". Expected ${initialType}, got ${parsedType}. Resetting to initial.`
        )
        return initialValue
      }

      return parsed
    } catch (error) {
      Logger.warn(`useLocalStorage: "${key}" için değer okunamadı:`, error)
      return initialValue
    }
  })

  const storedValueRef = useRef(storedValue)
  const serializedValueRef = useRef<string | null>(safeStringify(storedValue))
  useEffect(() => {
    storedValueRef.current = storedValue
    serializedValueRef.current = safeStringify(storedValue)
  }, [storedValue])

  useEffect(() => {
    if (!isClient) return

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        if (e.newValue === serializedValueRef.current) return
        const parsed = parseJsonValue<T>(e.newValue)
        if (parsed === INVALID_STORED_VALUE || !matchesInitialShape(initialValue, parsed)) {
          Logger.warn(`useLocalStorage: "${key}" için cross-window sync başarısız.`)
          return
        }
        setStoredValue(parsed)
      } else if (e.key === key && e.newValue === null) {
        setStoredValue(initialValue)
      }
    }

    const handleLocalChange = (e: Event) => {
      if (!isLocalStorageChangeEvent(e) || e.detail.key !== key) {
        return
      }
      if (e.detail.value === serializedValueRef.current) return
      const parsed = parseJsonValue<T>(e.detail.value)
      if (parsed === INVALID_STORED_VALUE || !matchesInitialShape(initialValue, parsed)) {
        Logger.warn(`useLocalStorage: "${key}" için local sync başarısız.`)
        return
      }
      setStoredValue(parsed)
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener(LOCAL_STORAGE_SYNC_EVENT, handleLocalChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener(LOCAL_STORAGE_SYNC_EVENT, handleLocalChange)
    }
  }, [key, initialValue])

  const setValue: SetValue<T> = useCallback(
    (value) => {
      try {
        if (value instanceof Function) {
          setStoredValue((prevValue) => {
            const newValue = value(prevValue)
            const serializedValue = safeStringify(newValue)
            if (serializedValue !== null && serializedValue === serializedValueRef.current) {
              return prevValue
            }
            setStorageItem(key, JSON.stringify(newValue))
            return newValue
          })
        } else {
          const serializedValue = safeStringify(value)
          if (serializedValue !== null && serializedValue === serializedValueRef.current) {
            return
          }
          setStoredValue(value)
          setStorageItem(key, JSON.stringify(value))
        }
      } catch (error) {
        Logger.warn(`useLocalStorage: "${key}" için değer kaydedilemedi:`, error)
      }
    },
    [key]
  )

  return [storedValue, setValue]
}

export function useLocalStorageString(
  key: string,
  initialValue: string,
  validValues: string[] | null = null
): [string, SetValue<string>] {
  const [storedValue, setStoredValue] = useState<string>(() => {
    if (!isClient) return initialValue

    try {
      const item = getStorageItem(key)
      if (item !== null) {
        if (validValues && !validValues.includes(item)) {
          return initialValue
        }
        return item
      }
      return initialValue
    } catch (error) {
      Logger.warn(`useLocalStorageString: "${key}" için değer okunamadı:`, error)
      return initialValue
    }
  })
  const storedValueRef = useRef(storedValue)

  useEffect(() => {
    storedValueRef.current = storedValue
  }, [storedValue])

  useEffect(() => {
    if (!isClient) return

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        if (e.newValue === storedValueRef.current) return
        if (validValues && validValues.length > 0 && !validValues.includes(e.newValue)) {
          return
        }
        setStoredValue(e.newValue)
      } else if (e.key === key && e.newValue === null) {
        setStoredValue(initialValue)
      }
    }

    const handleLocalChange = (e: Event) => {
      if (!isLocalStorageChangeEvent(e) || e.detail.key !== key) {
        return
      }
      const newValue = e.detail.value
      if (newValue === storedValueRef.current) return
      if (validValues && validValues.length > 0 && !validValues.includes(newValue)) {
        return
      }
      setStoredValue(newValue)
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener(LOCAL_STORAGE_SYNC_EVENT, handleLocalChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener(LOCAL_STORAGE_SYNC_EVENT, handleLocalChange)
    }
  }, [key, initialValue, validValues])

  useEffect(() => {
    if (validValues && validValues.length > 0 && !validValues.includes(storedValue)) {
      const item = getStorageItem(key)
      if (item && validValues.includes(item)) {
        setStoredValue(item)
      } else if (storedValue !== initialValue) {
        setStoredValue(initialValue)
      }
    }
  }, [validValues, key, initialValue, storedValue])

  const setValue: SetValue<string> = useCallback(
    (value) => {
      try {
        if (value instanceof Function) {
          setStoredValue((prevValue) => {
            const newValue = value(prevValue)
            if (newValue === prevValue) return prevValue
            if (validValues && !validValues.includes(newValue)) {
              Logger.warn(`useLocalStorageString: "${key}" için geçersiz değer:`, newValue)
              return prevValue
            }
            setStorageItem(key, newValue)
            return newValue
          })
        } else {
          if (validValues && !validValues.includes(value)) {
            Logger.warn(`useLocalStorageString: "${key}" için geçersiz değer:`, value)
            return
          }
          if (value === storedValueRef.current) return
          setStoredValue(value)
          setStorageItem(key, value)
        }
      } catch (error) {
        Logger.warn(`useLocalStorageString: "${key}" için değer kaydedilemedi:`, error)
      }
    },
    [key, validValues]
  )

  return [storedValue, setValue]
}

export function useLocalStorageBoolean(
  key: string,
  initialValue: boolean = false
): [boolean, SetValue<boolean>, () => void] {
  const [storedValue, setStoredValue] = useState<boolean>(() => {
    if (!isClient) return initialValue

    try {
      const item = getStorageItem(key)
      if (item === null) return initialValue
      return item === 'true'
    } catch (error) {
      Logger.warn(`useLocalStorageBoolean: "${key}" için değer okunamadı:`, error)
      return initialValue
    }
  })
  const storedValueRef = useRef(storedValue)

  useEffect(() => {
    storedValueRef.current = storedValue
  }, [storedValue])

  useEffect(() => {
    if (!isClient) return

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        const nextValue = e.newValue === 'true'
        if (nextValue === storedValueRef.current) return
        setStoredValue(nextValue)
      } else if (e.key === key && e.newValue === null) {
        setStoredValue(initialValue)
      }
    }

    const handleLocalChange = (e: Event) => {
      if (!isLocalStorageChangeEvent(e) || e.detail.key !== key) {
        return
      }
      const nextValue = e.detail.value === 'true'
      if (nextValue === storedValueRef.current) return
      setStoredValue(nextValue)
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener(LOCAL_STORAGE_SYNC_EVENT, handleLocalChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener(LOCAL_STORAGE_SYNC_EVENT, handleLocalChange)
    }
  }, [key, initialValue])

  const setValue: SetValue<boolean> = useCallback(
    (value) => {
      try {
        if (value instanceof Function) {
          setStoredValue((prevValue) => {
            const newValue = value(prevValue)
            if (newValue === prevValue) return prevValue
            setStorageItem(key, newValue.toString())
            return newValue
          })
        } else {
          if (value === storedValueRef.current) return
          setStoredValue(value)
          setStorageItem(key, value.toString())
        }
      } catch (error) {
        Logger.warn(`useLocalStorageBoolean: "${key}" için değer kaydedilemedi:`, error)
      }
    },
    [key]
  )

  const toggle = useCallback(() => {
    setValue((prev) => !prev)
  }, [setValue])

  return [storedValue, setValue, toggle]
}
