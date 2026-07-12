import { ensureErrorMessage } from '@shared/lib/errorUtils'
import { Logger } from '@shared/lib/logger'

import type { AiSendDiagnostics } from '../model/types'
import { attachDiagnostics } from './send/sendDiagnostics'
import { normalizeSendErrorCode } from './sendUtils'

export function handlePipelineError(
  error: unknown,
  diagnostics: AiSendDiagnostics,
  startedAt: number,
  context: string
) {
  const message = ensureErrorMessage(error)
  if (!message.includes('webview_not_ready') && !message.includes('webview_destroyed')) {
    Logger.error(`[useAiSender] ${context} error:`, error)
  }

  return attachDiagnostics(
    {
      success: false,
      error: normalizeSendErrorCode(message, 'send_failed')
    },
    diagnostics,
    startedAt
  )
}
