import type { NativeMessagingExtensionInfo } from '@shared-core/types'

import { getElectronApi } from '@shared/lib/electronApi'
import { LoaderIcon, SettingsIcon } from '@ui/components/Icons'

import { memo, useEffect, useState } from 'react'

interface ExtensionStatusCardProps {
  t: (key: string) => string
  onInstallExtension: () => void
  onRemoveExtension: () => void
}

const EXTENSION_STATUS_KEYS: Record<NonNullable<NativeMessagingExtensionInfo['status']>, string> = {
  connected: 'gws_extension_status_connected',
  connecting: 'gws_extension_status_connecting',
  disconnected: 'gws_extension_status_disconnected',
  error: 'gws_extension_status_error'
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

  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-4 backdrop-blur-sm">
      <div className="text-ql-12 mb-3 font-bold text-white/85">{t('gws_extension_title')}</div>

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              extensionInfo?.status === 'connected'
                ? 'bg-emerald-400'
                : extensionInfo?.status === 'connecting'
                  ? 'bg-amber-400'
                  : 'bg-white/30'
            }`}
          />
          <span className="text-ql-12 text-white/70">
            {t(EXTENSION_STATUS_KEYS[extensionInfo?.status || 'disconnected'])}
          </span>
        </div>

        {extensionInfo?.installed ? (
          <button
            type="button"
            onClick={onRemoveExtension}
            className="text-ql-11 text-red-400 hover:text-red-300"
          >
            {t('gws_extension_remove_btn')}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={installing}
            className="text-ql-11 inline-flex items-center gap-1.5 rounded-lg bg-blue-500/20 px-3 py-1.5 font-semibold text-blue-300 hover:bg-blue-500/30 disabled:opacity-50"
          >
            {installing ? (
              <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <SettingsIcon className="h-3.5 w-3.5" />
            )}
            {t('gws_extension_install_btn')}
          </button>
        )}
      </div>
    </div>
  )
}

export default memo(ExtensionStatusCard)
