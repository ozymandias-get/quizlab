/**
 * Shared Zustand store utilities.
 *
 * Reduces boilerplate for persisted stores.
 */
import type { StateCreator } from 'zustand'
import { create } from 'zustand'
import { createJSONStorage, persist, type PersistOptions } from 'zustand/middleware'

/** localStorage adapter (repeated in every persisted store). */
export const createLocalStorageAdapter = <T>() => createJSONStorage<T>(() => localStorage)

/**
 * Debounced localStorage adapter for high-frequency stores (e.g. sliders).
 * Coalesces rapid `setItem` calls (e.g. slider drag 60 Hz → 1 write per 250 ms)
 * via `setTimeout`, flushing the last pending write on `beforeunload` /
 * `visibilitychange` so no value is lost if the user closes mid-drag.
 */
export const createDebouncedStorageAdapter = <T>(delayMs = 250) => {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const pending = new Map<string, string>()

  const flush = (key: string) => {
    const value = pending.get(key)
    if (value !== undefined) {
      try {
        localStorage.setItem(key, value)
      } catch {}
      pending.delete(key)
    }
    const t = timers.get(key)
    if (t) {
      clearTimeout(t)
      timers.delete(key)
    }
  }

  const flushAll = () => {
    for (const k of pending.keys()) flush(k)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flushAll)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushAll()
    })
  }

  const debouncedStorage = {
    getItem: (key: string): string | null => {
      // If a write is pending, return the pending value so getItem is consistent
      if (pending.has(key)) return pending.get(key) ?? null
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    setItem: (key: string, value: string): void => {
      pending.set(key, value)
      const existing = timers.get(key)
      if (existing) clearTimeout(existing)
      const timer = setTimeout(() => flush(key), delayMs)
      timers.set(key, timer)
    },
    removeItem: (key: string): void => {
      const t = timers.get(key)
      if (t) {
        clearTimeout(t)
        timers.delete(key)
      }
      pending.delete(key)
      try {
        localStorage.removeItem(key)
      } catch {}
    }
  }

  return createJSONStorage<T>(() => debouncedStorage)
}

/**
 * Creates a Zustand store with the `persist` middleware, using localStorage.
 *
 * @param name  Storage key in localStorage.
 * @param config  Standard Zustand state creator.
 * @param partialize  Optional — pick which fields survive serialisation.
 */
export function createPersistedStore<T>(
  name: string,
  config: StateCreator<T, [['zustand/persist', unknown]], []>,
  partialize?: (state: T) => Partial<T>
) {
  const persistOptions: PersistOptions<T, Partial<T>> = {
    name,
    storage: createLocalStorageAdapter<Partial<T>>(),
    partialize: partialize ?? ((state) => state)
  }
  return create<T>()(persist(config, persistOptions))
}
