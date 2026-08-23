import { Button } from '@app/components/ui/button'
import { InlineSpinner } from '@shared/ui/components/primitives'
import { GridIcon } from '@ui/components/Icons'

import { CheckCircle, Download, RefreshCw, Trash2 } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import DoclingPipelineCard from './docling/DoclingPipelineCard'
import DoclingRemoveDialog from './docling/DoclingRemoveDialog'
import DoclingStatusCard from './docling/DoclingStatusCard'
import { useDoclingTabState } from './docling/useDoclingTabState'
import SettingsTabIntro from './shared/SettingsTabIntro'

const DoclingTab = memo(function DoclingTab() {
  const { t } = useTranslation()
  const {
    docling,
    serviceStatus,
    modelStatus,
    isLoading,
    isBusy,
    isInstalled,
    progress,
    modelProgress,
    confirmOpen,
    actionPending,
    modelActionPending,
    handleRefresh,
    handleInstall,
    handleRepair,
    handleRemove,
    closeConfirm,
    confirmRemove,
    handleDownloadModels,
    handleDeleteModels,
    handleRepairModels
  } = useDoclingTabState()

  const statusDot = isBusy ? 'bg-amber-500' : isInstalled ? 'bg-emerald-500' : 'bg-zinc-400'
  const statusText = isBusy
    ? t('docling_installing')
    : isInstalled
      ? t('docling_installed')
      : docling?.status === 'error'
        ? t('docling_state_error')
        : t('docling_not_installed')

  return (
    <div className="space-y-4 pb-4">
      <SettingsTabIntro
        icon={
          <div className="border-primary/20 bg-primary/10 text-primary rounded-lg border p-2.5">
            <GridIcon className="h-5 w-5" />
          </div>
        }
        description={t('docling_description')}
      />

      <DoclingStatusCard
        docling={docling}
        serviceStatus={serviceStatus}
        modelStatus={modelStatus}
        isLoading={isLoading}
        isBusy={isBusy}
        isInstalled={isInstalled}
        progress={progress}
        modelProgress={modelProgress}
        statusDot={statusDot}
        statusText={statusText}
        handleRefresh={handleRefresh}
        handleDownloadModels={handleDownloadModels}
        handleRepairModels={handleRepairModels}
        handleDeleteModels={handleDeleteModels}
        modelActionPending={modelActionPending}
      />

      <DoclingPipelineCard isInstalled={isInstalled} />

      <div className="flex flex-wrap gap-2.5">
        {!isInstalled ? (
          <Button
            type="button"
            onClick={handleInstall}
            disabled={isBusy || actionPending}
            aria-busy={isBusy || actionPending}
            className="gap-1.5"
          >
            {isBusy || actionPending ? (
              <InlineSpinner className="h-3.5 w-3.5" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>{t('docling_install')}</span>
          </Button>
        ) : (
          <>
            <Button
              type="button"
              onClick={handleRepair}
              disabled={isBusy || actionPending}
              aria-busy={isBusy || actionPending}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              {isBusy ? (
                <InlineSpinner className="h-3.5 w-3.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span>{t('docling_repair')}</span>
            </Button>
            <Button
              type="button"
              onClick={handleRemove}
              disabled={isBusy || actionPending}
              variant="destructive"
              size="sm"
              className="gap-1.5"
              aria-label={t('docling_remove')}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t('docling_remove')}</span>
            </Button>
          </>
        )}
      </div>

      {isInstalled && (
        <p className="text-ql-12 text-muted-foreground flex items-center gap-1.5">
          <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
          {t('docling_installed')}
        </p>
      )}

      <DoclingRemoveDialog open={confirmOpen} onClose={closeConfirm} onConfirm={confirmRemove} />
    </div>
  )
})

DoclingTab.displayName = 'DoclingTab'
export default DoclingTab
