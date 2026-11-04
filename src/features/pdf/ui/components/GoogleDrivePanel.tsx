import { useSiteSessionListQuery } from '@platform/electron/api/useSiteSessionApi'

import { useToastActions } from '@app/providers'
import { useIsAnyDialogOpen } from '@shared/hooks'
import { useManagedContentView } from '@shared/hooks/aiContent/useManagedContentView'
import { Button } from '@shared/ui/components/primitives'
import { getAiIcon, RefreshIcon } from '@ui/components/Icons'

import { memo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { usePdfTabStore } from '../../store/usePdfTabStore'

interface GoogleDrivePanelProps {
  tabId: string
  /** Entry URL; the manager validates it against the Google session partition. */
  webviewUrl?: string
  /** The account slot stored on the PDF tab; the global slot only fills a new tab. */
  sessionSlot?: number
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
  sessionSlot: tabSessionSlot,
  title,
  description,
  reloadLabel,
  isInteractionBlocked
}: GoogleDrivePanelProps) {
  const viewId = `gdrive:${tabId}`
  const isDialogOpen = useIsAnyDialogOpen()
  const { showWarning } = useToastActions()
  const { t } = useTranslation()
  const setPdfTabSessionSlot = usePdfTabStore((state) => state.setPdfTabSessionSlot)
  const { data: sessionList } = useSiteSessionListQuery()
  const googleView = sessionList?.views.find((view) => view.kind === 'google')
  const availableSlots = googleView?.accountSlots
  const activeSlot = googleView?.activeSlot
  const inheritedSlot =
    activeSlot !== undefined
      ? availableSlots && !availableSlots.includes(activeSlot)
        ? (availableSlots[0] ?? 1)
        : activeSlot
      : undefined
  // A tab keeps the account it was opened with. The global selection only
  // supplies the default for a new Drive view, so an AI tab on account 2 no
  // longer drags Drive onto a different account when the global value moves.
  const sessionSlot = tabSessionSlot ?? inheritedSlot
  useEffect(() => {
    if (tabSessionSlot === undefined && sessionSlot !== undefined) {
      setPdfTabSessionSlot(tabId, sessionSlot)
    }
  }, [tabId, tabSessionSlot, sessionSlot, setPdfTabSessionSlot])
  // The per-tab choice lives in the PDF tab store: switching it re-attaches the
  // Drive view on the slot's own partition, and the tab keeps that slot on its
  // next visit instead of inheriting the global default again.
  const currentSlot = availableSlots?.includes(sessionSlot ?? 1) ? (sessionSlot ?? 1) : undefined
  const slotOptions = availableSlots?.length
    ? [
        ...availableSlots,
        ...(currentSlot && !availableSlots.includes(currentSlot) ? [currentSlot] : [])
      ]
    : currentSlot
      ? [currentSlot]
      : []
  const sortedSlotOptions = [...slotOptions].sort((a, b) => a - b)
  const { setHostElement, reload } = useManagedContentView({
    viewId,
    showWarning,
    source: {
      kind: 'google-web-app',
      appId: 'gdrive',
      ...(sessionSlot !== undefined ? { sessionSlot } : {})
    },
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
        <div className="flex shrink-0 items-center gap-2">
          {sortedSlotOptions.length > 1 && (
            <select
              aria-label={t('ws_google_account_select')}
              className="text-ql-12 border-border/60 bg-background rounded-md border px-2 py-1"
              value={currentSlot ?? sortedSlotOptions[0]}
              onChange={(event) => {
                setPdfTabSessionSlot(tabId, Number(event.target.value))
              }}
            >
              {sortedSlotOptions.map((slot) => (
                <option key={slot} value={slot}>
                  {t('ws_account_slot', { slot: String(slot) })}
                </option>
              ))}
            </select>
          )}
          <Button type="button" variant="outline" size="sm" onClick={reload} className="text-ql-12">
            <RefreshIcon className="h-3.5 w-3.5" />
            {reloadLabel}
          </Button>
        </div>
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
