import type { QuickPresetItem } from '@features/ai'

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
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setShowPresetsMenu((v) => !v)}
        disabled={disabled}
        className={cn(
          'relative flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-neutral-400 shadow-2xs transition-all hover:border-white/20 hover:bg-white/[0.14] hover:text-white active:scale-95 disabled:opacity-40',
          showPresetsMenu && 'border-white/20 bg-white/[0.14] text-white'
        )}
        title={t('ai_preset_more')}
        aria-label={t('ai_preset_more')}
      >
        <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

      <AnimatePresence>
        {showPresetsMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded-xl border border-white/10 bg-[#16171b]/98 p-1 text-neutral-100 shadow-[0_20px_45px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
          >
            <div className="text-ql-9 border-b border-white/10 px-2.5 py-1.5 font-semibold tracking-wider text-neutral-400 uppercase">
              {t('ai_send_presets')}
            </div>
            <div className="flex flex-col gap-0.5 pt-1">
              {secondaryPresets.map((preset) => {
                const Icon = preset.icon
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowPresetsMenu(false)
                      onSelectPreset(preset.value)
                    }}
                    className="text-ql-11 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-amber-300" strokeWidth={2} />
                    <span className="truncate">{preset.label}</span>
                  </button>
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
