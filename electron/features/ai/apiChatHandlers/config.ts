import fs from 'fs'
import path from 'path'

import type { ApiConfig, ApiProviderConfig } from '../../../../shared/types/index.js'
import { getApiChatConfigPath } from '../../../core/coreHelpers.js'
import { decryptValue, encryptValue } from '../../../core/encryption.js'
import { Logger } from '../../../core/logger.js'

const MAX_PROMPT_LENGTH = 4000

function sanitizeApiKey(key: string): string {
  let cleaned = key.trim()
  cleaned = cleaned.replaceAll(/[\x00-\x1f\x7f]/g, '')
  return cleaned
}

/**
 * The only place the deprecated local-network aliases are ever read.
 *
 * `ApiProviderConfig.allowLocalEndpoints` / `.isCustomProvider` were introduced
 * as aliases and are never written by the app, but a config file could carry
 * them. Because load and save both spread each provider verbatim, they would
 * otherwise survive forever and the rest of the app would have to keep
 * re-deriving the permission from three names. Resolving them once here means
 * only the canonical flag exists at runtime, and the next save rewrites the file
 * in canonical form.
 *
 * The grant itself is unchanged: an alias of `true` becomes
 * `allowLocalNetwork: true`, which is what the request path would have computed
 * from it anyway. An explicit `allowLocalNetwork: false` still wins over an alias
 * set to `false`, and neither alias overrides a canonical `true`.
 *
 * The request path (`getSsrOptionsForProvider` in ssrf.ts) reads
 * `allowLocalNetwork` and nothing else, so a provider that predates the aliases
 * keeps working without any of them surviving into a live request.
 */
function normalizeProvider(p: ApiProviderConfig): ApiProviderConfig {
  const { allowLocalEndpoints, isCustomProvider, ...rest } = p
  const aliasAllowsLocal = allowLocalEndpoints === true || isCustomProvider === true
  return {
    ...rest,
    ...(aliasAllowsLocal || rest.allowLocalNetwork === true ? { allowLocalNetwork: true } : {})
  }
}

async function loadConfig(): Promise<ApiConfig> {
  let configPath: string | undefined
  try {
    configPath = getApiChatConfigPath()
    const content = await fs.promises.readFile(configPath, 'utf-8')
    const raw = JSON.parse(content)

    const providers: ApiProviderConfig[] = (raw.providers || []).map((p: ApiProviderConfig) => ({
      ...normalizeProvider(p),
      apiKey: decryptValue(p.apiKey || '')
    }))

    return {
      providers,
      generalPrompt: (raw.generalPrompt || '').slice(0, MAX_PROMPT_LENGTH),
      memoryPrompt: (raw.memoryPrompt || '').slice(0, MAX_PROMPT_LENGTH),
      characterPrompt: (raw.characterPrompt || '').slice(0, MAX_PROMPT_LENGTH),
      selectedProviderId: raw.selectedProviderId || '',
      selectedModel: raw.selectedModel || ''
    }
  } catch (err) {
    Logger.warn('[apiChatHandlers] Failed to load API chat config, using defaults:', err)

    if (configPath) {
      try {
        const backupPath = configPath + `.bak.${Date.now()}`
        await fs.promises.copyFile(configPath, backupPath).catch(() => {})
        Logger.info(`[apiChatHandlers] Backed up config to ${backupPath}`)
      } catch {
        // Backup failure is non-fatal
      }
    }
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

async function saveConfig(config: ApiConfig): Promise<boolean> {
  try {
    const encryptedProviders: ApiProviderConfig[] = config.providers.map((p) => ({
      ...p,
      apiKey: encryptValue(sanitizeApiKey(p.apiKey || ''))
    }))

    const configPath = getApiChatConfigPath()
    const trimmedConfig = {
      ...config,
      providers: encryptedProviders,
      generalPrompt: (config.generalPrompt || '').slice(0, MAX_PROMPT_LENGTH),
      memoryPrompt: (config.memoryPrompt || '').slice(0, MAX_PROMPT_LENGTH),
      characterPrompt: (config.characterPrompt || '').slice(0, MAX_PROMPT_LENGTH)
    }

    await fs.promises.mkdir(path.dirname(configPath), { recursive: true })
    await fs.promises.writeFile(configPath, JSON.stringify(trimmedConfig, null, 2), { mode: 0o600 })
    return true
  } catch {
    return false
  }
}

export { loadConfig, normalizeProvider, sanitizeApiKey, saveConfig }
