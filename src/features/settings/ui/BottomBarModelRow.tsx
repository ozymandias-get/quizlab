import type { AiPlatform } from '@shared-core/types'

import { getAiIcon } from '@ui/components/Icons'

import { Field, Label } from '@headlessui/react'
import { GripVertical } from 'lucide-react'
import { memo } from 'react'

import SettingsToggleSwitch from './shared/SettingsToggleSwitch'

const ROW_BASE =
  'motion-normal flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors'
const ROW_ACTIVE = 'border-white/10 bg-zinc-900/80'
const ROW_IDLE = 'border-white/10 bg-zinc-900/45 hover:bg-white/5'
const HOVER_AFFORDANCE =
  'opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 group-focus-visible:opacity-100 motion-reduce:opacity-100'

interface BottomBarModelRowProps {
  modelId: string
  site: AiPlatform
  displayName: string
  isVisible: boolean
  onToggle: (modelId: string) => void
}

/**
 * One model row inside the bottom-bar reorder list.
 *
 * The row is memoised and receives a stable `onToggle`, so flipping one switch
 * does not re-render every other Radix switch in the list.
 */
const BottomBarModelRow = memo(function BottomBarModelRow({
  modelId,
  site,
  displayName,
  isVisible,
  onToggle
}: BottomBarModelRowProps) {
  return (
    <Field
      className={`${ROW_BASE} ${isVisible ? ROW_ACTIVE : ROW_IDLE}`}
      onClick={() => onToggle(modelId)}
    >
      <div className="flex min-w-0 items-center gap-2">
        <GripVertical
          aria-hidden="true"
          className={`${HOVER_AFFORDANCE} text-muted-foreground h-4 w-4 shrink-0`}
        />
        <div className="flex size-5 shrink-0 items-center justify-center">
          {getAiIcon(site.icon || modelId) || (
            <span className="text-muted-foreground text-ql-12 font-semibold">
              {displayName.charAt(0)}
            </span>
          )}
        </div>
        <Label className="text-foreground text-ql-12 min-w-0 cursor-pointer truncate font-medium">
          {displayName}
        </Label>
      </div>
      <span role="presentation" onClick={(event) => event.stopPropagation()}>
        <SettingsToggleSwitch
          aria-label={displayName}
          checked={isVisible}
          onChange={() => onToggle(modelId)}
          size="sm"
        />
      </span>
    </Field>
  )
})

export default BottomBarModelRow
