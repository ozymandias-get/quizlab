import { DURATION } from '@shared/lib/motion'
import { cn } from '@shared/lib/uiUtils'
import type { BackgroundMode } from '@shared/stores/appearanceStore'
import { SettingsSection } from '@shared/ui/components/primitives'
import { MagicWandIcon, PaletteIcon } from '@ui/components/Icons'

import { motion } from 'motion/react'
import { memo } from 'react'

import ColorPicker from '../ColorPicker'

interface BackgroundSettingsProps {
  bgMode: BackgroundMode
  setBgMode: (mode: BackgroundMode) => void
  bgSolidColor: string
  setBgSolidColor: (val: string) => void
  t: (key: string) => string
}

const MODES: { value: BackgroundMode; labelKey: string; icon: typeof MagicWandIcon }[] = [
  { value: 'ambient', labelKey: 'bg_ambient', icon: MagicWandIcon },
  { value: 'solid', labelKey: 'bg_solid', icon: PaletteIcon }
]

const BackgroundSettings = memo(
  ({ bgMode, setBgMode, bgSolidColor, setBgSolidColor, t }: BackgroundSettingsProps) => {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.fast }}
      >
        <SettingsSection
          icon={<PaletteIcon className="h-4 w-4" />}
          title={t('background_settings')}
          detail={bgMode === 'solid' ? t('bg_solid_desc') : t('bg_desc')}
        >
          <div className="border-border/60 bg-muted/40 flex gap-1.5 rounded-xl border p-1">
            {MODES.map(({ value: mode, labelKey, icon: Icon }) => (
              <button
                type="button"
                key={mode}
                onClick={() => setBgMode(mode)}
                className={cn(
                  'focus-visible:ring-ring/40 flex flex-1 items-center justify-center rounded-lg border px-3 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none',
                  bgMode === mode
                    ? 'border-ring/50 bg-accent/30'
                    : 'border-border/60 bg-card hover:bg-muted/50'
                )}
              >
                <span
                  className={cn(
                    'text-ql-12 flex items-center gap-2',
                    bgMode === mode
                      ? 'text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground font-medium'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(labelKey)}
                </span>
              </button>
            ))}
          </div>

          <ColorPicker label={t('select_color')} color={bgSolidColor} onChange={setBgSolidColor} />
        </SettingsSection>
      </motion.div>
    )
  }
)

BackgroundSettings.displayName = 'BackgroundSettings'
export default BackgroundSettings
