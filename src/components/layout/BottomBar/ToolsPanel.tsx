import React, { memo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SettingsIcon, ExplorerIcon, MagicWandIcon, SwapIcon } from '@src/components/ui/Icons'
import { Brain } from 'lucide-react'
import { useLanguage, useNavigation, useAppTools } from '@src/app/providers'
import { APP_CONSTANTS } from '@src/constants/appConstants'
import { ToolButton } from './ToolButton'
import { panelVariantsHorizontal, panelVariantsVertical, panelTransition } from './animations'

const { LEFT_PANEL_TABS } = APP_CONSTANTS

interface ToolsPanelProps {
    isOpen: boolean;
    bottomBarLayout: 'horizontal' | 'vertical';
    panelStyle: React.CSSProperties;
    handleSettingsClick: () => void;
    toggleLayoutSwap: () => void;
    isQuizMode: boolean;
    onToggleQuizMode: () => void;
}

export const ToolsPanel = memo(({
    isOpen,
    bottomBarLayout,
    panelStyle,
    handleSettingsClick,
    toggleLayoutSwap,
    isQuizMode,
    onToggleQuizMode
}: ToolsPanelProps) => {
    const { t } = useLanguage()
    const { leftPanelTab, setLeftPanelTab } = useNavigation()
    const { isPickerActive, togglePicker } = useAppTools()

    return (
        <AnimatePresence initial={false}>
            {isOpen && (
                <motion.div
                    variants={bottomBarLayout === 'vertical' ? panelVariantsVertical : panelVariantsHorizontal}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={panelTransition}
                    className={bottomBarLayout === 'vertical'
                        ? "absolute bottom-full mb-3 left-0 overflow-hidden w-[52px]"
                        : "absolute right-full mr-3 top-0 overflow-hidden h-[52px]"
                    }
                    style={panelStyle}
                    id="bottom-bar-tools-panel"
                >
                    <div className={bottomBarLayout === 'vertical'
                        ? "flex flex-col items-center gap-1.5 py-3 w-full"
                        : "flex items-center gap-1.5 px-3 h-full"
                    }>
                        <div id="tool-btn-settings">
                            <ToolButton delay={0.03} onClick={handleSettingsClick} title={t('settings')}>
                                <SettingsIcon className="w-5 h-5" />
                            </ToolButton>
                        </div>
                        <div id="tool-btn-swap">
                            <ToolButton
                                delay={0.05}
                                onClick={toggleLayoutSwap}
                                title={t('swap_window')}
                            >
                                <SwapIcon className="w-5 h-5" />
                            </ToolButton>
                        </div>
                        <div id="tool-btn-picker">
                            <ToolButton
                                delay={0.06}
                                isActive={isPickerActive}
                                activeColor="rgba(139,92,246,0.35)"
                                onClick={togglePicker}
                                title={t('element_picker')}
                            >
                                <MagicWandIcon className="w-5 h-5" />
                            </ToolButton>
                        </div>
                        <ToolButton
                            delay={0.09}
                            isActive={leftPanelTab === LEFT_PANEL_TABS.EXPLORER}
                            activeColor="rgba(245,158,11,0.4)"
                            onClick={() => setLeftPanelTab(leftPanelTab === LEFT_PANEL_TABS.EXPLORER ? LEFT_PANEL_TABS.VIEWER : LEFT_PANEL_TABS.EXPLORER)}
                            title={t('explorer')}
                        >
                            <ExplorerIcon className="w-5 h-5" />
                        </ToolButton>

                        {/* Quiz Mode Button */}
                        <div id="tool-btn-quiz">
                            <ToolButton
                                delay={0.12}
                                isActive={isQuizMode}
                                activeColor="rgba(168,85,247,0.5)"
                                onClick={onToggleQuizMode}
                                title={isQuizMode ? t('close_quiz') : t('open_quiz')}
                            >
                                <Brain className="w-5 h-5" />
                            </ToolButton>
                        </div>

                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
})

ToolsPanel.displayName = 'ToolsPanel'

