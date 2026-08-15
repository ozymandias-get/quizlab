import type { ApiProviderConfig } from '@shared-core/types'

import { Input } from '@app/components/ui/input'
import { Label } from '@app/components/ui/label'

import { Eye, EyeOff } from 'lucide-react'
import { memo, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface ApiProviderCardProps {
  provider: ApiProviderConfig
  testResult: string
  testing: boolean
  fetchingModels: boolean
  onUpdate: (id: string, patch: Partial<ApiProviderConfig>) => void
  onRemove: (id: string) => void
  onTestConnection: (id: string) => void
  onFetchModels: (id: string) => void
}

function ApiProviderCard({
  provider,
  testResult,
  testing,
  fetchingModels,
  onUpdate,
  onRemove,
  onTestConnection,
  onFetchModels
}: ApiProviderCardProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const nameId = useId()
  const baseUrlId = useId()
  const apiKeyId = useId()
  const defaultModelId = useId()

  const filteredModels = (provider.models || []).filter((m) =>
    search ? m.toLowerCase().includes(search.toLowerCase()) : true
  )

  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-ql-11 bg-muted text-muted-foreground rounded-md px-2 py-0.5 font-mono">
            {provider.providerType}
          </span>
          <span className="text-ql-13 text-foreground font-semibold">
            {provider.name || t('unnamed_provider')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onRemove(provider.id)}
          className="text-ql-12 text-muted-foreground hover:text-destructive transition-colors"
        >
          {t('delete')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={nameId} className="text-ql-11 text-muted-foreground font-medium">
            {t('name')}
          </Label>
          <Input
            id={nameId}
            value={provider.name}
            onChange={(e) => onUpdate(provider.id, { name: e.target.value })}
            placeholder={t('api_chat_placeholder_provider')}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={baseUrlId} className="text-ql-11 text-muted-foreground font-medium">
            {t('api_chat_base_url')}
          </Label>
          <Input
            id={baseUrlId}
            value={provider.baseUrl}
            onChange={(e) => onUpdate(provider.id, { baseUrl: e.target.value })}
            className="font-mono"
            placeholder="https://api.openai.com/v1"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={apiKeyId} className="text-ql-11 text-muted-foreground font-medium">
            {t('api_chat_api_key')}
          </Label>
          <div className="relative">
            <Input
              id={apiKeyId}
              type={showApiKey ? 'text' : 'password'}
              value={provider.apiKey}
              onChange={(e) => onUpdate(provider.id, { apiKey: e.target.value })}
              placeholder="sk-..."
              className="pr-9"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowApiKey((prev) => !prev)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 flex -translate-y-1/2 items-center justify-center transition-colors"
              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={defaultModelId} className="text-ql-11 text-muted-foreground font-medium">
            {t('api_chat_default_model')}
          </Label>
          <Input
            id={defaultModelId}
            value={provider.defaultModel}
            onChange={(e) => onUpdate(provider.id, { defaultModel: e.target.value })}
            className="font-mono"
            placeholder="gpt-4o"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onTestConnection(provider.id)}
          disabled={testing}
          className="text-ql-12 border-border bg-muted/60 text-foreground hover:bg-muted focus-visible:ring-ring/40 rounded-lg border px-3 py-1.5 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
        >
          {testing ? t('testing') : t('api_chat_test_connection')}
        </button>
        <button
          type="button"
          onClick={() => onFetchModels(provider.id)}
          disabled={fetchingModels || !provider.apiKey || !provider.baseUrl}
          className="text-ql-12 border-border bg-muted/60 text-foreground hover:bg-muted focus-visible:ring-ring/40 rounded-lg border px-3 py-1.5 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
        >
          {fetchingModels ? t('fetching') : t('api_chat_fetch_models')}
        </button>
      </div>
      {testResult && (
        <span
          className={`text-ql-11 block font-medium ${testResult.startsWith('OK') ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
        >
          {testResult}
        </span>
      )}

      {(provider.models || []).length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-ql-11 text-muted-foreground font-medium">
              {t('api_chat_models_count')} ({provider.models.length})
            </label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
              placeholder={t('api_chat_search_models')}
            />
          </div>
          <div className="border-border bg-muted/30 max-h-[140px] overflow-y-auto rounded-lg border p-1">
            {filteredModels.length === 0 ? (
              <p className="text-ql-11 text-muted-foreground px-2 py-1">
                {t('api_chat_no_models_found')}
              </p>
            ) : (
              filteredModels.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onUpdate(provider.id, { defaultModel: m })}
                  className={`text-ql-11 w-full rounded-md px-2 py-1 text-left transition-colors ${
                    m === provider.defaultModel
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {m}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(ApiProviderCard)
