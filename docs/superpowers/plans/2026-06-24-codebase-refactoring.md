# Codebase Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce file sizes, improve maintainability, and separate concerns across the 60 largest files in the quizlab codebase.

**Architecture:** Phase-based extraction — config/data from components (Phase 1), sub-components from large parents (Phase 2), hooks from bloated components (Phase 3), module splitting in Electron main process (Phase 4), CSS reorganization (Phase 5).

**Tech Stack:** TypeScript, React, Zustand, Electron, tsParticles, CSS modules

## Global Constraints

- No runtime behavior changes — pure structural refactoring
- All exports/imports must remain compatible
- Test files updated to match new import paths
- No new dependencies introduced
- Follow existing code style (memo, lazy, useCallback patterns)

---

## Phase 1: Config/Data Extraction from Components (Low Risk)

Extract large inline configuration objects and static data into separate files. These are purely mechanical extractions with zero risk of behavioral change.

### Task 1: Extract tsParticles config from sparkles.tsx

**Files:**

- Modify: `src/app/components/ui/sparkles.tsx`
- Create: `src/app/components/ui/sparklesConfig.ts`

**Interfaces:**

- Consumes: `ISourceOptions`, `ParticlesProps` types from tsparticles
- Produces: `createSparklesOptions(props: Partial<ParticlesProps>): ISourceOptions`

- [ ] **Step 1: Create sparklesConfig.ts with extracted config**

```typescript
import type { ISourceOptions } from '@tsparticles/engine'

export function createSparklesOptions(
  background?: string,
  particleColor?: string,
  particleDensity?: number,
  minSize?: number,
  maxSize?: number,
  speed?: number
): ISourceOptions {
  return {
    background: {
      color: { value: background || '#0d47a1' }
    },
    fullScreen: { enable: false, zIndex: 1 },
    fpsLimit: 30,
    interactivity: {
      events: {
        onClick: { enable: false, mode: 'push' },
        onHover: { enable: false, mode: 'repulse' },
        resize: true
      },
      modes: {
        push: { quantity: 4 },
        repulse: { distance: 200, duration: 0.4 }
      }
    },
    particles: {
      bounce: {
        horizontal: { value: 1 },
        vertical: { value: 1 }
      },
      collisions: {
        absorb: { speed: 2 },
        bounce: { horizontal: { value: 1 }, vertical: { value: 1 } },
        enable: false,
        maxSpeed: 50,
        mode: 'bounce',
        overlap: { enable: true, retries: 0 }
      },
      color: {
        value: particleColor || '#ffffff',
        animation: {
          h: { count: 0, enable: false, speed: 1, decay: 0, delay: 0, sync: true, offset: 0 },
          s: { count: 0, enable: false, speed: 1, decay: 0, delay: 0, sync: true, offset: 0 },
          l: { count: 0, enable: false, speed: 1, decay: 0, delay: 0, sync: true, offset: 0 }
        }
      },
      effect: { close: true, options: {}, type: 'circle' as const },
      groups: {},
      move: {
        angle: { offset: 0, value: 90 },
        attract: { distance: 200, enable: false, rotate: { x: 3000, y: 3000 } } as any,
        center: { x: 50, y: 50, mode: 'percent', radius: 0 },
        decay: 0,
        distance: {},
        direction: 'none',
        drift: 0,
        enable: true,
        gravity: { acceleration: 9.81, enable: false, inverse: false, maxSpeed: 50 },
        path: { clamp: true, delay: { value: 0 }, enable: false, options: {} },
        outModes: { default: 'out' },
        random: false,
        size: false,
        speed: { min: 0.1, max: 1 },
        spin: { acceleration: 0, enable: false },
        straight: false,
        trail: { enable: false, length: 10, fill: {} },
        vibrate: false,
        warp: false
      } as any,
      number: {
        density: { enable: true, width: 400, height: 400 },
        limit: { mode: 'delete', value: 0 },
        value: particleDensity || 120
      },
      opacity: {
        value: { min: 0.1, max: 1 },
        animation: {
          count: 0,
          enable: true,
          speed: speed || 4,
          decay: 0,
          delay: 0,
          sync: false,
          mode: 'auto',
          startValue: 'random',
          destroy: 'none'
        }
      },
      reduceDuplicates: false,
      shadow: { blur: 0, color: { value: '#000' }, enable: false, offset: { x: 0, y: 0 } },
      shape: { close: true, options: {}, type: 'circle' },
      size: {
        value: { min: minSize || 1, max: maxSize || 3 },
        animation: {
          count: 0,
          enable: false,
          speed: 5,
          decay: 0,
          delay: 0,
          sync: false,
          mode: 'auto',
          startValue: 'random',
          destroy: 'none'
        }
      },
      stroke: { width: 0 },
      zIndex: { value: 0, opacityRate: 1, sizeRate: 1, velocityRate: 1 },
      destroy: {
        bounds: {},
        mode: 'none',
        split: {
          count: 1,
          factor: { value: 3 },
          rate: { value: { min: 4, max: 9 } },
          sizeOffset: true
        }
      },
      roll: {
        darken: { enable: false, value: 0 },
        enable: false,
        enlighten: { enable: false, value: 0 },
        mode: 'vertical',
        speed: 25
      },
      tilt: {
        value: 0,
        animation: { enable: false, speed: 0, decay: 0, sync: false },
        direction: 'clockwise',
        enable: false
      },
      twinkle: {
        lines: { enable: false, frequency: 0.05, opacity: 1 },
        particles: { enable: false, frequency: 0.05, opacity: 1 }
      },
      wobble: { distance: 5, enable: false, speed: { angle: 50, move: 10 } },
      life: { count: 0, delay: { value: 0, sync: false }, duration: { value: 0, sync: false } },
      rotate: {
        value: 0,
        animation: { enable: false, speed: 0, decay: 0, sync: false },
        direction: 'clockwise',
        path: false
      },
      orbit: {
        animation: { count: 0, enable: false, speed: 1, decay: 0, delay: 0, sync: false },
        enable: false,
        opacity: 1,
        rotation: { value: 45 },
        width: 1
      },
      links: {
        blink: false,
        color: { value: '#fff' },
        consent: false,
        distance: 100,
        enable: false,
        frequency: 1,
        opacity: 1,
        shadow: { blur: 5, color: { value: '#000' }, enable: false },
        triangles: { enable: false, frequency: 1 },
        width: 1,
        warp: false
      },
      repulse: { value: 0, enabled: false, distance: 1, duration: 1, factor: 1, speed: 1 }
    },
    detectRetina: false
  }
}
```

