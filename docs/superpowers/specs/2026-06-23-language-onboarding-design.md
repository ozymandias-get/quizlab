# Language Onboarding Dialog — Design Spec

## Problem

When the app is launched for the first time, the user should pick a language before proceeding. This choice must be persisted so the dialog never shows again.

The existing i18n infrastructure (i18next, Zustand language store) already supports EN and TR, but there is no first-launch onboarding flow.

## Architecture

A lightweight onboarding feature at `src/features/onboarding/` containing a single dialog component. The dialog is conditionally rendered in `App.tsx` based on a new `isOnboardingDone` flag in the existing language Zustand store. Once the user selects a language and clicks "Continue", the flag is set to `true` and persisted to localStorage — the dialog will never mount again.

No new dependencies. No routing changes. No tutorial system integration.

## Components

### `LanguageSelectionDialog`

- **Location:** `src/features/onboarding/ui/LanguageSelectionDialog.tsx`
- **Pattern:** Centered card modal (following `GeminiWebLoginOverlay` pattern)
  - Fixed inset backdrop with dark translucent (`oklch(0 0 0 / 0.65)`) + `backdrop-blur-xl`
  - Centered card: `glass-tier-1 glass-tier-card`, `max-w-md`, `rounded-[2rem]`, `p-8`
  - Z-index: `z-modal` (300)
- **Content:**
  - Title: "Select Your Language" / "Dil Seçin"
  - Language cards: Two clickable cards (EN / TR) each showing flag + native name
  - Selected state: highlighted border/accent color
  - "Continue" / "Devam Et" button — disabled until a language is selected
- **Behavior:**
  - Escape key closes? **No** — user must pick a language (no bypass)
  - Backdrop click closes? **No**
  - Language selected → card visually activates → Continue button enables
  - Continue clicked → `setLanguage()` + `completeOnboarding()` → dialog unmounts
- **Animation:**
  - Backdrop: `opacity 0→1`, 220ms, ease-out
  - Card: `opacity 0, y: 18, scale: 0.96 → identity`, 220ms, ease-out
  - Respects `useReducedMotion()` (no translate/scale, only opacity)
- **Accessibility:**
  - `role="dialog"`, `aria-modal="true"`, `aria-labelledby` for the title
  - Focus trap while open
  - Scroll lock while open

### `LanguageCard`

- Sub-component. Clickable, shows flag emoji + language name in that language
- States: default, hover, selected (ring/accent border)

## State Changes

### `src/shared/stores/languageStore.ts`

Add to `LanguageState`:

```ts
isOnboardingDone: boolean
completeOnboarding: () => void
```

Initialized from `localStorage.getItem(STORAGE_KEYS.APP_LANGUAGE_ONBOARDING_DONE) === 'true'`.

`completeOnboarding()` sets `localStorage.setItem(..., 'true')` and updates state.

### `src/shared/constants/storageKeys.ts`

Add:

```ts
APP_LANGUAGE_ONBOARDING_DONE: 'app-language-onboarding-done'
```

## Changes to Existing Files

### `src/app/App.tsx`

- Import `useLanguage` store and read `isOnboardingDone`
- Add `<AnimatePresence>` block rendering `LanguageSelectionDialog` when `!isOnboardingDone`
- Lazy-load the component via `React.lazy(() => import(...))`

### `src/app/main.tsx`

No changes needed — i18next init already reads the language from localStorage before render.

## Data Flow

```
App mounts
  → useLanguage().isOnboardingDone === false
  → <LanguageSelectionDialog /> renders (z-modal, blocks interaction)
  → User clicks EN/TR card → state updates selectedLang
  → "Continue" enables → user clicks
  → setLanguage(selectedLang) + completeOnboarding()
  → isOnboardingDone = true → dialog unmounts
  → Normal app UI is now interactive
  → Next launch: localStorage has 'true' → dialog never renders
```

## Edge Cases

- **localStorage cleared:** `isOnboardingDone` defaults to `false` → dialog shows again. User re-selects language. Acceptable.
- **Invalid/missing language in localStorage:** The language store already defaults to EN. The onboarding dialog lets them pick again.
- **Rapid double-click on Continue:** `completeOnboarding()` is idempotent (just sets a flag). No issue.
- **Reduced motion:** All animations degrade to opacity-only.
- **Very first render before i18next is ready:** The dialog itself doesn't need translations for its own labels (it shows native language names). Title can use a simple bilingual text or a brief inline label.

## Testing

- Unit test for `completeOnboarding()` in languageStore
- Render test for `LanguageSelectionDialog` with both selected and unselected states
- Verify dialog does not render when `isOnboardingDone === true`
- Verify Continue button is disabled when no language selected
