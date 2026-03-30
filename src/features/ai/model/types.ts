import type { AutomationExecutionDiagnostics } from '@shared-core/types'

export interface AiSendStageTimings {
  queueWaitMs: number
  configResolveMs: number
  scriptGenerationMs?: number
  executeJavaScriptMs?: number
  clipboardMs?: number
  focusScriptGenerationMs?: number
  focusExecuteJavaScriptMs?: number
  refocusScriptGenerationMs?: number
  refocusExecuteJavaScriptMs?: number
  pasteMs?: number
  promptScriptGenerationMs?: number
  promptExecuteJavaScriptMs?: number
  postPastePromptDelayMs?: number
  imageUploadWaitMs?: number
  submitReadyScriptGenerationMs?: number
  submitReadyExecuteJavaScriptMs?: number
  clickScriptGenerationMs?: number
  clickExecuteJavaScriptMs?: number
  totalMs: number
}

export interface AiSendDiagnostics {
  pipeline: 'text' | 'image'
  tabId?: string
  currentAI: string
  currentUrl?: string
  autoSend: boolean
  timings: AiSendStageTimings
  script?: AutomationExecutionDiagnostics | null
  focusScript?: AutomationExecutionDiagnostics | null
  refocusScript?: AutomationExecutionDiagnostics | null
  promptScript?: AutomationExecutionDiagnostics | null
  submitReadyScript?: AutomationExecutionDiagnostics | null
  clickScript?: AutomationExecutionDiagnostics | null
}

export interface SendTextResult {
  success: boolean
  error?: string
  mode?: string
  actualUrl?: string
  diagnostics?: AiSendDiagnostics
}

export interface SendImageResult {
  success: boolean
  error?: string
  mode?: string
  actualUrl?: string
  diagnostics?: AiSendDiagnostics
}

export interface AiSendOptions {
  autoSend?: boolean
  /** Composer’dan tek seferlik: global otomatik gönder kapalı olsa da tarayıcıda gönder (tıkla) */
  forceAutoSend?: boolean
  promptText?: string
  /**
   * Görsel yapıştırdıktan sonra ek notu giriş alanının sonuna ekle (Quill/contenteditable uyumu).
   * false: tüm alanı yeniden yazmayı dene (eski mod). Varsayılan: true.
   */
  appendPromptAfterPaste?: boolean
}

export type AiSendResult = SendTextResult | SendImageResult
