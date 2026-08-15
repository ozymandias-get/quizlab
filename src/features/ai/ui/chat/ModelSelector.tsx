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

const ModelSelector = memo(function ModelSelector({
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
        className="group/btn text-ql-12 border-border bg-card text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground flex max-w-[200px] cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 shadow-xs transition-colors"
      >
        <Sparkles className="text-primary h-3.5 w-3.5" />

        <span className="text-foreground max-w-[120px] truncate font-medium">
          {selectedModel || activeProvider.defaultModel || t('api_chat_select_model')}
        </span>
        <ChevronDown className="text-muted-foreground h-3 w-3 opacity-60" />
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
          <div className="border-border bg-popover text-popover-foreground shadow-ambient-lg absolute bottom-full left-0 z-20 mb-2 flex max-h-[300px] min-w-[220px] flex-col rounded-xl border p-1 backdrop-blur-md">
            <div className="border-border/70 relative mb-1 border-b p-1">
              <Input
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder={t('api_chat_search_models')}
                onClick={(e) => e.stopPropagation()}
                className="h-7 text-xs"
              />
            </div>
            <div className="custom-scrollbar max-h-[200px] min-h-0 flex-1 overflow-y-auto p-0.5">
              {allModels.length === 0 ? (
                <div className="text-ql-11 text-muted-foreground px-3 py-3 text-center leading-normal">
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
                    className={`text-ql-12 w-full rounded-md px-2.5 py-1.5 text-left font-medium transition-colors ${
                      m === selectedModel
                        ? 'bg-accent text-foreground font-semibold'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {m}
                  </button>
                ))
              ) : (
                <div className="text-ql-11 text-muted-foreground px-3 py-3 text-center">
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

export default ModelSelector
