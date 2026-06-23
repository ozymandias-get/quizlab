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
