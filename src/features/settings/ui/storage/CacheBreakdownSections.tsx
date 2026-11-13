/**
 * The two cache lists: the app's own root caches, and the per-AI-partition
 * breakdown with its per-row clear action.
 */
import { formatBytes } from '@shared/lib/formatUtils'
import { cn } from '@shared/lib/uiUtils'
import { CollapsiblePanel, SettingsSection } from '@shared/ui/components/primitives'

import type { TFunction } from 'i18next'
import { ChevronDown, FolderTree, Layers } from 'lucide-react'
import { memo, useId, useState } from 'react'

import type { PartitionCacheRow } from './cacheUsageSummary'
import { groupPartitionCacheRows } from './cacheUsageSummary'
import { PartitionRow, RootCacheRow } from './StorageComponents'

/** Nested list surface: recessed inside a section card, so it never uses `bg-card`. */
const INSET_LIST = 'border-white/[0.07] bg-zinc-950/40 rounded-xl border'

type PartitionGroupModel = ReturnType<typeof groupPartitionCacheRows>[number]

/**
 * A multi-profile partition group. Kept as a disclosure (not a native
 * `<details>`) so the body can use the shared accordion motion: the native
 * element hides its content before an exit transition can run.
 */
const PartitionGroup = memo(function PartitionGroup({
  group,
  onClearPartition,
  t
}: {
  group: PartitionGroupModel
  onClearPartition: (partitionKey: string) => void
  t: TFunction
}) {
  const [isOpen, setIsOpen] = useState(false)
  const panelId = useId()

  return (
    <div>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
        className="focus-visible:ring-ring/70 flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors select-none hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:outline-none"
      >
        <ChevronDown
          aria-hidden
          className={`motion-slow h-4 w-4 shrink-0 transition-transform ease-in-out motion-reduce:transition-none ${
            isOpen ? 'rotate-180' : ''
          }`}
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
      </button>

      <CollapsiblePanel isOpen={isOpen}>
        <div id={panelId} className="divide-y divide-white/5 border-t border-white/[0.07] pl-4">
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
      </CollapsiblePanel>
    </div>
  )
})

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
      <div className={cn(INSET_LIST, 'divide-y divide-white/5 overflow-hidden')}>
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
            <PartitionGroup
              key={group.key}
              group={group}
              onClearPartition={onClearPartition}
              t={t}
            />
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
