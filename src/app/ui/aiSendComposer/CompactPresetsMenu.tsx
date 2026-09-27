import type { QuickPresetItem } from '@features/ai'

import { IconButton } from '@app/components/ui/icon-button'
import { MenuItem } from '@app/components/ui/menu'
import { WithTooltip } from '@app/components/ui/tooltip'
import { DURATION } from '@shared/lib/motion'
import { cn } from '@shared/lib/uiUtils'

import { MoreHorizontal } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface CompactPresetsMenuProps {
  secondaryPresets: QuickPresetItem[]
  onSelectPreset: (presetValue: string) => void
  disabled: boolean
}

function CompactPresetsMenu({
  secondaryPresets,
  onSelectPreset,
  disabled
}: CompactPresetsMenuProps) {
  const { t } = useTranslation()
  const [showPresetsMenu, setShowPresetsMenu] = useState(false)
  const presetsMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showPresetsMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (presetsMenuRef.current && !presetsMenuRef.current.contains(e.target as Node)) {
        setShowPresetsMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPresetsMenu])

  return (
    <div ref={presetsMenuRef} className="relative shrink-0">
      <WithTooltip label={t('ai_preset_more')}>
        <IconButton
          type="button"
          variant="ghost"
          size="default"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setShowPresetsMenu((v) => !v)}
          disabled={disabled}
          className={cn(
            'border-border/60 bg-background/40 text-muted-foreground hover:border-ring/40 hover:bg-muted hover:text-foreground',
            showPresetsMenu && 'border-ring/50 bg-accent text-foreground'
          )}
          aria-label={t('ai_preset_more')}
        >
          <MoreHorizontal className="size-4" strokeWidth={2} />
        </IconButton>
      </WithTooltip>

      <AnimatePresence>
        {showPresetsMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: DURATION.normal }}
            onPointerDown={(e) => e.stopPropagation()}
            className="border-border bg-popover text-popover-foreground z-dropdown shadow-ambient-xl absolute bottom-full left-1/2 mb-2 w-48 -translate-x-1/2 rounded-xl border p-1"
          >
            <div className="text-muted-foreground border-border text-ql-10 tracking-ql-label border-b px-2.5 py-1.5 font-semibold uppercase">
              {t('ai_send_presets')}
            </div>
            <div className="flex flex-col gap-0.5 pt-1">
              {secondaryPresets.map((preset) => {
                const Icon = preset.icon
                return (
                  <MenuItem
                    key={preset.key}
                    icon={
                      <Icon
                        className="text-muted-foreground h-3.5 w-3.5 shrink-0"
                        strokeWidth={2}
                      />
                    }
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowPresetsMenu(false)
                      onSelectPreset(preset.value)
                    }}
                  >
                    {preset.label}
                  </MenuItem>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default memo(CompactPresetsMenu)
