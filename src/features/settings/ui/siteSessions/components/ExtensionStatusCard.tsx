import type { NativeMessagingExtensionInfo } from '@shared-core/types'

import {
  useInstallExtensionMutation,
  useNativeMessagingStatusQuery
} from '@platform/electron/api/useNativeMessagingApi'

import { useClipboard } from '@shared/hooks/useClipboard'
import { getElectronApi } from '@shared/lib/electronApi'
import { Button, SettingsSection } from '@shared/ui/components/primitives'
import { SettingsIcon } from '@ui/components/Icons'

import { Check, Copy, FolderInput, KeyRound, Loader2 } from 'lucide-react'
import { memo, useCallback, useState } from 'react'

interface ExtensionStatusCardProps {
  t: (key: string) => string
  onShowPairing: () => void
}

function ExtensionStatusCard({ t, onShowPairing }: ExtensionStatusCardProps) {
  // Polling + connect/disconnect invalidation live in the platform hook (STD-014).
  const { data: extensionInfo } = useNativeMessagingStatusQuery()
  const { mutateAsync: installExtension, isPending: isInstalling } = useInstallExtensionMutation()
  const { copy, isCopied } = useClipboard()
  /** The folder the app prepared, once the user asked for it. */
  const [installed, setInstalled] = useState<{
    path: string
    version: string
    refreshed: boolean
  } | null>(null)
  const [installFailed, setInstallFailed] = useState(false)

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

  /**
   * Prepares the bundled extension and copies its folder.
   *
   * Chrome only loads an unpacked extension from a folder the user picks, so
   * the app cannot finish the install on its own. It copies the folder to a
   * stable path and puts that path on the clipboard; the user pastes it into
   * the folder picker.
   */
  const handleInstall = useCallback(async () => {
    setInstallFailed(false)
    try {
      const result = await installExtension()
      setInstalled({ path: result.path, version: result.version, refreshed: result.refreshed })
      await copy(result.path)
    } catch {
      setInstallFailed(true)
    }
  }, [copy, installExtension])

  // The files being ready is not the same as Chrome loading them, and loading
  // is not the same as pairing. The block only turns green when the extension
  // really paired; otherwise it says what the user still has to do.
  const installStatusKey = installed
    ? extensionInfo?.status === 'connected' && extensionInfo.paired === true
      ? 'ws_extension_install_status_paired'
      : extensionInfo?.status === 'connected'
        ? 'ws_extension_install_status_unpaired'
        : 'ws_extension_install_status_load'
    : null
  const installedPaired = extensionInfo?.status === 'connected' && extensionInfo?.paired === true
  const installedLoaded = extensionInfo?.status === 'connected' || extensionInfo?.paired === true

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
            onClick={() => void handleInstall()}
            disabled={isInstalling}
            className="gap-1.5 @max-[420px]:flex-1"
          >
            {isInstalling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FolderInput className="h-3.5 w-3.5" />
            )}
            <span className="text-ql-11 font-semibold">{t('ws_extension_install_btn')}</span>
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

      {installed && installStatusKey && (
        <div
          className={`mt-3 flex flex-col gap-2 rounded-xl border p-3 ${
            installedPaired
              ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
              : 'border-amber-500/25 bg-amber-500/[0.04]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`text-ql-11 font-semibold ${
                installedPaired ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {t('ws_extension_install_ready')} · v{installed.version}
            </span>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => void copy(installed.path)}
              className="gap-1.5"
            >
              {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span className="text-ql-10 font-semibold">
                {isCopied ? t('ws_extension_install_copied') : t('ws_extension_install_copy_btn')}
              </span>
            </Button>
          </div>
          <code
            className="text-ql-10 text-muted-foreground truncate font-mono select-all"
            title={installed.path}
          >
            {installed.path}
          </code>
          <p className="text-ql-11 text-muted-foreground leading-relaxed">
            {t('ws_extension_install_hint')}
          </p>
          <p className="text-ql-11 text-muted-foreground leading-relaxed">{t(installStatusKey)}</p>
          {installed.refreshed && installedLoaded && (
            <p className="text-ql-11 leading-relaxed text-amber-400">
              {t('ws_extension_install_reload_hint')}
            </p>
          )}
        </div>
      )}

      {installFailed && (
        <p role="alert" className="text-ql-11 text-destructive mt-2">
          {t('ws_extension_install_error')}
        </p>
      )}
    </SettingsSection>
  )
}

export default memo(ExtensionStatusCard)
