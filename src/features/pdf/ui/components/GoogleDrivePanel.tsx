import { useToastActions } from '@app/providers'
import { useIsAnyDialogOpen } from '@shared/hooks'
import { useManagedContentView } from '@shared/hooks/aiContent/useManagedContentView'
import { useDockHovered } from '@shared/stores/dockHoverStore'
import { Button } from '@shared/ui/components/primitives'
import { getAiIcon, RefreshIcon } from '@ui/components/Icons'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

/** Stable keys for the loading skeleton's placeholder cards. */
const SKELETON_ROWS = ['one', 'two', 'three', 'four', 'five', 'six'] as const

interface GoogleDrivePanelProps {
  tabId: string
  /** Entry URL; the manager validates it against the Google session partition. */
  webviewUrl?: string
  title: string
  description: string
  reloadLabel: string
  isInteractionBlocked: boolean
}

/**
 * Embedded Google Drive picker inside the PDF panel.
 *
 * Runs as a main-process `WebContentsView` on the shared Gemini web-session
 * partition, positioned by a plain host placeholder — the same mechanism the AI
 * panel uses, so no `<webview>` element (and therefore no `webviewTag`) is needed
 * anywhere in the app.
 */
function GoogleDrivePanel({
  tabId,
  webviewUrl,
  title,
  description,
  reloadLabel,
  isInteractionBlocked
}: GoogleDrivePanelProps) {
  const { t } = useTranslation()
  const viewId = `gdrive:${tabId}`
  const isDialogOpen = useIsAnyDialogOpen()
  const isDockHovered = useDockHovered()
  const { showWarning } = useToastActions()
  const { setHostElement, reload, hasLoadedOnce, error, handleRetry } = useManagedContentView({
    viewId,
    showWarning,
    source: {
      kind: 'google-web-app',
      appId: 'gdrive'
    },
    restoredUrl: webviewUrl,
    modelId: 'gdrive',
    isEnabled: true,
    isHostOwner: true,
    // A native view paints above the DOM, so the themed skeleton can only be
    // seen while the view is hidden. Reveal it on the first completed load.
    revealAfterFirstLoad: true,
    hideWhenError: true,
    // A dialog is the only thing that has to occlude the view, because a native
    // view paints above the DOM. `isInteractionBlocked` deliberately does not
    // drive this: it also covers "the dock is hovered", which used to blank the
    // whole panel every time the pointer crossed the divider.
    visible: !isDialogOpen
  })

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative flex items-center justify-between gap-4 border-b border-white/[0.07] bg-zinc-950/80 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="text-foreground flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04] shadow-xs">
            {getAiIcon('gdrive')}
          </div>
          <div className="min-w-0">
            <div className="text-ql-13 text-foreground truncate font-semibold">{title}</div>
            <div className="text-ql-12 text-muted-foreground truncate">{description}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={reload} className="text-ql-12">
            <RefreshIcon className="h-3.5 w-3.5" />
            {reloadLabel}
          </Button>
        </div>
        {/* Soft inner edge between the themed chrome and the embedded page. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-b from-zinc-950/70 to-transparent"
        />
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={setHostElement}
          className="h-full w-full"
          data-ai-view-host={viewId}
          data-testid="drive-host"
        />

        {!hasLoadedOnce && !error && (
          <div
            role="status"
            aria-busy="true"
            aria-live="polite"
            className="pointer-events-none absolute inset-0 z-10 flex flex-col gap-5 bg-zinc-950/80 p-5"
          >
            <span className="sr-only">{t('loading')}</span>
            <div className="flex items-center gap-3">
              <div className="bg-muted h-9 w-9 shrink-0 rounded-lg motion-safe:animate-pulse" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="bg-muted h-3 w-40 max-w-full rounded-full motion-safe:animate-pulse" />
                <div className="h-2.5 w-64 max-w-full rounded-full bg-zinc-900/60 motion-safe:animate-pulse" />
              </div>
            </div>
            <div className="h-9 w-full rounded-lg bg-zinc-900/60 motion-safe:animate-pulse" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {SKELETON_ROWS.map((row) => (
                <div
                  key={row}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-zinc-900/60 p-3"
                >
                  <div className="bg-muted h-10 w-10 shrink-0 rounded-lg motion-safe:animate-pulse" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="bg-muted h-2.5 w-4/5 rounded-full motion-safe:animate-pulse" />
                    <div className="h-2 w-1/2 rounded-full bg-zinc-900/60 motion-safe:animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-zinc-950/85 p-6 text-center backdrop-blur-xl">
            <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
            <p className="text-ql-12 text-muted-foreground max-w-sm break-words">{error}</p>
            {handleRetry && (
              <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
                <RefreshCw className="h-3.5 w-3.5" />
                {reloadLabel}
              </Button>
            )}
          </div>
        )}

        {(isInteractionBlocked || isDockHovered) && !error && (
          <div className="pointer-events-auto absolute inset-0 z-10 bg-transparent" />
        )}
      </div>
    </div>
  )
}

export default memo(GoogleDrivePanel)
