import { useState, useEffect, useCallback, useRef } from 'react'
import { Logger } from '@shared/lib/logger'

/**
 * SSR/Test ortamÄ± kontrolÃ¼
 * window objesi olmayan ortamlarda (Jest, Vitest, SSR) hata vermemek iÃ§in
 */
const isClient = typeof window !== 'undefined'

/**
 * localStorage'a gÃ¼venli eriÅŸim saÄŸlar
 * window undefined ise null dÃ¶ner
 */
const getStorageItem = (key: string): string | null => {
    if (!isClient) return null
    try {
        return localStorage.getItem(key)
    } catch (error) {
        Logger.warn(`localStorage eriÅŸim hatasÄ± (get "${key}"):`, error)
        return null
    }
}

/**
 * localStorage'a gÃ¼venli yazma saÄŸlar
 * window undefined ise sessizce baÅŸarÄ±sÄ±z olur
 */
const setStorageItem = (key: string, value: string): boolean => {
    if (!isClient) return false
    try {
        localStorage.setItem(key, value)
        // Dispatch custom event for same-window sync
        window.dispatchEvent(new CustomEvent('local-storage', { detail: { key, value } }))
        return true
    } catch (error) {
        Logger.warn(`localStorage yazma hatasÄ± (set "${key}"):`, error)
        return false
    }
}

type SetValue<T> = React.Dispatch<React.SetStateAction<T>>

/**
 * localStorage ile state senkronizasyonu saÄŸlayan hook
 * SSR ve test ortamlarÄ±nda gÃ¼venli Ã§alÄ±ÅŸÄ±r
 * 
 * FIX: Stale closure sorunu Ã§Ã¶zÃ¼ldÃ¼ - useRef ile gÃ¼ncel deÄŸere eriÅŸim
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, SetValue<T>] {
    // BaÅŸlangÄ±Ã§ deÄŸerini localStorage'dan al veya varsayÄ±lan kullan
    const [storedValue, setStoredValue] = useState<T>(() => {
        // SSR/Test ortamÄ±nda localStorage eriÅŸilemez
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
                        Logger.warn(`useLocalStorage: Type mismatch for key "${key}". Expected Array, got ${parsedType}. Resetting to initial.`)
                        return initialValue
                    }
                } else if (parsedType !== initialType) {
                    Logger.warn(`useLocalStorage: Type mismatch for key "${key}". Expected ${initialType}, got ${parsedType}. Resetting to initial.`)
                    return initialValue
                }
            }

            return parsed
        } catch (error) {
            Logger.warn(`useLocalStorage: "${key}" iÃ§in deÄŸer okunamadÄ±:`, error)
            return initialValue
        }
    })

    // GÃ¼ncel deÄŸeri ref'te tut - stale closure sorununu Ã§Ã¶zer
    const storedValueRef = useRef(storedValue)
    useEffect(() => {
        storedValueRef.current = storedValue
    }, [storedValue])

    // Cross-window senkronizasyon iÃ§in storage event'i dinle
    useEffect(() => {
        // SSR/Test ortamÄ±nda event listener ekleme
        if (!isClient) return

        const handleStorageChange = (e: StorageEvent) => {
            // Sadece ilgili key deÄŸiÅŸtiÄŸinde ve baÅŸka pencereden geldiyse
            if (e.key === key && e.newValue !== null) {
                try {
                    setStoredValue(JSON.parse(e.newValue))
                } catch (error) {
                    Logger.warn(`useLocalStorage: "${key}" iÃ§in cross-window sync baÅŸarÄ±sÄ±z:`, error)
                }
            } else if (e.key === key && e.newValue === null) {
                // Key silindiyse initialValue'ya dÃ¶n
                setStoredValue(initialValue)
            }
        }

        // Custom event for same-window sync
        const handleLocalChange = (e: Event) => {
            const customEvent = e as CustomEvent
            if (customEvent.detail.key === key) {
                try {
                    setStoredValue(JSON.parse(customEvent.detail.value))
                } catch (error) {
                    Logger.warn(`useLocalStorage: "${key}" iÃ§in local sync baÅŸarÄ±sÄ±z:`, error)
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

    // DeÄŸer deÄŸiÅŸtiÄŸinde localStorage'a kaydet
    // FIX: Fonksiyon olarak geÃ§irildiÄŸinde React'in setState gibi Ã§alÄ±ÅŸÄ±r
    const setValue: SetValue<T> = useCallback((value) => {
        try {
            // Fonksiyon olarak gelen deÄŸeri destekle - EN GÃœNCEL deÄŸeri kullan
            if (value instanceof Function) {
                setStoredValue((prevValue) => {
                    const newValue = value(prevValue)
                    setStorageItem(key, JSON.stringify(newValue))
                    return newValue
                })
            } else {
                // DoÄŸrudan deÄŸer geÃ§ilmiÅŸse
                setStoredValue(value)
                setStorageItem(key, JSON.stringify(value))
            }
        } catch (error) {
            Logger.warn(`useLocalStorage: "${key}" iÃ§in deÄŸer kaydedilemedi:`, error)
        }
    }, [key])

    return [storedValue, setValue]
}

/**
 * String deÄŸerler iÃ§in localStorage hook'u (JSON parse etmeden)
 * SSR ve test ortamlarÄ±nda gÃ¼venli Ã§alÄ±ÅŸÄ±r
 */
