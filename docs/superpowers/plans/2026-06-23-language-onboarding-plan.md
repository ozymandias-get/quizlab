# Language Onboarding Dialog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a language selection dialog on first app launch only, persisted to localStorage.

**Architecture:** Zustand language store extended with `isOnboardingDone` flag. A centered dialog (`LanguageSelectionDialog`) conditionally rendered in `App.tsx` via `AnimatePresence`. Follows the existing `GeminiWebLoginOverlay` pattern for animations, focus trapping, and scroll lock.

**Tech Stack:** React 19, Zustand 5, i18next 26, motion/react, Tailwind CSS 4

## Global Constraints

- No new dependencies beyond what's already in `package.json`
- Follow existing `GeminiWebLoginOverlay` pattern for overlay/animations
- Dialog must not be dismissible via Escape or backdrop click
- Language flags use Unicode emoji (already in `LANGUAGES` constant)

---

## File Structure

| File                                                                 | Responsibility                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------ |
| `src/shared/constants/storageKeys.ts`                                | Add `APP_LANGUAGE_ONBOARDING_DONE` key                 |
| `src/shared/stores/languageStore.ts`                                 | Add `isOnboardingDone`, `completeOnboarding()`         |
| `src/features/onboarding/ui/LanguageSelectionDialog.tsx`             | Dialog component with language cards + Continue button |
| `src/app/App.tsx`                                                    | Lazy-load and conditionally render dialog              |
| `src/__tests__/shared/stores/languageStore.test.ts`                  | Update tests for `isOnboardingDone`                    |
| `src/__tests__/features/onboarding/LanguageSelectionDialog.test.tsx` | New tests for dialog                                   |

---

### Task 1: Storage key + language store extension

**Files:**

- Modify: `src/shared/constants/storageKeys.ts:19` (insert `APP_LANGUAGE_ONBOARDING_DONE`)
- Modify: `src/shared/stores/languageStore.ts:36-42` (extend `LanguageState`) + `src/shared/stores/languageStore.ts:53-73` (extend store creation)
- Test: `src/__tests__/shared/stores/languageStore.test.ts`

**Interfaces:**

- Consumes: `STORAGE_KEYS.APP_LANGUAGE` (existing), `LANGUAGES` (existing)
- Produces: `useLanguage.getState().isOnboardingDone: boolean`, `useLanguage.getState().completeOnboarding(): void`

- [ ] **Step 1: Add storage key**

Edit `src/shared/constants/storageKeys.ts` — add `APP_LANGUAGE_ONBOARDING_DONE` after `APP_LANGUAGE`:

```ts
APP_LANGUAGE_ONBOARDING_DONE: 'app-language-onboarding-done',
```

- [ ] **Step 2: Add failing test for onboarding state**

Edit `src/__tests__/shared/stores/languageStore.test.ts` — add to `describe('languageStore')`:

```ts
describe('onboarding', () => {
  it('defaults isOnboardingDone to false', () => {
    expect(useLanguage.getState().isOnboardingDone).toBe(false)
  })

  it('completeOnboarding sets isOnboardingDone to true and persists', () => {
    useLanguage.getState().completeOnboarding()
    expect(useLanguage.getState().isOnboardingDone).toBe(true)
    expect(window.localStorage.getItem('app-language-onboarding-done')).toBe('true')
  })

  it('reads persisted onboarding state from localStorage', () => {
    window.localStorage.setItem('app-language-onboarding-done', 'true')
    // Re-initialize the store (simulate fresh page load)
    const { useLanguage: freshStore } = await import('@shared/stores/languageStore')
    expect(freshStore.getState().isOnboardingDone).toBe(true)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/__tests__/shared/stores/languageStore.test.ts --reporter=verbose`
Expected: FAIL — `isOnboardingDone` is not defined on `LanguageState`

- [ ] **Step 4: Modify `LanguageState` interface**

In `src/shared/stores/languageStore.ts`, extend the interface:

```ts
interface LanguageState {
  language: string
  setLanguage: (lang: string) => void
  languages: typeof LANGUAGES
  _requestSeq: number
  lastError: string | null
  isOnboardingDone: boolean
  completeOnboarding: () => void
}
```

- [ ] **Step 5: Add initial value and `completeOnboarding` to the store**

Replace the `useLanguage` create call in `src/shared/stores/languageStore.ts`:

