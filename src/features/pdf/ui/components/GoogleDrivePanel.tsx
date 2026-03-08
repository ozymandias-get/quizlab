import { memo, useRef } from 'react'
import { GOOGLE_AI_WEB_SESSION_PARTITION, GOOGLE_DRIVE_WEB_APP } from '@shared-core/constants/google-ai-web-apps'
import { getAiIcon, RefreshIcon } from '@ui/components/Icons'

interface GoogleDrivePanelProps {
    tabId: string;
    webviewUrl?: string;
    chromeUserAgent: string;
    title: string;
    description: string;
    reloadLabel: string;
    isInteractionBlocked: boolean;
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
    const driveWebviewRef = useRef<any>(null)

    return (
        <div className="flex-1 flex flex-col overflow-hidden h-full min-h-0">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-black/20 px-4 py-3 backdrop-blur-xl">
                <div className="min-w-0 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-[#1a73e8]/15 text-[#1a73e8]">
                        {getAiIcon('gdrive')}
                    </div>
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-stone-200">{title}</div>
                        <div className="truncate text-[11px] text-stone-500">{description}</div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => driveWebviewRef.current?.reload?.()}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-stone-200 transition-colors hover:bg-white/10"
                >
                    <RefreshIcon className="w-4 h-4" />
                    {reloadLabel}
                </button>
            </div>

            <div className="relative flex-1 min-h-0">
                <webview
                    ref={driveWebviewRef}
                    key={tabId}
                    src={webviewUrl || GOOGLE_DRIVE_WEB_APP.url}
                    partition={GOOGLE_AI_WEB_SESSION_PARTITION}
                    className="flex-1 w-full h-full"
                    allowpopups={"true" as any}
                    webpreferences="contextIsolation=yes, sandbox=yes"
                    useragent={chromeUserAgent}
                />
                {isInteractionBlocked && (
                    <div className="absolute inset-0 z-10 pointer-events-auto bg-transparent" />
                )}
            </div>
        </div>
    )
}

export default memo(GoogleDrivePanel)
