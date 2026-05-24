import { useState, useEffect } from 'react'
import { useLanguageStrings } from '@app/providers'
import type { ApiConfig, ApiProviderConfig, ApiChatMessage } from '@shared-core/types'
import { PromptSettingsSection } from './apiSettings/PromptSettingsSection'
import { ApiProviderCard } from './apiSettings/ApiProviderCard'

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

export default function ApiSettingsTab() {
  const { t } = useLanguageStrings()
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

  useEffect(() => {
    const api = (window as any).electronAPI
    if (api?.getApiChatConfig) {
      api
        .getApiChatConfig()
        .then((cfg: ApiConfig) => {
          setConfig({
            providers: cfg.providers || [],
            generalPrompt: cfg.generalPrompt || '',
            memoryPrompt: cfg.memoryPrompt || '',
            characterPrompt: cfg.characterPrompt || '',
            selectedProviderId: cfg.selectedProviderId || '',
            selectedModel: cfg.selectedModel || ''
          })
        })
        .catch(console.error)
    }
  }, [])

  const addProvider = (template?: string) => {
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
  }

  const updateProvider = (id: string, patch: Partial<ApiProviderConfig>) => {
    setConfig((c) => ({
      ...c,
      providers: (c?.providers || []).map((p) => (p.id === id ? { ...p, ...patch } : p))
    }))
  }

  const removeProvider = (id: string) => {
    setConfig((c) => ({
      ...c,
      providers: (c?.providers || []).filter((p) => p.id !== id)
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const api = (window as any).electronAPI
      if (api?.saveApiChatConfig) {
        await api.saveApiChatConfig(config)
      }
    } catch (err: any) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleFetchModels = async (provider: ApiProviderConfig) => {
    setFetchingModels((s) => ({ ...s, [provider.id]: true }))
    try {
      const api = (window as any).electronAPI
      if (api?.fetchApiChatModels) {
        const models: string[] = await api.fetchApiChatModels(provider.id)
        updateProvider(provider.id, { models })
      }
    } catch (err: any) {
      setTestResults((s) => ({ ...s, [provider.id]: `Fetch error: ${err.message}` }))
    } finally {
      setFetchingModels((s) => ({ ...s, [provider.id]: false }))
    }
  }

  const handleTestConnection = async (provider: ApiProviderConfig) => {
    setTesting((s) => ({ ...s, [provider.id]: true }))
    setTestResults((s) => ({ ...s, [provider.id]: '' }))
    try {
      const api = (window as any).electronAPI
      if (api?.sendApiChatRequest) {
        const reply: ApiChatMessage = await api.sendApiChatRequest(
          [
            {
              id: 'test',
              role: 'user' as const,
              content: 'Merhaba! Sadece "Evet" yanıtı ver.',
              timestamp: Date.now()
            }
          ],
          provider.defaultModel || undefined,
          undefined,
          provider.id
        )
        setTestResults((s) => ({ ...s, [provider.id]: `OK: ${reply.content.slice(0, 100)}` }))
      } else {
        setTestResults((s) => ({
          ...s,
          [provider.id]: 'electronAPI.sendApiChatRequest not available'
        }))
      }
    } catch (err: any) {
      setTestResults((s) => ({ ...s, [provider.id]: `Hata: ${err.message}` }))
    } finally {
      setTesting((s) => ({ ...s, [provider.id]: false }))
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-ql-16 font-semibold text-white/90">
            {t('api_chat_settings_title') || 'API Chat Settings'}
          </h2>
          <p className="text-ql-12 text-white/40 mt-1">
            {t('api_chat_settings_desc') || 'Manage your API providers and connection settings'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-amber-500/20 px-4 py-2 text-ql-13 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : t('save_platform') || 'Save'}
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
          <h3 className="text-ql-14 font-medium text-white/70">
            {t('api_chat_providers_title') || 'API Providers'}
          </h3>
          <div className="flex gap-2">
            {Object.keys(DEFAULT_PROVIDER_TEMPLATES).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => addProvider(key)}
                className="rounded-lg border border-white/8 px-3 py-1.5 text-ql-12 text-white/50 hover:text-white/80 hover:border-white/16 transition-colors capitalize"
              >
                + {key}
              </button>
            ))}
            <button
              type="button"
              onClick={() => addProvider()}
              className="rounded-lg border border-white/8 px-3 py-1.5 text-ql-12 text-white/50 hover:text-white/80 hover:border-white/16 transition-colors"
            >
              + {t('api_chat_custom_provider') || 'Custom'}
            </button>
          </div>
        </div>

        {(!config?.providers || config.providers.length === 0) && (
          <p className="text-ql-12 text-white/30 italic">
            {t('api_chat_no_providers') || 'No providers configured. Add one above.'}
          </p>
        )}

        {config?.providers?.map((provider) => (
          <ApiProviderCard
            key={provider.id}
            provider={provider}
            testResult={testResults[provider.id] || ''}
            testing={!!testing[provider.id]}
            fetchingModels={!!fetchingModels[provider.id]}
            onUpdate={(patch) => updateProvider(provider.id, patch)}
            onRemove={() => removeProvider(provider.id)}
            onTestConnection={() => handleTestConnection(provider)}
            onFetchModels={() => handleFetchModels(provider)}
          />
        ))}
      </div>
    </div>
  )
}
