import { DURATION } from '@shared/lib/motion'
import { SettingsSection } from '@shared/ui/components/primitives'
import { SelectionIcon } from '@ui/components/Icons'

import { motion } from 'motion/react'
import { type CSSProperties, memo, useMemo } from 'react'

import ColorPicker from '../ColorPicker'

interface SelectionColorSettingsProps {
  selectionColor: string
  setSelectionColor: (val: string) => void
  t: (key: string) => string
}

const SelectionColorSettings = memo(
  ({ selectionColor, setSelectionColor, t }: SelectionColorSettingsProps) => {
    const previewStyle = useMemo<CSSProperties>(
      () => ({ backgroundColor: selectionColor }),
      [selectionColor]
    )

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.fast }}
      >
        <SettingsSection
          icon={<SelectionIcon className="h-4 w-4" />}
          title={t('selection_color_settings')}
          detail={t('selection_color_desc')}
        >
          <ColorPicker
            label={t('select_color')}
            color={selectionColor}
            onChange={setSelectionColor}
          />
          <div className="border-border/60 bg-background/40 flex items-center gap-3 rounded-xl border p-4">
            <div
              aria-hidden
              className="border-border/60 h-6 w-10 shrink-0 rounded-lg border shadow-xs"
              style={previewStyle}
            />
            <span className="text-ql-12 text-muted-foreground truncate">
              {t('selection_color_preview_hint')}
            </span>
          </div>
        </SettingsSection>
      </motion.div>
    )
  }
)

SelectionColorSettings.displayName = 'SelectionColorSettings'
export default SelectionColorSettings
