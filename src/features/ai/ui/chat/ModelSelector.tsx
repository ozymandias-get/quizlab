import type { ApiConfig } from '@shared-core/types'

import { Input } from '@app/components/ui/input'

import { ChevronDown, Sparkles } from 'lucide-react'
import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface ModelSelectorProps {
  activeProvider: ApiConfig['providers'][number] | null
  selectedModel: string
  onSelectModel: (model: string) => void
}

export const ModelSelector = memo(function ModelSelector({
  activeProvider,
  selectedModel,
  onSelectModel
}: ModelSelectorProps) {
  const { t } = useTranslation()
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
        className="group/btn text-ql-11 flex max-w-[220px] cursor-pointer items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-zinc-400 shadow-sm transition-colors hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-zinc-200 active:scale-95"
      >
        <Sparkles className="h-3.5 w-3.5 text-amber-500/80 transition-colors group-hover/btn:text-amber-400" />

        <span className="max-w-[130px] truncate font-semibold text-zinc-300">
          {selectedModel || activeProvider.defaultModel || t('api_chat_select_model')}
        </span>
        <ChevronDown className="h-3 w-3 opacity-40 transition-opacity group-hover/btn:opacity-75" />
      </button>

      {showModelSelector && (
        <>
          <button
            type="button"
            aria-label={t('api_chat_close_selector', 'Close')}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => {
              setShowModelSelector(false)
              setModelSearch('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setShowModelSelector(false)
                setModelSearch('')
              }
            }}
          />
          <div className="animate-app-enter absolute bottom-full left-0 z-20 mb-2.5 flex max-h-[320px] min-w-[250px] flex-col rounded-2xl border border-white/[0.08] bg-zinc-950/95 p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            <div className="relative mb-1 border-b border-white/[0.05] p-1">
              <Input
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder={t('api_chat_search_models')}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="custom-scrollbar max-h-[230px] min-h-0 flex-1 overflow-y-auto p-0.5">
              {allModels.length === 0 ? (
                <div className="text-ql-11 px-3 py-4 text-center leading-normal text-white/30">
                  {t('api_chat_no_fetched_models')}
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
                    className={`text-ql-12 w-full rounded-xl px-3 py-2 text-left font-medium transition-colors duration-150 ${
                      m === selectedModel
                        ? 'bg-amber-500/10 font-semibold text-amber-400'
                        : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100'
                    }`}
                  >
                    {m}
                  </button>
                ))
              ) : (
                <div className="text-ql-11 px-3 py-4 text-center text-white/30">
                  {t('api_chat_no_models_found')}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
})
