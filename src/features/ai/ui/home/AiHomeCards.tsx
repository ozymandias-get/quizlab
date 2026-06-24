import type { GridDragReorderState } from '@features/ai/hooks/useGridDragReorder'

import { GlowingEffect } from '@app/components/ui/glowing-effect'
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
        <div className="relative rounded-xl">
          <GlowingEffect
            disabled={false}
            blur={0}
            spread={20}
            borderWidth={1}
            proximity={40}
            inactiveZone={0}
          />
          <button
            type="button"
            onClick={() => onOpenModel('api-chat')}
            className={`group relative w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
              activeModelIds.has('api-chat')
                ? 'border-amber-500/30 bg-amber-500/[0.06]'
                : 'border-border bg-card hover:bg-muted hover:border-amber-500/20'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-500 shadow-md shadow-amber-500/5">
                {getAiIcon('api-chat')}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-ql-13 text-foreground/90 truncate font-semibold">
                  {t('api_chat_home_card_title')}
                </h3>
                <p className="text-ql-11 text-muted-foreground mt-0.5 truncate">
                  {t('api_chat_home_card_desc')}
                </p>
              </div>
              {activeModelIds.has('api-chat') && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              )}
              <div className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </button>
        </div>
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
