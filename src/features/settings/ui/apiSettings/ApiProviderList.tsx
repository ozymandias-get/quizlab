import type { ApiProviderConfig } from '@shared-core/types'

import { Button, EmptyState, SettingsSection } from '@shared/ui/components/primitives'

import { Plus, Server } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import ApiProviderCard from './ApiProviderCard'
import { DEFAULT_PROVIDER_TEMPLATES } from './constants'

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google Gemini',
  nvidia: 'NVIDIA NIM'
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
    <SettingsSection icon={<Server className="h-4 w-4" />} title={t('api_chat_providers_title')}>
      {/* `font: inherit` in _base.css kills `text-*` on <button>, so the label
          size is set on the span inside each control. */}
      <div className="flex flex-wrap items-center justify-end gap-1.5">
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
            <span className="text-ql-11">{PROVIDER_DISPLAY_NAMES[key] || key}</span>
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
          <span className="text-ql-11">{t('api_chat_custom_provider')}</span>
        </Button>
      </div>

      {(!providers || providers.length === 0) && (
        <EmptyState
          bare
          size="sm"
          icon={Server}
          title={t('api_chat_no_providers')}
          className="py-4"
        />
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
    </SettingsSection>
  )
}

export default memo(ApiProviderList)