```ts
export const useLanguage = create<LanguageState>((set, get) => ({
  language: getInitialLanguage(),
  languages: LANGUAGES,
  _requestSeq: 0,
  lastError: null,
  isOnboardingDone: (() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.APP_LANGUAGE_ONBOARDING_DONE) === 'true'
    } catch {
      return false
    }
  })(),
  setLanguage: async (newLang: string) => {
    if (!VALID_LANGUAGES.includes(newLang)) return
    const seq = get()._requestSeq + 1
    set({ _requestSeq: seq })
    try {
      localStorage.setItem(STORAGE_KEYS.APP_LANGUAGE, newLang)
    } catch (error) {
      Logger.warn('LocalStorage language save failed:', error)
      set({ lastError: 'Language preference could not be saved persistently' })
    }
    await i18next.changeLanguage(newLang)
    if (get()._requestSeq === seq) {
      set({ language: newLang, lastError: get().lastError })
    }
  },
  completeOnboarding: () => {
    try {
      localStorage.setItem(STORAGE_KEYS.APP_LANGUAGE_ONBOARDING_DONE, 'true')
    } catch (error) {
      Logger.warn('LocalStorage onboarding save failed:', error)
    }
    set({ isOnboardingDone: true })
  }
}))
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/shared/stores/languageStore.test.ts --reporter=verbose`
Expected: All tests PASS (including the new onboarding ones and existing ones)

- [ ] **Step 7: Commit**

```bash
git add src/shared/constants/storageKeys.ts src/shared/stores/languageStore.ts src/__tests__/shared/stores/languageStore.test.ts
git commit -m "feat: add onboarding flag to language store"
```

---

### Task 2: LanguageSelectionDialog component

**Files:**

- Create: `src/features/onboarding/ui/LanguageSelectionDialog.tsx`

**Interfaces:**

- Consumes: `useLanguage` (Zustand store), `LANGUAGES` const
- Produces: `<LanguageSelectionDialog />` (self-contained, no props)

**Pattern reference:** `GeminiWebLoginOverlay` in `src/app/ui/GeminiWebLoginOverlay.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/features/onboarding/LanguageSelectionDialog.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LanguageSelectionDialog } from '@features/onboarding/ui/LanguageSelectionDialog'

vi.mock('@shared/stores/languageStore', () => ({
  useLanguage: Object.assign(
    (selector?: (state: any) => any) => {
      const state = {
        language: 'en',
        isOnboardingDone: false,
        languages: {
          en: {
            code: 'en',
            name: 'English',
            nativeName: 'English',
            flag: '🇬🇧',
            dir: 'ltr' as const
          },
          tr: { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', dir: 'ltr' as const }
        },
        setLanguage: vi.fn().mockResolvedValue(undefined),
        completeOnboarding: vi.fn()
      }
      return selector ? selector(state) : state
    },
    {
      getState: () => ({
        completeOnboarding: vi.fn(),
        setLanguage: vi.fn().mockResolvedValue(undefined)
      })
    }
  )
}))

describe('LanguageSelectionDialog', () => {
  it('renders two language options', () => {
    render(<LanguageSelectionDialog />)
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Türkçe')).toBeInTheDocument()
  })

  it('continue button is disabled when no language selected', () => {
    render(<LanguageSelectionDialog />)
    expect(screen.getByRole('button', { name: /devam et|continue/i })).toBeDisabled()
  })

  it('selecting a language enables the continue button', async () => {
    const user = userEvent.setup()
    render(<LanguageSelectionDialog />)
    await user.click(screen.getByText('Türkçe'))
    expect(screen.getByRole('button', { name: /devam et|continue/i })).toBeEnabled()
  })

  it('sets language and completes onboarding on continue', async () => {
    const user = userEvent.setup()
    const completeOnboarding = vi.fn()
    const setLanguage = vi.fn().mockResolvedValue(undefined)

    // Override mock for this test
    vi.mocked(useLanguage).mockImplementation((selector?: any) =>
      selector?.({
        language: 'en',
        isOnboardingDone: false,
        languages: {
          /* same as above */
        },
        setLanguage,
        completeOnboarding
      })
    )

    render(<LanguageSelectionDialog />)
    await user.click(screen.getByText('Türkçe'))
    await user.click(screen.getByRole('button', { name: /devam et|continue/i }))
    expect(setLanguage).toHaveBeenCalledWith('tr')
    expect(completeOnboarding).toHaveBeenCalled()
  })

  it('has role="dialog" and aria-modal', () => {
    render(<LanguageSelectionDialog />)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/features/onboarding/LanguageSelectionDialog.test.tsx --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Create the directory and component**

```bash
New-Item -ItemType Directory -Path "src/features/onboarding/ui" -Force
```

Create `src/features/onboarding/ui/LanguageSelectionDialog.tsx`:

```tsx
import { useLanguage } from '@shared/stores/languageStore'
import { AnimatePresence, motion } from 'motion/react'
import { memo, useCallback, useId, useLayoutEffect, useRef, useState } from 'react'

