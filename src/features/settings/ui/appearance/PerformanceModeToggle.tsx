import { memo } from 'react'
import { motion } from 'framer-motion'
import { Field, Label, Description } from '@headlessui/react'
import SettingsToggleSwitch from '../shared/SettingsToggleSwitch'

interface PerformanceModeToggleProps {
  performanceMode: boolean
  setPerformanceMode: (val: boolean) => void
  t: (key: string) => string
}

const PerformanceModeToggle = memo(
  ({ performanceMode, setPerformanceMode, t }: PerformanceModeToggleProps) => {
    return (
      <motion.div
        initial={performanceMode ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={performanceMode ? { duration: 0.05 } : { delay: 0.15 }}
      >
        <Field
          className={`
          group flex items-center justify-between p-4 rounded-[20px] transition-all duration-300 border cursor-pointer
          ${
            performanceMode
              ? 'bg-white/[0.06] border-amber-500/20 shadow-lg shadow-amber-500/5'
              : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
          }
        `}
          onClick={() => setPerformanceMode(!performanceMode)}
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div
                className={`
                p-3 rounded-2xl border transition-all duration-300
                ${
                  performanceMode
                    ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400'
                    : 'bg-white/[0.02] border-white/[0.06] text-white/20'
                }
              `}
              >
                {/* Lightning Bolt SVG Icon */}
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              {performanceMode && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500 border-2 border-[#0a0a0a]"
                />
              )}
            </div>
            <div className="space-y-0.5 max-w-[75%]">
              <Label className="text-ql-14 font-bold text-white cursor-pointer">
                {t('performance_mode')}
              </Label>
              <Description className="text-ql-11 font-medium tracking-ql-fine text-white/42 leading-normal">
                {t('performance_mode_desc')}
              </Description>
            </div>
          </div>
          <SettingsToggleSwitch
            checked={performanceMode}
            onChange={setPerformanceMode}
            knobClassName="shadow-lg"
          />
        </Field>
      </motion.div>
    )
  }
)

PerformanceModeToggle.displayName = 'PerformanceModeToggle'
export default PerformanceModeToggle
