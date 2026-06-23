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
        className="group/btn text-ql-11 flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-zinc-400 shadow-sm transition-colors hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-zinc-200 active:scale-95"
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
        </span>

        <Database className="h-3.5 w-3.5 text-zinc-500 transition-colors group-hover/btn:text-zinc-400" />

        <span className="font-semibold text-zinc-300">
          {activeProvider?.name || t('api_chat_select_provider')}
        </span>
        <ChevronDown className="h-3 w-3 opacity-40 transition-opacity group-hover/btn:opacity-75" />
      </button>
      {showProviderSelector && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowProviderSelector(false)}
            aria-hidden="true"
          />
          <div className="animate-app-enter absolute bottom-full left-0 z-20 mb-2.5 min-w-[190px] rounded-2xl border border-white/[0.08] bg-zinc-950/95 p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            {config.providers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelectProvider(p.id)
                  setShowProviderSelector(false)
                }}
                className={`text-ql-12 w-full rounded-xl px-3 py-2 text-left font-medium transition-colors duration-150 ${
                  p.id === activeProviderId
                    ? 'bg-amber-500/10 font-semibold text-amber-400'
                    : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100'
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
