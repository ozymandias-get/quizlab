/**
 * Named DOM slot registry.
 *
 * Lets a control that is *owned* by one subtree (its state, its actions) be
 * rendered into a container that *lives* in another subtree, without either
 * side importing the other and without scanning the document.
 *
 * The PDF feature owns the slot (it knows where inside the viewer a draft
 * control belongs); the app layer owns the control (it owns the draft queue).
 * They meet here — one direction of dependency, no cycle, no `querySelector`
 * on every mutation.
 *
 * Two slots can exist at once (the workspace viewer and the focus-mode viewer
 * overlap during the overlay transition). Registration keeps insertion order
 * and `resolveDomSlot` answers with the most recent slot that is still in the
 * document, so a viewer going away cannot strand the control.
 */
type SlotListener = (element: HTMLElement | null) => void

const slots = new Map<string, HTMLElement[]>()
const listeners = new Map<string, Set<SlotListener>>()

function notify(id: string, element: HTMLElement | null): void {
  const subscribers = listeners.get(id)
  if (!subscribers) return
  for (const listener of subscribers) {
    listener(element)
  }
}

/** The most recently registered slot that is still in the document. */
export function resolveDomSlot(id: string): HTMLElement | null {
  const registered = slots.get(id)
  if (!registered || registered.length === 0) return null
  for (let i = registered.length - 1; i >= 0; i--) {
    const element = registered[i]
    if (element?.isConnected) return element
  }
  return null
}

export function registerDomSlot(id: string, element: HTMLElement | null): void {
  if (!element) return
  const registered = slots.get(id) ?? []
  if (registered.includes(element)) return
  registered.push(element)
  slots.set(id, registered)
  notify(id, resolveDomSlot(id))
}

export function unregisterDomSlot(id: string, element: HTMLElement): void {
  const registered = slots.get(id)
  if (!registered) return
  const index = registered.indexOf(element)
  if (index === -1) return
  registered.splice(index, 1)
  if (registered.length === 0) slots.delete(id)
  notify(id, resolveDomSlot(id))
}

/** Subscribes to slot changes; calls back immediately with the current slot. */
export function subscribeDomSlot(id: string, listener: SlotListener): () => void {
  const subscribers = listeners.get(id) ?? new Set<SlotListener>()
  subscribers.add(listener)
  listeners.set(id, subscribers)
  listener(resolveDomSlot(id))
  return () => {
    subscribers.delete(listener)
    if (subscribers.size === 0) listeners.delete(id)
  }
}
