/**
 * QuizGenerating - Loading state view
 * Premium aesthetic with advanced animations
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Sparkles, Zap, Cpu, FileText, CheckCircle2, LucideIcon } from 'lucide-react'

// Random loading tips or steps
interface LoadingStep {
    text: string;
    icon: LucideIcon;
}

const LOADING_STEPS: LoadingStep[] = [
    { text: 'quiz_gen_step1', icon: FileText },
    { text: 'quiz_gen_step2', icon: Brain },
    { text: 'quiz_gen_step3', icon: Cpu },
    { text: 'quiz_gen_step4', icon: Zap },
    { text: 'quiz_gen_step5', icon: CheckCircle2 }
]

interface QuizGeneratingProps {
    message?: string;
    t: (key: string) => string;
}

function QuizGenerating({ message, t }: QuizGeneratingProps) {
    const [currentStep, setCurrentStep] = useState(0)

    // Cycle through steps
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentStep((prev) => (prev + 1) % LOADING_STEPS.length)
        }, 2500)
        return () => clearInterval(interval)
    }, [])

    const CurrentIcon = LOADING_STEPS[currentStep].icon

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center h-full p-8 relative overflow-hidden"
        >
            {/* Background Ambient Glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-orange-500/5 rounded-full blur-[80px]" />
            </div>

            <div className="relative z-10 flex flex-col items-center max-w-md w-full">

                {/* Central Animation Container */}
                <div className="relative w-40 h-40 mb-10 flex items-center justify-center">
                    {/* Rotating Rings */}
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 rounded-full border border-amber-500/10 border-t-amber-500/30"
                    />
                    <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-4 rounded-full border border-orange-500/10 border-b-orange-500/30"
                    />
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 rounded-full border-t-2 border-transparent border-t-amber-400/20"
                    />

                    {/* Central Hexagon/Icon */}
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        className="relative w-20 h-20 bg-gradient-to-br from-amber-500/10 to-orange-500/5 rounded-2xl border border-amber-500/20 backdrop-blur-md flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.1)]"
                    >
                        {/* Pulse effect inside */}
                        <div className="absolute inset-0 bg-amber-400/5 rounded-2xl animate-pulse" />

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.5, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                <CurrentIcon className="w-8 h-8 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                            </motion.div>
                        </AnimatePresence>
                    </motion.div>

                    {/* Floating Particles */}
                    {[...Array(6)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute w-1 h-1 bg-amber-400/40 rounded-full"
                            animate={{
                                y: [-20, 20, -20],
                                x: [-20, 20, -20],
                                opacity: [0, 1, 0],
                                scale: [0, 1.5, 0]
                            }}
                            transition={{
                                duration: 3 + Math.random() * 2,
                                repeat: Infinity,
                                delay: i * 0.5,
                                ease: "easeInOut"
                            }}
                            style={{
                                top: `${50 + (Math.random() - 0.5) * 100}%`,
                                left: `${50 + (Math.random() - 0.5) * 100}%`,
                            }}
                        />
                    ))}
                </div>

                {/* Status Text Area */}
                <div className="text-center space-y-4 w-full">
                    {/* Main Title */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                            {t?.('quiz_gen_title') || 'AI Üretiyor'}
                        </span>
                    </div>

                    {/* Dynamic Step Text */}
                    <div className="h-8 relative overflow-hidden">
                        <AnimatePresence mode="wait">
                            <motion.h3
                                key={currentStep}
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -20, opacity: 0 }}
                                className="text-xl font-bold text-white absolute inset-0 flex items-center justify-center"
                            >
                                {t ? t(LOADING_STEPS[currentStep].text) : LOADING_STEPS[currentStep].text}
                            </motion.h3>
                        </AnimatePresence>
                    </div>

                    {/* Subtitle / Message */}
                    <p className="text-sm text-white/40 max-w-xs mx-auto leading-relaxed">
                        {message || t?.('quiz_gen_desc') || 'Your quiz is being prepared, please wait.'}
                    </p>

                    {/* Progress Bar */}
                    <div className="w-full max-w-xs mx-auto h-1 bg-white/5 rounded-full mt-6 overflow-hidden relative">
                        <motion.div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-orange-500"
                            animate={{
                                x: ["-100%", "100%"]
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            style={{ width: "50%" }}
                        />
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

export default QuizGenerating
