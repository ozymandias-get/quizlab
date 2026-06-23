import type { AiPlatform } from '@shared-core/types'
import type { TextInputMode } from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'

import type { QueryClient } from '@tanstack/react-query'
import type { RefObject } from 'react'

import type { AiSendDiagnostics, SendTextResult } from '../../model/types'
import type { ConfigCache } from '../aiSenderSupport'
import { toAutomationConfig } from '../aiSenderSupport'
import { buildPromptText, mergePromptText } from '../aiSenderSupport'
import { executePipelineStep } from './pipelineUtils'
import { isSendError, resolveSendContext } from './resolveSendContext'
import { cloneScriptDiagnostics } from './scriptExecution'
import { attachDiagnostics, nowMs, roundMs } from './sendDiagnostics'

interface TextSendPipelineParams {
  webviewRef: RefObject<WebviewController | null>
  webview: WebviewController
  scheduledWebview: WebviewController
  aiRegistry: Record<string, AiPlatform> | null
  currentAI: string
  queryClient: QueryClient
  configCache: ConfigCache
  activePromptText: string | null
  promptText?: string
  text: string
  effectiveAutoSend: boolean
  textInputMode: TextInputMode
  typingSpeed: number
  requestStartedAt: number
  diagnostics: AiSendDiagnostics
  canUseWebview: (webview: WebviewController, expected?: WebviewController | null) => boolean
  generateAutoSendScript: (params: {
    config: ReturnType<typeof toAutomationConfig>
    text: string
    submit: boolean
    append?: boolean
    textInputMode?: TextInputMode
    typingSpeed?: number
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
    textInputMode,
    typingSpeed,
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

  const finalText = buildPromptText(text, mergePromptText(activePromptText, promptText))

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
        submit: effectiveAutoSend,
        append: true,
        textInputMode,
        typingSpeed
      }),
    onTiming: (ms) => (diagnostics.timings.scriptGenerationMs = ms),
    onExecuteTiming: (ms) => (diagnostics.timings.executeJavaScriptMs = ms),
    onResult: (res) => (diagnostics.script = cloneScriptDiagnostics(res?.diagnostics))
  })

  if (!sendStep.success) {
    return sendStep.error
  }

  return attachDiagnostics(
    {
      success: true,
      mode: sendStep.scriptResult?.mode || resolved.aiConfig.submitMode
    },
    diagnostics,
    requestStartedAt
  )
}
