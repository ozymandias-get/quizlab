import {
  useShellIntegrationInstall,
  useShellIntegrationRemove,
  useShellIntegrationStatus
} from '@platform/electron/api/useShellIntegrationApi'

import { Button } from '@app/components/ui/button'
import { useToastActions } from '@shared/stores/toastStore'
import { SettingsSection } from '@shared/ui/components/primitives'
import { ImportIcon, LoaderIcon } from '@ui/components/Icons'

import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

const ShellIntegrationCard = memo(() => {
  const { t, i18n } = useTranslation()
  const { showSuccess, showError } = useToastActions()
  const { data: status, isLoading } = useShellIntegrationStatus()
  const { mutateAsync: install, isPending: isInstalling } = useShellIntegrationInstall()
  const { mutateAsync: remove, isPending: isRemoving } = useShellIntegrationRemove()

  const handleInstall = useCallback(async () => {
    try {
      const result = await install(i18n.language)
      if (result?.success) {
        showSuccess(t('shell_integration_installed'), t('toast_system_title'))
      } else {
        showError(t('shell_integration_failed'), t('toast_error_title'))
      }
    } catch {
      showError(t('shell_integration_failed'), t('toast_error_title'))
    }
  }, [install, i18n.language, showSuccess, showError, t])

  const handleRemove = useCallback(async () => {
    try {
      const result = await remove()
      if (result?.success) {
        showSuccess(t('shell_integration_removed'), t('toast_system_title'))
      } else {
        showError(t('shell_integration_failed'), t('toast_error_title'))
      }
    } catch {
      showError(t('shell_integration_failed'), t('toast_error_title'))
    }
  }, [remove, showSuccess, showError, t])

  // Web modunda veya desteklenmeyen platformda kartı gizle.
  if (!isLoading && (!status || !status.supported)) return null

  const installed = status?.installed ?? false
  const pending = isInstalling || isRemoving || isLoading

  return (
    <SettingsSection
      icon={<ImportIcon className="h-4 w-4" />}
      title={t('shell_integration_title')}
      detail={t('shell_integration_description')}
      action={
        !isLoading && (
          <span
            className={
              installed
                ? 'text-ql-10 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400'
                : 'text-ql-10 text-muted-foreground border-border/60 bg-muted rounded-full border px-2.5 py-0.5 font-semibold'
            }
          >
            {installed ? t('on') : t('off')}
          </span>
        )
      }
    >
      {!isLoading && installed && (
        <p className="border-border/60 bg-background/40 text-ql-12 text-muted-foreground rounded-xl border p-4">
          {t('shell_integration_location')}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {installed ? (
          <>
            <Button
              type="button"
              onClick={() => void handleInstall()}
              disabled={pending}
              variant="outline"
              size="sm"
              className="w-full gap-2 sm:flex-1"
            >
              {pending && <LoaderIcon className="h-3.5 w-3.5 animate-spin" />}
              <span className="text-ql-12 font-medium">{t('shell_integration_repair')}</span>
            </Button>
            <Button
              type="button"
              onClick={() => void handleRemove()}
              disabled={pending}
              variant="destructive-outline"
              size="sm"
              className="w-full gap-2 sm:flex-1"
            >
              {pending && <LoaderIcon className="h-3.5 w-3.5 animate-spin" />}
              <span className="text-ql-12 font-medium">{t('shell_integration_remove')}</span>
            </Button>
          </>
        ) : (
          <Button
            type="button"
            onClick={() => void handleInstall()}
            disabled={pending}
            variant="secondary"
            size="sm"
            className="w-full gap-2"
          >
            {pending && <LoaderIcon className="h-3.5 w-3.5 animate-spin" />}
            <span className="text-ql-12 font-medium">{t('shell_integration_install')}</span>
          </Button>
        )}
      </div>
    </SettingsSection>
  )
})

ShellIntegrationCard.displayName = 'ShellIntegrationCard'
export default ShellIntegrationCard