let globalScrollLockCount = 0
let globalScrollLockOriginal: string | null = null

export function LanguageSelectionDialog() {
  const { isOnboardingDone, languages, setLanguage, completeOnboarding } = useLanguage()
  const [selectedLang, setSelectedLang] = useState<string | null>(null)
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const restoreFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleContinue = useCallback(async () => {
    if (!selectedLang) return
    await setLanguage(selectedLang)
    completeOnboarding()
  }, [selectedLang, setLanguage, completeOnboarding])

  const isVisible = !isOnboardingDone

  useLayoutEffect(() => {
    if (isVisible) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null

      if (globalScrollLockCount === 0) {
        globalScrollLockOriginal = document.body.style.overflow
        document.body.style.overflow = 'hidden'
      }
      globalScrollLockCount += 1

      const focusFrame = requestAnimationFrame(() => {
        const dialog = dialogRef.current
        if (!dialog) return
        const firstFocusable = dialog.querySelector<HTMLElement>(
          'button:not([disabled]):not([hidden]):not([inert])'
        )
        ;(firstFocusable ?? dialog).focus()
      })

      return () => {
        cancelAnimationFrame(focusFrame)

        globalScrollLockCount -= 1
        if (globalScrollLockCount <= 0) {
          document.body.style.overflow = globalScrollLockOriginal ?? ''
          globalScrollLockOriginal = null
        }

        if (restoreFocusTimeoutRef.current !== null) {
          clearTimeout(restoreFocusTimeoutRef.current)
        }

        const prevFocus = previouslyFocusedRef.current
        if (prevFocus) {
          restoreFocusTimeoutRef.current = setTimeout(() => {
            try {
              if (document.body.contains(prevFocus)) {
                prevFocus.focus?.()
              }
            } catch {
              // Silently ignore focus on detached element
            }
          }, 250)
        }
      }
    }
  }, [isVisible])

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <motion.div
        key="language-onboarding"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="z-modal fixed inset-0 flex items-center justify-center bg-[rgba(2,6,12,0.72)] backdrop-blur-xl"
      >
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="glass-tier-1 glass-tier-card mx-6 w-full max-w-md rounded-[2rem] p-8 text-center outline-none"
        >
          <h2 id={titleId} className="text-ql-28 font-semibold text-white">
            Select Your Language
          </h2>
          <p className="text-ql-14 mt-2 text-white/60">Dilinizi Seçin</p>

          <div className="mt-8 flex flex-col gap-4">
            {Object.values(languages).map((lang) => {
              const isSelected = selectedLang === lang.code
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setSelectedLang(lang.code)}
                  className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none ${
                    isSelected
                      ? 'border-emerald-400/60 bg-emerald-400/10 ring-1 ring-emerald-400/40'
                      : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]'
                  } `}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.06] text-2xl">
                    {lang.flag}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-ql-16 font-semibold text-white">{lang.nativeName}</span>
                    <span className="text-ql-13 text-white/50">{lang.name}</span>
                  </div>
                  {isSelected && (
                    <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400 text-xs text-white">
                      ✓
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={handleContinue}
            disabled={!selectedLang}
            className="text-ql-14 mt-8 inline-flex w-full items-center justify-center rounded-full px-6 py-3 font-semibold transition-all focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none enabled:bg-emerald-400/90 enabled:text-white enabled:hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue &rarr;
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default memo(LanguageSelectionDialog)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/features/onboarding/LanguageSelectionDialog.test.tsx --reporter=verbose`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/ui/LanguageSelectionDialog.tsx src/__tests__/features/onboarding/LanguageSelectionDialog.test.tsx
git commit -m "feat: add LanguageSelectionDialog component"
```

---

### Task 3: Integrate in App.tsx

**Files:**

- Modify: `src/app/App.tsx` — add lazy import, conditional render

**Interfaces:**

- Consumes: `useLanguage().isOnboardingDone` from languageStore
- Produces: LanguageSelectionDialog rendered at z-modal level, blocking all interaction until dismissed

- [ ] **Step 1: Write the failing test**

Add to a new or existing integration test file. Create `src/__tests__/app/App.onboarding.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from '@app/App'

vi.mock('@shared/stores/languageStore', () => ({
  useLanguage: (selector?: any) =>
    selector?.({
      language: 'en',
      isOnboardingDone: false,
      languages: {
        en: { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', dir: 'ltr' as const },
        tr: { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', dir: 'ltr' as const }
      },
      setLanguage: vi.fn().mockResolvedValue(undefined),
      completeOnboarding: vi.fn()
    })
}))

// Mock all lazy-loaded dependencies that App.tsx imports
vi.mock('@app/ui/FocusOverlay', () => ({ default: () => null }))
vi.mock('@features/screenshot', () => ({ ScreenshotTool: () => null }))
vi.mock('@features/tutorial', () => ({ TutorialOverlay: () => null }))
vi.mock('@ui/components/UpdateBanner', () => ({ default: () => null }))
vi.mock('@app/ui/GeminiWebLoginOverlay', () => ({ default: () => null }))
vi.mock('@app/ui/AiSendComposer', () => ({ default: () => null }))
vi.mock('@features/settings/hooks/useCacheThresholdWarning', () => ({
  useCacheThresholdWarning: () => {}
}))
vi.mock('@app/hooks/useAppShellState', () => ({ useAppShellState: () => ({}) }))
vi.mock('@app/hooks/usePdfWorkspaceState', () => ({ usePdfWorkspaceState: () => ({}) }))
vi.mock('@app/providers', () => ({
  useAppToolActions: () => ({}),
  useAppToolGeminiSessionState: () => ({}),
  useAppToolQueueState: () => ({}),
  useAppToolScreenshotState: () => ({})
}))
vi.mock('@features/tutorial/store/tutorialStore', () => ({ useTutorialStore: () => ({}) }))
vi.mock('@features/tutorial/tutorialRegistry', () => ({ getTutorialEntry: () => null }))
vi.mock('@ui/components/Toast/ToastContainer', () => ({ default: () => null }))
vi.mock('@ui/layout/AppBackground', () => ({ default: () => null }))

describe('App onboarding', () => {
  it('renders LanguageSelectionDialog when onboarding not done', async () => {
    render(<App />)
    expect(await screen.findByText('Select Your Language')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/app/App.onboarding.test.tsx --reporter=verbose`
Expected: FAIL — LanguageSelectionDialog not rendered (not in App.tsx yet)

- [ ] **Step 3: Modify App.tsx**

At the top of `src/app/App.tsx`, add a lazy import after the existing lazy imports:

```tsx
const LanguageSelectionDialog = lazy(() =>
  import('@features/onboarding/ui/LanguageSelectionDialog').then((m) => ({
    default: m.default ?? m.LanguageSelectionDialog
  }))
)
```

Add import for `useLanguage`:

```tsx
import { useLanguage } from '@shared/stores/languageStore'
```

In the `App` function body, add after `const isFocusActive = focus.mode !== null`:

```tsx
const isOnboardingDone = useLanguage((s) => s.isOnboardingDone)
```

In the JSX return, add inside the root `LayoutGroup > div`, before the closing `</div>` (e.g. after the TutorialLayer Suspense block):

```tsx
{
  !isOnboardingDone && (
    <Suspense fallback={null}>
      <LanguageSelectionDialog />
    </Suspense>
  )
}
```

Note: Do NOT wrap in AnimatePresence here — the LanguageSelectionDialog component already has its own AnimatePresence internally. Put this block outside the existing `AnimatePresence` for FocusOverlay.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/app/App.onboarding.test.tsx --reporter=verbose`
Expected: PASS

Run existing tests to ensure nothing broke:
`npx vitest run src/__tests__/shared/stores/languageStore.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/App.tsx src/__tests__/app/App.onboarding.test.tsx
git commit -m "feat: integrate LanguageSelectionDialog into App.tsx"
```

---

## Self-Review

**Spec coverage:**

- Storage key added ✅ (Task 1)
- Store flag + `completeOnboarding()` ✅ (Task 1)
- LanguageSelectionDialog with language cards + Continue button ✅ (Task 2)
- Integrates in App.tsx, conditionally rendered ✅ (Task 3)
- Tests for all paths ✅ (Tasks 1-3)

**Placeholder scan:** No TBD, TODO, or incomplete sections.

**Type consistency:** `isOnboardingDone` (boolean), `completeOnboarding()` (void), `setLanguage(lang: string)` (Promise<void>) — consistent across all tasks.
