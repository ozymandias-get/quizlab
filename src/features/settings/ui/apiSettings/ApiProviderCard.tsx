import type { ApiProviderConfig } from '@shared-core/types'

import { Badge } from '@app/components/ui/badge'
import { Button } from '@app/components/ui/button'
import { IconButton } from '@app/components/ui/icon-button'
import { Input } from '@app/components/ui/input'
import { InputGroup, InputGroupAddon } from '@app/components/ui/input-group'
import { Label } from '@app/components/ui/label'

import { Eye, EyeOff, KeyRound, Search, Sparkles } from 'lucide-react'
import { memo, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

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

  return (
    <div className="border-border/80 bg-card/70 flex flex-col gap-3.5 rounded-xl border p-4 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="tracking-ql-label font-mono uppercase">
            {provider.providerType}
          </Badge>
          <span className="text-ql-13 text-foreground font-semibold">
            {provider.name || t('unnamed_provider')}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => onRemove(provider.id)}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7"
        >
          {t('delete')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
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
          <Input
            id={baseUrlId}
            value={provider.baseUrl}
            onChange={(e) => {
              onUpdate(provider.id, { baseUrl: e.target.value })
              if (baseUrlError) setBaseUrlError(validateBaseUrl(e.target.value))
            }}
            onBlur={() => setBaseUrlError(validateBaseUrl(provider.baseUrl))}
            className="text-ql-12 font-mono"
            placeholder="https://api.openai.com/v1"
            aria-invalid={!!baseUrlError}
          />
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
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <KeyRound className="text-muted-foreground/60 h-3.5 w-3.5" />
            </InputGroupAddon>
            <Input
              id={apiKeyId}
              type={showApiKey ? 'text' : 'password'}
              value={provider.apiKey}
              onChange={(e) => onUpdate(provider.id, { apiKey: e.target.value })}
              placeholder="sk-..."
              size="sm"
              className="text-ql-12 pr-8 pl-8 font-mono"
            />
            <IconButton
              type="button"
              size="compact"
              variant="ghost"
              tabIndex={-1}
              onClick={() => setShowApiKey((prev) => !prev)}
              className="text-muted-foreground/70 hover:text-foreground absolute right-1.5"
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
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <Sparkles className="text-muted-foreground/60 h-3.5 w-3.5" />
            </InputGroupAddon>
            <Input
              id={defaultModelId}
              value={provider.defaultModel}
              onChange={(e) => onUpdate(provider.id, { defaultModel: e.target.value })}
              className="text-ql-12 pl-8 font-mono"
              placeholder="gpt-4o"
            />
          </InputGroup>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onTestConnection(provider.id)}
          disabled={testing}
        >
          {testing ? t('testing') : t('api_chat_test_connection')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onFetchModels(provider.id)}
          disabled={fetchingModels || !provider.apiKey || !provider.baseUrl}
        >
          {fetchingModels ? t('fetching') : t('api_chat_fetch_models')}
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
        <div className="border-border/50 flex flex-col gap-2 border-t pt-1">
          <div className="flex items-center gap-2">
            <label className="text-ql-11 text-muted-foreground shrink-0 font-medium">
              {t('api_chat_models_count')} ({provider.models.length})
            </label>
            <InputGroup className="flex-1">
              <InputGroupAddon align="inline-start">
                <Search className="text-muted-foreground/60 h-3 w-3" />
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
          <div className="border-border/80 bg-muted/30 custom-scrollbar max-h-[140px] overflow-y-auto rounded-lg border p-1">
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
                  className={`text-ql-11 w-full rounded-md px-2.5 py-1 text-left font-mono transition-colors ${
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
