import type { ApiConfig } from '@shared-core/types'

import { Input } from '@app/components/ui/input'
import { InputGroup, InputGroupAddon } from '@app/components/ui/input-group'

import { Check, ChevronDown, Search, Sparkles } from 'lucide-react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
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
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const listRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const allModels = activeProvider?.models || []
  const filteredModels = allModels.filter((m) =>
    m.toLowerCase().includes(modelSearch.toLowerCase())
  )

  const handleClose = useCallback(() => {
    setShowModelSelector(false)
    setModelSearch('')
    setFocusedIndex(-1)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  const handleSelect = useCallback(
    (model: string) => {
      onSelectModel(model)
      handleClose()
    },
    [onSelectModel, handleClose]
  )

  useEffect(() => {
    if (showModelSelector) {
      setFocusedIndex(-1)
    }
  }, [showModelSelector])

  useEffect(() => {
    if (focusedIndex >= 0) {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-model-index="${focusedIndex}"]`)
        ?.scrollIntoView({ block: 'nearest' })
    }
  }, [focusedIndex])

  const handleSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((prev) =>
        filteredModels.length > 0 ? (prev + 1) % filteredModels.length : -1
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((prev) =>
        filteredModels.length > 0 ? (prev <= 0 ? filteredModels.length - 1 : prev - 1) : -1
      )
    } else if (e.key === 'Enter') {
      if (focusedIndex >= 0 && focusedIndex < filteredModels.length) {
        e.preventDefault()
        handleSelect(filteredModels[focusedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleClose()
    }
  }

  if (!activeProvider) return null

  const currentDisplayName =
    selectedModel || activeProvider.defaultModel || t('api_chat_select_model')

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setShowModelSelector(!showModelSelector)
          setModelSearch('')
        }}
        className="group/btn text-ql-12 border-border/80 bg-card/80 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 flex max-w-[200px] cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 shadow-2xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
        aria-haspopup="listbox"
        aria-expanded={showModelSelector}
        data-state={showModelSelector ? 'open' : 'closed'}
      >
        <Sparkles className="text-primary h-3.5 w-3.5 shrink-0" />

        <span className="text-foreground max-w-[120px] truncate font-medium">
          {currentDisplayName}
        </span>
        <ChevronDown className="text-muted-foreground h-3 w-3 shrink-0 opacity-60 transition-transform duration-150 group-data-[state=open]:rotate-180" />
      </button>

      {showModelSelector && (
        <>
          <button
            type="button"
            aria-label={t('api_chat_close_selector', 'Close')}
            className="fixed inset-0 z-10 cursor-default"
            onClick={handleClose}
          />
          <div className="border-border/80 bg-popover/95 text-popover-foreground shadow-ambient-lg animate-in fade-in zoom-in-98 absolute bottom-full left-0 z-20 mb-2 flex max-h-[300px] min-w-[240px] flex-col rounded-xl border p-1.5 backdrop-blur-md duration-150">
            <div className="border-border/60 relative mb-1 border-b pb-1.5">
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <Search className="text-muted-foreground/60 h-3 w-3" />
                </InputGroupAddon>
                <Input
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- focus search input when popover opens
                  autoFocus
                  value={modelSearch}
                  onChange={(e) => {
                    setModelSearch(e.target.value)
                    setFocusedIndex(-1)
                  }}
                  onKeyDown={handleSearchKeyDown}
                  aria-activedescendant={
                    focusedIndex >= 0 ? `model-option-${focusedIndex}` : undefined
                  }
                  placeholder={t('api_chat_search_models')}
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 pl-7 text-xs font-normal"
                />
              </InputGroup>
            </div>
            <div
              ref={listRef}
              role="listbox"
              className="custom-scrollbar max-h-[200px] min-h-0 flex-1 space-y-0.5 overflow-y-auto p-0.5"
            >
              {allModels.length === 0 ? (
                <div className="text-ql-11 text-muted-foreground px-3 py-3 text-center leading-normal">
                  {t('api_chat_no_fetched_models')}
                </div>
              ) : filteredModels.length > 0 ? (
                filteredModels.map((m, index) => {
                  const isSelected = m === selectedModel
                  const isFocused = index === focusedIndex
                  return (
                    <button
                      key={m}
                      id={`model-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-model-index={index}
                      onClick={() => handleSelect(m)}
                      className={`text-ql-12 flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left font-mono font-medium transition-colors ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-semibold'
                          : isFocused
                            ? 'bg-muted text-foreground'
                            : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                      }`}
                    >
                      <span className="truncate">{m}</span>
                      {isSelected && <Check className="text-primary h-3.5 w-3.5 shrink-0" />}
                    </button>
                  )
                })
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
