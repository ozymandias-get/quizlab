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

const ACCOUNT_COLORS = [
  'bg-sky-700',
  'bg-emerald-700',
  'bg-amber-700',
  'bg-violet-700',
  'bg-rose-700'
] as const

/** A colour per slot position, so the badge is stable across reloads. */
function accountColor(slot: number): string {
  return ACCOUNT_COLORS[slot % ACCOUNT_COLORS.length]
}

function emailInitial(email: string): string {
  const first = email.trim().charAt(0)
  return first ? first.toLocaleUpperCase() : '?'
}

function AiTabSlotPill({ modelId, sessionSlot, onSwitchSlot }: AiTabSlotPillProps) {
  const { t } = useTranslation()
  const { data } = useSiteSessionListQuery()
  const view = data?.views?.find((item) => modelId && item.memberAppIds.includes(modelId))

  if (view?.kind !== 'google') return null
  const slots = googleAccountSlotOptions(view.accountSlots ?? [1])
  if (slots.length < 2) return null
  const emailBySlot = new Map(
    (view.accounts ?? []).flatMap((account) =>
      account.email === undefined ? [] : [[account.slot, account.email] as const]
    )
  )
  const labelFor = (slot: number) => emailBySlot.get(slot) ?? t('ws_account_slot', { slot })

  const requestedSlot = sessionSlot ?? view.activeSlot ?? 1
  const currentSlot = slots.includes(requestedSlot) ? requestedSlot : slots[0]
  const currentEmail = emailBySlot.get(currentSlot)

  const tooltipText = t('ws_tab_slot_tooltip', { slot: currentSlot })

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <label className="text-ql-11 bg-muted/60 border-border/60 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-medium">
          {currentEmail ? (
            <span
              aria-hidden
              className={`text-ql-10 flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-semibold text-white ${accountColor(currentSlot)}`}
            >
              {emailInitial(currentEmail)}
            </span>
          ) : (
            <Users aria-hidden className="text-muted-foreground h-3.5 w-3.5" />
          )}
          <select
            aria-label={t('ws_google_account_select')}
            className="text-foreground max-w-[13rem] cursor-pointer overflow-hidden bg-transparent outline-none"
            value={currentSlot}
            onChange={(event) => onSwitchSlot?.(Number(event.target.value))}
          >
            {slots.map((slot) => (
              <option key={slot} value={slot}>
                {labelFor(slot)}
              </option>
            ))}
          </select>
        </label>
      </TooltipTrigger>
      <TooltipContent side="top" avoidCollisions={false}>
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  )
}

export default memo(AiTabSlotPill)
