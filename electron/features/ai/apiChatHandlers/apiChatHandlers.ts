import { IPC_CHANNELS } from '../../../../shared/constants/ipcChannels.js'
import { failure, success } from '../../../../shared/lib/typedIpc.js'
import type {
  ApiChatMessage,
  ApiConfig,
  ApiProviderConfig
} from '../../../../shared/types/index.js'
import { requireTrustedIpcSender } from '../../../core/ipcSecurity.js'
import { Logger } from '../../../core/logger.js'
import { registerIpcHandler } from '../../../core/typedIpcMain.js'
import { loadConfig, sanitizeApiKey, saveConfig } from './config.js'
import type { SsrProtectionOptions } from './ssrf.js'
import { fetchWithSsrProtection, validateProviderUrl } from './ssrf.js'
import type { ChatCompletionBody, ChatContentItem, ModelListItem } from './validation.js'
import { MAX_REQUEST_BODY_SIZE, sanitizeChatMessage } from './validation.js'

function getSsrOptionsForProvider(provider: ApiProviderConfig): SsrProtectionOptions | undefined {
  const allow =
    provider.allowLocalNetwork === true ||
    (provider as ApiProviderConfig).allowLocalEndpoints === true ||
    (provider as ApiProviderConfig).isCustomProvider === true ||
    provider.providerType === 'custom'
  return allow ? { allowLocalNetwork: true } : undefined
}

/** Hard cap for the renderer-composed system prompt forwarded per request. */
const MAX_SYSTEM_PROMPT_LENGTH = 20_000

/**
 * In-flight chat requests keyed by requestId. Each tab sends with its own
 * requestId, so concurrent tabs never abort each other; CANCEL targets a
 * single request by id (or every active request when no id is given).
 */
let activeRequestControllers = new Map<string, AbortController>()
let autoRequestIdCounter = 0
let activeModelFetchController: AbortController | null = null
let handlersRegistered = false

