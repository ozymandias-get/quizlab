/**
 * The two cache lists: the app's own root caches, and the per-AI-partition
 * breakdown with its per-row clear action.
 */
import { formatBytes } from '@shared/lib/formatUtils'
import { cn } from '@shared/lib/uiUtils'
import { SettingsSection } from '@shared/ui/components/primitives'

import type { TFunction } from 'i18next'
import { ChevronDown, FolderTree, Layers } from 'lucide-react'
import { memo } from 'react'

import type { PartitionCacheRow } from './cacheUsageSummary'
import { groupPartitionCacheRows } from './cacheUsageSummary'
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
  const groups = groupPartitionCacheRows(rows, t)
  return (
    <SettingsSection
      icon={<Layers className="h-4 w-4" />}
      title={t('storage_services_count', { count: groups.length })}
    >
      <div className={cn(INSET_LIST, 'divide-border/60 divide-y overflow-hidden')}>
        {groups.map((group) =>
          group.rows.length === 1 ? (
            <PartitionRow
              key={group.key}
              label={group.rows[0].label}
              size={group.rows[0].size}
              category={group.rows[0].category}
              lastActive={group.rows[0].lastActive}
              onClear={() => onClearPartition(group.rows[0].key)}
              t={t}
            />
          ) : (
            <details key={group.key} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline focus-visible:outline-2">
                <ChevronDown
                  aria-hidden
                  className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                />
                <span className="text-ql-12 text-foreground min-w-0 flex-1 truncate font-medium">
                  {group.label}
                </span>
                <span className="text-ql-11 text-muted-foreground">
                  {t('storage_profiles_count', { count: group.rows.length })}
                </span>
                <span className="text-ql-12 text-muted-foreground font-mono tabular-nums">
                  {formatBytes(group.size)}
                </span>
              </summary>
              <div className="divide-border/60 border-border/60 divide-y border-t pl-4">
                {group.rows.map((row) => (
                  <PartitionRow
                    key={row.key}
                    label={row.label}
                    size={row.size}
                    category={row.category}
                    lastActive={row.lastActive}
                    onClear={() => onClearPartition(row.key)}
                    t={t}
                  />
                ))}
              </div>
            </details>
          )
        )}
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
