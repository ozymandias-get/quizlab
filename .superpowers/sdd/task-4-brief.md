# Task 4: ExtensionStatusCard.tsx — Updated UI

**Files:**

- Modify: `src/features/settings/ui/geminiWebSession/components/ExtensionStatusCard.tsx`

**Interfaces:**

- Consumes: Updated `NativeMessagingExtensionInfo` with `waitingSince` + `userHint` (returns 'waiting', 'waiting_long', or null)

## Changes

Replace the component with a version that shows different states:

- `installed=true` + `connected` → green dot, "Extension connected"
- `installed=true` + `connecting` + `userHint='waiting'` → amber dot, "Waiting for Chrome extension..."
- `installed=true` + `connecting` + `userHint='waiting_long'` → amber dot, "Still waiting. Open chrome://extensions..."
- `installed=true` + `connecting` + `userHint=null` → amber dot, "Extension connecting..."
- `installed=false` + any → white dot, "Extension not installed."

Remove the `EXTENSION_STATUS_KEYS` constant. Replace with a `statusKey()` function that reads `info.userHint`.

### Complete replacement code:

Replace the entire file content with:

```
import type { NativeMessagingExtensionInfo } from '@shared-core/types'

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
    if (!info) return 'bg-white/30'
    if (info.status === 'connected') return 'bg-emerald-400'
    if (info.status === 'connecting' && info.installed) return 'bg-amber-400'
    return 'bg-white/30'
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-4 backdrop-blur-sm">
      <div className="text-ql-12 mb-3 font-bold text-white/85">{t('gws_extension_title')}</div>

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${dotColor(extensionInfo)}`} />
          <span className="text-ql-12 text-white/70">
            {t(statusKey(extensionInfo))}
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
```
