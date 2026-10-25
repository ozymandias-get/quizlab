import { googleAccountSlotOptions } from '@shared-core/constants/siteSessionSlots'

import { useSiteSessionListQuery } from '@platform/electron/api/useSiteSessionApi'

import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/ui/components/primitives'

import { Users } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface AiTabSlotPillProps {
  modelId: string | undefined
  sessionSlot?: number
  onSwitchSlot?: (slot: number) => void
}

function AiTabSlotPill({ modelId, sessionSlot, onSwitchSlot }: AiTabSlotPillProps) {
  const { t } = useTranslation()
  const { data } = useSiteSessionListQuery()
  const view = data?.views?.find((item) => modelId && item.memberAppIds.includes(modelId))

  if (view?.kind !== 'google') return null
  const slots = googleAccountSlotOptions(view.accountSlots ?? [1])
  if (slots.length < 2) return null
  const requestedSlot = sessionSlot ?? view.activeSlot ?? 1
  const currentSlot = slots.includes(requestedSlot) ? requestedSlot : slots[0]

  const tooltipText = t('ws_tab_slot_tooltip', { slot: currentSlot })

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <label className="text-ql-11 bg-muted/60 border-border/60 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-medium">
          <Users className="text-muted-foreground h-3.5 w-3.5" />
          <select
            aria-label={t('ws_google_account_select')}
            className="text-foreground cursor-pointer bg-transparent outline-none"
            value={currentSlot}
            onChange={(event) => onSwitchSlot?.(Number(event.target.value))}
          >
            {slots.map((slot) => (
              <option key={slot} value={slot}>
                {t('ws_account_slot', { slot })}
              </option>
            ))}
          </select>
        </label>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltipText}</TooltipContent>
    </Tooltip>
  )
}

export default memo(AiTabSlotPill)
