import { useCacheInfo } from '@platform/electron/api/useSettingsSystemApi'

import { useToastActions } from '@shared/stores/toastStore'

import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const MAX_TOTAL_CACHE_BYTES = 500 * 1024 * 1024 // 500 MB
const WARNING_THRESHOLD = MAX_TOTAL_CACHE_BYTES * 0.8 // 400 MB

/**
 * Önbellek boyutunu izler ve %80 eşiği aşıldığında kullanıcıya uyarı toast'ı gösterir.
 * Uyarı oturum başına yalnızca bir kez gösterilir.
 */
export function useCacheThresholdWarning(): void {
  const { data: cacheInfo } = useCacheInfo()
  const { showWarning } = useToastActions()
  const { t } = useTranslation()
  const hasWarnedRef = useRef(false)

  useEffect(() => {
    if (hasWarnedRef.current) return
    if (!cacheInfo?.breakdown?.total) return

    const total = cacheInfo.breakdown.total
    if (total > WARNING_THRESHOLD) {
      hasWarnedRef.current = true

      const usedMb = (total / (1024 * 1024)).toFixed(1)
      const limitMb = (MAX_TOTAL_CACHE_BYTES / (1024 * 1024)).toFixed(0)

      showWarning(
        t('toast_cache_warning_message', {
          used: usedMb,
          limit: limitMb
        }),
        t('toast_cache_warning_title')
      )
    }
  }, [cacheInfo, showWarning, t])
}
