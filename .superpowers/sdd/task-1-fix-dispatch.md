Fix the following issues found in the Task 1 review:

### 1. Critical: Test 3 doesn't verify init logic (`languageStore.test.ts:118-124`)
The test manually calls `useLanguage.setState({ isOnboardingDone: true })` instead of testing the store's initialization IIFE. This test would pass even if the init logic were deleted.

**Fix approach:** Extract the IIFE into a named helper function `getInitialOnboardingDone()` in `languageStore.ts` (similar to existing `getInitialLanguage()`), use it in the store creation, export it, and test it directly.

In `src/shared/stores/languageStore.ts`, add before the `useLanguage` create call:

```ts
const getInitialOnboardingDone = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEYS.APP_LANGUAGE_ONBOARDING_DONE) === 'true'
  } catch {
    return false
  }
}
```

Replace the IIFE in store creation:
```ts
isOnboardingDone: getInitialOnboardingDone(),
```

Export it:
```ts
export { getInitialOnboardingDone }
```

In the test, add the import:
```ts
import { ..., getInitialOnboardingDone } from '@shared/stores/languageStore'
```

Replace the third onboarding test:
```ts
it('reads persisted onboarding state from localStorage', () => {
  window.localStorage.setItem('app-language-onboarding-done', 'true')
  expect(getInitialOnboardingDone()).toBe(true)
  window.localStorage.removeItem('app-language-onboarding-done')
  expect(getInitialOnboardingDone()).toBe(false)
})
```

### 2. Important: `_requestSeq` describe moved outside `languageStore` block (`languageStore.test.ts:127-133`)
The `describe('_requestSeq')` block is at the wrong indent level — it's at the top level instead of nested inside `describe('languageStore')`.

**Fix:** Change its indentation so it's properly nested (add 2 spaces to every line in that block).

### 3. Important: Onboarding tests incorrect indentation (`languageStore.test.ts:107-125`)
The `describe('onboarding', ...)` and its nested `it(...)` calls have wrong indentation — they're at the same level as the parent `describe('languageStore')`.

**Fix:** Indent the entire onboarding block + its test lines 4 spaces from `describe('languageStore')`, and the `it(...)` lines 2 more spaces from `describe('onboarding')`.

### 4. Minor: `beforeEach` doesn't reset `isOnboardingDone` (`languageStore.test.ts:24`)
Add `isOnboardingDone: false` to the `setState` call in `beforeEach`.

## Instructions

Implement all fixes above. After fixing:
1. Run `npx vitest run src/__tests__/shared/stores/languageStore.test.ts --reporter=verbose`
2. Append the test results to the report file at `C:\Users\Umutu\Downloads\quizlab-master\.superpowers\sdd\task-1-report.md`
3. Commit with `git commit --amend --no-edit` (or create a new commit with message "fix: address Task 1 review findings")
4. Return Status, commits, test summary