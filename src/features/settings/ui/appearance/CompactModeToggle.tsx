import { memo } from 'react'
import { motion } from 'framer-motion'
import { Field, Label, Description } from '@headlessui/react'
import { EyeIcon } from '@ui/components/Icons'
import SettingsToggleSwitch from '../shared/SettingsToggleSwitch'

interface CompactModeToggleProps {
  showOnlyIcons: boolean
  setShowOnlyIcons: (val: boolean) => void
  t: (key: string) => string
}

const CompactModeToggle = memo(({ showOnlyIcons, setShowOnlyIcons, t }: CompactModeToggleProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Field
        className={`
                    group flex items-center justify-between p-4 rounded-[20px] transition-all duration-300 border cursor-pointer
                    ${
                      showOnlyIcons
                        ? 'bg-white/[0.06] border-white/[0.12] shadow-lg'
                        : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                    }
                `}
        onClick={() => setShowOnlyIcons(!showOnlyIcons)}
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <div
              className={`
                            p-3 rounded-2xl border transition-all duration-300
                            ${
                              showOnlyIcons
                                ? 'bg-gradient-to-br from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-400'
                                : 'bg-white/[0.02] border-white/[0.06] text-white/20'
                            }
                        `}
            >
              <EyeIcon className="w-5 h-5" />
            </div>
            {showOnlyIcons && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0a0a0a] shadow-[0_0_8px_rgba(16,185,129,0.6)]"
              />
            )}
          </div>
          <div className="space-y-0.5">
            <Label className="text-ql-14 font-bold text-white cursor-pointer">
              {t('show_only_icons')}
            </Label>
            <Description className="text-ql-11 font-medium tracking-ql-fine text-white/42">
              {t('show_only_icons_desc')}
            </Description>
          </div>
        </div>
        <SettingsToggleSwitch
          checked={showOnlyIcons}
          onChange={setShowOnlyIcons}
          knobClassName="shadow-lg"
        />
      </Field>
    </motion.div>
  )
})

CompactModeToggle.displayName = 'CompactModeToggle'
export default CompactModeToggle
