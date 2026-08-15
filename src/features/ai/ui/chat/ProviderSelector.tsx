import type { ApiConfig } from '@shared-core/types'

import { ChevronDown, Database } from 'lucide-react'
import { memo, useState } from 'react'
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

  if (!config || config.providers.length === 0) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowProviderSelector(!showProviderSelector)}
        className="group/btn text-ql-12 border-border bg-card text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 shadow-xs transition-colors"
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>

        <Database className="text-muted-foreground h-3.5 w-3.5" />

        <span className="text-foreground font-medium">
          {activeProvider?.name || t('api_chat_select_provider')}
        </span>
        <ChevronDown className="text-muted-foreground h-3 w-3 opacity-60" />
      </button>
      {showProviderSelector && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowProviderSelector(false)}
            aria-hidden="true"
          />
          <div className="border-border bg-popover text-popover-foreground shadow-ambient-lg absolute bottom-full left-0 z-20 mb-2 min-w-[180px] rounded-xl border p-1 backdrop-blur-md">
            {config.providers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelectProvider(p.id)
                  setShowProviderSelector(false)
                }}
                className={`text-ql-12 w-full rounded-md px-2.5 py-1.5 text-left font-medium transition-colors ${
                  p.id === activeProviderId
                    ? 'bg-accent text-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {p.name || p.baseUrl}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
})

export default ProviderSelector
