import { useState } from 'react'
import { useLanguageStrings } from '@app/providers'
import type { ApiProviderConfig } from '@shared-core/types'

interface ApiProviderCardProps {
  provider: ApiProviderConfig
  testResult: string
  testing: boolean
  fetchingModels: boolean
  onUpdate: (patch: Partial<ApiProviderConfig>) => void
  onRemove: () => void
  onTestConnection: () => void
  onFetchModels: () => void
}

export function ApiProviderCard({
  provider,
  testResult,
  testing,
  fetchingModels,
  onUpdate,
  onRemove,
  onTestConnection,
  onFetchModels
}: ApiProviderCardProps) {
  const { t } = useLanguageStrings()
  const [search, setSearch] = useState('')

  const filteredModels = (provider.models || []).filter((m) =>
    search ? m.toLowerCase().includes(search.toLowerCase()) : true
  )

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-ql-11 text-white/40 font-mono">
            {provider.providerType}
          </span>
          <span className="text-ql-13 font-medium text-white/70">
            {provider.name || 'Unnamed Provider'}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-ql-12 text-red-400/60 hover:text-red-400 transition-colors"
        >
          {t('delete') || 'Remove'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-ql-11 text-white/40">{t('name') || 'Name'}</label>
          <input
            value={provider.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="rounded-lg border border-white/8 bg-zinc-900/40 px-3 py-1.5 text-ql-13 text-white/80 focus:outline-none focus:border-amber-500/30 transition-colors"
            placeholder="My Provider"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-ql-11 text-white/40">{t('api_chat_base_url') || 'Base URL'}</label>
          <input
            value={provider.baseUrl}
            onChange={(e) => onUpdate({ baseUrl: e.target.value })}
            className="rounded-lg border border-white/8 bg-zinc-900/40 px-3 py-1.5 text-ql-13 text-white/80 focus:outline-none focus:border-amber-500/30 transition-colors font-mono text-ql-12"
            placeholder="https://api.openai.com/v1"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-ql-11 text-white/40">{t('api_chat_api_key') || 'API Key'}</label>
          <input
            type="password"
            value={provider.apiKey}
            onChange={(e) => onUpdate({ apiKey: e.target.value })}
            className="rounded-lg border border-white/8 bg-zinc-900/40 px-3 py-1.5 text-ql-13 text-white/80 focus:outline-none focus:border-amber-500/30 transition-colors"
            placeholder="sk-..."
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-ql-11 text-white/40">
            {t('api_chat_default_model') || 'Default Model'}
          </label>
          <input
            value={provider.defaultModel}
            onChange={(e) => onUpdate({ defaultModel: e.target.value })}
            className="rounded-lg border border-white/8 bg-zinc-900/40 px-3 py-1.5 text-ql-13 text-white/80 focus:outline-none focus:border-amber-500/30 transition-colors font-mono text-ql-12"
            placeholder="gpt-4o"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onTestConnection}
          disabled={testing}
          className="rounded-lg border border-white/8 px-3 py-1.5 text-ql-12 text-white/50 hover:text-white/80 hover:border-white/16 transition-colors disabled:opacity-50"
        >
          {testing ? 'Testing...' : t('api_chat_test_connection') || 'Test Connection'}
        </button>
        <button
          type="button"
          onClick={onFetchModels}
          disabled={fetchingModels || !provider.apiKey || !provider.baseUrl}
          className="rounded-lg border border-white/8 px-3 py-1.5 text-ql-12 text-white/50 hover:text-white/80 hover:border-white/16 transition-colors disabled:opacity-50"
        >
          {fetchingModels ? 'Fetching...' : t('api_chat_fetch_models') || 'Fetch Models'}
        </button>
        {testResult && (
          <span
            className={`text-ql-11 ${testResult.startsWith('OK') ? 'text-green-400/70' : 'text-red-400/70'}`}
          >
            {testResult}
          </span>
        )}
      </div>

      {(provider.models || []).length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-ql-11 text-white/40">
              {t('api_chat_models_count') || 'Models'} ({provider.models.length})
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-lg border border-white/8 bg-zinc-900/40 px-2 py-1 text-ql-11 text-white/60 placeholder-white/20 focus:outline-none focus:border-amber-500/30 transition-colors"
              placeholder={t('api_chat_search_models') || 'Search models...'}
            />
          </div>
          <div className="max-h-[120px] overflow-y-auto rounded-lg border border-white/8 bg-zinc-900/40 p-1">
            {filteredModels.length === 0 ? (
              <p className="text-ql-11 text-white/30 px-2 py-1">
                {t('api_chat_no_models_found') || 'No models found'}
              </p>
            ) : (
              filteredModels.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onUpdate({ defaultModel: m })}
                  className={`w-full rounded px-2 py-1 text-left text-ql-11 transition-colors ${
                    m === provider.defaultModel
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/5'
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
