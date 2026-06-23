import type { ApiChatMessage, ApiConfig, ApiProviderConfig } from '@shared-core/types'

import { getElectronApi, hasElectronApi } from '@shared/lib/electronApi'
import { Logger } from '@shared/lib/logger'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import ApiProviderCard from './apiSettings/ApiProviderCard'
import PromptSettingsSection from './apiSettings/PromptSettingsSection'

const DEFAULT_PROVIDER_TEMPLATES: Record<
  string,
  { baseUrl: string; providerType: ApiProviderConfig['providerType'] }
> = {
  openai: { baseUrl: 'https://api.openai.com/v1', providerType: 'openai' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', providerType: 'anthropic' },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    providerType: 'google'
  }
}

export default memo(function ApiSettingsTab() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<ApiConfig>({
    providers: [],
    generalPrompt: '',
    memoryPrompt: '',
    characterPrompt: '',
    selectedProviderId: '',
    selectedModel: ''
  })
  const [saving, setSaving] = useState(false)
  const [fetchingModels, setFetchingModels] = useState<Record<string, boolean>>({})
  const [testResults, setTestResults] = useState<Record<string, string>>({})
  const [testing, setTesting] = useState<Record<string, boolean>>({})

  // Keep a ref mirror of `config` so async test/fetch callbacks can read the
  // latest provider snapshot without putting `config` in their dep arrays
  // (which would re-create them on every keystroke and bust `ApiProviderCard`'s
  // memo).
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    if (!hasElectronApi()) return
    const api = getElectronApi()
    if (api?.getApiChatConfig) {
      api
        .getApiChatConfig()
        .then((cfg: ApiConfig | null) => {
          if (!cfg) return
          setConfig({
            providers: cfg.providers || [],
            generalPrompt: cfg.generalPrompt || '',
            memoryPrompt: cfg.memoryPrompt || '',
            characterPrompt: cfg.characterPrompt || '',
            selectedProviderId: cfg.selectedProviderId || '',
            selectedModel: cfg.selectedModel || ''
          })
        })
        .catch((err) => Logger.error('[ApiSettingsTab] Failed to load API chat config:', err))
    }
  }, [])

  const addProvider = useCallback((template?: string) => {
    const id = `provider-${Date.now()}`
    const tpl = template ? DEFAULT_PROVIDER_TEMPLATES[template] : null
    setConfig((c) => ({
      ...c,
      providers: [
        ...(c?.providers || []),
        {
          id,
          name: tpl ? (template ?? '') : '',
          baseUrl: tpl?.baseUrl || '',
          apiKey: '',
          defaultModel: '',
          enabled: true,
          models: [],
          providerType: tpl?.providerType || 'custom'
        }
      ]
    }))
  }, [])

  const updateProvider = useCallback((id: string, patch: Partial<ApiProviderConfig>) => {
    setConfig((c) => ({
      ...c,
      providers: (c?.providers || []).map((p) => (p.id === id ? { ...p, ...patch } : p))
    }))
  }, [])

  const removeProvider = useCallback((id: string) => {
    setConfig((c) => ({
      ...c,
      providers: (c?.providers || []).filter((p) => p.id !== id)
    }))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      if (!hasElectronApi()) return
      const api = getElectronApi()
      if (api?.saveApiChatConfig) {
        // Read the latest config from the ref so we don't need `config` in
        // the dep array (which would re-create this callback on every
        // keystroke and bust any memo'd consumer).
        await api.saveApiChatConfig(configRef.current)
      }
    } catch (err: unknown) {
      Logger.error('[ApiSettingsTab] Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }, [])

  const handleFetchModels = useCallback(
    async (id: string) => {
      setFetchingModels((s) => ({ ...s, [id]: true }))
      try {
        if (!hasElectronApi()) return
        const api = getElectronApi()
        if (api?.fetchApiChatModels) {
          const models: string[] | null = await api.fetchApiChatModels(id)
          updateProvider(id, { models: models ?? [] })
        }
      } catch (err: unknown) {
        setTestResults((s) => ({
          ...s,
          [id]: t('api_chat_fetch_error', {
            error: err instanceof Error ? err.message : String(err)
          })
        }))
      } finally {
        setFetchingModels((s) => ({ ...s, [id]: false }))
      }
    },
    [t, updateProvider]
  )

  const handleTestConnection = useCallback(
    async (id: string) => {
      setTesting((s) => ({ ...s, [id]: true }))
      setTestResults((s) => ({ ...s, [id]: '' }))
      try {
        if (!hasElectronApi()) return
        const api = getElectronApi()
        // Read the latest provider snapshot from the config ref. Using a ref
        // keeps this callback stable (no `config` dep) and avoids a stale
        // closure after the user edits the provider's defaultModel field.
        const provider = configRef.current.providers.find((p) => p.id === id)
        if (!provider) return
        if (api?.sendApiChatRequest) {
          const reply: ApiChatMessage | null = await api.sendApiChatRequest(
            [
              {
                id: 'test',
                role: 'user' as const,
                content: t('test_message_content'),
                timestamp: Date.now()
              }
            ],
            provider.defaultModel || undefined,
            undefined,
            id
          )
          setTestResults((s) => ({
            ...s,
            [id]: reply
              ? t('api_chat_test_ok', { response: reply.content.slice(0, 100) })
              : t('api_chat_test_failed')
          }))
        } else {
          setTestResults((s) => ({
            ...s,
            [id]: t('api_chat_api_unavailable')
          }))
        }
      } catch (err: unknown) {
        setTestResults((s) => ({
          ...s,
          [id]: t('api_chat_test_error', {
            error: err instanceof Error ? err.message : String(err)
          })
        }))
      } finally {
        setTesting((s) => ({ ...s, [id]: false }))
      }
    },
    [t]
  )

  return (
    <div className="flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-ql-16 text-foreground font-semibold">
            {t('api_chat_settings_title')}
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">{t('api_chat_settings_desc')}</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-amber-500/20 px-4 py-2 text-xs text-amber-400 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
        >
          {saving ? t('saving') : t('save_platform')}
        </button>
      </div>

      <PromptSettingsSection
        memoryPrompt={config.memoryPrompt || ''}
        characterPrompt={config.characterPrompt || ''}
        generalPrompt={config.generalPrompt || ''}
        onChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
      />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-muted-foreground/80 text-sm font-medium">
            {t('api_chat_providers_title')}
          </h3>
          <div className="flex gap-2">
            {Object.keys(DEFAULT_PROVIDER_TEMPLATES).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => addProvider(key)}
                className="text-muted-foreground/70 hover:text-foreground/90 rounded-lg border border-white/8 px-3 py-1.5 text-xs capitalize transition-colors hover:border-white/16"
              >
                + {key}
              </button>
            ))}
            <button
              type="button"
              onClick={() => addProvider()}
              className="text-muted-foreground/70 hover:text-foreground/90 rounded-lg border border-white/8 px-3 py-1.5 text-xs transition-colors hover:border-white/16"
            >
              + {t('api_chat_custom_provider')}
            </button>
          </div>
        </div>

        {(!config?.providers || config.providers.length === 0) && (
          <p className="text-xs text-white/30 italic">{t('api_chat_no_providers')}</p>
        )}

        {config?.providers?.map((provider) => (
          <ApiProviderCard
            key={provider.id}
            provider={provider}
            testResult={testResults[provider.id] || ''}
            testing={!!testing[provider.id]}
            fetchingModels={!!fetchingModels[provider.id]}
            onUpdate={updateProvider}
            onRemove={removeProvider}
            onTestConnection={handleTestConnection}
            onFetchModels={handleFetchModels}
          />
        ))}
      </div>
    </div>
  )
})
