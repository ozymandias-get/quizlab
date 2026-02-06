import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '@src/app/providers'

interface SplashScreenProps {
    onFinish: () => void;
}

const SplashScreen = ({ onFinish }: SplashScreenProps) => {
    const { t } = useLanguage()
    const [isVisible, setIsVisible] = useState(true)

    useEffect(() => {
        // Splash screen showing duration
        const timer = setTimeout(() => {
            setIsVisible(false)
            // Call onFinish after the exit animation completes
            setTimeout(onFinish, 800)
        }, 3000)

        return () => clearTimeout(timer)
    }, [onFinish])

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    className="splash-screen"
                    initial={{ opacity: 1 }}
                    exit={{
                        opacity: 0,
                        scale: 1.1,
                        filter: 'blur(20px)',
                        transition: { duration: 0.8, ease: [0.65, 0, 0.35, 1] }
                    }}
                >
                    <div className="splash-bg" />

                    {/* Heartbeat Icon SVG */}
                    <div className="heartbeat-container">
                        <div className="heartbeat-aura" />
                        <svg className="heartbeat-icon" viewBox="0 0 100 100">
                            <path
                                className="heartbeat-path"
                                d="M0,50 L30,50 L35,30 L45,70 L55,10 L65,90 L70,50 L100,50"
                            />
                        </svg>
                    </div>

                    {/* Pulsing Title */}
                    <h1 className="splash-text">
                        {t('app_name')}
                    </h1>

                    {/* Subtle Loading Text */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1, duration: 1 }}
                        className="text-white/30 text-sm font-medium tracking-[0.2em] uppercase mt-4"
                    >
                        {t('splash_initializing')}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default SplashScreen

