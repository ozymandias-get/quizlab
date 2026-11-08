import { QUIZLAB_EXTENSION_RELEASE_URL } from '@shared-core/constants/extensionRelease'

import {
  useNativeMessagingPairingCodeQuery,
  useNativeMessagingStatusQuery
} from '@platform/electron/api/useNativeMessagingApi'

import { Dialog } from '@app/components/ui/dialog'
import { useClipboard } from '@shared/hooks/useClipboard'
import { getElectronApi } from '@shared/lib/electronApi'
import { Button } from '@shared/ui/components/primitives'

import { Check, Copy, Download, ExternalLink, Loader2 } from 'lucide-react'
import { memo, useCallback, useId } from 'react'
import { useTranslation } from 'react-i18next'

interface ExtensionPairingDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * Explains the separate extension install and shows the pairing code.
 *
 * The app no longer copies the extension into its own data directory. The user
 * downloads the release, loads it in the browser and pairs it once with the
 * code below.
 */
function ExtensionPairingDialog({ open, onClose }: ExtensionPairingDialogProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const { data: pairingCode, isLoading } = useNativeMessagingPairingCodeQuery(open)
  const { data: extensionInfo } = useNativeMessagingStatusQuery()
  const { copy, isCopied } = useClipboard()

  const handleCopy = useCallback(() => {
    if (!pairingCode) return
    void copy(pairingCode)
  }, [copy, pairingCode])

  const isConnected = extensionInfo?.status === 'connected'
  const isPaired = extensionInfo?.paired === true

  return (
    <Dialog isOpen={open} onClose={onClose} size="md" ariaLabelledBy={titleId}>
      <div className="flex flex-col gap-4 p-6 text-left">
        <h3 id={titleId} className="text-ql-16 text-foreground font-semibold">
          {t('ws_extension_pairing_title')}
        </h3>
        <p className="text-ql-13 text-muted-foreground leading-relaxed">
          {t('ws_extension_pairing_desc')}
        </p>

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

        <Button
          type="button"
          variant="outline"
          onClick={() => getElectronApi()?.openExternal(QUIZLAB_EXTENSION_RELEASE_URL)}
          className="w-full gap-2"
        >
          <Download className="h-4 w-4" />
          <span className="text-ql-12 font-semibold">{t('ws_extension_download_btn')}</span>
          <ExternalLink className="text-muted-foreground ms-auto h-3.5 w-3.5" />
        </Button>

        <div className="flex flex-col gap-2">
          <span className="text-ql-12 text-foreground font-semibold">
            {t('ws_extension_pairing_code_label')}
          </span>
          <div className="border-border/60 bg-muted/40 flex items-center justify-between gap-2 rounded-lg border p-2">
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
                <span className="text-ql-11 flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
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
