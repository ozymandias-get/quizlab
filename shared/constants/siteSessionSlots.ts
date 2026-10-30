/** Bound allocations from untrusted IPC while supporting additional Google accounts. */
const MAX_GOOGLE_ACCOUNT_SLOTS = 20
export const SITE_SESSION_SLOTS: readonly number[] = Array.from(
  { length: MAX_GOOGLE_ACCOUNT_SLOTS },
  (_, index) => index + 1
)

export function isSiteSessionSlot(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_GOOGLE_ACCOUNT_SLOTS
  )
}

export function googleAccountSlotOptions(usedSlots: readonly number[] = []): number[] {
  return [...new Set(usedSlots.filter(isSiteSessionSlot))].sort((a, b) => a - b)
}
