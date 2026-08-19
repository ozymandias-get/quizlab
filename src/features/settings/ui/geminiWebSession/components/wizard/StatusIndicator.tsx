import { getElectronApi } from '@shared/lib/electronApi'
import { cn } from '@shared/lib/uiUtils'

import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface StatusIndicatorProps {
  isConnected: boolean
  mode: 'install' | 'remove'
}

function StatusIndicator({ isConnected, mode }: StatusIndicatorProps) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'border-border bg-muted/40 mt-4 flex w-full items-start gap-3 rounded-xl border p-3.5 shadow-xs transition-colors'
      )}
    >
      {isConnected ? (
        mode === 'install' ? (
          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        )
      ) : mode === 'install' ? (
        <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-amber-600 dark:text-amber-400" />
      ) : (
        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      )}
      <div className="text-left">
        <span className="text-ql-12 text-foreground mb-0.5 block font-semibold">
          {t('gws_extension_wizard_status_label')}
        </span>
        <p className="text-ql-12 text-muted-foreground">
          {isConnected
            ? mode === 'install'
              ? t('gws_extension_wizard_status_connected')
              : t('gws_extension_wizard_status_active')
            : mode === 'install'
              ? t('gws_extension_wizard_status_waiting')
              : t('gws_extension_wizard_status_removed')}
        </p>
        {!isConnected && mode === 'install' && (
          <button
            type="button"
            onClick={() => getElectronApi()?.openExternal('https://gemini.google.com/app')}
            className="text-ql-11 mt-2 inline-flex items-center gap-1 font-semibold text-amber-600 underline hover:no-underline dark:text-amber-400"
          >
            {t('gws_extension_wake_btn')}
          </button>
        )}
      </div>
    </div>
  )
}

export default memo(StatusIndicator)
