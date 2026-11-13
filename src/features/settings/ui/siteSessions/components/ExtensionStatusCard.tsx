import { QUIZLAB_EXTENSION_RELEASE_URL } from '@shared-core/constants/extensionRelease'
import type { NativeMessagingExtensionInfo } from '@shared-core/types'

import { useNativeMessagingStatusQuery } from '@platform/electron/api/useNativeMessagingApi'

import { getElectronApi } from '@shared/lib/electronApi'
import { Button, SettingsSection } from '@shared/ui/components/primitives'
import { SettingsIcon } from '@ui/components/Icons'

import { Download, KeyRound } from 'lucide-react'
import { memo } from 'react'

interface ExtensionStatusCardProps {
  t: (key: string) => string
  onShowPairing: () => void
}

function ExtensionStatusCard({ t, onShowPairing }: ExtensionStatusCardProps) {
  // Polling + connect/disconnect invalidation live in the platform hook (STD-014).
  const { data: extensionInfo } = useNativeMessagingStatusQuery()

  const statusKey = (info: NativeMessagingExtensionInfo | null): string => {
    if (!info) return 'ws_extension_status_disconnected'

    if (info.status === 'connected') {
      return info.paired ? 'ws_extension_status_connected' : 'ws_extension_status_unpaired'
    }

    if (info.status === 'error') {
      return 'ws_extension_status_error'
    }

    if (info.status === 'connecting') {
      const hint = info.userHint
      if (hint === 'waiting_long') {
        return 'ws_extension_status_waiting_long'
      }
      if (hint === 'waiting') {
        return 'ws_extension_status_waiting'
      }
      return 'ws_extension_status_connecting'
    }

    return 'ws_extension_status_disconnected'
  }

  const dotColor = (info: NativeMessagingExtensionInfo | null): string => {
    if (!info) return 'bg-muted-foreground'
    if (info.status === 'connected') {
      return info.paired ? 'bg-emerald-500' : 'bg-amber-500'
    }
    if (info.status === 'error') return 'bg-destructive'
    if (info.status === 'connecting') return 'bg-amber-500'
    return 'bg-muted-foreground'
  }

  const openDownloadPage = () => {
    getElectronApi()?.openExternal(QUIZLAB_EXTENSION_RELEASE_URL)
  }

  return (
    <SettingsSection icon={<SettingsIcon className="h-4 w-4" />} title={t('ws_extension_title')}>
      <div className="@container flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            aria-hidden="true"
            className={`size-2 shrink-0 rounded-full ${dotColor(extensionInfo ?? null)}`}
          />
          {/* The text only changes when the status actually changes, so a
              polite live region announces connect/disconnect transitions
              without re-reading unchanged polling results. */}
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="text-ql-12 text-muted-foreground min-w-0"
          >
            {t(statusKey(extensionInfo ?? null))}
          </span>
        </div>

        {/* In a narrow panel the actions take their own row instead of being
            squeezed next to a long, translated status string. */}
        <div className="flex w-full flex-wrap items-center gap-2 @min-[420px]:w-auto @min-[420px]:shrink-0">
          {extensionInfo?.paired && extensionInfo.status !== 'connected' && (
            <Button
              type="button"
              variant="link"
              size="xs"
              // Any supported site makes the extension talk to the app; Gemini
              // is the one the button has always opened, and the label says so.
              onClick={() => getElectronApi()?.openExternal('https://gemini.google.com/app')}
              className="text-amber-400 hover:text-amber-300 @max-[420px]:flex-1"
            >
              <span className="text-ql-11 font-semibold">{t('ws_extension_wake_btn')}</span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={openDownloadPage}
            className="gap-1.5 @max-[420px]:flex-1"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="text-ql-11 font-semibold">{t('ws_extension_download_btn')}</span>
          </Button>
          <Button
            type="button"
            size="xs"
            onClick={onShowPairing}
            className="gap-1.5 @max-[420px]:flex-1"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span className="text-ql-11 font-semibold">{t('ws_extension_pair_btn')}</span>
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}

export default memo(ExtensionStatusCard)
