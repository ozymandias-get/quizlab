import {
  useDoclingGpuDetect,
  useDoclingGpuPrefs,
  useDoclingGpuSetEnabled
} from '@platform/electron/api/useDoclingGpuApi'

import { Button } from '@app/components/ui/button'
import { cn } from '@shared/lib/uiUtils'
import { InlineSpinner, SurfaceCard } from '@shared/ui/components/primitives'
import { GridIcon } from '@ui/components/Icons'

import {
  AlertTriangle,
  CheckCircle,
  Cpu,
  Download,
  HardDrive,
  RefreshCw,
  Trash2,
  Zap
} from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import DoclingModelsCard from './docling/DoclingModelsCard'
import DoclingRemoveDialog from './docling/DoclingRemoveDialog'
import { useDoclingTabState } from './docling/useDoclingTabState'
import SettingsTabIntro from './shared/SettingsTabIntro'
import SettingsToggleSwitch from './shared/SettingsToggleSwitch'

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function phaseLabel(phase: string, t: (k: string) => string): string {
  const key = `docling_phase_${phase}`
  const v = t(key)
  return v === key ? phase : v
}

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
  const { data: gpuPrefs } = useDoclingGpuPrefs()
  const {
    data: gpuDetect,
    isLoading: gpuDetectLoading,
    refetch: refetchGpuDetect
  } = useDoclingGpuDetect(!!isInstalled)
  const gpuToggle = useDoclingGpuSetEnabled()
  const gpuEnabled = !!gpuPrefs?.enabled
  const gpuAvailable = !!gpuDetect?.available
  const gpuDeviceLabel = gpuDetect?.device ?? gpuPrefs?.lastDetected ?? 'cpu'

  const statusDot = isBusy ? 'bg-amber-500' : isInstalled ? 'bg-emerald-500' : 'bg-zinc-400'
  const statusText = isBusy
    ? t('docling_installing')
    : isInstalled
      ? t('docling_installed')
      : docling?.status === 'error'
        ? t('docling_state_error')
        : t('docling_not_installed')

  return (
    <div className="space-y-6 pb-4">
      <SettingsTabIntro
        icon={
          <div className="border-primary/20 bg-primary/10 text-primary rounded-lg border p-2.5">
            <GridIcon className="h-5 w-5" />
          </div>
        }
        description={t('docling_description')}
      />

      <SurfaceCard className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-ql-13 text-foreground flex items-center gap-2 font-semibold">
            <span className={cn('size-2 rounded-full', statusDot)} aria-hidden />
            {statusText} — Engine
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            aria-label={t('refresh')}
            disabled={isLoading}
            className="gap-1.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            <span>{t('refresh')}</span>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6">
            <InlineSpinner />
            <span className="text-ql-13 text-muted-foreground">Yükleniyor…</span>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-ql-12">{t('docling_version')}</dt>
              <dd className="text-ql-13 font-mono">
                {docling?.version ?? t('docling_not_available')}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-ql-12">{t('docling_runtime')}</dt>
              <dd className="text-ql-13">
                {serviceStatus
                  ? t(`docling_state_${serviceStatus.state}`, { defaultValue: serviceStatus.state })
                  : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-ql-12 flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                {t('docling_disk_usage')}
              </dt>
              <dd className="text-ql-13 font-mono">
                {formatBytes(serviceStatus?.diskUsageBytes ?? null)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-ql-12">Engine</dt>
              <dd className="text-ql-13">
                {isInstalled ? t('docling_installed') : t('docling_not_installed')}
              </dd>
            </div>
          </dl>
        )}

        {(docling?.error || progress?.phase === 'failed') && (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive text-ql-13 flex items-start gap-2 rounded-lg border p-3"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium">{t('docling_last_error')}</p>
              <p className="break-words opacity-90">{docling?.error ?? progress?.message ?? ''}</p>
            </div>
          </div>
        )}

        {progress && progress.phase !== 'failed' && isBusy && (
          <div
            data-testid="docling-progress"
            className="border-border bg-muted/40 flex items-center gap-3 rounded-lg border p-3"
          >
            <InlineSpinner />
            <div className="min-w-0 flex-1">
              <p data-testid="docling-progress-phase" className="text-ql-13 font-medium">
                {phaseLabel(progress.phase, t)}
              </p>
              {progress.percent !== null && (
                <div className="bg-border mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
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

      <DoclingModelsCard
        modelStatus={modelStatus}
        isInstalled={isInstalled}
        pending={modelActionPending}
        modelProgress={modelProgress}
        onDownload={handleDownloadModels}
        onRepair={handleRepairModels}
        onDelete={handleDeleteModels}
      />

      <SurfaceCard className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary rounded-md p-1.5">
              {gpuEnabled ? <Zap className="h-4 w-4" /> : <Cpu className="h-4 w-4" />}
            </div>
            <div>
              <h3 className="text-ql-13 font-semibold">GPU Hızlandırma (Deneysel)</h3>
              <p className="text-ql-11 text-muted-foreground">
                Akıllı okuma dönüşümünü GPU ile hızlandırır. Kapatılırsa CPU kullanılır.
              </p>
            </div>
          </div>
          <SettingsToggleSwitch
            checked={gpuEnabled}
            onChange={(val) => gpuToggle.mutate(val)}
            disabled={gpuToggle.isPending}
          />
        </div>
        <div className="text-ql-12 text-muted-foreground space-y-1">
          <div className="flex items-center gap-1.5">
            <span>Algılanan cihaz:</span>
            <span className="text-foreground font-mono font-medium">
              {gpuDetectLoading ? 'taranıyor…' : gpuDeviceLabel}
            </span>
            {gpuAvailable ? (
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                kullanılabilir
              </span>
            ) : (
              <span className="rounded-full bg-zinc-500/15 px-1.5 py-0.5 text-[11px]">
                {isInstalled ? 'CPU kullanılacak' : 'Docling kurulu değil'}
              </span>
            )}
          </div>
          {gpuDetect?.detail && (
            <p className="text-ql-11 break-words opacity-80">{gpuDetect.detail}</p>
          )}
          {gpuEnabled && !gpuAvailable && (
            <p className="text-amber-600 dark:text-amber-300">
              GPU açık ama cihaz bulunamadı — işlem otomatik CPU’ya düşecek. NVIDIA driver / CUDA
              veya Apple MPS gereklidir.
            </p>
          )}
          <button
            type="button"
            onClick={() => refetchGpuDetect()}
            className="text-ql-11 text-primary hover:underline"
          >
            Yeniden tara
          </button>
        </div>
      </SurfaceCard>

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
