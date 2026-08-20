import { Button } from '@app/components/ui/button'
import { DURATION } from '@shared/lib/motion'
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
          <div className="border-border bg-popover text-popover-foreground shadow-ambient-md w-[220px] overflow-hidden rounded-xl border">
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.02, duration: DURATION.slow } }}
              exit={{ opacity: 0, transition: { duration: DURATION.fast } }}
              className="text-ql-10 border-border/70 text-muted-foreground block border-b py-2 text-center font-semibold tracking-wider uppercase select-none"
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
                  {groupIdx > 0 && <div className="bg-border/60 mx-2 my-1 h-px" />}

                  <motion.span
                    variants={itemVariants}
                    className="text-ql-10 text-muted-foreground/70 block px-2 pt-1 pb-0.5 font-semibold tracking-wider uppercase select-none"
                  >
                    {group.label}
                  </motion.span>

                  {group.tools.map((tool) => {
                    const colors = colorMap[tool.color]
                    const isActive = tool.isActive ?? false
                    const Icon = tool.icon

                    return (
                      <Button
                        key={tool.label}
                        asChild
                        type="button"
                        variant="ghost"
                        aria-label={tool.tooltip}
                        className={cn(
                          'group text-foreground hover:bg-muted h-auto w-full justify-start gap-2 rounded-lg px-2 py-1.5 transition-colors',
                          isActive && 'bg-muted/70'
                        )}
                      >
                        <motion.button
                          type="button"
                          variants={itemVariants}
                          whileHover={{ x: 1, transition: { duration: DURATION.normal } }}
                          whileTap={{ scale: 0.98, transition: { duration: DURATION.fast } }}
                          onClick={tool.onClick}
                        >
                          <div
                            className={cn(
                              'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
                              isActive
                                ? cn(colors.bgActive, colors.textActive)
                                : cn(colors.bg, colors.text)
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>

                          <span
                            className={cn(
                              'text-ql-11 font-medium transition-colors',
                              isActive
                                ? 'text-foreground font-semibold'
                                : 'text-foreground/80 group-hover:text-foreground'
                            )}
                          >
                            {tool.label}
                          </span>

                          {tool.onClick && 'isActive' in tool && (
                            <div
                              className={cn(
                                'ml-auto flex h-4 w-7 items-center rounded-full transition-colors',
                                isActive
                                  ? cn(colors.toggleTrack, 'border-primary/30 border')
                                  : 'border-border bg-muted border'
                              )}
                            >
                              <motion.div
                                className={cn(
                                  'h-3 w-3 rounded-full',
                                  isActive ? 'bg-primary-foreground' : 'bg-muted-foreground/60'
                                )}
                                animate={{
                                  x: isActive ? 14 : 2,
                                  transition: { type: 'spring', stiffness: 500, damping: 30 }
                                }}
                              />
                            </div>
                          )}
                        </motion.button>
                      </Button>
                    )
                  })}
                </div>
              ))}
            </motion.div>
          </div>

          <div className="border-border bg-popover absolute bottom-0 left-[18px] h-2 w-2 -translate-x-1/2 translate-y-[calc(50%-1px)] rotate-45 border-r border-b" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default memo(PdfToolsPopup)
