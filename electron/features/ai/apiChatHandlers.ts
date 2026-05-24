import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../../shared/constants/ipc-channels'
import { getApiChatConfigPath } from '../../core/helpers'
import fs from 'fs'
import type { ApiConfig, ApiChatMessage } from '../../../shared/types'

function loadConfig(): ApiConfig {
  try {
    const p = getApiChatConfigPath()
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, 'utf-8'))
      return {
        providers: raw.providers || [],
        generalPrompt: raw.generalPrompt || '',
        memoryPrompt: raw.memoryPrompt || '',
        characterPrompt: raw.characterPrompt || '',
        selectedProviderId: raw.selectedProviderId || '',
        selectedModel: raw.selectedModel || ''
      }
    }
  } catch {
    /* ignore */
  }
  return {
    providers: [],
    generalPrompt: '',
    memoryPrompt: '',
    characterPrompt: '',
    selectedProviderId: '',
    selectedModel: ''
  }
}

function saveConfig(config: ApiConfig): boolean {
  try {
    fs.writeFileSync(getApiChatConfigPath(), JSON.stringify(config, null, 2))
    return true
  } catch {
    return false
  }
}

export function registerApiChatHandlers() {
  ipcMain.handle(IPC_CHANNELS.GET_API_CHAT_CONFIG, () => loadConfig())

  ipcMain.handle(IPC_CHANNELS.SAVE_API_CHAT_CONFIG, (_e, config: ApiConfig) => saveConfig(config))

  ipcMain.handle(
    IPC_CHANNELS.SEND_API_CHAT_REQUEST,
    async (
      _e,
      messages: ApiChatMessage[],
      selectedModel?: string,
      generalPrompt?: string,
      providerId?: string
    ) => {
      const config = loadConfig()
      const provider = config.providers.find(
        (p) => p.id === (providerId || config.selectedProviderId)
      )
      if (!provider) throw new Error('Provider not configured')

      const model = selectedModel || provider.defaultModel
      const baseUrl = provider.baseUrl.replace(/\/+$/, '')

      const promptParts = [
        config.memoryPrompt && `[User Info]\n${config.memoryPrompt}`,
        config.characterPrompt && `[Character]\n${config.characterPrompt}`,
        (generalPrompt || config.generalPrompt) &&
          `[System]\n${generalPrompt || config.generalPrompt}`
      ].filter(Boolean)

      const systemContent = promptParts.join('\n\n')
      const systemMessages = systemContent ? [{ role: 'system', content: systemContent }] : []

      const body: Record<string, unknown> = {
        model,
        messages: [
          ...systemMessages,
          ...messages.map(({ role, content, images }) => {
            if (images && images.length > 0 && role === 'user') {
              const contentArray: any[] = [{ type: 'text', text: content }]
              images.forEach((img) => {
                contentArray.push({
                  type: 'image_url',
                  image_url: { url: img }
                })
              })
              return { role, content: contentArray }
            }
            return { role, content }
          })
        ]
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      if (provider.apiKey) {
        headers['Authorization'] = `Bearer ${provider.apiKey}`
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      let response: Response
      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal
        })
      } catch (err: any) {
        if (err.name === 'AbortError') {
          throw new Error('API Request timed out after 60 seconds')
        }
        throw err
      } finally {
        clearTimeout(timeoutId)
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${await response.text()}`)
      }

      const data = await response.json()
      const reply = data.choices?.[0]?.message?.content || ''

      return {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
        model,
        providerId: provider.id
      } satisfies ApiChatMessage
    }
  )

  ipcMain.handle(IPC_CHANNELS.FETCH_API_CHAT_MODELS, async (_e, providerId?: string) => {
    const config = loadConfig()
    const provider = config.providers.find(
      (p) => p.id === (providerId || config.selectedProviderId)
    )
    if (!provider) throw new Error('Provider not configured')

    const baseUrl = provider.baseUrl.replace(/\/+$/, '')

    const headers: Record<string, string> = {}
    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    let response: Response
    try {
      response = await fetch(`${baseUrl}/models`, {
        headers,
        signal: controller.signal
      })
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Failed to fetch models: Request timed out')
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`)
    }

    const data = await response.json()
    return (data.data || []).map((m: { id: string }) => m.id)
  })
}
