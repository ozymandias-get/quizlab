import { getElectronApi, hasElectronApi } from '@shared/lib/electronApi'
import { createIssueLogReport, Logger } from '@shared/lib/logger'
import { useToastActions } from '@shared/stores/toastStore'
import { InfoIcon } from '@ui/components/Icons'

import { memo, useCallback, useState } from 'react'

import AboutActionCard from './AboutActionCard'

interface IssueReportCardProps {
  t: (key: string) => string
  appVersion: string | null
}

/**
 * Küçük bir gecikme — transient activation'ın sıfırlanmasına veya
 * event loop'un temizlenmesine zaman tanır.
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function copyToClipboard(text: string): Promise<void> {
  const errors: string[] = []

  // ── Strateji 1: navigator.clipboard.writeText ─────────────────────
  // En basit ve en doğrudan API. Hem Electron'da hem tarayıcıda çalışır.
  // Güvenli context (https/localhost) ve kullanıcı jesti (click) gerektirir.
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

  // ── Strateji 2: document.execCommand('copy') ─────────────────────
  // navigator.clipboard'tan farklı bir mekanizma kullanır; transient
  // activation veya Permissions API gerektirmez. Tarayıcı uyumluluğu
  // daha geniştir ancak Electron'un güvenlik kısıtlamalarına takılabilir.
  // Hafif bir gecikme, bir önceki stratejinin olası kilitlenmelerinden
  // kurtulmaya yardımcı olur.
  await delay(10)
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

  // ── Strateji 3: IPC (Electron main process) ──────────────────────
  // Renderer işlemindeki DOM/güvenlik kısıtlamalarını aşar, doğrudan
  // main process'te clipboard.writeText() çağırır. Sadece gerçek
  // Electron'da çalışır (browser stub'larda bu strateji yok sayılır).
  const electronApi = hasElectronApi() ? getElectronApi() : null
  if (electronApi) {
    await delay(10)
    try {
      const copied = await electronApi.copyTextToClipboard(text)
      if (copied) return
      errors.push('IPC returned false')
    } catch (error) {
      errors.push(`IPC error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  throw new Error(errors.join(' | ') || 'clipboard copy failed')
}

const IssueReportCard = memo(({ t, appVersion }: IssueReportCardProps) => {
  const [isCopying, setIsCopying] = useState(false)
  const { showSuccess, showError } = useToastActions()

  const handleCopy = useCallback(async () => {
    if (isCopying) return
    setIsCopying(true)

    try {
      const report = createIssueLogReport({
        appVersion: appVersion ?? 'unknown',
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
          type="button"
          onClick={handleCopy}
          disabled={isCopying}
          className="text-ql-11 flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-5 py-2.5 font-semibold text-blue-400 transition-colors hover:bg-blue-500/20 disabled:opacity-60"
        >
          <InfoIcon className="h-4 w-4" />
          {isCopying ? t('loading') : t('copy_logs')}
        </button>
      }
    />
  )
})

IssueReportCard.displayName = 'IssueReportCard'

export default IssueReportCard
