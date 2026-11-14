import {
  useInstallExtensionMutation,
  useNativeMessagingPairingCodeQuery,
  useNativeMessagingStatusQuery
} from '@platform/electron/api/useNativeMessagingApi'

import { Dialog } from '@app/components/ui/dialog'
import { useClipboard } from '@shared/hooks/useClipboard'
import { Button } from '@shared/ui/components/primitives'

import { Check, Copy, FolderInput, Loader2 } from 'lucide-react'
import { memo, useCallback, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface ExtensionPairingDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * Installs and pairs the Chrome extension that ships with the app.
 *
 * The user presses "Install", the app copies the bundled folder to a stable
 * path and puts that path on the clipboard. The user loads it once from
 * `chrome://extensions` and pastes the pairing code below.
 */
function ExtensionPairingDialog({ open, onClose }: ExtensionPairingDialogProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const { data: pairingCode, isLoading } = useNativeMessagingPairingCodeQuery(open)
  const { data: extensionInfo } = useNativeMessagingStatusQuery()
  const { mutateAsync: installExtension, isPending: isInstalling } = useInstallExtensionMutation()
  const { copy, isCopied } = useClipboard()
  const { copy: copyPath, isCopied: isPathCopied } = useClipboard()
  const [installed, setInstalled] = useState<{
    path: string
    version: string
    refreshed: boolean
  } | null>(null)
  const [installFailed, setInstallFailed] = useState(false)

  const handleCopy = useCallback(() => {
    if (!pairingCode) return
    void copy(pairingCode)
  }, [copy, pairingCode])

  const handleInstall = useCallback(async () => {
    setInstallFailed(false)
    try {
      const result = await installExtension()
      setInstalled({ path: result.path, version: result.version, refreshed: result.refreshed })
      await copyPath(result.path)
    } catch {
      setInstallFailed(true)
    }
  }, [copyPath, installExtension])

  const isConnected = extensionInfo?.status === 'connected'
  const isPaired = extensionInfo?.paired === true
  const installStatusKey = installed
    ? isConnected && isPaired
      ? 'ws_extension_install_status_paired'
      : isConnected
        ? 'ws_extension_install_status_unpaired'
        : 'ws_extension_install_status_load'
    : null
  const installedPaired = isConnected && isPaired
  const installedLoaded = isConnected || isPaired

  return (
    <Dialog isOpen={open} onClose={onClose} size="md" ariaLabelledBy={titleId}>
      <div className="flex flex-col gap-4 p-6 text-left">
        <h3 id={titleId} className="text-ql-16 text-foreground font-semibold">
          {t('ws_extension_pairing_title')}
        </h3>
        <p className="text-ql-13 text-muted-foreground leading-relaxed">
          {t('ws_extension_pairing_desc')}
        </p>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleInstall()}
            disabled={isInstalling}
            className="w-full gap-2"
          >
            {isInstalling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderInput className="h-4 w-4" />
            )}
            <span className="text-ql-12 font-semibold">{t('ws_extension_install_btn')}</span>
          </Button>

          {installed && installStatusKey && (
            <div
              className={`flex flex-col gap-2 rounded-lg border p-2.5 ${
                installedPaired
                  ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                  : 'border-amber-500/25 bg-amber-500/[0.04]'
              }`}
            >
              <span
                className={`text-ql-11 font-semibold ${
                  installedPaired ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {t('ws_extension_install_ready')} · v{installed.version}
              </span>
              <div className="flex items-center justify-between gap-2">
                <code
                  className="text-ql-10 text-muted-foreground min-w-0 flex-1 truncate font-mono select-all"
                  title={installed.path}
                >
                  {installed.path}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => void copyPath(installed.path)}
                  className="shrink-0 gap-1.5"
                >
                  {isPathCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span className="text-ql-10 font-semibold">
                    {isPathCopied
                      ? t('ws_extension_install_copied')
                      : t('ws_extension_install_copy_btn')}
                  </span>
                </Button>
              </div>
              <p className="text-ql-11 text-muted-foreground leading-relaxed">
                {t(installStatusKey)}
              </p>
              {installed.refreshed && installedLoaded && (
                <p className="text-ql-11 leading-relaxed text-amber-400">
                  {t('ws_extension_install_reload_hint')}
                </p>
              )}
            </div>
          )}

          {installFailed && (
            <p role="alert" className="text-ql-11 text-destructive">
              {t('ws_extension_install_error')}
            </p>
          )}
        </div>

        <ol className="flex flex-col gap-2">
          <li className="text-ql-12 text-muted-foreground leading-relaxed">
            {t('ws_extension_pairing_step1')}
          </li>
          <li className="text-ql-12 text-muted-foreground leading-relaxed">
            {t('ws_extension_pairing_step2')}
          </li>
          <li className="text-ql-12 text-muted-foreground leading-relaxed">
            {t('ws_extension_pairing_step3')}
          </li>
          <li className="text-ql-12 text-muted-foreground leading-relaxed">
            {t('ws_extension_pairing_step4')}
          </li>
        </ol>

        <div className="flex flex-col gap-2">
          <span className="text-ql-12 text-foreground font-semibold">
            {t('ws_extension_pairing_code_label')}
          </span>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.07] bg-zinc-950/80 p-2">
            <span className="text-ql-12 text-muted-foreground min-w-0 flex-1 truncate font-mono select-all">
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                (pairingCode ?? t('ws_extension_pairing_error'))
              )}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!pairingCode}
              aria-label={
                isCopied ? t('ws_extension_pairing_copied') : t('ws_extension_pairing_copy_btn')
              }
            >
              {isCopied ? (
                <span className="text-ql-11 flex items-center gap-1 font-semibold text-emerald-400">
                  <Check className="h-3 w-3" />
                  {t('ws_extension_pairing_copied')}
                </span>
              ) : (
                <span className="text-ql-11 flex items-center gap-1">
                  <Copy className="h-3 w-3" />
                  {t('ws_extension_pairing_copy_btn')}
                </span>
              )}
            </Button>
          </div>
          <p className="text-ql-11 text-muted-foreground leading-relaxed">
            {t('ws_extension_pairing_code_hint')}
          </p>
        </div>

        <p role="status" className="text-ql-12 text-muted-foreground">
          {isPaired
            ? t('ws_extension_pairing_status_paired')
            : isConnected
              ? t('ws_extension_pairing_status_unpaired')
              : t('ws_extension_pairing_status_waiting')}
        </p>

        <Button type="button" onClick={onClose} className="mt-1 w-full">
          <span className="text-ql-12">{t('ws_extension_pairing_done_btn')}</span>
        </Button>
      </div>
    </Dialog>
  )
}

export default memo(ExtensionPairingDialog)
