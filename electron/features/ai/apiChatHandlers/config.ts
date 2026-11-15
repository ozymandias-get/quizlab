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
  let configPath: string | undefined
  try {
    configPath = getApiChatConfigPath()
    const content = await fs.promises.readFile(configPath, 'utf-8')
    if (cachedRawContent === content && cachedDecodedConfig !== null) {
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

    cachedRawContent = content
    cachedDecodedConfig = resolved
    return cloneApiConfig(resolved)
  } catch (err) {
    cachedRawContent = null
    cachedDecodedConfig = null
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