export function registerApiChatHandlers() {
  if (handlersRegistered) return
  handlersRegistered = true

  registerIpcHandler(
    IPC_CHANNELS.GET_API_CHAT_CONFIG,
    async () => success(await loadConfig()),
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.CANCEL_API_CHAT_REQUEST,
    (_event, requestId?: string) => {
      if (requestId !== undefined) {
        const controller = activeRequestControllers.get(requestId)
        if (controller) {
          controller.abort()
          activeRequestControllers.delete(requestId)
          Logger.info('[apiChatHandlers] API request cancelled by user', { requestId })
          return success(true)
        }
        return success(false)
      }

      // Legacy / global stop: abort every in-flight request.
      if (activeRequestControllers.size > 0) {
        for (const controller of activeRequestControllers.values()) {
          controller.abort()
        }
        activeRequestControllers.clear()
        Logger.info('[apiChatHandlers] All API requests cancelled by user')
        return success(true)
      }
      return success(false)
    },
    requireTrustedIpcSender,
    success(false)
  )

  registerIpcHandler(
    IPC_CHANNELS.SAVE_API_CHAT_CONFIG,
    async (event, config: ApiConfig) => {
      if (config?.providers?.length) {
        for (const provider of config.providers) {
          const ssrOptions = getSsrOptionsForProvider(provider)
          const err = validateProviderUrl(provider.baseUrl || '', ssrOptions)
          if (err) {
            Logger.warn(`[apiChatHandlers] Rejected provider "${provider.name}": ${err}`)
            return success(false)
          }
        }
      }

      return success(await saveConfig(config))
    },
    requireTrustedIpcSender,
    success(false)
  )

  registerIpcHandler(
    IPC_CHANNELS.SEND_API_CHAT_REQUEST,
    async (
      event,
      messages: ApiChatMessage[],
      selectedModel?: string,
      generalPrompt?: string,
      providerId?: string,
      requestId?: string
    ) => {
      const config = await loadConfig()
      const provider = config.providers.find(
        (p) => p.id === (providerId || config.selectedProviderId)
      )
      if (!provider) return failure('invalid_input', 'Provider not configured')

      const chatSsrOptions = getSsrOptionsForProvider(provider)
      const ssrfErr = validateProviderUrl(provider.baseUrl, chatSsrOptions)
      if (ssrfErr) {
        Logger.warn(`[apiChatHandlers] SSRF blocked for provider "${provider.name}": ${ssrfErr}`)
        return failure('invalid_input', 'Provider configuration rejected for security reasons')
      }

      const model = selectedModel || provider.defaultModel
      const baseUrl = provider.baseUrl.replace(/\/+$/, '')

      const resolvedRequestId = requestId ?? `auto-${Date.now()}-${++autoRequestIdCounter}`
      const controller = new AbortController()
      activeRequestControllers.set(resolvedRequestId, controller)

      const requestTimeout = provider.requestTimeout ?? 60000
      let abortedByTimeout = false
      const timeoutId = setTimeout(() => {
        abortedByTimeout = true
        controller.abort()
      }, requestTimeout)

      const safeApiKey = sanitizeApiKey(provider.apiKey || '')
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      if (safeApiKey) {
        headers['Authorization'] = `Bearer ${safeApiKey}`
      }

      try {
        // Prefer the prompt composed by the renderer for THIS send (it may
        // include per-send overrides); fall back to the on-disk config only
        // when the caller did not pass one.
        const systemContent =
          typeof generalPrompt === 'string' && generalPrompt.trim().length > 0
            ? generalPrompt.slice(0, MAX_SYSTEM_PROMPT_LENGTH)
            : [
                config.memoryPrompt && `[User Info]\n${config.memoryPrompt}`,
                config.characterPrompt && `[Character]\n${config.characterPrompt}`,
                config.generalPrompt && `[System]\n${config.generalPrompt}`
              ]
                .filter(Boolean)
                .join('\n\n')
        const systemMessages = systemContent ? [{ role: 'system', content: systemContent }] : []

        const safeMessages = messages
          .map((m) => sanitizeChatMessage(m))
          .filter((m): m is NonNullable<ReturnType<typeof sanitizeChatMessage>> => m !== null)

        if (safeMessages.length === 0) {
          return failure('invalid_input', 'No valid user messages to send')
        }

        const body: ChatCompletionBody = {
          model,
          messages: [
            ...systemMessages,
            ...safeMessages.map(({ role, content, images }) => {
              if (images && images.length > 0) {
                const contentArray: ChatContentItem[] = [{ type: 'text', text: content }]
                for (const img of images) {
                  contentArray.push({
                    type: 'image_url',
                    image_url: { url: img }
                  })
                }
                return { role, content: contentArray }
              }
              return { role, content }
            })
          ]
        }

        const bodyJson = JSON.stringify(body)
        if (Buffer.byteLength(bodyJson, 'utf-8') > MAX_REQUEST_BODY_SIZE) {
          const sizeMb = (Buffer.byteLength(bodyJson, 'utf-8') / (1024 * 1024)).toFixed(1)
          Logger.warn(`[apiChatHandlers] Request body too large: ${sizeMb} MB`)
          return failure(
            'invalid_input',
            `Request body too large (${sizeMb} MB). Reduce the number of attached images or shorten the message.`
          )
        }

        const response = await fetchWithSsrProtection(
          `${baseUrl}/chat/completions`,
          {
            method: 'POST',
            headers,
            body: bodyJson,
            signal: controller.signal
          },
          chatSsrOptions
        )

        if (!response.ok) {
          const errorText = await response.text()
          return failure('internal_error', `API error: ${response.status} ${errorText}`)
        }

        const data = await response.json()
        const reply = data.choices?.[0]?.message?.content || ''

        return success({
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: reply,
          timestamp: Date.now(),
          model,
          providerId: provider.id
        } satisfies ApiChatMessage)
      } catch (err: unknown) {
        if (controller.signal.aborted && !abortedByTimeout) {
          Logger.info('[apiChatHandlers] API request aborted by user')
          return failure('cancelled', 'Request cancelled')
        }
        if (err instanceof Error && err.name === 'AbortError') {
          return failure(
            'internal_error',
            `API Request timed out after ${Math.round(requestTimeout / 1000)} seconds`
          )
        }
        return failure('internal_error', err instanceof Error ? err.message : String(err))
      } finally {
        clearTimeout(timeoutId)
        if (activeRequestControllers.get(resolvedRequestId) === controller) {
          activeRequestControllers.delete(resolvedRequestId)
        }
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.FETCH_API_CHAT_MODELS,
    async (event, providerId?: string) => {
      const config = await loadConfig()
      const provider = config.providers.find(
        (p) => p.id === (providerId || config.selectedProviderId)
      )
      if (!provider) return failure('invalid_input', 'Provider not configured')

      const modelSsrOptions = getSsrOptionsForProvider(provider)
      const ssrfErr = validateProviderUrl(provider.baseUrl, modelSsrOptions)
      if (ssrfErr) {
        Logger.warn(`[apiChatHandlers] SSRF blocked for provider "${provider.name}": ${ssrfErr}`)
        return failure('invalid_input', 'Provider configuration rejected for security reasons')
      }

      const baseUrl = provider.baseUrl.replace(/\/+$/, '')

      const headers: Record<string, string> = {}
      if (provider.apiKey) {
        headers['Authorization'] = `Bearer ${sanitizeApiKey(provider.apiKey)}`
      }

      const controller = new AbortController()
      if (activeModelFetchController) {
        activeModelFetchController.abort()
      }
      activeModelFetchController = controller
      const fetchTimeout =
        provider.requestTimeout != null ? Math.min(provider.requestTimeout, 30000) : 15000
      let fetchAbortedByTimeout = false
      const timeoutId = setTimeout(() => {
        fetchAbortedByTimeout = true
        controller.abort()
      }, fetchTimeout)

      try {
        const response = await fetchWithSsrProtection(
          `${baseUrl}/models`,
          {
            headers,
            signal: controller.signal
          },
          modelSsrOptions
        )

        if (!response.ok) {
          return failure('internal_error', `Failed to fetch models: ${response.status}`)
        }

        const data = await response.json()
        if (!data || typeof data !== 'object' || !Array.isArray(data.data)) {
          return failure('internal_error', 'Invalid API response: expected { data: [...] }')
        }
        return success(data.data.map((m: ModelListItem) => m.id))
      } catch (err: unknown) {
        if (controller.signal.aborted && !fetchAbortedByTimeout) {
          Logger.info('[apiChatHandlers] Model fetch aborted by user')
          return failure('cancelled', 'Request cancelled')
        }
        if (err instanceof Error && err.name === 'AbortError') {
          return failure('internal_error', 'Failed to fetch models: Request timed out')
        }
        return failure('internal_error', err instanceof Error ? err.message : String(err))
      } finally {
        clearTimeout(timeoutId)
        if (activeModelFetchController === controller) {
          activeModelFetchController = null
        }
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )
}
