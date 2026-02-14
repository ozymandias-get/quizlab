import React, { memo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SettingsIcon, MagicWandIcon, SwapIcon } from '@src/components/ui/Icons'
import { Brain } from 'lucide-react'
import { useLanguage, useAppTools } from '@src/app/providers'
import { ToolButton } from './ToolButton'
import { panelVariantsVertical, panelTransition } from './animations'

interface ToolsPanelProps {
    isOpen: boolean;
    panelStyle: React.CSSProperties;
    handleSettingsClick: () => void;
    toggleLayoutSwap: () => void;
    isQuizMode: boolean;
    onToggleQuizMode: () => void;
}

export const ToolsPanel = memo(({
    isOpen,
    panelStyle,
    handleSettingsClick,
    toggleLayoutSwap,
    isQuizMode,
    onToggleQuizMode
}: ToolsPanelProps) => {
    const { t } = useLanguage()

    const { isPickerActive, togglePicker } = useAppTools()

    return (
        <AnimatePresence initial={false}>
            {isOpen && (
                <motion.div
                    variants={panelVariantsVertical}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={panelTransition}
                    className="bottom-bar-panel bottom-bar-panel--tools absolute bottom-full mb-1.5 left-0 w-full overflow-hidden"
                    style={panelStyle}
                    id="bottom-bar-tools-panel"
                >
                    <motion.div
                        className="flex flex-col items-center gap-2 py-3 w-full"
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        variants={{
                            hidden: {},
                            visible: {
                                transition: {
                                    staggerChildren: 0.06,
                                    delayChildren: 0.08,
                                }
                            },
                            exit: {
                                transition: {
                                    staggerChildren: 0.03,
                                    staggerDirection: -1,
                                }
                            }
                        }}
                    >
                        <motion.div id="tool-btn-settings" variants={{ hidden: {}, visible: {}, exit: {} }}>
                            <ToolButton delay={0.03} onClick={handleSettingsClick} title={t('settings')}>
                                <SettingsIcon className="w-5 h-5" />
                            </ToolButton>
                        </motion.div>
                        <motion.div id="tool-btn-swap" variants={{ hidden: {}, visible: {}, exit: {} }}>
                            <ToolButton
                                delay={0.05}
                                onClick={toggleLayoutSwap}
                                title={t('swap_window')}
                            >
                                <SwapIcon className="w-5 h-5" />
                            </ToolButton>
                        </motion.div>
                        <motion.div id="tool-btn-picker" variants={{ hidden: {}, visible: {}, exit: {} }}>
                            <ToolButton
                                delay={0.06}
                                isActive={isPickerActive}
                                activeColor="rgba(139,92,246,0.35)"
                                onClick={togglePicker}
                                title={t('element_picker')}
                            >
                                <MagicWandIcon className="w-5 h-5" />
                            </ToolButton>
                        </motion.div>

                        {/* Quiz Mode Button */}
                        <motion.div id="tool-btn-quiz" variants={{ hidden: {}, visible: {}, exit: {} }}>
                            <ToolButton
                                delay={0.12}
                                isActive={isQuizMode}
                                activeColor="rgba(168,85,247,0.5)"
                                onClick={onToggleQuizMode}
                                title={isQuizMode ? t('close_quiz') : t('open_quiz')}
                            >
                                <Brain className="w-5 h-5" />
                            </ToolButton>
                        </motion.div>

                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
})

ToolsPanel.displayName = 'ToolsPanel'
