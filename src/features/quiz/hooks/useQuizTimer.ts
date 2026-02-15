import { useState, useEffect } from 'react'

/**
 * Format timestamp into MM:SS string
 * Reacts to startTime changes and updates every second
 */
export const useQuizTimer = (startTime: number | null) => {
    const [elapsedTime, setElapsedTime] = useState('00:00')

    useEffect(() => {
        if (!startTime) {
            setElapsedTime('00:00')
            return
        }

        const updateElapsedTime = () => {
            const now = Date.now()
            // Ensure we don't show negative time if system clock drifts backwards slightly
            const elapsed = Math.max(0, Math.floor((now - startTime) / 1000))
            const mins = Math.floor(elapsed / 60).toString().padStart(2, '0')
            const secs = (elapsed % 60).toString().padStart(2, '0')
            setElapsedTime(`${mins}:${secs}`)
        }

        updateElapsedTime() // Initial update
        const interval = setInterval(updateElapsedTime, 1000)

        return () => clearInterval(interval)
    }, [startTime])

    return elapsedTime
}
