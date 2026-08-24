import {
  GOOGLE_AI_WEB_SESSION_PARTITION,
  GOOGLE_DRIVE_WEB_APP
} from '@shared-core/constants/googleAiWebApps'
import type { WebviewElement } from '@shared-core/types/webview'

import { Button } from '@app/components/ui/button'
import { WEBVIEW_ALLOW_POPUPS } from '@shared/constants/electronWebview'
import { getAiIcon, RefreshIcon } from '@ui/components/Icons'

import { memo, useRef } from 'react'

interface GoogleDrivePanelProps {
  tabId: string
  webviewUrl?: string
  chromeUserAgent: string
  title: string
  description: string
  reloadLabel: string
  isInteractionBlocked: boolean
}

function GoogleDrivePanel({
  tabId,
  webviewUrl,
  chromeUserAgent,
  title,
  description,
  reloadLabel,
  isInteractionBlocked
}: GoogleDrivePanelProps) {
  const driveWebviewRef = useRef<WebviewElement | null>(null)

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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => driveWebviewRef.current?.reload?.()}
          className="text-ql-12"
        >
          <RefreshIcon className="h-3.5 w-3.5" />
          {reloadLabel}
        </Button>
      </div>

      <div className="relative min-h-0 flex-1">
        <webview
          ref={driveWebviewRef}
          key={tabId}
          src={webviewUrl || GOOGLE_DRIVE_WEB_APP.url}
          partition={GOOGLE_AI_WEB_SESSION_PARTITION}
          className="h-full w-full flex-1"
          // React's `DetailedHTMLProps<HTMLAttributes>` types `allowpopups` as
          // `boolean | undefined`, but Electron's `<webview>` accepts a string
          // token (`'true' | undefined`) which also suppresses React's
          // "non-boolean attribute" runtime warning. The string cast is
          // necessary because of this known JSX/React type mismatch; see
          // `src/shared/types/global.d.ts` for the augmented type.
          allowpopups={(WEBVIEW_ALLOW_POPUPS ? 'true' : undefined) as any}
          webpreferences="contextIsolation=yes, sandbox=yes"
          useragent={chromeUserAgent}
        />
        {isInteractionBlocked && (
          <div className="pointer-events-auto absolute inset-0 z-10 bg-transparent" />
        )}
      </div>
    </div>
  )
}

export default memo(GoogleDrivePanel)
