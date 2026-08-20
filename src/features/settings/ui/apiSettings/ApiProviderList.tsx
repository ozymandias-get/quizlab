import type { ApiProviderConfig } from '@shared-core/types'

import { Button } from '@app/components/ui/button'
import { EmptyState } from '@shared/ui/components/primitives'

import { Plus, Server } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import ApiProviderCard from './ApiProviderCard'
import { DEFAULT_PROVIDER_TEMPLATES } from './constants'

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google Gemini'
}

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-foreground text-sm font-semibold">{t('api_chat_providers_title')}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.keys(DEFAULT_PROVIDER_TEMPLATES).map((key) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onAddProvider(key)}
              className="gap-1"
            >
              <Plus className="h-3 w-3" />
              <span>{PROVIDER_DISPLAY_NAMES[key] || key}</span>
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => onAddProvider()}
            className="gap-1"
          >
            <Plus className="h-3 w-3" />
            <span>{t('api_chat_custom_provider')}</span>
          </Button>
        </div>
      </div>

      {(!providers || providers.length === 0) && (
        <EmptyState size="sm" icon={Server} title={t('api_chat_no_providers')} className="py-4" />
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
