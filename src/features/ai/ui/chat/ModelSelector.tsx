import { useState } from 'react'
import { useLanguageStrings } from '@app/providers'
import type { ApiConfig } from '@shared-core/types'

interface ModelSelectorProps {
  activeProvider: ApiConfig['providers'][number] | null
  selectedModel: string
  onSelectModel: (model: string) => void
}

export function ModelSelector({
  activeProvider,
  selectedModel,
  onSelectModel
}: ModelSelectorProps) {
  const { t } = useLanguageStrings()
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [modelSearch, setModelSearch] = useState('')

  if (!activeProvider) return null

  const allModels = activeProvider.models || []
  const filteredModels = allModels.filter((m) =>
    m.toLowerCase().includes(modelSearch.toLowerCase())
  )

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setShowModelSelector(!showModelSelector)
          setModelSearch('')
        }}
        className="group/btn flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12] px-3 py-1.5 text-ql-11 text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer shadow-sm max-w-[220px] active:scale-95"
      >
        {/* Sparkle/AI Magic SVG icon */}
        <svg
          className="h-3.5 w-3.5 text-amber-500/80 group-hover/btn:text-amber-400 transition-colors"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9Z" />
        </svg>

        <span className="truncate max-w-[130px] font-semibold text-zinc-300">
          {selectedModel || activeProvider.defaultModel || t('api_chat_select_model') || 'Model'}
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

      {showModelSelector && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              setShowModelSelector(false)
              setModelSearch('')
            }}
          />
          <div className="absolute bottom-full left-0 mb-2.5 z-20 min-w-[250px] max-h-[320px] rounded-2xl border border-white/[0.08] bg-zinc-950/95 backdrop-blur-2xl p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-col animate-app-enter">
            <div className="relative p-1 border-b border-white/[0.05] mb-1">
              <input
                type="text"
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder={t('api_chat_search_models') || 'Modelleri ara...'}
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-ql-12 text-zinc-200 placeholder-zinc-500 outline-none focus:border-amber-500/40 focus:bg-white/[0.05] transition-all"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="flex-1 overflow-y-auto max-h-[230px] custom-scrollbar p-0.5">
              {allModels.length === 0 ? (
                <div className="px-3 py-4 text-ql-11 text-white/30 text-center leading-normal">
                  {t('api_chat_no_fetched_models') || "Model bulunamadı. Ayarlar'dan çekin."}
                </div>
              ) : filteredModels.length > 0 ? (
                filteredModels.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      onSelectModel(m)
                      setShowModelSelector(false)
                      setModelSearch('')
                    }}
                    className={`w-full rounded-xl px-3 py-2 text-left text-ql-12 font-medium transition-all duration-150 ${
                      m === selectedModel
                        ? 'bg-amber-500/10 text-amber-400 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]'
                    }`}
                  >
                    {m}
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-ql-11 text-white/30 text-center">
                  {t('api_chat_no_models_found') || 'Model bulunamadı'}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