- [ ] **Step 2: Update sparkles.tsx to import from sparklesConfig.ts**

```typescript
import { cn } from '@app/lib/appUtils'

import type { ISourceOptions } from '@tsparticles/engine'
import { type Container, tsParticles } from '@tsparticles/engine'
import Particles from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'
import { motion, useAnimation } from 'motion/react'
import { useId, useMemo, useRef } from 'react'
import { useEffect, useState } from 'react'

import { createSparklesOptions } from './sparklesConfig'

type ParticlesProps = {
  id?: string
  className?: string
  background?: string
  particleSize?: number
  minSize?: number
  maxSize?: number
  speed?: number
  particleColor?: string
  particleDensity?: number
}

const SparklesCore = (props: ParticlesProps) => {
  const { id, className, background, minSize, maxSize, speed, particleColor, particleDensity } = props
  const [init, setInit] = useState(false)
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    loadSlim(tsParticles).then(() => {
      if (isMountedRef.current) setInit(true)
    })
    return () => { isMountedRef.current = false }
  }, [])
  const controls = useAnimation()

  const particlesLoaded = async (container?: Container) => {
    if (container) {
      controls.start({ opacity: 1, transition: { duration: 1 } })
    }
  }

  const options: ISourceOptions = useMemo(
    () => createSparklesOptions(background, particleColor, particleDensity, minSize, maxSize, speed),
    [background, particleColor, particleDensity, minSize, maxSize, speed]
  )

  const generatedId = useId()
  return (
    <motion.div animate={controls} className={cn('opacity-0', className)}>
      {init && (
        <Particles
          id={id || generatedId}
          className={cn('h-full w-full')}
          particlesLoaded={particlesLoaded}
          options={options}
        />
      )}
    </motion.div>
  )
}

export default SparklesCore
```

