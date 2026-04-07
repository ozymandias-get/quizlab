import type { RefObject } from 'react'
import type { AiSendDiagnostics, SendTextResult } from '../../model/types'
import type { WebviewController } from '@shared-core/types/webview'
import { normalizeSendErrorCode, toAutomationConfig, type AiConfig } from '../aiSenderSupport'
import { buildPromptText, mergePromptText } from '../aiSenderSupport'
import { cloneScriptDiagnostics, normalizeExecutionResult } from './scriptExecution'
import { attachDiagnostics, nowMs, roundMs } from './sendDiagnostics'
import { isSendError, resolveSendContext } from './resolveSendContext'
import type { QueryClient } from '@tanstack/react-query'
import type { ConfigCache } from '../aiSenderSupport'

interface TextSendPipelineParams {
  webviewRef: RefObject<WebviewController | null>
  webview: WebviewController
  scheduledWebview: WebviewController
  aiRegistry: Record<string, AiConfig> | null
  currentAI: string
  queryClient: QueryClient
  configCache: ConfigCache
  activePromptText: string | null
  promptText?: string
  text: string
  effectiveAutoSend: boolean
  requestStartedAt: number
  diagnostics: AiSendDiagnostics
  canUseWebview: (webview: WebviewController, expected?: WebviewController | null) => boolean
  generateAutoSendScript: (params: {
    config: ReturnType<typeof toAutomationConfig>
    text: string
    submit: boolean
    append?: boolean
  }) => Promise<string | null>
}

export async function executeTextSendPipeline({
  webviewRef,
  webview,
  scheduledWebview,
  aiRegistry,
  currentAI,
  queryClient,
  configCache,
  activePromptText,
  promptText,
  text,
  effectiveAutoSend,
  requestStartedAt,
  diagnostics,
  canUseWebview,
  generateAutoSendScript
}: TextSendPipelineParams): Promise<SendTextResult> {
  const resolveStartedAt = nowMs()
  const resolved = await resolveSendContext({
    webviewRef,
    webview,
    scheduledWebview,
    aiRegistry,
    currentAI,
    queryClient,
    configCache
  })
  diagnostics.timings.configResolveMs = roundMs(nowMs() - resolveStartedAt)

  if (isSendError(resolved)) {
    if (resolved.actualUrl) {
      diagnostics.currentUrl = resolved.actualUrl
    }
    return attachDiagnostics(resolved, diagnostics, requestStartedAt)
  }

  diagnostics.currentUrl = resolved.currentUrl

  const finalPromptText = mergePromptText(activePromptText, promptText)
  const finalText = buildPromptText(text, finalPromptText)

  const scriptGenerationStartedAt = nowMs()
  const script = await generateAutoSendScript({
    config: toAutomationConfig(resolved.aiConfig),
    text: finalText,
    submit: effectiveAutoSend
  })
  diagnostics.timings.scriptGenerationMs = roundMs(nowMs() - scriptGenerationStartedAt)

  if (!script) {
    return attachDiagnostics(
      { success: false, error: 'script_generation_failed' },
      diagnostics,
      requestStartedAt
    )
  }

  if (!canUseWebview(webview, scheduledWebview)) {
    return attachDiagnostics(
      { success: false, error: 'webview_destroyed' },
      diagnostics,
      requestStartedAt
    )
  }

  const executeStartedAt = nowMs()
  const rawResult = await webview.executeJavaScript(script)
  diagnostics.timings.executeJavaScriptMs = roundMs(nowMs() - executeStartedAt)

  const scriptResult = normalizeExecutionResult(rawResult)
  diagnostics.script = cloneScriptDiagnostics(scriptResult?.diagnostics)

  if (!scriptResult || scriptResult.success === false) {
    return attachDiagnostics(
      {
        success: false,
        error: normalizeSendErrorCode(scriptResult?.error, 'script_failed')
      },
      diagnostics,
      requestStartedAt
    )
  }

  return attachDiagnostics(
    {
      success: true,
      mode: scriptResult.mode || resolved.aiConfig.submitMode
    },
    diagnostics,
    requestStartedAt
  )
}
