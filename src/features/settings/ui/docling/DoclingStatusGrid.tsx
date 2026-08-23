import { HardDrive } from 'lucide-react'
import { useTranslation } from 'react-i18next'

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

interface Props {
  docling: { version?: string | null } | null | undefined
  serviceStatus: { state: string; diskUsageBytes: number | null } | null | undefined
  modelStatus: { status: string; diskBytes: number | null } | null | undefined
  isInstalled: boolean
}

export default function DoclingStatusGrid({
  docling,
  serviceStatus,
  modelStatus,
  isInstalled
}: Props) {
  const { t } = useTranslation()
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
      <div className="min-w-0">
        <dt className="text-muted-foreground text-ql-11">{t('docling_version')}</dt>
        <dd className="text-ql-12 truncate font-mono">
          {docling?.version ?? t('docling_not_available')}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-muted-foreground text-ql-11">{t('docling_runtime')}</dt>
        <dd className="text-ql-12 truncate">
          {serviceStatus
            ? t(`docling_state_${serviceStatus.state}`, { defaultValue: serviceStatus.state })
            : '-'}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-muted-foreground text-ql-11">Engine</dt>
        <dd className="text-ql-12">
          {isInstalled ? t('docling_installed') : t('docling_not_installed')}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-muted-foreground text-ql-11 flex items-center gap-1">
          <HardDrive className="h-3 w-3" />
          {t('docling_disk_usage')}
        </dt>
        <dd className="text-ql-12 font-mono">
          {formatBytes(serviceStatus?.diskUsageBytes ?? null)}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-muted-foreground text-ql-11 flex items-center gap-1">
          <HardDrive className="h-3 w-3" />
          {t('docling_models_size')}
        </dt>
        <dd className="text-ql-12 font-mono">{formatBytes(modelStatus?.diskBytes ?? null)}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-muted-foreground text-ql-11">{t('docling_models')}</dt>
        <dd className="text-ql-12">
          {modelStatus
            ? t(`docling_model_${modelStatus.status}`, { defaultValue: modelStatus.status })
            : t('docling_not_available')}
        </dd>
      </div>
    </dl>
  )
}

export { formatBytes }