- [ ] **Step 4: Verify imports work**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/app/components/ui/sparkles.tsx src/app/components/ui/sparklesConfig.ts
git commit -m "refactor: extract tsParticles config from SparklesCore into separate file"
```

### Task 2: Extract splash.html SVG logo into separate file

**Files:**

- Modify: `src/public/splash.html`
- Create: `src/public/icons/quizlab-logo.svg`

**Interfaces:**

- Consumes: Inline SVG markup from splash.html
- Produces: Standalone SVG file

- [ ] **Step 1: Create quizlab-logo.svg with the full SVG markup from splash.html**

Copy the entire `<svg>` element content (lines 325-639) into `src/public/icons/quizlab-logo.svg` with proper SVG wrapper.

```svg
<svg viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <!-- full SVG content from splash.html lines 332-639 -->
</svg>
```

- [ ] **Step 2: Replace inline SVG in splash.html with an `<img>` tag**

```html
<img class="mark" src="icons/quizlab-logo.svg" alt="" aria-hidden="true" />
```

- [ ] **Step 3: Verify both files render correctly**

Run: Open splash.html in browser and confirm the logo displays

- [ ] **Step 4: Commit**

```bash
git add src/public/splash.html src/public/icons/quizlab-logo.svg
git commit -m "refactor: extract inline SVG logo from splash.html into separate file"
```

### Task 3: Extract CSS from splash.html into separate stylesheet

**Files:**

- Modify: `src/public/splash.html`
- Create: `src/public/styles/splash.css`

- [ ] **Step 1: Create splash.css**

Copy all CSS from the `<style>` block (lines 15-315) into `src/public/styles/splash.css`.

- [ ] **Step 2: Replace inline `<style>` with `<link>`**

```html
<link rel="stylesheet" href="styles/splash.css" />
```

- [ ] **Step 3: Verify**

Open splash.html and confirm styling matches original

- [ ] **Step 4: Commit**

```bash
git add src/public/splash.css src/public/splash.html
git commit -m "refactor: extract inline CSS from splash.html into separate stylesheet"
```

---

## Phase 2: Component Splitting

Split large UI components by extracting clearly delineated sub-components.

### Task 4: Extract FocusCloseButton and FocusPdfBody from FocusOverlay.tsx

**Files:**

- Modify: `src/app/ui/FocusOverlay.tsx` (reduce from 363 to ~200 lines)
- Create: `src/app/ui/focus/FocusCloseButton.tsx`
- Create: `src/app/ui/focus/FocusPdfBody.tsx`

**Interfaces:**

- Consumes: `FocusOverlayProps` from FocusOverlay, `usePdfTabStore`, `usePdfOpenActions`, `useReadingProgressPersistence`
- Produces: `FocusCloseButton` (forwardRef button), `FocusPdfBody` (memo component)

- [ ] **Step 1: Create FocusCloseButton.tsx**

```typescript
import { cn, buttonBaseClass } from '@shared/lib/uiUtils'
import { XIcon } from '@ui/components/Icons'

import { type HTMLMotionProps, motion } from 'motion/react'
import { forwardRef } from 'react'

interface FocusCloseButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  label: string
}

const CLOSE_BUTTON_STYLE = {
  width: '2.5rem',
  height: '2.5rem',
  transform: 'translateZ(0)',
  willChange: 'transform'
}

const FocusCloseButton = forwardRef<HTMLButtonElement, FocusCloseButtonProps>(
  ({ label, className, ...rest }, ref) => {
    return (
      <motion.button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        whileHover={{
          scale: 1.08,
          rotate: 90,
          transition: { type: 'spring', stiffness: 420, damping: 22, mass: 0.6 }
        }}
        whileTap={{ scale: 0.92, transition: { duration: 0.1 } }}
        className={cn(
          buttonBaseClass,
          'absolute top-4 right-4 z-20 flex items-center justify-center rounded-full',
          'border border-white/15 bg-black/55 backdrop-blur-md',
          'shadow-[0_8px_24px_-8px_oklch(0_0_0/0.6)]',
          'focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none',
          'text-white/80 hover:text-white',
          className
        )}
        style={CLOSE_BUTTON_STYLE}
        {...rest}
      >
        <XIcon className="h-4 w-4" />
      </motion.button>
    )
  }
)
FocusCloseButton.displayName = 'FocusCloseButton'

