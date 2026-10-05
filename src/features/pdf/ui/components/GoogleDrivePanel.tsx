import { Button } from '@app/components/ui/button'
import { useIsAnyDialogOpen } from '@shared/hooks'
import { useManagedContentView } from '@shared/hooks/aiContent/useManagedContentView'
import { getAiIcon, RefreshIcon } from '@ui/components/Icons'

import { memo } from 'react'

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
  const viewId = `gdrive:${tabId}`
  const isDialogOpen = useIsAnyDialogOpen()
  const { setHostElement, reload } = useManagedContentView({
    viewId,
    source: { kind: 'google-web-app', appId: 'gdrive' },
    restoredUrl: webviewUrl,
    modelId: 'gdrive',
    isEnabled: true,
    isHostOwner: true,
    // A dialog is the only thing that has to occlude the view, because a native
    // view paints above the DOM. `isInteractionBlocked` deliberately does not
    // drive this: it also covers "the dock is hovered", which used to blank the
    // whole panel every time the pointer crossed the divider.
    visible: !isDialogOpen
  })

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-border bg-card/90 flex items-center justify-between gap-4 border-b px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="border-border bg-muted/60 text-foreground flex h-9 w-9 items-center justify-center rounded-lg border shadow-xs">
            {getAiIcon('gdrive')}
          </div>
          <div className="min-w-0">
            <div className="text-ql-13 text-foreground truncate font-semibold">{title}</div>
            <div className="text-ql-12 text-muted-foreground truncate">{description}</div>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={reload} className="text-ql-12">
          <RefreshIcon className="h-3.5 w-3.5" />
          {reloadLabel}
        </Button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={setHostElement}
          className="h-full w-full"
          data-ai-view-host={viewId}
          data-testid="drive-host"
        />
        {isInteractionBlocked && (
          <div className="pointer-events-auto absolute inset-0 z-10 bg-transparent" />
        )}
      </div>
    </div>
  )
}

export default memo(GoogleDrivePanel)
