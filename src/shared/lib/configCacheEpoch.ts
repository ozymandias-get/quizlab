/**
 * A monotonic stamp for caches whose key cannot express every input.
 *
 * `getCachedAiConfig` keys its memo on URL + current AI + the *base* registry
 * config. A selector repair, a Magic Selector pick, or a settings save/delete
 * changes the *persisted custom* config without touching any of those, so the
 * key still matches and the memo would keep serving pre-change selectors. The
 * epoch is folded into the key, so one `invalidateConfigCaches()` retires every
 * cache built before it without any cache needing a reference to itself.
 *
 * It lives in `shared/lib` rather than in the feature because both ends need it:
 * `@platform/electron/api` fires it when the config is written or deleted, and
 * `@features/ai` reads it when deciding whether a memo is still good. Declaring
 * it in either one alone makes `platform` import `features`, which inverts the
 * layer order and closes the loop
 * `features/ai/index -> hooks/useAiSender -> lib/aiSenderSupport ->
 * platform/electron/api/useAiApi -> features/ai/index` — rejected by both
 * `npm run analyze:circular` and `src/__tests__/architecture/circular-import-gate.test.ts`.
 */
let epoch = 0

/**
 * Invalidates every memo stamped with {@link configCacheEpochValue}, in every
 * module that reads it.
 */
export function invalidateConfigCaches(): void {
  epoch += 1
}

/** The current stamp. Read it; only {@link invalidateConfigCaches} may advance it. */
export function configCacheEpochValue(): number {
  return epoch
}
