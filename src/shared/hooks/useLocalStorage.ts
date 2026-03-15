import { useState, useEffect, useCallback, useRef } from 'react'
import { Logger } from '@shared/lib/logger'

/**
 * SSR/Test ortamı kontrolü
 * window objesi olmayan ortamlarda (Jest, Vitest, SSR) hata vermemek için
 */
const isClient = typeof window !== 'undefined'

/**
 * localStorage'a güvenli erişim sağlar
 * window undefined ise null döner
 */
const getStorageItem = (key: string): string | null => {
  if (!isClient) return null
  try {
    return localStorage.getItem(key)
  } catch (error) {
    Logger.warn(`localStorage erişim hatası (get "${key}"):`, error)
    return null
  }
}

/**
 * localStorage'a güvenli yazma sağlar
 * window undefined ise sessizce başarısız olur
 */
const setStorageItem = (key: string, value: string): boolean => {
  if (!isClient) return false
  try {
    localStorage.setItem(key, value)
    // Dispatch custom event for same-window sync
    window.dispatchEvent(new CustomEvent('local-storage', { detail: { key, value } }))
    return true
  } catch (error) {
    Logger.warn(`localStorage yazma hatası (set "${key}"):`, error)
    return false
  }
}

type SetValue<T> = React.Dispatch<React.SetStateAction<T>>

interface LocalStorageChangeDetail {
  key: string
  value: string
}

