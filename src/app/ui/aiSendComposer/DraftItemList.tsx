import type { AiDraftItem } from '@app/providers/ai/types'

import { Sparkles } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import DraftItemRow from './DraftItemRow'

interface DraftItemListProps {
  items: AiDraftItem[]
  onRemoveItem?: (id: string) => void
}

/**
 * İçerik listesi — kompakt satırlar, sırayla. Görsel galerisi yok.
 *
 * Liste sabit tavanlık içinde akar (208px), böylece 10+ öğe eklenince panel
 * zıplamaz; sayfa numarası her satırda okunabilir.
 */
function DraftItemList({ items, onRemoveItem }: DraftItemListProps) {
  const { t } = useTranslation()

  return (
    <div
      className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2"
      style={{ maxHeight: 208 }}
    >
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
          <span
            className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-xl"
            aria-hidden
          >
            <Sparkles className="size-4" />
          </span>
          <p className="text-muted-foreground text-ql-11 leading-relaxed">{t('ai_draft_empty')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1" aria-label={t('ai_send_panel_title')}>
          {items.map((item) => (
            <DraftItemRow key={item.id} item={item} onRemove={onRemoveItem} />
          ))}
        </ul>
      )}
    </div>
  )
}

export default memo(DraftItemList)
