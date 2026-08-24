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
          size="compact"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setShowPresetsMenu((v) => !v)}
          disabled={disabled}
          className={cn(
            'border-white/10 bg-white/5 text-neutral-400 hover:border-white/20 hover:bg-white/15 hover:text-white active:scale-95',
            showPresetsMenu && 'border-white/20 bg-white/15 text-white'
          )}
          aria-label={t('ai_preset_more')}
        >
          <MoreHorizontal strokeWidth={2} />
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
            className="z-dropdown bg-popover/98 shadow-ambient-xl absolute bottom-full left-1/2 mb-2 w-48 -translate-x-1/2 rounded-xl border border-white/10 p-1 text-neutral-100"
          >
            <div className="text-ql-10 tracking-ql-caps border-b border-white/10 px-2.5 py-1.5 font-semibold text-neutral-400 uppercase">
              {t('ai_send_presets')}
            </div>
            <div className="flex flex-col gap-0.5 pt-1">
              {secondaryPresets.map((preset) => {
                const Icon = preset.icon
                return (
                  <MenuItem
                    key={preset.key}
                    icon={<Icon className="h-3.5 w-3.5 shrink-0 text-amber-300" strokeWidth={2} />}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowPresetsMenu(false)
                      onSelectPreset(preset.value)
                    }}
                    className="text-neutral-300 hover:bg-white/10 hover:text-white"
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
