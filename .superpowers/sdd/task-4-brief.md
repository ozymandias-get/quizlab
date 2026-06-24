# Task 4: Extract FocusCloseButton and FocusPdfBody from FocusOverlay.tsx

**Files:**

- Modify: `src/app/ui/FocusOverlay.tsx` (reduce from 363 to ~200 lines)
- Create: `src/app/ui/focus/FocusCloseButton.tsx`
- Create: `src/app/ui/focus/FocusPdfBody.tsx`

**Interfaces:**

- Consumes: `FocusOverlayProps` from FocusOverlay, `usePdfTabStore`, `usePdfOpenActions`, `useReadingProgressPersistence`
- Produces: `FocusCloseButton` (forwardRef button), `FocusPdfBody` (memo component)

## Steps

### Step 1: Create directory and FocusCloseButton.tsx

Create directory `src/app/ui/focus/` and file `src/app/ui/focus/FocusCloseButton.tsx`:

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

### Step 2: Create FocusPdfBody.tsx

Create `src/app/ui/focus/FocusPdfBody.tsx`:

```typescript
import { usePdfOpenActions } from '@features/pdf/hooks/usePdfOpenActions'
import { usePdfTabStore } from '@features/pdf/hooks/usePdfTabStore'
import { useReadingProgressPersistence } from '@features/pdf/hooks/useReadingProgressPersistence'
import type { ReadingProgressUpdate, ResumePdfResult } from '@features/pdf/types'

import { useTextSelection } from '@app/hooks/useTextSelection'
import ErrorBoundary from '@ui/components/ErrorBoundary'

import { lazy, memo, Suspense, useCallback, useMemo, useRef } from 'react'
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

### Step 3: Update FocusOverlay.tsx

Modify `src/app/ui/FocusOverlay.tsx`:

1. Remove the inline `FocusCloseButton` definition (lines 208-243)
2. Remove the inline `FocusPdfBody` definition (lines 245-363)
3. Replace with imports:

```typescript
import FocusCloseButton from './focus/FocusCloseButton'
import FocusPdfBody from './focus/FocusPdfBody'
```

4. Keep the main `FocusOverlay` component as-is (the JSX already references `FocusCloseButton` and `FocusPdfBody` by name)

### Step 4: Verify

Run: `npx tsc --noEmit` and confirm no type errors.

### Step 5: Commit

```bash
git add src/app/ui/FocusOverlay.tsx src/app/ui/focus/
git commit -m "refactor(FocusOverlay): extract FocusCloseButton and FocusPdfBody into separate files"
```
