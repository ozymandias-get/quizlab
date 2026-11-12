/**
 * Moves the item identified by `itemId` next to the item identified by
 * `targetId`.
 *
 * The insertion side is explicit because in a tab strip the pointer position
 * decides it; a plain index swap would make a one-pill drag to the right jump
 * past the target instead of landing next to it. The original array is
 * returned for a no-op move so store subscribers do not re-render for nothing.
 */
export function moveItemWithinList<T extends { id: string }>(
  items: T[],
  itemId: string,
  targetId: string,
  placeAfter: boolean
): T[] {
  if (itemId === targetId) return items
  const fromIndex = items.findIndex((item) => item.id === itemId)
  if (fromIndex < 0) return items
  if (!items.some((item) => item.id === targetId)) return items

  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) return items
  const targetIndex = next.findIndex((item) => item.id === targetId)
  next.splice(placeAfter ? targetIndex + 1 : targetIndex, 0, moved)
  return next
}
