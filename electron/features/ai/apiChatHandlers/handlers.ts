import { IPC_CHANNELS } from '../../../../shared/constants/ipc-channels.js'
import { failure, success } from '../../../../shared/lib/typedIpc.js'
import type { ApiChatMessage, ApiConfig } from '../../../../shared/types/index.js'
import { requireTrustedIpcSender } from '../../../core/ipcSecurity.js'
import { Logger } from '../../../core/logger.js'
import { registerIpcHandler } from '../../../core/typedIpcMain.js'
import { loadConfig, sanitizeApiKey, saveConfig } from './config.js'
import { validateProviderUrl } from './ssrf.js'
import type { ChatCompletionBody, ChatContentItem, ModelListItem } from './validation.js'
import { MAX_REQUEST_BODY_SIZE, sanitizeChatMessage } from './validation.js'

let activeRequestController: AbortController | null = null
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
    () => {
      if (activeRequestController) {
        activeRequestController.abort()
        activeRequestController = null
        Logger.info('[apiChatHandlers] API request cancelled by user')
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
          const err = validateProviderUrl(provider.baseUrl || '')
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
      _generalPrompt?: string,
      providerId?: string
    ) => {
      const config = await loadConfig()
      const provider = config.providers.find(
        (p) => p.id === (providerId || config.selectedProviderId)
      )
      if (!provider) return failure('invalid_input', 'Provider not configured')

      const ssrfErr = validateProviderUrl(provider.baseUrl)
      if (ssrfErr) {
        Logger.warn(`[apiChatHandlers] SSRF blocked for provider "${provider.name}": ${ssrfErr}`)
        return failure('invalid_input', 'Provider configuration rejected for security reasons')
      }

      const model = selectedModel || provider.defaultModel
      const baseUrl = provider.baseUrl.replace(/\/+$/, '')

      const controller = new AbortController()
      if (activeRequestController) {
        activeRequestController.abort()
      }
      activeRequestController = controller

      const requestTimeout = provider.requestTimeout ?? 60000
      const timeoutId = setTimeout(() => controller.abort(), requestTimeout)

      const safeApiKey = sanitizeApiKey(provider.apiKey || '')
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      if (safeApiKey) {
        headers['Authorization'] = `Bearer ${safeApiKey}`
      }

      try {
        const promptParts = [
          config.memoryPrompt && `[User Info]\n${config.memoryPrompt}`,
          config.characterPrompt && `[Character]\n${config.characterPrompt}`,
          config.generalPrompt && `[System]\n${config.generalPrompt}`
        ].filter(Boolean)

        const systemContent = promptParts.join('\n\n')
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

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: bodyJson,
          signal: controller.signal
        })

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
        if (err instanceof Error && err.name === 'AbortError') {
          return failure('internal_error', 'API Request timed out after 60 seconds')
        }
        return failure('internal_error', err instanceof Error ? err.message : String(err))
      } finally {
        clearTimeout(timeoutId)
        if (activeRequestController === controller) {
          activeRequestController = null
        }
      }
      headers['Authorization'] = ''
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

      const ssrfErr = validateProviderUrl(provider.baseUrl)
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
      const fetchTimeout = provider.requestTimeout
        ? Math.min(provider.requestTimeout, 30000)
        : 15000
      const timeoutId = setTimeout(() => controller.abort(), fetchTimeout)

      try {
        const response = await fetch(`${baseUrl}/models`, {
          headers,
          signal: controller.signal
        })

        if (!response.ok) {
          return failure('internal_error', `Failed to fetch models: ${response.status}`)
        }

        const data = await response.json()
        if (!data || typeof data !== 'object' || !Array.isArray(data.data)) {
          return failure('internal_error', 'Invalid API response: expected { data: [...] }')
        }
        return success(data.data.map((m: ModelListItem) => m.id))
      } catch (err: unknown) {
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
