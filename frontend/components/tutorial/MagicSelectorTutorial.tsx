import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '../../context'
import { MagicWandIcon, CloseIcon } from '../Icons'

interface MagicSelectorTutorialProps {
    onClose: () => void;
    onComplete?: () => void;
}

interface HoveredRect {
    top: number;
    left: number;
    width: number;
    height: number;
    type: 'input' | 'button';
}

/**
 * Magic Selector Tutorial
 * A guided interactive tutorial to teach users how to use the Magic Selector.
 */
export default function MagicSelectorTutorial({ onClose, onComplete }: MagicSelectorTutorialProps) {
    const { t } = useLanguage()

    // Steps: 
    // 0: Intro (Explanation)
    // 1: Select Input (Guide user to click input)
    // 2: Type Test (Guide user to type text to reveal button)
    // 3: Select Button (Guide user to click send button)
    // 4: Success (Finish)
    const [step, setStep] = useState(0)

    // Fake Chat App State
    const [inputValue, setInputValue] = useState('')
    const [isButtonVisible, setIsButtonVisible] = useState(false)

    // Refs for highlighting
    const inputRef = useRef<HTMLInputElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Hover state for "Magic Selector" effect
    const [hoveredRect, setHoveredRect] = useState<HoveredRect | null>(null)

    // Handle typing simulation
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setInputValue(val)
        if (step === 2 && val.length > 0) {
            setIsButtonVisible(true)
            setStep(3)
        }
    }

    // Handle Element Selection (Simulation)
    const handleElementClick = (type: 'input' | 'button') => {
        if (step === 1 && type === 'input') {
            setStep(2)
        } else if (step === 3 && type === 'button') {
            setStep(4)
            if (onComplete) onComplete()
        }
    }

    const handleElementHover = (e: React.MouseEvent<HTMLElement>, type: 'input' | 'button') => {
        if (step !== 1 && step !== 3) return
        if (!containerRef.current) return

        const rect = e.currentTarget.getBoundingClientRect()
        const containerRect = containerRef.current.getBoundingClientRect()

        setHoveredRect({
            top: rect.top - containerRect.top,
            left: rect.left - containerRect.left,
            width: rect.width,
            height: rect.height,
            type // 'input' or 'button'
        })
    }

    const handleMouseLeave = () => {
        setHoveredRect(null)
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col bg-[#212121] text-white overflow-hidden"
        >
            {/* Top Bar (Simulated ChatGPT Header) */}
            <div className="flex items-center justify-between px-4 h-14 bg-[#212121] z-10">
                <div className="flex items-center gap-2 text-gray-300 font-medium cursor-pointer hover:bg-[#2f2f2f] px-3 py-2 rounded-lg transition-colors">
                    <span>ChatGPT 5.2</span>
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-[#2f2f2f] rounded-lg text-gray-400 hover:text-white transition-colors"
                        title={t('tut_close')}
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Main Content (Chat Area) */}
            <div ref={containerRef} className="flex-1 flex flex-col relative">

                {/* Center Content (Empty State or Messages) */}
                <div className="flex-1 flex items-center justify-center flex-col p-4">
                    <div className="w-12 h-12 bg-white rounded-full mb-6 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-black" />
                    </div>
                    <h2 className="text-2xl font-semibold mb-8 text-center text-white max-w-lg">{t('tut_example_site_desc')}</h2>
                </div>

                {/* Input Area (Bottom) */}
                <div className="w-full max-w-3xl mx-auto px-4 pb-8 relative">
                    {/* Tutorial Instructions Overlay (Floating) */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            className="absolute -top-32 left-0 right-0 mx-auto w-max max-w-xl pointer-events-none z-30"
                        >
                            <div className="bg-[#2f2f2f] border border-white/10 p-4 rounded-xl shadow-2xl backdrop-blur-md flex items-start gap-4 pointer-events-auto">
                                <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400 mt-1">
                                    <MagicWandIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white mb-1">
                                        {step === 0 && t('tut_welcome_title')}
                                        {step === 1 && t('tut_select_input_title')}
                                        {step === 2 && t('tut_type_msg_title')}
                                        {step === 3 && t('tut_select_btn_title')}
                                        {step === 4 && t('tut_success_title')}
                                    </h4>
                                    <p className="text-sm text-gray-300 leading-relaxed max-w-sm">
                                        {step === 0 && t('tut_welcome_desc')}
                                        {step === 1 && t('tut_select_input_desc')}
                                        {step === 2 && t('tut_type_msg_desc')}
                                        {step === 3 && t('tut_select_btn_desc')}
                                        {step === 4 && t('tut_success_desc')}
                                    </p>
                                    {step === 0 && (
                                        <button
                                            onClick={() => setStep(1)}
                                            className="mt-3 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors"
                                        >
                                            {t('tut_start')}
                                        </button>
                                    )}
                                    {step === 4 && (
                                        <button
                                            onClick={onComplete || onClose}
                                            className="mt-3 px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors"
                                        >
                                            {t('tut_finish')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Chat Input Simulation */}
                    <div className="relative flex items-center gap-3 bg-[#2f2f2f] rounded-2xl p-3 border border-gray-700/50 shadow-lg">
                        <div className="p-2 hover:bg-black/20 rounded-lg cursor-pointer text-gray-400">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </div>

                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={handleInputChange}
                            disabled={step === 4}
                            placeholder={t('tut_placeholder')}
                            className={`flex-1 bg-transparent border-none outline-none text-white placeholder-gray-400 text-base ${step === 1 ? 'cursor-pointer' : ''}`}
                            onMouseEnter={(e) => handleElementHover(e, 'input')}
                            onMouseLeave={handleMouseLeave}
                            onClick={() => handleElementClick('input')}
                            autoComplete="off"
                        />

                        {/* Step 1 Guide: Pulsing Box around Input */}
                        {step === 1 && (
                            <div className="absolute inset-0 border-2 border-purple-500 rounded-2xl animate-pulse pointer-events-none z-20">
                                <div className="absolute -top-3 left-10 bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                                    {t('tut_click_input')}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            {!isButtonVisible && step < 3 && (
                                <div className="p-2 hover:bg-black/20 rounded-lg cursor-pointer text-gray-400">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                </div>
                            )}

                            <AnimatePresence>
                                {(isButtonVisible || step >= 3) && (
                                    <motion.button
                                        ref={buttonRef}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        className={`p-2 bg-purple-600 rounded-lg text-white hover:bg-purple-500 transition-colors relative flex items-center justify-center ${step === 3 ? 'cursor-pointer' : ''}`}
                                        onMouseEnter={(e) => handleElementHover(e, 'button')}
                                        onMouseLeave={handleMouseLeave}
                                        onClick={() => handleElementClick('button')}
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>

                                        {/* Step 3 Guide: Box around Button */}
                                        {step === 3 && (
                                            <div className="absolute -inset-2 border-2 border-purple-500 rounded-xl animate-pulse pointer-events-none z-20">
                                                <div className="absolute -top-8 -right-2 bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded w-max">
                                                    {t('tut_click_btn')}
                                                </div>
                                            </div>
                                        )}
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                    <div className="text-center mt-2 text-xs text-gray-500">
                        {t('tut_disclaimer')}
                    </div>
                </div>

                {/* Magic Selector Overlay (The Green Hover Box) */}
                {hoveredRect && (
                    <motion.div
                        layoutId="selector-highlight"
                        className="absolute pointer-events-none border-2 border-emerald-400 bg-emerald-400/10 rounded-lg z-50 mix-blend-screen"
                        style={{
                            top: hoveredRect.top,
                            left: hoveredRect.left,
                            width: hoveredRect.width,
                            height: hoveredRect.height,
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="absolute -top-6 left-0 bg-emerald-500 text-black text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                            {hoveredRect.type === 'input' ? t('tut_input_label') : t('tut_btn_label')}
                        </div>
                    </motion.div>
                )}

            </div>
        </motion.div>
    )
}
