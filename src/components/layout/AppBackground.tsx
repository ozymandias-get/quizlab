import React, { useState, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppearance } from '@src/app/providers'

interface RandomBlobProps {
    color: string;
    index: number;
    isRandomMode: boolean;
}

const RandomBlob = memo(React.forwardRef<HTMLDivElement, RandomBlobProps>(({ color, index, isRandomMode }, ref) => {
    const [blobColor, setBlobColor] = useState<string>(color)
    const [target, setTarget] = useState({
        x: '0%',
        y: '0%',
        scale: 1,
        borderRadius: "40% 60% 60% 40% / 40% 40% 60% 60%"
    })

    // Random Color Generator (Aesthetic tones)
    const getRandomAestheticColor = () => {
        const hue = Math.floor(Math.random() * 360)
        return `hsl(${hue}, 40%, 15%)` // Dark, muted, premium tones
    }

    useEffect(() => {
        setBlobColor(color)
    }, [color])

    useEffect(() => {
        let isMounted = true
        let timeoutId: NodeJS.Timeout | null = null

        const updateTarget = () => {
            if (!isMounted) return

            // Random position within a safe range
            const x = `${Math.floor(Math.random() * 60 - 30)}%`
            const y = `${Math.floor(Math.random() * 60 - 30)}%`
            const scale = 0.8 + Math.random() * 0.6

            // Random fluid border radius
            const r1 = Math.floor(Math.random() * 40 + 30)
            const r2 = Math.floor(Math.random() * 40 + 30)
            const r3 = Math.floor(Math.random() * 40 + 30)
            const r4 = Math.floor(Math.random() * 40 + 30)
            const borderRadius = `${r1}% ${100 - r1}% ${r2}% ${100 - r2}% / ${r3}% ${r4}% ${100 - r4}% ${100 - r3}%`

            setTarget({ x, y, scale, borderRadius })

            // If random mode is on, change color too
            if (isRandomMode) {
                setBlobColor(getRandomAestheticColor())
            }

            // Set next random target more frequently
            timeoutId = setTimeout(updateTarget, 10000 + Math.random() * 10000)
        }

        updateTarget()
        return () => {
            isMounted = false
            if (timeoutId) clearTimeout(timeoutId)
        }
    }, [isRandomMode])

    return (
        <motion.div
            ref={ref}
            className={`bg-blob bg-blob--${index + 1}`}
            animate={{
                x: target.x,
                y: target.y,
                scale: target.scale,
                borderRadius: target.borderRadius,
                backgroundColor: blobColor
            }}
            transition={{
                backgroundColor: { duration: 8, ease: "easeInOut" },
                duration: 12,
                ease: "linear"
            }}
            style={{
                position: 'absolute',
                // Initial placement offset to spread them out
                left: index === 0 ? '-10%' : index === 1 ? '50%' : '20%',
                top: index === 0 ? '-10%' : index === 1 ? '50%' : '10%',
                willChange: 'transform, border-radius, background-color', // GPU hints
                backfaceVisibility: 'hidden' as React.CSSProperties['backfaceVisibility'] // Framer motion type workaround
            }}
        />
    )
}))

interface AnimatedBlobsProps {
    colors: string[];
    isRandomMode: boolean;
}

// Memoized container for blobs to prevent re-renders from unrelated context changes
const AnimatedBlobs: React.FC<AnimatedBlobsProps> = memo(({ colors, isRandomMode }) => (
    <AnimatePresence mode="popLayout">
        {colors.map((color, index) => (
            <RandomBlob
                key={index}
                color={color}
                index={index}
                isRandomMode={isRandomMode}
            />
        ))}
    </AnimatePresence>
))

const AppBackground: React.FC = () => {
    const { bgType, bgSolidColor, bgAnimatedColors, bgRandomMode } = useAppearance()

    // Base background to avoid banding and pixelation on dark colors
    const baseStyle = {
        backgroundColor: bgType === 'solid' ? bgSolidColor : '#050505',
        transition: 'background-color 2s ease'
    }

    return (
        <div className="app-background animated-bg" style={baseStyle}>
            {bgType === 'animated' && (
                <AnimatedBlobs colors={bgAnimatedColors} isRandomMode={bgRandomMode} />
            )}

            <div className="glass-overlay" />
            <div className="bg-noise" />
        </div>
    )
}

export default memo(AppBackground)

