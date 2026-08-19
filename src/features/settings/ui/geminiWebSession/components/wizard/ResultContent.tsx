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
      <div className="flex flex-col items-center gap-4 px-8 pt-4 pb-8">
        <div className="bg-destructive/15 flex h-12 w-12 items-center justify-center rounded-full">
          <XCircle className="text-destructive h-7 w-7" />
        </div>
        <h3 className="text-ql-18 text-foreground font-semibold">
          {t('gws_extension_wizard_error_title')}
        </h3>
        {error ? <p className="text-ql-13 text-destructive">{error}</p> : null}
        <button
          type="button"
          onClick={onDone}
          className="text-ql-12 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/40 mt-2 inline-flex w-full items-center justify-center rounded-lg px-5 py-2.5 font-semibold shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {t('gws_extension_wizard_done_btn')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 px-8 pt-4 pb-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
        {isConnected ? (
          <CheckCircle className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        ) : mode === 'install' ? (
          <Loader2 className="h-7 w-7 animate-spin text-amber-600 dark:text-amber-400" />
        ) : (
          <CheckCircle className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        )}
      </div>
      <h3 className="text-ql-18 text-foreground font-semibold">
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
          <div className="border-border bg-muted/30 mt-4 w-full rounded-xl border p-3">
            <p className="text-ql-12 text-foreground mb-2 font-semibold">
              {t('gws_extension_wizard_remove_manual_title')}
            </p>
            <div className="border-border bg-muted/60 mb-3 flex items-center justify-between gap-2 rounded-lg border p-2">
              <span className="text-ql-12 text-muted-foreground font-mono select-all">
                chrome://extensions
              </span>
              <button
                type="button"
                onClick={onCopyLink}
                className="text-ql-11 border-border bg-muted text-foreground hover:bg-muted/80 focus-visible:ring-ring/40 flex h-8 shrink-0 items-center justify-center rounded-lg border px-3 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                {copiedLink ? (
                  <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" />
                    {t('gws_extension_wizard_link_copied')}
                  </span>
                ) : (
                  t('gws_extension_wizard_copy_link_btn')
                )}
              </button>
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
          <div className="border-border bg-muted/30 w-full rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-ql-12 text-muted-foreground truncate font-mono">
                {installedPath}
              </span>
              <button
                type="button"
                onClick={onCopyPath}
                className="border-border bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground focus-visible:ring-ring/40 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:ring-2 focus-visible:outline-none"
                aria-label={t('gws_extension_wizard_path_copied')}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
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
      <button
        type="button"
        onClick={onDone}
        className={
          'text-ql-12 focus-visible:ring-ring/40 mt-2 inline-flex w-full items-center justify-center rounded-lg px-5 py-2.5 font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none ' +
          ((mode === 'install' && isConnected) || (mode === 'remove' && !isConnected)
            ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs'
            : 'border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border')
        }
      >
        {mode === 'install'
          ? isConnected
            ? t('gws_extension_wizard_finish_btn')
            : t('gws_extension_wizard_skip_btn')
          : t('gws_extension_wizard_done_btn')}
      </button>
    </div>
  )
}

export default memo(ResultContent)
