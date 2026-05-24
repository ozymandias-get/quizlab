import { memo } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { useLanguageStrings } from '@app/providers'
import { getAiIcon } from '@ui/components/Icons'
import type { GridDragReorderState } from '@features/ai/hooks/useGridDragReorder'
import type { AiSiteMap, SectionTone } from '../../model/home'
import { GridCard } from './aiHomeCards/GridCard'

export { StatChip, EmptySitesState, OpenTabsToggle } from './aiHomeCards'

interface AiHomeCardGridProps {
  activeModelIds: Set<string>
  aiSites: AiSiteMap
  cardColumns: string
  dragState: GridDragReorderState
  ids: string[]
  onOpenModel: (id: string) => void
  tone: SectionTone
}

export const AiHomeCardGrid = memo<AiHomeCardGridProps>(function AiHomeCardGrid({
  activeModelIds,
  aiSites,
  cardColumns,
  dragState,
  ids,
  onOpenModel,
  tone
}: AiHomeCardGridProps) {
  const { t } = useLanguageStrings()

  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: cardColumns }}>
      {tone === 'model' && (
        <button
          type="button"
          onClick={() => onOpenModel('api-chat')}
          className={`group relative w-full rounded-xl border px-3 py-2.5 text-left transition-all ${
            activeModelIds.has('api-chat')
              ? 'border-amber-500/30 bg-amber-500/[0.06]'
              : 'border-white/8 bg-white/[0.02] hover:border-amber-500/20 hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-500 shadow-md shadow-amber-500/5">
              {getAiIcon('api-chat')}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-ql-13 font-semibold text-white/82">
                  {t('api_chat_home_card_title') || 'API ile Doğrudan Konuş'}
                </h3>
                <span className="rounded-full border border-amber-500/20 bg-amber-500/5 px-1.5 py-0.5 text-[10px] text-amber-400 font-medium">
                  {t('ai_home.featured') || 'Öne Çıkan'}
                </span>
              </div>
              <p className="truncate mt-0.5 text-ql-11 text-white/40">
                {t('api_chat_home_card_desc') || 'Kendi API anahtarınızla LLM modellerine bağlanın'}
              </p>
            </div>
            {activeModelIds.has('api-chat') && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500 animate-pulse" />
            )}
            <div className="text-white/30 transition-colors group-hover:text-white/60">
              <ArrowUpRight className="h-3.5 w-3.5" />
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
              onClick={() => onOpenModel(id)}
              onDragEnd={dragState.handleDragEnd}
              onDragOver={(event) => dragState.handleDragOver(event, id)}
              onDragStart={() => dragState.handleDragStart(id)}
              onDrop={dragState.handleDrop}
              site={site}
              tone={tone}
            />
          )
        })}
    </div>
  )
})
