import type { PdfTab } from '@features/pdf/hooks/types'

import { getAiIcon } from '@ui/components/Icons'

import { FileText } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export function usePdfTabStripDerived(tabs: PdfTab[], activeTabId: string) {
  const { t } = useTranslation()

  const tr = useCallback(
    (key: string, fallback: string) => {
      const translated = t(key)
      return translated === key ? fallback : translated
    },
    [t]
  )

  const getTabLabel = useCallback(
    (tab: PdfTab) => tab.title || tab.file?.name || tr('new_tab_title', 'New Tab'),
    [tr]
  )

  const getTabIcon = useCallback((tab: PdfTab) => {
    if (tab.kind === 'drive') {
      return (
        getAiIcon('gdrive') || <FileText className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
      )
    }
    return <FileText className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
  }, [])

  const pdfHomeTabId = useMemo(() => {
    if (!tabs || tabs.length === 0) return ''
    const landing = tabs.find((tab) => !tab.file && tab.kind !== 'drive')
    return landing?.id ?? ''
  }, [tabs])

  const isPdfHomeActive = pdfHomeTabId !== '' && activeTabId === pdfHomeTabId

  return { t, tr, getTabLabel, getTabIcon, pdfHomeTabId, isPdfHomeActive }
}
