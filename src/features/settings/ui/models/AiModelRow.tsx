import type { AiPlatform } from '@shared-core/types'

import {
  IconButton,
  InlineSpinner,
  SettingsRowIcon,
  WithTooltip
} from '@shared/ui/components/primitives'
import { GridIcon, RefreshIcon, TrashIcon } from '@ui/components/Icons'

import { Description, Field, Label } from '@headlessui/react'
import { CircleCheck, Star } from 'lucide-react'
import { motion } from 'motion/react'
import { memo, type MouseEvent, type ReactNode } from 'react'

import { getAiPlatformIcon, getAiPlatformLabel } from '../shared/aiPlatformPresentation'
import SettingsToggleSwitch from '../shared/SettingsToggleSwitch'

/**
 * Row-level affordances repeat on every card, so they stay hidden at rest and
 * fade in on hover/focus instead of forming a wall of identical icons. Busy
 * rows keep their icon visible so the spinner stays readable.
 */
const HOVER_AFFORDANCE =
  'opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 group-focus-visible:opacity-100 motion-reduce:opacity-100'

/** Wraps every case-insensitive occurrence of `query` in a highlight mark. */
function highlightMatch(text: string, query: string): ReactNode {
  const needle = query.trim()
  if (!needle) return text
  const haystack = text.toLowerCase()
  const target = needle.toLowerCase()
  let cursor = 0
  let index = haystack.indexOf(target)
  if (index === -1) return text

  const parts: ReactNode[] = []
  let key = 0
  while (index !== -1) {
    if (index > cursor) parts.push(text.slice(cursor, index))
    parts.push(
      <mark key={key} className="text-foreground rounded-sm bg-amber-400/30 px-0.5">
        {text.slice(index, index + target.length)}
      </mark>
    )
    key += 1
    cursor = index + target.length
    index = haystack.indexOf(target, cursor)
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

interface AiModelRowProps {
  modelKey: string
  site: AiPlatform
  isEnabled: boolean
  isLastModel: boolean
  isFavorite: boolean
  isDefault: boolean
  canFavorite: boolean
  canClear: boolean
  canSetDefault: boolean
  isDeleting: boolean
  isClearingModelData: boolean
  isCurrentlyDeleting: boolean
  isCurrentlyClearing: boolean
  searchQuery: string
  animationDelay: number
  t: (key: string) => string
  onToggle: (key: string) => void
  onToggleFavorite: (key: string) => void
  onSetDefault: (key: string) => void
  onDelete: (event: MouseEvent, key: string) => void
  onClear: (event: MouseEvent, key: string) => void
}

/**
 * One catalogue row.
 *
 * Kept memoised and fed only primitives plus stable callbacks: toggling a
 * switch changes `enabledModels`, and without this boundary every one of the
 * ~50 Radix switches in the list re-rendered for a single row's change.
 */
const AiModelRow = memo(function AiModelRow({
  modelKey,
  site,
  isEnabled,
  isLastModel,
  isFavorite,
  isDefault,
  canFavorite,
  canClear,
  canSetDefault,
  isDeleting,
  isClearingModelData,
  isCurrentlyDeleting,
  isCurrentlyClearing,
  searchQuery,
  animationDelay,
  t,
  onToggle,
  onToggleFavorite,
  onSetDefault,
  onDelete,
  onClear
}: AiModelRowProps) {
  const isCustom = site.isCustom

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: animationDelay }}
    >
      <Field
        className={`group relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border p-3 transition-colors ${
          isEnabled
            ? 'border-white/[0.09] bg-white/[0.03]'
            : 'border-white/[0.07] bg-transparent hover:bg-white/[0.03]'
        } ${isLastModel ? 'opacity-80' : 'cursor-pointer'}`}
        onClick={() => !isLastModel && onToggle(modelKey)}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            <SettingsRowIcon>
              {getAiPlatformIcon(site, modelKey, <GridIcon className="h-5 w-5" />)}
            </SettingsRowIcon>
          </div>

          <div className="min-w-0 space-y-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <Label
                className={`text-ql-13 truncate font-semibold transition-colors ${
                  isEnabled ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {highlightMatch(getAiPlatformLabel(site, modelKey, t), searchQuery)}
              </Label>
              {isCustom && (
                <span className="text-primary border-primary/20 bg-primary/10 text-ql-10 shrink-0 rounded-lg border px-1.5 py-0.5 font-semibold uppercase">
                  {t('custom_badge')}
                </span>
              )}
            </div>
            <Description
              className={`text-ql-10 inline-flex w-fit items-center gap-1 rounded-full border px-1.5 py-0.5 font-medium transition-colors ${
                isEnabled
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                  : 'text-muted-foreground border-white/[0.07] bg-white/[0.03]'
              }`}
            >
              <span
                aria-hidden
                className={`size-1.5 rounded-full ${
                  isEnabled ? 'bg-emerald-400' : 'bg-muted-foreground/40'
                }`}
              />
              {isEnabled ? t('model_active') : t('model_inactive')}
            </Description>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {canFavorite && (
            <WithTooltip label={t(isFavorite ? 'remove_favorite_model' : 'add_favorite_model')}>
              <IconButton
                type="button"
                size="compact"
                variant="ghost"
                aria-pressed={isFavorite}
                aria-label={`${t(isFavorite ? 'remove_favorite_model' : 'add_favorite_model')} — ${getAiPlatformLabel(site, modelKey, t)}`}
                className={isFavorite ? 'text-amber-400' : 'text-muted-foreground'}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onToggleFavorite(modelKey)
                }}
              >
                <Star fill={isFavorite ? 'currentColor' : 'none'} />
              </IconButton>
            </WithTooltip>
          )}
          {isEnabled && canSetDefault && (
            <WithTooltip label={isDefault ? t('is_default_model') : t('set_as_default')}>
              <IconButton
                type="button"
                size="compact"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onSetDefault(modelKey)
                }}
                className={`group/star ${
                  isDefault
                    ? 'text-amber-400 hover:text-amber-300'
                    : `text-muted-foreground ${HOVER_AFFORDANCE}`
                }`}
                aria-label={isDefault ? t('is_default_model') : t('set_as_default')}
              >
                <CircleCheck className="transition-transform group-hover/star:scale-110" />
              </IconButton>
            </WithTooltip>
          )}

          <SettingsToggleSwitch
            aria-label={getAiPlatformLabel(site, modelKey, t)}
            checked={isEnabled}
            onChange={() => !isLastModel && onToggle(modelKey)}
            disabled={isLastModel}
          />

          {canClear && (
            <WithTooltip label={t('clear_ai_model_data')}>
              <IconButton
                type="button"
                size="compact"
                variant="ghost"
                onClick={(e) => onClear(e, modelKey)}
                disabled={isClearingModelData || isCurrentlyClearing}
                className={isCurrentlyClearing ? 'opacity-100' : HOVER_AFFORDANCE}
                aria-label={t('clear_ai_model_data')}
              >
                {isCurrentlyClearing ? <InlineSpinner /> : <RefreshIcon />}
              </IconButton>
            </WithTooltip>
          )}

          {isCustom && (
            <WithTooltip label={t('delete_custom_ai')}>
              <IconButton
                type="button"
                size="compact"
                variant="ghost"
                onClick={(e) => onDelete(e, modelKey)}
                disabled={isDeleting || isCurrentlyDeleting}
                className={`hover:bg-destructive/10 hover:text-destructive ${
                  isCurrentlyDeleting ? 'opacity-100' : HOVER_AFFORDANCE
                }`}
                aria-label={t('delete_custom_ai')}
              >
                {isCurrentlyDeleting ? <InlineSpinner /> : <TrashIcon />}
              </IconButton>
            </WithTooltip>
          )}
        </div>
      </Field>
    </motion.div>
  )
})

export default AiModelRow
