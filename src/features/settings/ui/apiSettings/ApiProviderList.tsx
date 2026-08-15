import type { ApiProviderConfig } from '@shared-core/types'

import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import ApiProviderCard from './ApiProviderCard'
import { DEFAULT_PROVIDER_TEMPLATES } from './constants'

interface ApiProviderListProps {
  providers: ApiProviderConfig[]
  testResults: Record<string, string>
  testing: Record<string, boolean>
  fetchingModels: Record<string, boolean>
  onUpdate: (id: string, patch: Partial<ApiProviderConfig>) => void
  onRemove: (id: string) => void
  onTestConnection: (id: string) => void
  onFetchModels: (id: string) => void
  onAddProvider: (template?: string) => void
}

function ApiProviderList({
  providers,
  testResults,
  testing,
  fetchingModels,
  onUpdate,
  onRemove,
  onTestConnection,
  onFetchModels,
  onAddProvider
}: ApiProviderListProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground text-sm font-semibold">{t('api_chat_providers_title')}</h3>
        <div className="flex gap-2">
          {Object.keys(DEFAULT_PROVIDER_TEMPLATES).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onAddProvider(key)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted border-border bg-muted/40 focus-visible:ring-ring/40 rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              + {key}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onAddProvider()}
            className="text-muted-foreground hover:text-foreground hover:bg-muted border-border bg-muted/40 focus-visible:ring-ring/40 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            + {t('api_chat_custom_provider')}
          </button>
        </div>
      </div>

      {(!providers || providers.length === 0) && (
        <p className="text-muted-foreground text-xs italic">{t('api_chat_no_providers')}</p>
      )}

      {providers?.map((provider) => (
        <ApiProviderCard
          key={provider.id}
          provider={provider}
          testResult={testResults[provider.id] || ''}
          testing={!!testing[provider.id]}
          fetchingModels={!!fetchingModels[provider.id]}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onTestConnection={onTestConnection}
          onFetchModels={onFetchModels}
        />
      ))}
    </div>
  )
}

export default memo(ApiProviderList)