const safeStringify = <T>(value: T): string | null => {
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

/**
 * localStorage ile state senkronizasyonu sağlayan hook
 * SSR ve test ortamlarında güvenli çalışır
 *
 * FIX: Stale closure sorunu çözüldü - useRef ile güncel değere erişim
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, SetValue<T>] {
  // Başlangıç değerini localStorage'dan al veya varsayılan kullan
  const [storedValue, setStoredValue] = useState<T>(() => {
    // SSR/Test ortamında localStorage erişilemez
    if (!isClient) return initialValue

    try {
      const item = getStorageItem(key)
      if (item === null) return initialValue

      const parsed = JSON.parse(item)

      // Type safety check: If initialValue is provided, ensure parsed value matches type
      if (initialValue !== null && initialValue !== undefined) {
        const initialType = typeof initialValue
        const parsedType = typeof parsed

        // Special handling for Arrays (which are type 'object')
        if (Array.isArray(initialValue)) {
          if (!Array.isArray(parsed)) {
            Logger.warn(
              `useLocalStorage: Type mismatch for key "${key}". Expected Array, got ${parsedType}. Resetting to initial.`
            )
            return initialValue
          }
        } else if (parsedType !== initialType) {
          Logger.warn(
            `useLocalStorage: Type mismatch for key "${key}". Expected ${initialType}, got ${parsedType}. Resetting to initial.`
          )
          return initialValue
        }
      }

      return parsed
    } catch (error) {
      Logger.warn(`useLocalStorage: "${key}" için değer okunamadı:`, error)
      return initialValue
    }
  })

  // Güncel değeri ref'te tut - stale closure sorununu çözer
  const storedValueRef = useRef(storedValue)
  const serializedValueRef = useRef<string | null>(safeStringify(storedValue))
  useEffect(() => {
    storedValueRef.current = storedValue
    serializedValueRef.current = safeStringify(storedValue)
  }, [storedValue])

  // Cross-window senkronizasyon için storage event'i dinle
  useEffect(() => {
    // SSR/Test ortamında event listener ekleme
    if (!isClient) return

    const handleStorageChange = (e: StorageEvent) => {
      // Sadece ilgili key değiştiğinde ve başka pencereden geldiyse
      if (e.key === key && e.newValue !== null) {
        if (e.newValue === serializedValueRef.current) return
        try {
          setStoredValue(JSON.parse(e.newValue))
        } catch (error) {
          Logger.warn(`useLocalStorage: "${key}" için cross-window sync başarısız:`, error)
        }
      } else if (e.key === key && e.newValue === null) {
        // Key silindiyse initialValue'ya dön
        setStoredValue(initialValue)
      }
    }

    // Custom event for same-window sync
    const handleLocalChange = (e: Event) => {
      const customEvent = e as CustomEvent<LocalStorageChangeDetail>
      if (customEvent.detail.key === key) {
        if (customEvent.detail.value === serializedValueRef.current) return
        try {
          setStoredValue(JSON.parse(customEvent.detail.value))
        } catch (error) {
          Logger.warn(`useLocalStorage: "${key}" için local sync başarısız:`, error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('local-storage', handleLocalChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('local-storage', handleLocalChange)
    }
  }, [key, initialValue])

  // Değer değiştiğinde localStorage'a kaydet
  // FIX: Fonksiyon olarak geçirildiğinde React'in setState gibi çalışır
  const setValue: SetValue<T> = useCallback(
    (value) => {
      try {
        // Fonksiyon olarak gelen değeri destekle - EN GÜNCEL değeri kullan
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
          // Doğrudan değer geçilmişse
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

/**
 * String değerler için localStorage hook'u (JSON parse etmeden)
 * SSR ve test ortamlarında güvenli çalışır
 */
export function useLocalStorageString(
  key: string,
  initialValue: string,
  validValues: string[] | null = null
): [string, SetValue<string>] {
  const [storedValue, setStoredValue] = useState<string>(() => {
    // SSR/Test ortamında localStorage erişilemez
    if (!isClient) return initialValue

    try {
      const item = getStorageItem(key)
      if (item !== null) {
        // Geçerli değerler varsa kontrol et
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

  // Cross-window senkronizasyon
  useEffect(() => {
    // SSR/Test ortamında event listener ekleme
    if (!isClient) return

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        if (e.newValue === storedValueRef.current) return
        // Geçerli değerler varsa kontrol et
        if (validValues && validValues.length > 0 && !validValues.includes(e.newValue)) {
          return
        }
        setStoredValue(e.newValue)
      } else if (e.key === key && e.newValue === null) {
        setStoredValue(initialValue)
      }
    }

    // Custom event for same-window sync
    const handleLocalChange = (e: Event) => {
      const customEvent = e as CustomEvent<LocalStorageChangeDetail>
      if (customEvent.detail.key === key) {
        const newValue = customEvent.detail.value
        if (newValue === storedValueRef.current) return
        // Geçerli değerler varsa kontrol et
        if (validValues && validValues.length > 0 && !validValues.includes(newValue)) {
          return
        }
        setStoredValue(newValue)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('local-storage', handleLocalChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('local-storage', handleLocalChange)
    }
  }, [key, initialValue, validValues])

  // Mevcut değeri validValues ile senkronize et (dinamik validValues için)
  useEffect(() => {
    if (validValues && validValues.length > 0 && !validValues.includes(storedValue)) {
      // Eğer localStorage'da geçerli bir değer varsa onu al, yoksa initialValue
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
            // Geçerli değerler varsa kontrol et
            if (validValues && !validValues.includes(newValue)) {
              Logger.warn(`useLocalStorageString: "${key}" için geçersiz değer:`, newValue)
              return prevValue // Geçersiz değeri kaydetme
            }
            setStorageItem(key, newValue)
            return newValue
          })
        } else {
          // Geçerli değerler varsa kontrol et
          if (validValues && !validValues.includes(value)) {
            Logger.warn(`useLocalStorageString: "${key}" için geçersiz değer:`, value)
            return // Geçersiz değeri kaydetme
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

/**
 * Boolean değerler için localStorage hook'u
 * SSR ve test ortamlarında güvenli çalışır
 */
export function useLocalStorageBoolean(
  key: string,
  initialValue: boolean = false
): [boolean, SetValue<boolean>, () => void] {
  const [storedValue, setStoredValue] = useState<boolean>(() => {
    // SSR/Test ortamında localStorage erişilemez
    if (!isClient) return initialValue

    try {
      const item = getStorageItem(key)
      // null ise (key yok) initialValue kullan
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

  // Cross-window senkronizasyon
  useEffect(() => {
    // SSR/Test ortamında event listener ekleme
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

    // Custom event for same-window sync
    const handleLocalChange = (e: Event) => {
      const customEvent = e as CustomEvent<LocalStorageChangeDetail>
      if (customEvent.detail.key === key) {
        const nextValue = customEvent.detail.value === 'true'
        if (nextValue === storedValueRef.current) return
        setStoredValue(nextValue)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('local-storage', handleLocalChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('local-storage', handleLocalChange)
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