export function useLocalStorageString(key: string, initialValue: string, validValues: string[] | null = null): [string, SetValue<string>] {
    const [storedValue, setStoredValue] = useState<string>(() => {
        // SSR/Test ortamÄ±nda localStorage eriÅŸilemez
        if (!isClient) return initialValue

        try {
            const item = getStorageItem(key)
            if (item !== null) {
                // GeÃ§erli deÄŸerler varsa kontrol et
                if (validValues && !validValues.includes(item)) {
                    return initialValue
                }
                return item
            }
            return initialValue
        } catch (error) {
            Logger.warn(`useLocalStorageString: "${key}" iÃ§in deÄŸer okunamadÄ±:`, error)
            return initialValue
        }
    })

    // Cross-window senkronizasyon
    useEffect(() => {
        // SSR/Test ortamÄ±nda event listener ekleme
        if (!isClient) return

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === key && e.newValue !== null) {
                // GeÃ§erli deÄŸerler varsa kontrol et
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
            const customEvent = e as CustomEvent
            if (customEvent.detail.key === key) {
                const newValue = customEvent.detail.value
                // GeÃ§erli deÄŸerler varsa kontrol et
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

    // Mevcut deÄŸeri validValues ile senkronize et (dinamik validValues iÃ§in)
    useEffect(() => {
        if (validValues && validValues.length > 0 && !validValues.includes(storedValue)) {
            // EÄŸer localStorage'da geÃ§erli bir deÄŸer varsa onu al, yoksa initialValue
            const item = getStorageItem(key)
            if (item && validValues.includes(item)) {
                setStoredValue(item)
            } else if (storedValue !== initialValue) {
                setStoredValue(initialValue)
            }
        }
    }, [validValues, key, initialValue, storedValue])

    const setValue: SetValue<string> = useCallback((value) => {
        try {
            if (value instanceof Function) {
                setStoredValue((prevValue) => {
                    const newValue = value(prevValue)
                    // GeÃ§erli deÄŸerler varsa kontrol et
                    if (validValues && !validValues.includes(newValue)) {
                        Logger.warn(`useLocalStorageString: "${key}" iÃ§in geÃ§ersiz deÄŸer:`, newValue)
                        return prevValue // GeÃ§ersiz deÄŸeri kaydetme
                    }
                    setStorageItem(key, newValue)
                    return newValue
                })
            } else {
                // GeÃ§erli deÄŸerler varsa kontrol et
                if (validValues && !validValues.includes(value)) {
                    Logger.warn(`useLocalStorageString: "${key}" iÃ§in geÃ§ersiz deÄŸer:`, value)
                    return // GeÃ§ersiz deÄŸeri kaydetme
                }
                setStoredValue(value)
                setStorageItem(key, value)
            }
        } catch (error) {
            Logger.warn(`useLocalStorageString: "${key}" iÃ§in deÄŸer kaydedilemedi:`, error)
        }
    }, [key, validValues])

    return [storedValue, setValue]
}

/**
 * Boolean deÄŸerler iÃ§in localStorage hook'u
 * SSR ve test ortamlarÄ±nda gÃ¼venli Ã§alÄ±ÅŸÄ±r
 */
export function useLocalStorageBoolean(key: string, initialValue: boolean = false): [boolean, SetValue<boolean>, () => void] {
    const [storedValue, setStoredValue] = useState<boolean>(() => {
        // SSR/Test ortamÄ±nda localStorage eriÅŸilemez
        if (!isClient) return initialValue

        try {
            const item = getStorageItem(key)
            // null ise (key yok) initialValue kullan
            if (item === null) return initialValue
            return item === 'true'
        } catch (error) {
            Logger.warn(`useLocalStorageBoolean: "${key}" iÃ§in deÄŸer okunamadÄ±:`, error)
            return initialValue
        }
    })

    // Cross-window senkronizasyon
    useEffect(() => {
        // SSR/Test ortamÄ±nda event listener ekleme
        if (!isClient) return

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === key && e.newValue !== null) {
                setStoredValue(e.newValue === 'true')
            } else if (e.key === key && e.newValue === null) {
                setStoredValue(initialValue)
            }
        }

        // Custom event for same-window sync
        const handleLocalChange = (e: Event) => {
            const customEvent = e as CustomEvent
            if (customEvent.detail.key === key) {
                setStoredValue(customEvent.detail.value === 'true')
            }
        }

        window.addEventListener('storage', handleStorageChange)
        window.addEventListener('local-storage', handleLocalChange)
        return () => {
            window.removeEventListener('storage', handleStorageChange)
            window.removeEventListener('local-storage', handleLocalChange)
        }
    }, [key, initialValue])

    const setValue: SetValue<boolean> = useCallback((value) => {
        try {
            if (value instanceof Function) {
                setStoredValue((prevValue) => {
                    const newValue = value(prevValue)
                    setStorageItem(key, newValue.toString())
                    return newValue
                })
            } else {
                setStoredValue(value)
                setStorageItem(key, value.toString())
            }
        } catch (error) {
            Logger.warn(`useLocalStorageBoolean: "${key}" iÃ§in deÄŸer kaydedilemedi:`, error)
        }
    }, [key])

    const toggle = useCallback(() => {
        setValue((prev) => !prev)
    }, [setValue])

    return [storedValue, setValue, toggle]
}

