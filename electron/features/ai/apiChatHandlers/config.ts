import fs from 'fs'
import path from 'path'

import type { ApiConfig, ApiProviderConfig } from '../../../../shared/types/index.js'
import { getApiChatConfigPath } from '../../../core/coreHelpers.js'
import { decryptValueChecked, encryptValue } from '../../../core/encryption.js'
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

let cachedRawContent: string | null = null
let cachedDecodedConfig: ApiConfig | null = null
/**
 * A read failed for a reason other than "the file does not exist".
 *
 * The empty config returned to the UI is not proof that the user has no
 * providers. Saving it would replace the unreadable file, so writes are
 * refused until a load succeeds again.
 */
let configReadFailed = false

function emptyApiConfig(): ApiConfig {
  return {
    providers: [],
    generalPrompt: '',
    memoryPrompt: '',
    characterPrompt: '',
    selectedProviderId: '',
    selectedModel: ''
  }
}

/**
 * Providers whose stored key exists but could not be decrypted.
 *
 * Their in-memory `apiKey` is empty because the UI has nothing to show. A save
 * must not interpret that as "the user cleared the key": the encrypted value
 * is still in the file and is kept until the key can be read or the user enters
 * a new one.
 */
const undecryptableApiKeys = new Set<string>()

function cloneApiConfig(config: ApiConfig): ApiConfig {
  return {
    ...config,
    providers: config.providers.map((p) => ({
      ...p,
      ...(p.models ? { models: [...p.models] } : {})
    }))
  }
}

async function loadConfig(): Promise<ApiConfig> {
  let configPath: string
  try {
    configPath = getApiChatConfigPath()
  } catch (error) {
    configReadFailed = true
    Logger.warn('[apiChatHandlers] Failed to resolve the API chat config path:', error)
    return emptyApiConfig()
  }

  let content: string
  try {
    content = await fs.promises.readFile(configPath, 'utf-8')
  } catch (error) {
    cachedRawContent = null
    cachedDecodedConfig = null
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      configReadFailed = false
      return emptyApiConfig()
    }

    // A permission or I/O error is not proof that the file is empty. Keep the
    // existing file untouched and refuse writes until a later load works.
    configReadFailed = true
    Logger.warn('[apiChatHandlers] The API chat config could not be read:', error)
    return emptyApiConfig()
  }

  try {
    if (cachedRawContent === content && cachedDecodedConfig !== null) {
      configReadFailed = false
      return cloneApiConfig(cachedDecodedConfig)
    }

    const raw = JSON.parse(content)

    undecryptableApiKeys.clear()
    const providers: ApiProviderConfig[] = (raw.providers || []).map((p: ApiProviderConfig) => {
      const decrypted = decryptValueChecked(p.apiKey || '')
      if (decrypted.failed && typeof p.id === 'string' && p.id) {
        undecryptableApiKeys.add(p.id)
      }
      return {
        ...normalizeProvider(p),
        apiKey: decrypted.value
      }
    })

    const resolved: ApiConfig = {
      providers,
      generalPrompt: (raw.generalPrompt || '').slice(0, MAX_PROMPT_LENGTH),
      memoryPrompt: (raw.memoryPrompt || '').slice(0, MAX_PROMPT_LENGTH),
      characterPrompt: (raw.characterPrompt || '').slice(0, MAX_PROMPT_LENGTH),
      selectedProviderId: raw.selectedProviderId || '',
      selectedModel: raw.selectedModel || ''
    }

    configReadFailed = false
    cachedRawContent = content
    cachedDecodedConfig = resolved
    return cloneApiConfig(resolved)
  } catch (error) {
    cachedRawContent = null
    cachedDecodedConfig = null
    Logger.warn('[apiChatHandlers] The API chat config is corrupt:', error)

    // A corrupt file has no usable provider list, but its bytes are the only
    // remaining copy of the encrypted keys. Move it aside (do not overwrite
    // it), then let the user create a new config.
    try {
      const backupPath = `${configPath}.bak.${Date.now()}`
      await fs.promises.rename(configPath, backupPath)
      undecryptableApiKeys.clear()
      configReadFailed = false
      Logger.warn(`[apiChatHandlers] Moved the corrupt config to ${backupPath}`)
    } catch (backupError) {
      configReadFailed = true
      Logger.error('[apiChatHandlers] The corrupt config could not be preserved:', backupError)
    }
    return emptyApiConfig()
  }
}

