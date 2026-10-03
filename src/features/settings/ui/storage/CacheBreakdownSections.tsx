/**
 * The two cache lists: the app's own root caches, and the per-AI-partition
 * breakdown with its per-row clear action.
 */
import { cn } from '@shared/lib/uiUtils'
import { SettingsSection } from '@shared/ui/components/primitives'

import type { TFunction } from 'i18next'
import { FolderTree, Layers } from 'lucide-react'
import { memo } from 'react'

import type { PartitionCacheRow } from './cacheUsageSummary'
import { PartitionRow, RootCacheRow } from './StorageComponents'

/** Nested list surface: recessed inside a section card, so it never uses `bg-card`. */
const INSET_LIST = 'border-border/60 bg-background/40 rounded-xl border'

export const RootCacheSection = memo(function RootCacheSection({
  chromiumCache,
  codeCache,
  gpuCache,
  tempFiles,
  t
}: {
  chromiumCache: number
  codeCache: number
  gpuCache: number
  tempFiles: number
  t: TFunction
}) {
  return (
    <SettingsSection icon={<FolderTree className="h-4 w-4" />} title={t('root_caches')}>
      <div className={cn(INSET_LIST, 'space-y-3 p-4')}>
        <RootCacheRow label={t('browser_cache')} size={chromiumCache} />
        <RootCacheRow label={t('code_cache')} size={codeCache} />
        <RootCacheRow label={t('gpu_cache')} size={gpuCache} />
        {tempFiles > 0 && <RootCacheRow label={t('temp_files')} size={tempFiles} />}
      </div>
    </SettingsSection>
  )
})

export const PartitionCacheSection = memo(function PartitionCacheSection({
  rows,
  onClearPartition,
  t
}: {
  rows: PartitionCacheRow[]
  onClearPartition: (partitionKey: string) => void
  t: TFunction
}) {
  return (
    <SettingsSection
      icon={<Layers className="h-4 w-4" />}
      title={t('ai_partitions_count', { count: rows.length })}
    >
      <div className={cn(INSET_LIST, 'divide-border/60 divide-y overflow-hidden')}>
        {rows.map(({ key, label, size, category, lastActive }) => (
          <PartitionRow
            key={key}
            partitionKey={key}
            label={label}
            size={size}
            category={category}
            lastActive={lastActive}
            onClear={() => onClearPartition(key)}
            t={t}
          />
        ))}
      </div>
      <p className="text-ql-11 text-muted-foreground">
        {t('storage_partition_summary', {
          smart: t('smart_cache_desc'),
          cold: rows.filter((row) => row.category === 'cold').length,
          idle: rows.filter((row) => row.category === 'passive').length,
          active: rows.filter((row) => row.category === 'active').length
        })}
      </p>
    </SettingsSection>
  )
})
