import { cn } from '@shared/lib/uiUtils'

import { Crop, Hand, Image as ImageIcon, Send, Type } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { memo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { ColorKey } from './pdfToolsPopupConstants'
import { colorMap, groupVariants, itemVariants, panelVariants } from './pdfToolsPopupConstants'

interface PdfToolsPopupProps {
  isOpen: boolean
  onToggle: () => void
  onAddCurrentPageTextToAi?: () => void
  panMode: boolean
  onTogglePanMode: () => void
  onStartScreenshot: () => void
  onFullPageScreenshot: () => void
  autoSend: boolean
  onToggleAutoSend: () => void
}

function PdfToolsPopup({
  isOpen,
  onToggle,
  onAddCurrentPageTextToAi,
  panMode,
  onTogglePanMode,
  onStartScreenshot,
  onFullPageScreenshot,
  autoSend,
  onToggleAutoSend
}: PdfToolsPopupProps) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (panelRef.current && !panelRef.current.contains(target)) {
        const trigger = (e.target as HTMLElement).closest('[data-tools-trigger]')
        if (!trigger) onToggle()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onToggle])

  const toolGroups = [
    {
      label: t('pdf_group_ai'),
      tools: [
        {
          icon: Type,
          label: t('tool_page_text'),
          tooltip: t('pdf_add_current_page_text_to_ai'),
          onClick: onAddCurrentPageTextToAi,
          color: 'violet' as ColorKey
        },
        {
          icon: Send,
          label: t('tool_auto_send'),
          tooltip: autoSend ? t('auto_send_on') : t('auto_send_off'),
          onClick: onToggleAutoSend,
          color: 'violet' as ColorKey,
          isActive: autoSend
        }
      ]
    },
    {
      label: t('pdf_group_capture'),
      tools: [
        {
          icon: Crop,
          label: t('tool_area_screenshot'),
          tooltip: t('screenshot'),
          onClick: onStartScreenshot,
          color: 'amber' as ColorKey
        },
        {
          icon: ImageIcon,
          label: t('tool_fullpage_screenshot'),
          tooltip: t('full_page_screenshot'),
          onClick: onFullPageScreenshot,
          color: 'amber' as ColorKey
        }
      ]
    },
    {
      label: t('pdf_group_view'),
      tools: [
        {
          icon: Hand,
          label: t('tool_pan'),
          tooltip: t('pdf_pan_mode'),
          onClick: onTogglePanMode,
          color: 'sky' as ColorKey,
          isActive: panMode
        }
      ]
    }
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="z-tooltip absolute bottom-full left-0 mb-3"
        >
          <div
            className="glass-tier-2 w-[220px] overflow-hidden rounded-2xl"
            style={{
              boxShadow: `
                0 16px 40px -12px rgba(0, 0, 0, 0.7),
                0 8px 16px -8px rgba(0, 0, 0, 0.5),
                inset 0 1px 0 rgba(255, 255, 255, 0.06)
              `
            }}
          >
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.02, duration: 0.2 } }}
              exit={{ opacity: 0, transition: { duration: 0.06 } }}
              className="text-ql-10 block border-b border-white/[0.06] py-2.5 text-center font-semibold tracking-[0.12em] text-white/40 uppercase select-none"
            >
              {t('pdf_tools')}
            </motion.span>

            <motion.div
              variants={groupVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-0.5 p-1.5"
            >
              {toolGroups.map((group, groupIdx) => (
                <div key={group.label}>
                  {groupIdx > 0 && (
                    <div className="mx-2 my-1 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                  )}

                  <motion.span
                    variants={itemVariants}
                    className="block px-2.5 pt-1.5 pb-0.5 text-[9px] font-medium tracking-[0.1em] text-white/35 uppercase select-none"
                  >
                    {group.label}
                  </motion.span>

                  {group.tools.map((tool) => {
                    const colors = colorMap[tool.color]
                    const isActive = tool.isActive ?? false
                    const Icon = tool.icon

                    return (
                      <motion.button
                        key={tool.label}
                        type="button"
                        variants={itemVariants}
                        whileHover={{ x: 2, transition: { duration: 0.15 } }}
                        whileTap={{ scale: 0.98, transition: { duration: 0.08 } }}
                        onClick={tool.onClick}
                        title={tool.tooltip}
                        aria-label={tool.tooltip}
                        className={cn(
                          'group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors duration-200',
                          'hover:bg-white/[0.07]',
                          isActive && 'bg-white/[0.06]'
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200',
                            isActive
                              ? cn(colors.bgActive, colors.textActive, colors.glow)
                              : cn(colors.bg, colors.text, 'group-hover:text-white/85')
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>

                        <span
                          className={cn(
                            'text-ql-11 font-medium transition-colors duration-200',
                            isActive ? 'text-white/90' : 'text-white/65 group-hover:text-white/80'
                          )}
                        >
                          {tool.label}
                        </span>

                        {tool.onClick && 'isActive' in tool && (
                          <div
                            className={cn(
                              'ml-auto flex h-4 w-7 items-center rounded-full transition-colors duration-200',
                              isActive
                                ? cn(colors.toggleTrack, 'border border-white/[0.10]')
                                : 'border border-white/[0.06] bg-white/[0.10]'
                            )}
                          >
                            <motion.div
                              className={cn(
                                'h-3 w-3 rounded-full',
                                isActive ? 'bg-white/90' : 'bg-white/45'
                              )}
                              animate={{
                                x: isActive ? 14 : 2,
                                transition: { type: 'spring', stiffness: 500, damping: 30 }
                              }}
                            />
                          </div>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              ))}
            </motion.div>
          </div>

          <div className="glass-tier-2 absolute bottom-0 left-[22px] h-2.5 w-2.5 -translate-x-1/2 translate-y-[calc(50%-1px)] rotate-45 border-t-0 border-l-0" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default memo(PdfToolsPopup)
