import type { CacheInfoResponse } from '@shared-core/types'

import { useConfirmDialog } from '@shared/hooks'

import type { TFunction } from 'i18next'
import { useCallback, useMemo } from 'react'

import { groupPartitionCacheRows, resolvePartitionCacheRows } from './cacheUsageSummary'

/**
 * Deep clean wipes every AI partition, which includes the Chromium profiles
 * behind the web logins. It is therefore never fired straight from a button:
 * the dialog names the sessions that will be signed out first.
 *
 * Session names come from the same partition rows the Storage tab renders, so
 * the warning cannot drift from what the user sees on disk.
 */
export function useDeepCleanConfirm({
  cacheInfo,
  t,
  onConfirm
}: {
  cacheInfo: CacheInfoResponse | undefined
  t: TFunction
  onConfirm: () => void
}) {
  const { confirm, props: confirmProps } = useConfirmDialog()

  const sessions = useMemo(() => {
    const groups = groupPartitionCacheRows(resolvePartitionCacheRows(cacheInfo, t), t)
    return [...new Set(groups.map((group) => group.label))]
  }, [cacheInfo, t])

  const requestDeepClean = useCallback(async () => {
    const confirmed = await confirm({
      title: t('deep_clean_confirm_title'),
      description:
        sessions.length > 0
          ? t('deep_clean_confirm_description', { sessions: sessions.join(', ') })
          : t('deep_clean_confirm_no_sessions'),
      confirmLabel: t('deep_clean_confirm_action'),
      cancelLabel: t('cancel'),
      variant: 'destructive'
    })
    if (confirmed) onConfirm()
  }, [confirm, onConfirm, sessions, t])

  return { requestDeepClean, confirmProps }
}
