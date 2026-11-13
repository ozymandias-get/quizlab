import type { GridDragReorderState } from '@features/ai/hooks/useGridDragReorder'

import { BlurFade } from '@app/components/ui/blur-fade'
import { MagicCard } from '@app/components/ui/magic-card'
import { getAiIcon } from '@ui/components/Icons'

import { ArrowUpRight } from 'lucide-react'
import { type DragEvent, memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AiSiteMap, SectionTone } from '../../model/home'
import { safeAiAccentColor } from '../../model/home'
import GridCard from './aiHomeCards/GridCard'

export { default as EmptySitesState } from './aiHomeCards/EmptySitesState'

/** Mirrors the `api-chat` entry in the platform registry. Used when the model
 *  is not present in `aiSites` so the card still renders with its brand color. */
const API_CHAT_FALLBACK_ACCENT = '#f59e0b'

interface AiHomeCardGridProps {
  activeModelIds: Set<string>
  aiSites: AiSiteMap
  cardColumns: string
  dragState: GridDragReorderState
  ids: string[]
  onOpenModel: (id: string) => void
  tone: SectionTone
  showApiChat?: boolean
}

const AiHomeCardGrid = memo<AiHomeCardGridProps>(function AiHomeCardGrid({
  activeModelIds,
  aiSites,
  cardColumns,
  dragState,
  ids,
  onOpenModel,
  tone,
  showApiChat = true
}: AiHomeCardGridProps) {
  const { t } = useTranslation()
  const [reorderAnnouncement, setReorderAnnouncement] = useState('')
  const gridStyle = useMemo(() => ({ gridTemplateColumns: cardColumns }), [cardColumns])
  const apiChatAccent = useMemo(
    () => safeAiAccentColor(aiSites['api-chat']?.color ?? API_CHAT_FALLBACK_ACCENT),
    [aiSites]
  )
  const isApiChatActive = activeModelIds.has('api-chat')

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

  const handleCardDragLeave = useCallback(
    (itemId: string, event: DragEvent<Element>) => dragState.handleDragLeave(event, itemId),
    [dragState]
  )

  const handleCardMove = useCallback(
    (itemId: string, delta: -1 | 1) => {
      const visibleIds = ids.filter(
        (id) => !(tone === 'model' && showApiChat && id === 'api-chat') && Boolean(aiSites[id])
      )
      const fromIndex = visibleIds.indexOf(itemId)
      const toIndex = fromIndex + delta
      dragState.moveItem(itemId, delta)
      if (fromIndex !== -1 && toIndex >= 0 && toIndex < visibleIds.length) {
        const site = aiSites[itemId]
        const name = site?.displayName || site?.name || itemId
        setReorderAnnouncement(`${name} (${toIndex + 1} / ${visibleIds.length})`)
      }
    },
    [aiSites, dragState, ids, showApiChat, tone]
  )

  return (
    <>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {reorderAnnouncement}
      </span>
      <div className="grid gap-2.5 contain-content" style={gridStyle}>
        {tone === 'model' && showApiChat && (
          <div role="presentation">
            <BlurFade className="h-full">
              <MagicCard
                className={`h-full rounded-xl ${isApiChatActive ? 'ring-ring/40 ring-1' : ''}`}
                gradientColor="#18181b"
                gradientOpacity={0.35}
                gradientFrom="#27272a"
                gradientTo="#18181b"
              >
                <button
                  type="button"
                  onClick={() => onOpenModel('api-chat')}
                  className={`group motion-normal focus-visible:ring-ring/70 relative flex w-full cursor-pointer items-center rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                    isApiChatActive
                      ? 'border-ring/50 bg-accent/30'
                      : 'border-transparent bg-transparent hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex w-full items-center gap-3">
                    <div
                      className="motion-normal flex size-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105 motion-reduce:scale-100"
                      style={{
                        color: apiChatAccent,
                        backgroundColor: `color-mix(in srgb, ${apiChatAccent} 13%, transparent)`
                      }}
                    >
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
                    {isApiChatActive && (
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: apiChatAccent }}
                      />
                    )}
                    <div className="text-muted-foreground/60 group-hover:text-foreground opacity-0 transition-opacity group-focus-visible:opacity-100 focus-visible:opacity-100 motion-reduce:opacity-100">
                      <ArrowUpRight className="motion-normal h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" />
                    </div>
                  </div>
                </button>
              </MagicCard>
            </BlurFade>
          </div>
        )}

        {ids
          .filter((id) => !(tone === 'model' && showApiChat && id === 'api-chat'))
          .map((id) => {
            const site = aiSites[id]
            if (!site) return null
            return (
              <GridCard
                key={id}
                isActive={activeModelIds.has(id)}
                isDragging={dragState.draggingId === id}
                isDropTarget={dragState.dragOverId === id}
                itemId={id}
                onClick={onOpenModel}
                onDragEnd={dragState.handleDragEnd}
                onDragLeave={handleCardDragLeave}
                onDragOver={handleCardDragOver}
                onDragStart={dragState.handleDragStart}
                onDrop={dragState.handleDrop}
                onMove={handleCardMove}
                site={site}
                tone={tone}
              />
            )
          })}
      </div>
    </>
  )
})

export default AiHomeCardGrid
