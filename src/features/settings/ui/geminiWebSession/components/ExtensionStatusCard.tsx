import type { NativeMessagingExtensionInfo } from '@shared-core/types'

import { useNativeMessagingStatusQuery } from '@platform/electron/api/useNativeMessagingApi'

import { getElectronApi } from '@shared/lib/electronApi'
import { Button, SettingsSection } from '@shared/ui/components/primitives'
import { LoaderIcon, SettingsIcon } from '@ui/components/Icons'

import { memo, useState } from 'react'

interface ExtensionStatusCardProps {
  t: (key: string) => string
  onInstallExtension: () => void
  onRemoveExtension: () => void
}

function ExtensionStatusCard({
  t,
  onInstallExtension,
  onRemoveExtension
}: ExtensionStatusCardProps) {
  // Polling + connect/disconnect invalidation live in the platform hook (STD-014).
  const { data: extensionInfo } = useNativeMessagingStatusQuery()
  const [installing, setInstalling] = useState(false)

  const handleInstallClick = async () => {
    if (installing) return
    setInstalling(true)
    try {
      await onInstallExtension()
    } finally {
      setInstalling(false)
    }
  }

  const statusKey = (info: NativeMessagingExtensionInfo | null): string => {
    if (!info) return 'gws_extension_status_disconnected'

    if (info.status === 'connected') {
      return 'gws_extension_status_connected'
    }

    if (info.status === 'error') {
      return 'gws_extension_status_error'
    }

    if (info.status === 'connecting' && info.installed) {
      const hint = info.userHint
      if (hint === 'waiting_long') {
        return 'gws_extension_status_waiting_long'
      }
      if (hint === 'waiting') {
        return 'gws_extension_status_waiting'
      }
      return 'gws_extension_status_connecting'
    }

    if (info.status === 'connecting' && !info.installed) {
      return 'gws_extension_status_not_installed'
    }

    return 'gws_extension_status_disconnected'
  }

  const dotColor = (info: NativeMessagingExtensionInfo | null): string => {
    if (!info) return 'bg-muted-foreground'
    if (info.status === 'connected') return 'bg-emerald-500'
    if (info.status === 'connecting' && info.installed) return 'bg-amber-500'
    return 'bg-muted-foreground'
  }

  return (
    <SettingsSection icon={<SettingsIcon className="h-4 w-4" />} title={t('gws_extension_title')}>
      <div className="border-border/60 bg-background/40 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`size-2 shrink-0 rounded-full ${dotColor(extensionInfo ?? null)}`} />
          <span className="text-ql-12 text-muted-foreground min-w-0">
            {t(statusKey(extensionInfo ?? null))}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {extensionInfo?.installed && extensionInfo?.status !== 'connected' && (
            <Button
              type="button"
              variant="link"
              size="xs"
              onClick={() => getElectronApi()?.openExternal('https://gemini.google.com/app')}
              className="text-amber-600 hover:text-amber-700 dark:text-amber-400"
            >
              <span className="text-ql-11 font-semibold">{t('gws_extension_wake_btn')}</span>
            </Button>
          )}
          {extensionInfo?.installed ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onRemoveExtension}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <span className="text-ql-11 font-semibold">{t('gws_extension_remove_btn')}</span>
            </Button>
          ) : (
            <Button
              type="button"
              size="xs"
              onClick={handleInstallClick}
              disabled={installing}
              className="gap-1.5"
            >
              {installing ? (
                <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <SettingsIcon className="h-3.5 w-3.5" />
              )}
              <span className="text-ql-11 font-semibold">{t('gws_extension_install_btn')}</span>
            </Button>
          )}
        </div>
      </div>
    </SettingsSection>
  )
}

export default memo(ExtensionStatusCard)