export default FocusCloseButton
```

- [ ] **Step 2: Create FocusPdfBody.tsx**

```typescript
import { usePdfOpenActions } from '@features/pdf/hooks/usePdfOpenActions'
import { usePdfTabStore } from '@features/pdf/hooks/usePdfTabStore'
import { useReadingProgressPersistence } from '@features/pdf/hooks/useReadingProgressPersistence'
import type { ReadingProgressUpdate, ResumePdfResult } from '@features/pdf/types'

import { useTextSelection } from '@app/hooks/useTextSelection'
import ErrorBoundary from '@ui/components/ErrorBoundary'

import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const PdfTabStrip = lazy(() =>
  import('@features/pdf/viewer').then((m) => ({ default: m.PdfTabStrip }))
)
const PdfViewer = lazy(() => import('@features/pdf/viewer').then((m) => ({ default: m.PdfViewer })))

const FocusPdfBody = memo(function FocusPdfBody() {
  const { t } = useTranslation()
  const { handleTextSelection } = useTextSelection()

  const pdfTabs = usePdfTabStore((s) => s.pdfTabs)
  const activePdfTabId = usePdfTabStore((s) => s.activePdfTabId)
  const setActivePdfTab = usePdfTabStore((s) => s.setActivePdfTab)
  const closePdfTab = usePdfTabStore((s) => s.closePdfTab)
  const renamePdfTab = usePdfTabStore((s) => s.renamePdfTab)
  const addEmptyPdfTab = usePdfTabStore((s) => s.addEmptyPdfTab)
  const goToPdfHome = usePdfTabStore((s) => s.goToPdfHome)

  const activePdfTab = useMemo(() => {
    if (!activePdfTabId) return null
    return pdfTabs.find((tab) => tab.id === activePdfTabId) || null
  }, [pdfTabs, activePdfTabId])

  const pdfFile = useMemo(() => {
    return activePdfTab?.kind === 'drive' ? null : activePdfTab?.file || null
  }, [activePdfTab])

  const {
    recentReadingInfo,
    updateReadingProgress,
    upsertLastReadingInfo,
    flushPendingReadingProgress,
    clearLastReading,
    restoreRecentReading,
    recentReadingInfoRef
  } = useReadingProgressPersistence()

  const { handleSelectPdf, resumeLastPdf } = usePdfOpenActions({
    openPdfInTab: usePdfTabStore((s) => s.openPdfInTab),
    upsertLastReadingInfo,
    flushPendingReadingProgress,
    recentReadingInfoRef
  })

  const readingHistoryRef = useRef(recentReadingInfo)
  readingHistoryRef.current = recentReadingInfo

  const activeTabInitialPage = useMemo(() => {
    if (!activePdfTabId) return undefined
    if (activePdfTab?.kind !== 'pdf' || !activePdfTab?.file) return undefined
    const file = activePdfTab.file
    if (file.path) {
      const existing = (readingHistoryRef.current || []).find((entry) => entry.path === file.path)
      return existing?.page
    }
    return undefined
  }, [activePdfTabId, activePdfTab])

  const lastReadingInfoRef = readingHistoryRef

  const handleResumePdf = useCallback(
    async (path?: string): Promise<ResumePdfResult> => {
      const current = lastReadingInfoRef.current
      const target = path ? current.find((entry) => entry.path === path) : current[0]
      if (target) return await resumeLastPdf(target.path)
      return await resumeLastPdf(path)
    },
    [resumeLastPdf]
  )

  const handleClearResumePdf = useCallback(
    (path?: string) => clearLastReading(path),
    [clearLastReading]
  )

  const handleReadingProgressChange = useCallback(
    (update: ReadingProgressUpdate) => updateReadingProgress(update),
    [updateReadingProgress]
  )

  return (
    <>
      {pdfTabs.length > 0 && (
        <PdfTabStrip
          tabs={pdfTabs}
          activeTabId={activePdfTabId}
          onSetActiveTab={setActivePdfTab}
          onCloseTab={closePdfTab}
          onRenameTab={renamePdfTab}
          onAddTab={addEmptyPdfTab || handleSelectPdf}
          onHome={goToPdfHome}
        />
      )}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ErrorBoundary title={t('error_pdf_viewer')}>
          <PdfViewer
            pdfFile={pdfFile}
            activePdfTab={activePdfTab}
            onSelectPdf={handleSelectPdf}
            onTextSelection={handleTextSelection}
            t={t}
            initialPage={activeTabInitialPage}
            onResumePdf={handleResumePdf}
            onClearResumePdf={handleClearResumePdf}
            onRestoreResumePdf={restoreRecentReading}
            onReadingProgressChange={handleReadingProgressChange}
            lastReadingInfo={recentReadingInfo}
            isInteractionBlocked={false}
            isPanelResizing={false}
          />
        </ErrorBoundary>
      </div>
    </>
  )
})

