import { getElectronApi, hasElectronApi } from '@shared/lib/electronApi'
import { ensureErrorMessage } from '@shared/lib/errorUtils'
import { createIssueLogReport, Logger } from '@shared/lib/logger'
import { useToastActions } from '@shared/stores/toastStore'
import { Button } from '@shared/ui/components/primitives'

import { ChevronDown, Copy, Loader2 } from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'

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
      errors.push(`navigator.clipboard error: ${ensureErrorMessage(error)}`)
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
    errors.push(`execCommand error: ${ensureErrorMessage(error)}`)
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
      errors.push(`IPC error: ${ensureErrorMessage(error)}`)
    }
  }

  throw new Error(errors.join(' | ') || 'clipboard copy failed')
}

const IssueReportCard = memo(({ t, appVersion }: IssueReportCardProps) => {
  const [isCopying, setIsCopying] = useState(false)
  const { showSuccess, showError } = useToastActions()

  // The exact text that will be written to the clipboard, so the disclosure
  // below can show it before the user commits.
  const report = useMemo(
    () =>
      createIssueLogReport({
        appVersion: appVersion ?? 'unknown',
        language: typeof navigator !== 'undefined' ? navigator.language : 'unknown'
      }),
    [appVersion]
  )

  const handleCopy = useCallback(async () => {
    if (isCopying) return
    setIsCopying(true)

    try {
      await copyToClipboard(report)
      showSuccess(t('toast_logs_copied'), t('toast_system_title'))
    } catch (error) {
      Logger.error('[IssueReportCard] Clipboard copy failed:', error)
      showError(t('error_clipboard_failed'), t('toast_system_title'))
    } finally {
      setIsCopying(false)
    }
  }, [isCopying, report, showError, showSuccess, t])

  return (
    <>
      <AboutActionCard
        title={t('report_issue_title')}
        description={t('report_issue_desc')}
        trailing={
          <Button
            type="button"
            onClick={handleCopy}
            disabled={isCopying}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            {isCopying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className="text-ql-12 font-medium">
              {isCopying ? t('loading') : t('copy_logs')}
            </span>
          </Button>
        }
      />

      <details className="group mt-2 rounded-xl border border-white/[0.07] bg-zinc-950/40">
        <summary className="text-ql-11 text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 font-medium select-none">
          {t('preview_report_data')}
          <ChevronDown className="size-3.5 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <pre className="custom-scrollbar text-ql-11 text-muted-foreground max-h-56 overflow-auto border-t border-white/[0.07] p-3 font-mono break-words whitespace-pre-wrap">
          {report}
        </pre>
      </details>
    </>
  )
})

IssueReportCard.displayName = 'IssueReportCard'

export default IssueReportCard
