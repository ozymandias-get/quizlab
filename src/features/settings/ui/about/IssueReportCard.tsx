import { memo, useCallback, useState } from 'react'
import { InfoIcon } from '@ui/components/Icons'
import { createIssueLogReport, Logger } from '@shared/lib/logger'
import { useToast } from '@app/providers/ToastContext'
import AboutActionCard from './AboutActionCard'

interface IssueReportCardProps {
  t: (key: string) => string
  appVersion: string
}

async function copyToClipboard(text: string): Promise<void> {
  const errors: string[] = []

  if (typeof window !== 'undefined' && window.electronAPI?.copyTextToClipboard) {
    try {
      const copied = await window.electronAPI.copyTextToClipboard(text)
      if (copied) return
      errors.push('IPC returned false')
    } catch (error) {
      errors.push(`IPC error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch (error) {
      errors.push(
        `navigator.clipboard error: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'absolute'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (copied) return
    errors.push('document.execCommand returned false')
  } catch (error) {
    errors.push(`execCommand error: ${error instanceof Error ? error.message : String(error)}`)
  }

  throw new Error(errors.join(' | ') || 'clipboard copy failed')
}

const IssueReportCard = memo(({ t, appVersion }: IssueReportCardProps) => {
  const [isCopying, setIsCopying] = useState(false)
  const { showSuccess, showError } = useToast()

  const handleCopy = useCallback(async () => {
    if (isCopying) return
    setIsCopying(true)

    try {
      const report = createIssueLogReport({
        appVersion,
        language: typeof navigator !== 'undefined' ? navigator.language : 'unknown'
      })
      await copyToClipboard(report)
      showSuccess(t('toast_logs_copied'), t('toast_system_title'))
    } catch (error) {
      Logger.error('[IssueReportCard] Clipboard copy failed:', error)
      showError(t('error_clipboard_failed'), t('toast_system_title'))
    } finally {
      setIsCopying(false)
    }
  }, [appVersion, isCopying, showError, showSuccess, t])

  return (
    <AboutActionCard
      title={t('report_issue_title')}
      description={t('report_issue_desc')}
      trailing={
        <button
          onClick={handleCopy}
          disabled={isCopying}
          className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-5 py-2.5 text-xs font-bold text-blue-400 transition-all hover:bg-blue-500/20 disabled:opacity-60"
        >
          <InfoIcon className="w-4 h-4" />
          {isCopying ? t('loading') : t('copy_logs')}
        </button>
      }
    />
  )
})

IssueReportCard.displayName = 'IssueReportCard'

export default IssueReportCard
