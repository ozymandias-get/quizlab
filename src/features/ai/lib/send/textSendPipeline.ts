import type { RefObject } from 'react'
import type { AiSendDiagnostics, SendTextResult } from '../../model/types'
import type { WebviewController } from '@shared-core/types/webview'
import { toAutomationConfig, type AiConfig } from '../aiSenderSupport'
import { buildPromptText, mergePromptText } from '../aiSenderSupport'
import { cloneScriptDiagnostics } from './scriptExecution'
import { attachDiagnostics, nowMs, roundMs } from './sendDiagnostics'
import { isSendError, resolveSendContext } from './resolveSendContext'
import type { QueryClient } from '@tanstack/react-query'
import type { ConfigCache } from '../aiSenderSupport'
import { executePipelineStep } from './pipelineUtils'

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

export async function executeTextSendPipeline(
  params: TextSendPipelineParams
): Promise<SendTextResult> {
  const {
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
  } = params

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

  const sendStep = await executePipelineStep<SendTextResult>({
    name: 'Script',
    webview,
    scheduledWebview,
    diagnostics,
    requestStartedAt,
    canUseWebview,
    generateScript: () =>
      generateAutoSendScript({
        config: toAutomationConfig(resolved.aiConfig),
        text: finalText,
        submit: effectiveAutoSend
      }),
    onTiming: (ms) => (diagnostics.timings.scriptGenerationMs = ms),
    onExecuteTiming: (ms) => (diagnostics.timings.executeJavaScriptMs = ms),
    onResult: (res) => (diagnostics.script = cloneScriptDiagnostics(res?.diagnostics))
  })

  if (!sendStep.success) return sendStep.error

  return attachDiagnostics(
    {
      success: true,
      mode: sendStep.scriptResult?.mode || resolved.aiConfig.submitMode
    },
    diagnostics,
    requestStartedAt
  )
}
