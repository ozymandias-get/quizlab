import { useEffect, useSyncExternalStore } from 'react'

/**
 * "Unsaved settings" registry shared by the settings modal and the forms inside
 * it.
 *
 * The modal keeps every visited tab mounted so drafts survive tab switches, so
 * a form's dirty state has to outlive its own render tree. The registry is a
 * module-level set because the close decision belongs to the modal, while the
 * answer comes from deep, lazily mounted tab components; a React context would
 * work too but would force every tab wrapper to thread a provider for a signal
 * that is only ever read at close time.
 *
 * Keys are stable per form ("api-provider-settings", "add-ai-model"). A form
 * registers its own answer and clears it on unmount, and the modal only asks
 * "is the set empty?".
 */
const dirtyKeys = new Set<string>()
const listeners = new Set<() => void>()

function emitChange(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Records one form's dirty state. Exported so a form that already owns a ref
 * to its dirty flag can publish it without adding another effect wrapper; the
 * hook below is the normal path.
 */
export function setSettingsDirty(key: string, isDirty: boolean): void {
  const hasKey = dirtyKeys.has(key)
  if (isDirty === hasKey) return
  if (isDirty) dirtyKeys.add(key)
  else dirtyKeys.delete(key)
  emitChange()
}

/** Drops every registration; used when the user confirms a discard. */
export function resetSettingsDirty(): void {
  if (dirtyKeys.size === 0) return
  dirtyKeys.clear()
  emitChange()
}

/** Registers the calling form's dirty state for as long as it is mounted. */
export function useSettingsDirty(key: string, isDirty: boolean): void {
  useEffect(() => {
    setSettingsDirty(key, isDirty)
    return () => setSettingsDirty(key, false)
  }, [key, isDirty])
}

/** True while any mounted settings form reports unsaved changes. */
export function useHasDirtySettings(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => dirtyKeys.size > 0,
    () => false
  )
}
