import { useEffect } from 'react'

function isTypingElement(element: Element | null): boolean {
    if (!(element instanceof HTMLElement)) return false
    const tag = element.tagName.toLowerCase()
    return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable
}

/**
 * Handle user keyboard interactions for quiz navigation
 * (Arrow keys for Next/Prev)
 */
export const useQuizKeyboard = (
    navigateQuestion: (direction: number) => void,
    isFirst: boolean,
    isLast: boolean
) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.defaultPrevented) return
            if (e.altKey || e.ctrlKey || e.metaKey) return
            if (e.repeat) return
            if (isTypingElement(document.activeElement)) return

            if (e.key === 'ArrowRight') {
                if (isLast) return
                e.preventDefault()
                navigateQuestion(1)
            } else if (e.key === 'ArrowLeft') {
                if (isFirst) return
                e.preventDefault()
                navigateQuestion(-1)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [navigateQuestion, isLast, isFirst])
}