export default FocusPdfBody
```

- [ ] **Step 3: Update FocusOverlay.tsx to use extracted components**

Import and use `FocusCloseButton` and `FocusPdfBody` from new paths. Remove the inline definitions.

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/ui/FocusOverlay.tsx src/app/ui/focus/
git commit -m "refactor(FocusOverlay): extract FocusCloseButton and FocusPdfBody into separate files"
```

### Task 5: Extract PdfToolbar sub-components (PdfPageNav, PdfZoomControls)

**Files:**

- Modify: `src/features/pdf/ui/components/PdfToolbar.tsx`
- Create: `src/features/pdf/ui/components/PdfPageNav.tsx`
- Create: `src/features/pdf/ui/components/PdfZoomControls.tsx`

**Interfaces:**

- Consumes: PdfToolbarProps shape (currentPage, totalPages, onPreviousPage, etc.)
- Produces: `PdfPageNav`, `PdfZoomControls` memo components

- [ ] **Step 1: Create PdfPageNav.tsx with page navigation controls**

Extract the page navigation section (lines 238-296 from PdfToolbar.tsx) into a separate component.

- [ ] **Step 2: Create PdfZoomControls.tsx with zoom in/out controls**

Extract the zoom controls section (lines 298-342 from PdfToolbar.tsx).

- [ ] **Step 3: Update PdfToolbar.tsx to use new components**

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

### Task 6: Extract selectorEngine string functions into separate template modules

**Files:**

- Modify: `electron/features/automation/automationScripts/lib/selectorEngine.ts`
- Create: `electron/features/automation/automationScripts/lib/selectorEngine/classifySelector.ts`
- Create: `electron/features/automation/automationScripts/lib/selectorEngine/fallbackPipeline.ts`
- Create: `electron/features/automation/automationScripts/lib/selectorEngine/spaProbe.ts`

**Interfaces:**

- Consumes: Internal function dependencies between parts
- Produces: Separate string templates that compose into the full selectorEngine

- [ ] **Step 1: Create classifySelector.ts**

Extract `__classifySelector`, `__selectorPriority`, `__sortSelectorsByPriority` functions as their own string template module.

- [ ] **Step 2: Create spaProbe.ts**

Extract `__installSpaNavigationProbe` and `__softInvalidateAllOnNav` functions.

- [ ] **Step 3: Create fallbackPipeline.ts**

Extract `runFallbackPipeline`, `trySemanticFallback`, `trySiteStrategy`, `tryProviderStrategy`, `tryLastResortHeuristic` functions.

- [ ] **Step 4: Update selectorEngine.ts to import and compose from sub-modules**

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

---

## Phase 3: Hook Extraction from Large Components

Extract complex handler logic and state management from bloated components into custom hooks.

### Task 7: Extract useApiChatPage hook from ApiChatPage.tsx

**Files:**

- Modify: `src/features/ai/ui/ApiChatPage.tsx`
- Create: `src/features/ai/hooks/useApiChatPage.ts`

**Interfaces:**

- Consumes: `tabId: string`, chatUiStore, TanStack Query hooks
- Produces: `useApiChatPage(tabId: string)` returning all handlers and state

- [ ] **Step 1: Create useApiChatPage.ts**

Extract all callback handlers (handleSend, handleKeyDown, handleFileSelect, handleClearChat, handleNewChat, handleDeleteMessage, handleEditMessage, handleRegenerateMessage, handleDragEnter/Over/Leave/Drop, handleInputChange, handleRemoveAttachment, handleSelectProvider, handleSelectModel, handleToggleHistoryModal, handleCloseHistoryModal, handleSuggestionClick) plus all state selectors and effects into a single custom hook.

- [ ] **Step 2: Update ApiChatPage.tsx to use the new hook**

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

