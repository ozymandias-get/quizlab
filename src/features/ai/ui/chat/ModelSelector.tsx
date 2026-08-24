import type { ApiConfig } from '@shared-core/types'

import { InlineSelector } from '@app/components/ui/inline-selector'
import { Input } from '@app/components/ui/input'
import { InputGroup, InputGroupAddon } from '@app/components/ui/input-group'

import { Check, ChevronDown, Search, Sparkles } from 'lucide-react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
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
  const listboxId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const listRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const allModels = useMemo(() => activeProvider?.models ?? [], [activeProvider])

  const filteredModels = useMemo(
    () => allModels.filter((model) => model.toLowerCase().includes(modelSearch.toLowerCase())),
    [allModels, modelSearch]
  )

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setModelSearch('')
    setActiveIndex(-1)
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
    if (!isOpen) return
    setActiveIndex((prev) => {
      if (prev >= 0 && prev < filteredModels.length) return prev
      const selectedIndex = filteredModels.indexOf(selectedModel)
      return selectedIndex >= 0 ? selectedIndex : -1
    })
  }, [isOpen, filteredModels, selectedModel])

  useEffect(() => {
    if (activeIndex >= 0) {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-model-index="${activeIndex}"]`)
        ?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  const handleSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (filteredModels.length === 0) return
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % filteredModels.length)
    } else if (e.key === 'ArrowUp') {
      if (filteredModels.length === 0) return
      e.preventDefault()
      setActiveIndex((prev) => (prev <= 0 ? filteredModels.length - 1 : prev - 1))
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < filteredModels.length) {
        e.preventDefault()
        handleSelect(filteredModels[activeIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleClose()
    } else if (e.key === 'Home') {
      if (filteredModels.length === 0) return
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === 'End') {
      if (filteredModels.length === 0) return
      e.preventDefault()
      setActiveIndex(filteredModels.length - 1)
    }
  }

  if (!activeProvider) return null

  const currentDisplayName =
    selectedModel || activeProvider.defaultModel || t('api_chat_select_model')

  const activeDescendantId = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined

  return (
    <div className="relative">
      <InlineSelector
        open={isOpen}
        onClose={handleClose}
        closeLabel={t('api_chat_close_selector')}
        popupClassName="max-h-[300px] min-w-[240px]"
        trigger={
          <button
            ref={triggerRef}
            type="button"
            onClick={() => {
              setIsOpen(!isOpen)
              setModelSearch('')
            }}
            className="group/btn text-ql-12 border-border/80 bg-card/80 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 flex max-w-[200px] cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 shadow-2xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            data-state={isOpen ? 'open' : 'closed'}
          >
            <Sparkles className="text-primary h-3.5 w-3.5 shrink-0" />

            <span className="text-foreground max-w-[120px] truncate font-medium">
              {currentDisplayName}
            </span>
            <ChevronDown className="text-muted-foreground motion-normal h-3 w-3 shrink-0 opacity-60 transition-transform group-data-[state=open]:rotate-180" />
          </button>
        }
      >
        <div className="border-border/60 relative mb-1 border-b pb-1.5">
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <Search className="text-muted-foreground/60 h-3 w-3" />
            </InputGroupAddon>
            <Input
              // eslint-disable-next-line jsx-a11y/no-autofocus -- focus search input when popover opens
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={activeDescendantId}
              aria-label={t('api_chat_search_models')}
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t('api_chat_search_models')}
              onClick={(e) => e.stopPropagation()}
              size="sm"
              className="pl-7"
            />
          </InputGroup>
        </div>
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="custom-scrollbar max-h-[200px] min-h-0 flex-1 space-y-0.5 overflow-y-auto p-0.5"
        >
          {allModels.length === 0 ? (
            <div className="text-ql-11 text-muted-foreground px-3 py-3 text-center leading-normal">
              {t('api_chat_no_fetched_models')}
            </div>
          ) : filteredModels.length > 0 ? (
            filteredModels.map((model, index) => {
              const isSelected = model === selectedModel
              const isActive = index === activeIndex
              return (
                <div
                  key={model}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  data-model-index={index}
                  onMouseDown={() => handleSelect(model)}
                  className={`text-ql-12 flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left font-mono font-medium transition-colors ${
                    isSelected
                      ? 'bg-primary/10 text-primary font-semibold'
                      : isActive
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  }`}
                >
                  <span className="truncate">{model}</span>
                  {isSelected && <Check className="text-primary h-3.5 w-3.5 shrink-0" />}
                </div>
              )
            })
          ) : (
            <div className="text-ql-11 text-muted-foreground px-3 py-3 text-center">
              {t('api_chat_no_models_found')}
            </div>
          )}
        </div>
      </InlineSelector>
    </div>
  )
})

export default ModelSelector
