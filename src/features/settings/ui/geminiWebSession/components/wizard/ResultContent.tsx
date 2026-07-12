import { Check, CheckCircle, Copy, Loader2, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { memo, useEffect, useRef } from 'react'
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
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-400/20">
          <XCircle className="h-8 w-8 text-red-400" />
        </div>
        <h3 className="text-ql-18 font-semibold text-white">
          {t('gws_extension_wizard_error_title')}
        </h3>
        {error ? <p className="text-ql-13 text-red-300/80">{error}</p> : null}
        <button
          type="button"
          onClick={onDone}
          className="text-ql-14 mt-2 inline-flex w-full items-center justify-center rounded-full bg-white/10 px-6 py-3 font-semibold text-white transition-all hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
        >
          {t('gws_extension_wizard_done_btn')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 px-8 pt-4 pb-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/20">
        {isConnected ? (
          <CheckCircle className="h-8 w-8 text-emerald-400" />
        ) : mode === 'install' ? (
          <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
        ) : (
          <CheckCircle className="h-8 w-8 text-emerald-400" />
        )}
      </div>
      <h3 className="text-ql-18 font-semibold text-white">
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
          <p className="text-ql-13 text-center text-white/60">
            {t('gws_extension_wizard_remove_success_desc')}
          </p>
          <div className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-ql-12 mb-2 font-medium text-white/70">
              {t('gws_extension_wizard_remove_manual_title')}
            </p>
            <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2">
              <span className="text-ql-12 font-mono text-white/50 select-all">
                chrome://extensions
              </span>
              <button
                type="button"
                onClick={onCopyLink}
                className="text-ql-11 flex h-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 font-medium text-white/50 transition-colors hover:border-white/20 hover:text-white/70 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
              >
                {copiedLink ? (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Check className="h-3 w-3" />
                    {t('gws_extension_wizard_link_copied')}
                  </span>
                ) : (
                  t('gws_extension_wizard_copy_link_btn')
                )}
              </button>
            </div>
            <ul className="flex flex-col gap-2">
              <li className="text-ql-12 text-white/50">
                {t('gws_extension_wizard_remove_manual_step1')}
              </li>
              <li className="text-ql-12 text-white/50">
                {t('gws_extension_wizard_remove_manual_step2')}
              </li>
              <li className="text-ql-12 text-white/50">
                {t('gws_extension_wizard_remove_manual_step3')}
              </li>
            </ul>
          </div>
        </div>
      ) : null}
      {mode === 'install' && installedPath ? (
        <div className="w-full">
          <p className="text-ql-12 mb-2 text-white/50">
            {t('gws_extension_wizard_install_success_desc')}
          </p>
          <div className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-ql-12 truncate text-white/50">{installedPath}</span>
              <button
                type="button"
                onClick={onCopyPath}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition-colors hover:border-white/20 hover:text-white/70 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
                aria-label={t('gws_extension_wizard_path_copied')}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
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
          <p className="text-ql-12 mb-2 font-medium text-white/70">
            {t('gws_extension_wizard_manual_title')}
          </p>
          <ul className="flex flex-col gap-2">
            <li className="text-ql-12 text-white/50">{t('gws_extension_wizard_manual_step1')}</li>
            <li className="text-ql-12 text-white/50">{t('gws_extension_wizard_manual_step2')}</li>
            <li className="text-ql-12 text-white/50">{t('gws_extension_wizard_manual_step3')}</li>
            <li className="text-ql-12 text-white/50">{t('gws_extension_wizard_manual_step4')}</li>
          </ul>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onDone}
        className={
          'text-ql-14 mt-2 inline-flex w-full items-center justify-center rounded-full px-6 py-3 font-semibold transition-all focus-visible:ring-2 focus-visible:outline-none ' +
          ((mode === 'install' && isConnected) || (mode === 'remove' && !isConnected)
            ? 'bg-emerald-400/90 text-white hover:bg-emerald-400 focus-visible:ring-emerald-400/60'
            : 'border border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20 hover:text-white/90 focus-visible:ring-white/20')
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
