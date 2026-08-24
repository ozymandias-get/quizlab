import type { ApiConfig } from '@shared-core/types'

import { Button } from '@app/components/ui/button'
import { InlineSelector } from '@app/components/ui/inline-selector'

import { Check, ChevronDown, Database } from 'lucide-react'
import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface ProviderSelectorProps {
  config: ApiConfig | null
  activeProvider: ApiConfig['providers'][number] | null
  activeProviderId: string
  onSelectProvider: (id: string) => void
}

const ProviderSelector = memo(function ProviderSelector({
  config,
  activeProvider,
  activeProviderId,
  onSelectProvider
}: ProviderSelectorProps) {
  const { t } = useTranslation()
  const [showProviderSelector, setShowProviderSelector] = useState(false)

  const handleSelect = useCallback(
    (id: string) => {
      onSelectProvider(id)
      setShowProviderSelector(false)
    },
    [onSelectProvider]
  )

  if (!config || config.providers?.length === 0) return null

  return (
    <div className="relative">
      <InlineSelector
        open={showProviderSelector}
        onClose={() => setShowProviderSelector(false)}
        closeLabel={t('close')}
        popupClassName="min-w-[200px]"
        trigger={
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-state={showProviderSelector ? 'open' : 'closed'}
            onClick={() => setShowProviderSelector(!showProviderSelector)}
            className="bg-card/80 text-ql-12 h-7 gap-1.5 rounded-lg px-2.5 font-medium shadow-2xs"
            aria-haspopup="listbox"
            aria-expanded={showProviderSelector}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>

            <Database className="text-muted-foreground/80 h-3.5 w-3.5" />

            <span className="text-foreground">
              {activeProvider?.name || t('api_chat_select_provider')}
            </span>
            <ChevronDown className="text-muted-foreground motion-normal h-3 w-3 opacity-60 transition-transform group-data-[state=open]/button:rotate-180" />
          </Button>
        }
      >
        <div role="listbox" className="space-y-0.5">
          {config.providers.map((p) => {
            const isSelected = p.id === activeProviderId
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(p.id)}
                className={`text-ql-12 flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left font-medium transition-colors ${
                  isSelected
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                <span className="truncate">{p.name || p.baseUrl}</span>
                {isSelected && <Check className="text-primary h-3.5 w-3.5 shrink-0" />}
              </button>
            )
          })}
        </div>
      </InlineSelector>
    </div>
  )
})

export default ProviderSelector
