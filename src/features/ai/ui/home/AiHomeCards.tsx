import type { GridDragReorderState } from '@features/ai/hooks/useGridDragReorder'

import { getAiIcon } from '@ui/components/Icons'

import { ArrowUpRight } from 'lucide-react'
import { type DragEvent, memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { AiSiteMap, SectionTone } from '../../model/home'
import GridCard from './aiHomeCards/GridCard'

export { default as EmptySitesState } from './aiHomeCards/EmptySitesState'

interface AiHomeCardGridProps {
  activeModelIds: Set<string>
  aiSites: AiSiteMap
  cardColumns: string
  dragState: GridDragReorderState
  ids: string[]
  onOpenModel: (id: string) => void
  tone: SectionTone
}

const AiHomeCardGrid = memo<AiHomeCardGridProps>(function AiHomeCardGrid({
  activeModelIds,
  aiSites,
  cardColumns,
  dragState,
  ids,
  onOpenModel,
  tone
}: AiHomeCardGridProps) {
  const { t } = useTranslation()
  const gridStyle = useMemo(() => ({ gridTemplateColumns: cardColumns }), [cardColumns])

  // The hook's `handleDragOver` is `(event, id) => void` (React DOM ordering),
  // but `GridCard`'s prop signature is `(id, event) => void` (curried). This
  // adapter swaps the args. `dragState.handleDragOver` is itself a stable
  // `useCallback` from the hook, so this adapter is also stable — important
  // because `GridCard` is `memo`'d and a fresh lambda on every render would
  // defeat that.
  const handleCardDragOver = useCallback(
    (itemId: string, event: DragEvent<Element>) => dragState.handleDragOver(event, itemId),
    [dragState]
  )

  return (
    <div className="grid gap-2.5 contain-content" style={gridStyle}>
      {tone === 'model' && (
        <button
          type="button"
          onClick={() => onOpenModel('api-chat')}
          className={`group hover:shadow-ambient-sm motion-normal relative w-full cursor-pointer rounded-xl border p-3 text-left shadow-2xs transition-all hover:-translate-y-0.5 motion-reduce:transform-none ${
            activeModelIds.has('api-chat')
              ? 'border-ring/60 bg-accent/20'
              : 'border-border/80 bg-card hover:border-border hover:bg-muted/60'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="border-border/60 bg-muted/60 motion-normal flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-amber-500 transition-transform group-hover:scale-105 motion-reduce:scale-100">
              {getAiIcon('api-chat')}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-ql-13 text-foreground truncate font-semibold">
                {t('api_chat_home_card_title')}
              </h3>
              <p className="text-ql-11 text-muted-foreground mt-0.5 truncate">
                {t('api_chat_home_card_desc')}
              </p>
            </div>
            {activeModelIds.has('api-chat') && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
            )}
            <div className="text-muted-foreground/60 group-hover:text-foreground transition-colors">
              <ArrowUpRight className="motion-normal h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" />
            </div>
          </div>
        </button>
      )}

      {ids
        .filter((id) => id !== 'api-chat')
        .map((id) => {
          const site = aiSites[id]
          if (!site) return null
          return (
            <GridCard
              key={id}
              isActive={activeModelIds.has(id)}
              isDragging={dragState.dragItemRef.current === id}
              itemId={id}
              onClick={onOpenModel}
              onDragEnd={dragState.handleDragEnd}
              onDragOver={handleCardDragOver}
              onDragStart={dragState.handleDragStart}
              onDrop={dragState.handleDrop}
              site={site}
              tone={tone}
            />
          )
        })}
    </div>
  )
})

export default AiHomeCardGrid
