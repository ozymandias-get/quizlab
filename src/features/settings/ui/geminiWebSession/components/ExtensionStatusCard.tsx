import type { NativeMessagingExtensionInfo } from '@shared-core/types'

import { Button } from '@app/components/ui/button'
import { getElectronApi } from '@shared/lib/electronApi'
import { LoaderIcon, SettingsIcon } from '@ui/components/Icons'

import { memo, useEffect, useState } from 'react'

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
  const [extensionInfo, setExtensionInfo] = useState<NativeMessagingExtensionInfo | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    const api = getElectronApi()
    if (!api?.nativeMessaging) return

    const updateStatus = () => {
      api.nativeMessaging
        .getStatus()
        .then(setExtensionInfo)
        .catch(() => {})
    }

    updateStatus()
    const interval = setInterval(updateStatus, 5000)

    const unsubConnected = api.nativeMessaging.onExtensionConnected(() => {
      updateStatus()
    })
    const unsubDisconnected = api.nativeMessaging.onExtensionDisconnected(() => {
      updateStatus()
    })

    return () => {
      clearInterval(interval)
      unsubConnected()
      unsubDisconnected()
    }
  }, [])

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
    <div className="border-border bg-card rounded-xl border p-4 shadow-xs">
      <div className="text-ql-12 text-foreground mb-3 font-semibold">
        {t('gws_extension_title')}
      </div>

      <div className="border-border bg-muted/30 flex items-center justify-between rounded-lg border px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${dotColor(extensionInfo)}`} />
          <span className="text-ql-12 text-muted-foreground">{t(statusKey(extensionInfo))}</span>
        </div>

        <div className="flex items-center gap-2">
          {extensionInfo?.installed && extensionInfo?.status !== 'connected' && (
            <Button
              type="button"
              variant="link"
              size="xs"
              onClick={() => getElectronApi()?.openExternal('https://gemini.google.com/app')}
              className="text-amber-600 hover:text-amber-700 dark:text-amber-400"
            >
              {t('gws_extension_wake_btn')}
            </Button>
          )}
          {extensionInfo?.installed ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onRemoveExtension}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              {t('gws_extension_remove_btn')}
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
              <span>{t('gws_extension_install_btn')}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(ExtensionStatusCard)