let configWriteQueue: Promise<unknown> = Promise.resolve()

/**
 * Serialises config writes.
 *
 * Two IPC saves can overlap. A fixed `.tmp` path would let the second write
 * truncate the file the first is about to rename; the queue keeps each
 * write-rename pair whole.
 */
function saveConfig(config: ApiConfig): Promise<boolean> {
  const write = configWriteQueue.then(
    () => saveConfigNow(config),
    () => saveConfigNow(config)
  )
  configWriteQueue = write.catch(() => undefined)
  return write
}

async function readStoredApiKeys(configPath: string): Promise<Map<string, string>> {
  let content: string
  try {
    content = await fs.promises.readFile(configPath, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Map()
    throw error
  }
  const raw = JSON.parse(content) as { providers?: Array<{ id?: unknown; apiKey?: unknown }> }
  const stored = new Map<string, string>()
  for (const provider of raw.providers ?? []) {
    if (
      typeof provider?.id === 'string' &&
      typeof provider.apiKey === 'string' &&
      provider.apiKey
    ) {
      stored.set(provider.id, provider.apiKey)
    }
  }
  return stored
}

async function saveConfigNow(config: ApiConfig): Promise<boolean> {
  if (configReadFailed) {
    Logger.warn(
      '[apiChatHandlers] Refusing to save the API chat config: the existing file could not be read.'
    )
    return false
  }

  let temporaryPath: string | null = null
  try {
    const configPath = getApiChatConfigPath()
    const preservedIds = new Set<string>()
    let storedApiKeys: Map<string, string> | null = null

    const encryptedProviders: ApiProviderConfig[] = []
    for (const p of config.providers) {
      const plain = sanitizeApiKey(p.apiKey || '')
      const needsPreservedKey =
        plain === '' && typeof p.id === 'string' && undecryptableApiKeys.has(p.id)

      if (needsPreservedKey) {
        // If the current file cannot be read, fail the save instead of
        // overwriting the key we could not decrypt.
        storedApiKeys ??= await readStoredApiKeys(configPath)
        const storedKey = storedApiKeys.get(p.id)
        if (storedKey) {
          preservedIds.add(p.id)
          encryptedProviders.push({ ...p, apiKey: storedKey })
          continue
        }
      }

      encryptedProviders.push({
        ...p,
        apiKey: encryptValue(plain)
      })
    }

    const trimmedConfig = {
      ...config,
      providers: encryptedProviders,
      generalPrompt: (config.generalPrompt || '').slice(0, MAX_PROMPT_LENGTH),
      memoryPrompt: (config.memoryPrompt || '').slice(0, MAX_PROMPT_LENGTH),
      characterPrompt: (config.characterPrompt || '').slice(0, MAX_PROMPT_LENGTH)
    }

    const serialized = JSON.stringify(trimmedConfig, null, 2)
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true })

    // Write next to the target and rename over it. A crash or a full disk in
    // the middle of the write leaves the previous, valid config in place
    // instead of a truncated file that loadConfig would read as an empty
    // provider list. The rename is atomic on the same volume.
    temporaryPath = `${configPath}.tmp`
    await fs.promises.writeFile(temporaryPath, serialized, { mode: 0o600 })
    await fs.promises.rename(temporaryPath, configPath)

    // A provider whose encrypted key is still in the file stays marked. A
    // provider that was removed or given a new key no longer needs the mark.
    for (const id of undecryptableApiKeys) {
      if (!preservedIds.has(id)) undecryptableApiKeys.delete(id)
    }

    cachedRawContent = null
    cachedDecodedConfig = null
    return true
  } catch {
    if (temporaryPath) {
      await fs.promises.unlink(temporaryPath).catch(() => {})
    }
    return false
  }
}

export { loadConfig, normalizeProvider, sanitizeApiKey, saveConfig }
