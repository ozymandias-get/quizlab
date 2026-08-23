import { Button } from '@app/components/ui/button'
import { cn } from '@shared/lib/uiUtils'
import { InlineSpinner, SurfaceCard } from '@shared/ui/components/primitives'

import { AlertTriangle, Download, RefreshCw, Trash2 } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import DoclingStatusGrid, { formatBytes } from './DoclingStatusGrid'
import type { useDoclingTabState } from './useDoclingTabState'

function phaseLabel(phase: string, t: (k: string) => string): string {
  const key = `docling_phase_${phase}`
  const v = t(key)
  return v === key ? phase : v
}

type TabState = ReturnType<typeof useDoclingTabState>

interface Props {
  docling: TabState['docling']
  serviceStatus: TabState['serviceStatus']
  modelStatus: TabState['modelStatus']
  isLoading: boolean
  isBusy: boolean
  isInstalled: boolean
  progress: TabState['progress']
  modelProgress: TabState['modelProgress']
  statusDot: string
  statusText: string
  handleRefresh: TabState['handleRefresh']
  handleDownloadModels: TabState['handleDownloadModels']
  handleRepairModels: TabState['handleRepairModels']
  handleDeleteModels: TabState['handleDeleteModels']
  modelActionPending: boolean
}

const DoclingStatusCard = memo(function DoclingStatusCard({
  docling,
  serviceStatus,
  modelStatus,
  isLoading,
  isBusy,
  isInstalled,
  progress,
  modelProgress,
  statusDot,
  statusText,
  handleRefresh,
  handleDownloadModels,
  handleRepairModels,
  handleDeleteModels,
  modelActionPending
}: Props) {
  const { t } = useTranslation()
  return (
    <SurfaceCard className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-ql-13 text-foreground flex items-center gap-2 font-semibold">
          <span className={cn('size-2 rounded-full', statusDot)} aria-hidden />
          {statusText}
          {isInstalled && modelStatus && (
            <span
              className={cn(
                'text-ql-11 rounded-full px-2 py-0.5 font-medium',
                modelStatus.status === 'ready'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : modelStatus.status === 'partial' || modelStatus.status === 'runtime_missing'
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300'
              )}
            >
              {t(`docling_model_${modelStatus.status}`, { defaultValue: modelStatus.status })} ·{' '}
              {formatBytes(modelStatus.diskBytes)}
            </span>
          )}
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          aria-label={t('refresh')}
          disabled={isLoading}
          className="h-7 gap-1.5 px-2.5 text-xs"
        >
          <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} />
          <span>{t('refresh')}</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4">
          <InlineSpinner />
          <span className="text-ql-13 text-muted-foreground">{t('docling_loading')}</span>
        </div>
      ) : (
        <>
          <DoclingStatusGrid
            docling={docling}
            serviceStatus={serviceStatus}
            modelStatus={modelStatus}
            isInstalled={isInstalled}
          />

          {modelProgress?.phase === 'downloading' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-ql-11 text-muted-foreground truncate">
                  {modelProgress.message ?? t('docling_downloading')}
                  {modelProgress.currentFile ? ` — ${modelProgress.currentFile}` : ''}
                </span>
                <span className="text-ql-11 ml-2 shrink-0 font-mono">
                  {modelProgress.percent !== null ? `${modelProgress.percent}%` : '…'}
                </span>
              </div>
              <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
                <div
                  className={cn(
                    'bg-primary h-full transition-all duration-300',
                    modelProgress.percent === null && 'w-full animate-pulse'
                  )}
                  style={
                    modelProgress.percent !== null
                      ? { width: `${modelProgress.percent}%` }
                      : undefined
                  }
                />
              </div>
            </div>
          )}
          {modelProgress?.phase === 'completed' && (
            <p className="text-ql-11 text-emerald-600 dark:text-emerald-400">
              {modelProgress.message ?? t('docling_models_ready_check')}
            </p>
          )}
          {modelProgress?.phase === 'failed' && (
            <p className="text-ql-11 text-destructive">
              {modelProgress.message ?? t('docling_download_failed')}
            </p>
          )}

          <div className="border-border/50 flex flex-wrap items-center gap-1.5 border-t pt-2.5">
            <span className="text-ql-11 text-muted-foreground hidden sm:inline">
              {t('docling_models')}
            </span>
            <div className="ml-auto flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                onClick={handleDownloadModels}
                disabled={!isInstalled || modelActionPending}
                className="h-7 gap-1 px-2.5 text-xs"
              >
                <Download className="h-3 w-3" />
                <span>{t('docling_download_models')}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRepairModels}
                disabled={!isInstalled || modelActionPending}
                className="h-7 gap-1 px-2.5 text-xs"
              >
                <RefreshCw className="h-3 w-3" />
                <span>{t('docling_repair_models')}</span>
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDeleteModels}
                disabled={!isInstalled || modelStatus?.status === 'missing' || modelActionPending}
                className="h-7 gap-1 px-2.5 text-xs"
              >
                <Trash2 className="h-3 w-3" />
                <span>{t('docling_delete_models')}</span>
              </Button>
            </div>
          </div>
        </>
      )}

      {(docling?.error || progress?.phase === 'failed') && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive text-ql-11 flex items-start gap-2 rounded-lg border p-2.5"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium">{t('docling_last_error')}</p>
            <p className="break-words opacity-90">{docling?.error ?? progress?.message ?? ''}</p>
          </div>
        </div>
      )}

      {progress && progress.phase !== 'failed' && isBusy && (
        <div
          data-testid="docling-progress"
          className="border-border bg-muted/40 flex items-center gap-3 rounded-lg border p-2.5"
        >
          <InlineSpinner />
          <div className="min-w-0 flex-1">
            <p data-testid="docling-progress-phase" className="text-ql-12 font-medium">
              {phaseLabel(progress.phase, t)}
            </p>
            {progress.percent !== null && (
              <div className="bg-border mt-1 h-1 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
                  aria-hidden
                />
              </div>
            )}
          </div>
        </div>
      )}
    </SurfaceCard>
  )
})

export default DoclingStatusCard
