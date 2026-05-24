import { useState } from 'react'
import { useLanguageStrings } from '@app/providers'
import type { ApiConfig } from '@shared-core/types'

interface ProviderSelectorProps {
  config: ApiConfig | null
  activeProvider: ApiConfig['providers'][number] | null
  activeProviderId: string
  onSelectProvider: (id: string) => void
}

export function ProviderSelector({
  config,
  activeProvider,
  activeProviderId,
  onSelectProvider
}: ProviderSelectorProps) {
  const { t } = useLanguageStrings()
  const [showProviderSelector, setShowProviderSelector] = useState(false)

  if (!config || config.providers.length === 0) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowProviderSelector(!showProviderSelector)}
        className="group/btn flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12] px-3 py-1.5 text-ql-11 text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer shadow-sm active:scale-95"
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400/70"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]"></span>
        </span>

        {/* Database/Server rack SVG icon */}
        <svg
          className="h-3.5 w-3.5 text-zinc-500 group-hover/btn:text-zinc-400 transition-colors"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>

        <span className="font-semibold text-zinc-300">
          {activeProvider?.name || t('api_chat_select_provider') || 'Sağlayıcı'}
        </span>
        <svg
          className="h-3 w-3 opacity-40 group-hover/btn:opacity-75 transition-opacity"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {showProviderSelector && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowProviderSelector(false)} />
          <div className="absolute bottom-full left-0 mb-2.5 z-20 min-w-[190px] rounded-2xl border border-white/[0.08] bg-zinc-950/95 backdrop-blur-2xl p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] animate-app-enter">
            {config.providers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelectProvider(p.id)
                  setShowProviderSelector(false)
                }}
                className={`w-full rounded-xl px-3 py-2 text-left text-ql-12 font-medium transition-all duration-150 ${
                  p.id === activeProviderId
                    ? 'bg-amber-500/10 text-amber-400 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]'
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
}
