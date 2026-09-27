import type { ApiProviderConfig } from '@shared-core/types'

import { Badge } from '@app/components/ui/badge'
import { Button } from '@app/components/ui/button'
import { IconButton } from '@app/components/ui/icon-button'
import { Input } from '@app/components/ui/input'
import { InputGroup, InputGroupAddon } from '@app/components/ui/input-group'
import { Label } from '@app/components/ui/label'
import { WithTooltip } from '@app/components/ui/tooltip'

import { Eye, EyeOff, KeyRound, Search, Sparkles, Trash2 } from 'lucide-react'
import { memo, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DEFAULT_PLACEHOLDERS, PROVIDER_PLACEHOLDERS } from './constants'
import {
  validateProviderBaseUrl as validateBaseUrl,
  validateProviderName as validateName
} from './providerValidation'

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
  const [nameError, setNameError] = useState('')
  const [baseUrlError, setBaseUrlError] = useState('')
  const nameId = useId()
  const baseUrlId = useId()
  const apiKeyId = useId()
  const defaultModelId = useId()

  const filteredModels = (provider.models || []).filter((m) =>
    search ? m.toLowerCase().includes(search.toLowerCase()) : true
  )

  const isTestSuccess = testResult.startsWith('OK')
  const isDefaultModel = (model: string) => model === provider.defaultModel
  const placeholders = PROVIDER_PLACEHOLDERS[provider.providerType] || DEFAULT_PLACEHOLDERS

  return (
    <div className="group border-border/60 bg-background/40 flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="muted" className="tracking-ql-label font-mono uppercase">
            {provider.providerType}
          </Badge>
          <span className="text-ql-13 text-foreground truncate font-semibold">
            {provider.name || t('unnamed_provider')}
          </span>
        </div>
        <WithTooltip label={t('delete')}>
          <IconButton
            type="button"
            size="compact"
            variant="ghost"
            onClick={() => onRemove(provider.id)}
            aria-label={t('delete')}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive -mr-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 focus-visible:opacity-100 motion-reduce:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </WithTooltip>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="text-ql-12 flex flex-col gap-1.5">
          <Label htmlFor={nameId} className="text-ql-11 text-muted-foreground font-medium">
            {t('name')}
          </Label>
          <Input
            id={nameId}
            value={provider.name}
            onChange={(e) => {
              onUpdate(provider.id, { name: e.target.value })
              if (nameError) setNameError(validateName(e.target.value))
            }}
            onBlur={() => setNameError(validateName(provider.name))}
            placeholder={t('api_chat_placeholder_provider')}
            aria-invalid={!!nameError}
          />
          {nameError && (
            <span role="alert" className="text-destructive text-ql-11 px-1">
              {t(nameError)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={baseUrlId} className="text-ql-11 text-muted-foreground font-medium">
            {t('api_chat_base_url')}
          </Label>
          <div className="text-ql-12 font-mono">
            <Input
              id={baseUrlId}
              value={provider.baseUrl}
              onChange={(e) => {
                onUpdate(provider.id, { baseUrl: e.target.value })
                if (baseUrlError) setBaseUrlError(validateBaseUrl(e.target.value))
              }}
              onBlur={() => setBaseUrlError(validateBaseUrl(provider.baseUrl))}
              placeholder="https://api.openai.com/v1"
              aria-invalid={!!baseUrlError}
            />
          </div>
          {baseUrlError && (
            <span role="alert" className="text-destructive text-ql-11 px-1">
              {t(baseUrlError)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={apiKeyId} className="text-ql-11 text-muted-foreground font-medium">
            {t('api_chat_api_key')}
          </Label>
          <InputGroup className="text-ql-12 font-mono">
            <InputGroupAddon align="inline-start">
              <KeyRound className="text-muted-foreground h-3.5 w-3.5" />
            </InputGroupAddon>
            <Input
              id={apiKeyId}
              type={showApiKey ? 'text' : 'password'}
              value={provider.apiKey}
              onChange={(e) => onUpdate(provider.id, { apiKey: e.target.value })}
              placeholder={placeholders.apiKey}
              size="sm"
              className="pr-8 pl-8"
            />
            <IconButton
              type="button"
              size="compact"
              variant="ghost"
              tabIndex={-1}
              onClick={() => setShowApiKey((prev) => !prev)}
              className="text-muted-foreground hover:text-foreground absolute right-1.5"
              aria-label={showApiKey ? t('api_chat_hide_api_key') : t('api_chat_show_api_key')}
            >
              {showApiKey ? <EyeOff /> : <Eye />}
            </IconButton>
          </InputGroup>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={defaultModelId} className="text-ql-11 text-muted-foreground font-medium">
            {t('api_chat_default_model')}
          </Label>
          <InputGroup className="text-ql-12 font-mono">
            <InputGroupAddon align="inline-start">
              <Sparkles className="text-muted-foreground h-3.5 w-3.5" />
            </InputGroupAddon>
            <Input
              id={defaultModelId}
              value={provider.defaultModel}
              onChange={(e) => onUpdate(provider.id, { defaultModel: e.target.value })}
              className="pl-8"
              placeholder={placeholders.model}
            />
          </InputGroup>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onTestConnection(provider.id)}
          disabled={testing}
        >
          <span className="text-ql-11">
            {testing ? t('testing') : t('api_chat_test_connection')}
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onFetchModels(provider.id)}
          disabled={fetchingModels || !provider.apiKey || !provider.baseUrl}
        >
          <span className="text-ql-11">
            {fetchingModels ? t('fetching') : t('api_chat_fetch_models')}
          </span>
        </Button>

        {testResult && (
          <Badge
            variant={isTestSuccess ? 'success' : 'destructive'}
            className="text-ql-11 max-w-full truncate"
          >
            {testResult}
          </Badge>
        )}
      </div>

      {(provider.models || []).length > 0 && (
        <div className="border-border/60 flex flex-col gap-2 border-t pt-4">
          <div className="flex items-center gap-2">
            <label className="text-ql-11 text-muted-foreground shrink-0 font-medium">
              {t('api_chat_models_count')} ({provider.models.length})
            </label>
            <InputGroup className="text-ql-12 flex-1">
              <InputGroupAddon align="inline-start">
                <Search className="text-muted-foreground h-3 w-3" />
              </InputGroupAddon>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size="sm"
                className="pl-7"
                placeholder={t('api_chat_search_models')}
              />
            </InputGroup>
          </div>
          <div className="border-border/60 bg-muted/30 custom-scrollbar max-h-[140px] overflow-y-auto rounded-lg border p-1">
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
                  className={`w-full rounded-md px-2.5 py-1 text-left transition-colors ${
                    isDefaultModel(m)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span
                    className={`text-ql-11 font-mono ${isDefaultModel(m) ? 'font-semibold' : ''}`}
                  >
                    {m}
                  </span>
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
