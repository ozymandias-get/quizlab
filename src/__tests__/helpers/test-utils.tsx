/**
 * Shared test utilities for rendering components with providers.
 * Provides consistent provider wrappers to reduce mock duplication.
 */
/**
 * Simulate a StorageEvent for cross-tab sync testing.
 */
export function fireStorageEvent(key: string, value: string | null) {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }))
}

/**
 * Simulate the custom localStorage sync event used by useLocalStorage.
 */
export function fireLocalStorageSyncEvent(key: string, value: string) {
  window.dispatchEvent(
    new CustomEvent('local-storage', {
      detail: { key, value }
    })
  )
}
