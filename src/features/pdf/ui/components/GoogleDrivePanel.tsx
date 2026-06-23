import {
  GOOGLE_AI_WEB_SESSION_PARTITION,
  GOOGLE_DRIVE_WEB_APP
} from '@shared-core/constants/google-ai-web-apps'
import type { WebviewElement } from '@shared-core/types/webview'

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
      <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-black/20 px-4 py-3 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-blue-600/15 text-blue-600">
            {getAiIcon('gdrive')}
          </div>
          <div className="min-w-0">
            <div className="text-ql-14 truncate font-semibold text-stone-200">{title}</div>
            <div className="text-ql-12 truncate text-stone-500">{description}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => driveWebviewRef.current?.reload?.()}
          className="text-ql-12 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-semibold text-stone-200 transition-colors hover:bg-white/10"
        >
          <RefreshIcon className="h-4 w-4" />
          {reloadLabel}
        </button>
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