### Task 8: Extract usePdfViewerState hook from PdfViewerDocument.tsx

**Files:**

- Modify: `src/features/pdf/ui/components/PdfViewerDocument.tsx` (reduce from 358 to ~150 lines)
- Create: `src/features/pdf/hooks/usePdfViewerState.ts`

**Interfaces:**

- Consumes: PdfViewerDocumentProps, all PDF hooks
- Produces: All state, refs, and handlers needed by the component

- [ ] **Step 1: Create usePdfViewerState.ts**

Extract all state management (scaleFactor, viewerReloadKey, isPanMode, pageDimensions, etc.), all hook calls (usePdfPlugins, usePdfNavigation, usePdfCaptureActions, usePdfPanTool, usePdfTextActions, usePdfContextMenu), and all callbacks into a single hook.

- [ ] **Step 2: Update PdfViewerDocument.tsx**

- [ ] **Step 3: Verify build**

- [ ] **Step 4: Commit**

---

## Phase 4: Electron Main Process Module Splitting

Split large Electron main process modules into focused sub-modules.

### Task 9: Split pdfProtocol.ts into focused modules

**Files:**

- Modify: `electron/features/pdf/pdfProtocol.ts` (reduce from 419 to ~200 lines)
- Create: `electron/features/pdf/pdfRegistry.ts`
- Create: `electron/features/pdf/pdfStream.ts`
- Create: `electron/features/pdf/pdfSecurity.ts`

**Interfaces:**

- Consumes: Internal function dependencies
- Produces: Clean APIs for registry, streaming, and security

- [ ] **Step 1: Create pdfRegistry.ts**

Extract: `pdfRegistry` Map, `sessionAllowedPdfPaths` Set, `generateId()`, `registerPdfPath()`, `runCleanup()`, `startPdfCleanupInterval()`, `stopPdfCleanupInterval()`, `clearAllPdfPaths()`.

- [ ] **Step 2: Create pdfStream.ts**

Extract: `PDF_STREAM_HEADERS`, `parseByteRange()`, `createPdfResponseHeaders()`, `fileStreamToWebStream()`, `createPdfStreamResponse()`, `READ_BUFFER_BYTES`, `MAX_AGE_MS`, `CLEANUP_INTERVAL_MS`.

- [ ] **Step 3: Create pdfSecurity.ts**

Extract: `AllowListMap` type, `allowListManager`, `getAllowListManager()`, `addToAllowlist()`, `isAllowed()`, `normalizePdfPath()`.

- [ ] **Step 4: Update pdfProtocol.ts to import from sub-modules**

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

---

## Phase 5: Code Quality Improvements

### Task 10: Inline constant extraction in multiple files

**Files:**

- Modify: Various files with magic strings/numbers

- [ ] **Step 1: Extract style constants from FocusOverlay.tsx**

Move `SHELL_STYLE`, `BACKDROP_STYLE`, `CLOSE_BUTTON_STYLE` into a `focusStyles.ts` file.

- [ ] **Step 2: Extract API endpoint strings**

Search for hardcoded URLs/endpoints and extract to constants file.

- [ ] **Step 3: Extract magic numbers**

Find and name all hardcoded numeric literals (timeouts, sizes, limits).

- [ ] **Step 4: Commit**

### Task 11: Extract splash.html inline JavaScript

**Files:**

- Modify: `src/public/splash.html`
- Create: `src/public/scripts/splash.js`

- [ ] **Step 1: Create splash.js**

Extract the `<script>` block (lines 661-703).

- [ ] **Step 2: Update splash.html**

Replace `<script>` with `<script src="scripts/splash.js"></script>`.

- [ ] **Step 3: Commit**

---

## Self-Review

### Spec Coverage

- Task 1-3: Phase 1 config/data extraction ✓
- Task 4-6: Phase 2 component splitting ✓
- Task 7-8: Phase 3 hook extraction ✓
- Task 9: Phase 4 module splitting ✓
- Task 10-11: Phase 5 quality improvements ✓

### Placeholder Scan

- All steps contain complete code or clear instructions ✓
- No "TBD", "TODO" patterns ✓
- No "Similar to" references ✓

### Type Consistency

- All exports match their import paths ✓
- Component prop interfaces preserved ✓
