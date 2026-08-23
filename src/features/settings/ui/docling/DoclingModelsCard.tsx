import { Button } from '@app/components/ui/button'
import { cn } from '@shared/lib/uiUtils'
import { SurfaceCard } from '@shared/ui/components/primitives'

import { Download, HardDrive, RefreshCw, Trash2 } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

import type { DoclingModelProgressEvent } from '@shared-core/types'

interface Props {
  modelStatus: { status: string; diskBytes: number | null } | null | undefined
  isInstalled: boolean
  pending: boolean
  modelProgress?: DoclingModelProgressEvent | null
  onDownload: () => void
  onRepair: () => void
  onDelete: () => void
}

const DoclingModelsCard = memo(function DoclingModelsCard({
  modelStatus,
  isInstalled,
  pending,
  modelProgress,
  onDownload,
  onRepair,
  onDelete
}: Props) {
  const { t } = useTranslation()
  return (
    <SurfaceCard className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-ql-13 text-foreground font-semibold">Models — {t('docling_models')}</h3>
        <span
          className={cn(
            'text-ql-11 rounded-full px-2 py-0.5 font-medium',
            modelStatus?.status === 'ready'
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : modelStatus?.status === 'partial'
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300'
          )}
        >
          {modelStatus
            ? t(`docling_model_${modelStatus.status}`, { defaultValue: modelStatus.status })
            : '-'}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground text-ql-12">Durum</dt>
          <dd className="text-ql-13">
            {modelStatus
              ? t(`docling_model_${modelStatus.status}`, { defaultValue: modelStatus.status })
              : t('docling_not_available')}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-ql-12 flex items-center gap-1">
            <HardDrive className="h-3 w-3" />
            Boyut
          </dt>
          <dd className="text-ql-13 font-mono">{formatBytes(modelStatus?.diskBytes ?? null)}</dd>
        </div>
      </dl>
      {modelProgress && modelProgress.phase === 'downloading' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-ql-12 text-muted-foreground">
              {modelProgress.message ?? 'İndiriliyor...'}
              {modelProgress.currentFile ? ` — ${modelProgress.currentFile}` : ''}
            </span>
            <span className="text-ql-12 font-mono">
              {modelProgress.percent !== null ? `${modelProgress.percent}%` : '…'}
            </span>
          </div>
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className={cn(
                'bg-primary h-full transition-all duration-300',
                modelProgress.percent === null && 'w-full animate-pulse'
              )}
              style={
                modelProgress.percent !== null ? { width: `${modelProgress.percent}%` } : undefined
              }
            />
          </div>
          {modelProgress.totalFiles ? (
            <span className="text-ql-11 text-muted-foreground">
              {modelProgress.currentIndex ?? 0}/{modelProgress.totalFiles} dosya
            </span>
          ) : null}
        </div>
      )}
      {modelProgress && modelProgress.phase === 'completed' && (
        <p className="text-ql-12 text-emerald-600 dark:text-emerald-400">
          {modelProgress.message ?? 'Modeller hazır ✓'}
        </p>
      )}
      {modelProgress && modelProgress.phase === 'failed' && (
        <p className="text-ql-12 text-destructive">
          {modelProgress.message ?? 'İndirme başarısız'}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onDownload}
          disabled={!isInstalled || pending}
          className="gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          <span>{t('docling_download_models', { defaultValue: 'Modelleri İndir' })}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRepair}
          disabled={!isInstalled || pending}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>{t('docling_repair_models', { defaultValue: 'Onar' })}</span>
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={!isInstalled || modelStatus?.status === 'missing' || pending}
          className="gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>{t('docling_delete_models', { defaultValue: 'Modelleri Sil' })}</span>
        </Button>
      </div>
      <p className="text-muted-foreground text-ql-11">
        Motoru kaldırmadan sadece modelleri temizleyebilirsiniz. Offline dönüşüm için modeller
        gereklidir.
      </p>
    </SurfaceCard>
  )
})

export default DoclingModelsCard
