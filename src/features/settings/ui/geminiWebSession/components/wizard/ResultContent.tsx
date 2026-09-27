import { Button } from '@app/components/ui/button'
import { IconButton } from '@app/components/ui/icon-button'
import { IconBadge } from '@shared/ui/components/primitives'

import { Check, CheckCircle, Copy, Loader2, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface ResultContentProps {
  success: boolean
  error: string | null
  mode: 'install' | 'remove'
  isConnected: boolean
  installedPath: string | null
  copied: boolean
  copiedLink: boolean
  onCopyPath: () => void
  onCopyLink: () => void
  onDone: () => void
  statusIndicator: ReactNode
}

function ResultContent({
  success,
  error,
  mode,
  isConnected,
  installedPath,
  copied,
  copiedLink,
  onCopyPath,
  onCopyLink,
  onDone,
  statusIndicator
}: ResultContentProps) {
  const { t } = useTranslation()

  if (!success) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <IconBadge icon={XCircle} variant="danger" size="lg" className="mb-1" />
        <h3 className="text-ql-16 text-foreground font-semibold">
          {t('gws_extension_wizard_error_title')}
        </h3>
        {error ? <p className="text-ql-13 text-destructive">{error}</p> : null}
        <Button type="button" onClick={onDone} className="mt-2 w-full">
          <span className="text-ql-12">{t('gws_extension_wizard_done_btn')}</span>
        </Button>
      </div>
    )
  }

  const resultIcon = isConnected || mode !== 'install' ? CheckCircle : Loader2

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <IconBadge
        icon={resultIcon}
        variant={isConnected || mode !== 'install' ? 'success' : 'warning'}
        size="lg"
        iconClassName={!isConnected && mode === 'install' ? 'animate-spin' : undefined}
        className="mb-1"
      />
      <h3 className="text-ql-16 text-foreground font-semibold">
        {mode === 'install'
          ? isConnected
            ? t('gws_extension_wizard_install_success')
            : t('gws_extension_wizard_install_title')
          : isConnected
            ? t('gws_extension_wizard_remove_title')
            : t('gws_extension_wizard_remove_success')}
      </h3>
      {statusIndicator}
      {mode === 'remove' ? (
        <div className="w-full text-left">
          <p className="text-ql-13 text-muted-foreground text-center">
            {t('gws_extension_wizard_remove_success_desc')}
          </p>
          <div className="border-border/60 bg-background/40 mt-4 w-full rounded-xl border p-4">
            <p className="text-ql-12 text-foreground mb-2 font-semibold">
              {t('gws_extension_wizard_remove_manual_title')}
            </p>
            <div className="border-border/60 bg-muted/40 mb-3 flex items-center justify-between gap-2 rounded-lg border p-2">
              <span className="text-ql-12 text-muted-foreground font-mono select-all">
                chrome://extensions
              </span>
              <Button type="button" variant="outline" size="sm" onClick={onCopyLink}>
                {copiedLink ? (
                  <span className="text-ql-11 flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" />
                    {t('gws_extension_wizard_link_copied')}
                  </span>
                ) : (
                  <span className="text-ql-11">{t('gws_extension_wizard_copy_link_btn')}</span>
                )}
              </Button>
            </div>
            <ul className="flex flex-col gap-2">
              <li className="text-ql-12 text-muted-foreground">
                {t('gws_extension_wizard_remove_manual_step1')}
              </li>
              <li className="text-ql-12 text-muted-foreground">
                {t('gws_extension_wizard_remove_manual_step2')}
              </li>
              <li className="text-ql-12 text-muted-foreground">
                {t('gws_extension_wizard_remove_manual_step3')}
              </li>
            </ul>
          </div>
        </div>
      ) : null}
      {mode === 'install' && installedPath ? (
        <div className="w-full">
          <p className="text-ql-12 text-muted-foreground mb-2">
            {t('gws_extension_wizard_install_success_desc')}
          </p>
          <div className="border-border/60 bg-background/40 w-full rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-ql-12 text-muted-foreground truncate font-mono">
                {installedPath}
              </span>
              <IconButton
                type="button"
                variant="outline"
                size="compact"
                onClick={onCopyPath}
                className="text-muted-foreground hover:text-foreground"
                aria-label={t('gws_extension_wizard_path_copied')}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy />
                )}
              </IconButton>
            </div>
          </div>
        </div>
      ) : null}
      {mode === 'install' ? (
        <div className="w-full">
          <p className="text-ql-12 text-foreground mb-2 font-semibold">
            {t('gws_extension_wizard_manual_title')}
          </p>
          <ul className="flex flex-col gap-2">
            <li className="text-ql-12 text-muted-foreground">
              {t('gws_extension_wizard_manual_step1')}
            </li>
            <li className="text-ql-12 text-muted-foreground">
              {t('gws_extension_wizard_manual_step2')}
            </li>
            <li className="text-ql-12 text-muted-foreground">
              {t('gws_extension_wizard_manual_step3')}
            </li>
            <li className="text-ql-12 text-muted-foreground">
              {t('gws_extension_wizard_manual_step4')}
            </li>
          </ul>
        </div>
      ) : null}
      <Button
        type="button"
        onClick={onDone}
        variant={
          (mode === 'install' && isConnected) || (mode === 'remove' && !isConnected)
            ? 'secondary'
            : 'outline'
        }
        className="mt-2 w-full"
      >
        <span className="text-ql-12">
          {mode === 'install'
            ? isConnected
              ? t('gws_extension_wizard_finish_btn')
              : t('gws_extension_wizard_skip_btn')
            : t('gws_extension_wizard_done_btn')}
        </span>
      </Button>
    </div>
  )
}

export default memo(ResultContent)
