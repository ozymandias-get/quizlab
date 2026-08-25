import type { ApiChatMessage, ApiConfig, ApiProviderConfig } from '@shared-core/types'

import {
  normalizeApiConfig,
  useApiChatConfigQuery,
  useSaveApiChatConfigMutation
} from '@platform/electron/api/useApiChatApi'

import { Button } from '@app/components/ui/button'
import { getElectronApi, hasElectronApi } from '@shared/lib/electronApi'
import { ensureErrorMessage } from '@shared/lib/errorUtils'
import { AiIcon } from '@shared/ui/components/icons/AiIcon'

import { Loader2 } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import ApiProviderList from './apiSettings/ApiProviderList'
import { DEFAULT_PROVIDER_TEMPLATES } from './apiSettings/constants'
import PromptSettingsSection from './apiSettings/PromptSettingsSection'
import SettingsTabIntro from './shared/SettingsTabIntro'

export default memo(function ApiSettingsTab() {
  const { t } = useTranslation()
  // Persisted configuration via TanStack Query (STD-014); the tab edits a
  // local draft which is hydrated whenever the query delivers fresh data.
  const { data: savedConfig } = useApiChatConfigQuery()
  const { mutateAsync: saveConfig, isPending: saving } = useSaveApiChatConfigMutation()
  const [config, setConfig] = useState<ApiConfig>({
    providers: [],
    generalPrompt: '',
    memoryPrompt: '',
    characterPrompt: '',
    selectedProviderId: '',
    selectedModel: ''
  })
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
    if (!savedConfig) return
    setConfig(normalizeApiConfig(savedConfig))
  }, [savedConfig])

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

  const handlePromptChange = useCallback(
    (patch: { memoryPrompt?: string; characterPrompt?: string; generalPrompt?: string }) => {
      setConfig((c) => ({ ...c, ...patch }))
    },
    []
  )

  const handleSave = useCallback(async () => {
    try {
      // Read the latest config from the ref so we don't need `config` in
      // the dep array (which would re-create this callback on every
      // keystroke and bust any memo'd consumer).
      await saveConfig(configRef.current)
    } catch {
      // Error toast is surfaced centrally by useSaveApiChatConfigMutation.
    }
  }, [saveConfig])

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
            error: ensureErrorMessage(err)
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
                content: t('api_chat_test_message'),
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
            error: ensureErrorMessage(err)
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
      <SettingsTabIntro
        icon={
          <div className="border-primary/20 bg-primary/10 text-primary rounded-lg border p-2.5">
            <AiIcon modelKey="api-chat" className="h-5 w-5" />
          </div>
        }
        description={t('api_chat_settings_desc')}
        action={
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{t('saving')}</span>
              </>
            ) : (
              <span>{t('api_chat_save')}</span>
            )}
          </Button>
        }
      />

      <PromptSettingsSection
        memoryPrompt={config.memoryPrompt || ''}
        characterPrompt={config.characterPrompt || ''}
        generalPrompt={config.generalPrompt || ''}
        onChange={handlePromptChange}
      />

      <ApiProviderList
        providers={config?.providers || []}
        testResults={testResults}
        testing={testing}
        fetchingModels={fetchingModels}
        onUpdate={updateProvider}
        onRemove={removeProvider}
        onTestConnection={handleTestConnection}
        onFetchModels={handleFetchModels}
        onAddProvider={addProvider}
      />
    </div>
  )
})
