import { useLayoutEffect, useState } from 'react'

export function useBottomBarPanelHeight(
    barRef: React.RefObject<HTMLDivElement | null>,
    isOpen: boolean,
    bottomBarScale: number
) {
    const [panelHeight, setPanelHeight] = useState(0)

    useLayoutEffect(() => {
        if (!isOpen) {
            setPanelHeight((prev) => (prev === 0 ? prev : 0))
            return
        }

        const shell = barRef.current
        if (!shell) return

        let frameId: number | null = null

        const measure = () => {
            const hub = shell.querySelector<HTMLButtonElement>('.hub-center-btn')
            if (!hub) return

            const toolsScrollArea = shell.querySelector<HTMLElement>('[data-testid="tools-panel-scroll-area"]')
            const modelsScrollArea = shell.querySelector<HTMLElement>('[data-testid="models-panel-scroll-area"]')
            const shellRect = shell.getBoundingClientRect()
            const hubRect = hub.getBoundingClientRect()
            const edgePadding = 12
            const panelGap = 10
            const availableTopHeight = Math.max(0, hubRect.top - shellRect.top - edgePadding - panelGap)
            const availableBottomHeight = Math.max(0, shellRect.bottom - hubRect.bottom - edgePadding - panelGap)
            const sharedHeight = Math.max(
                0,
                Math.floor(
                    Math.min(
                        availableTopHeight,
                        availableBottomHeight,
                        toolsScrollArea?.scrollHeight ?? Number.POSITIVE_INFINITY,
                        modelsScrollArea?.scrollHeight ?? Number.POSITIVE_INFINITY
                    )
                )
            )

            setPanelHeight((prev) => (prev === sharedHeight ? prev : sharedHeight))
        }

        const scheduleMeasure = () => {
            if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
                measure()
                return
            }

            if (frameId !== null) {
                window.cancelAnimationFrame(frameId)
            }

            frameId = window.requestAnimationFrame(() => {
                frameId = null
                measure()
            })
        }

        measure()
        window.addEventListener('resize', scheduleMeasure)

        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(scheduleMeasure)
            : null

        const observedElements = [
            shell,
            shell.querySelector('.hub-center-btn'),
            shell.querySelector('[data-testid="tools-panel-scroll-area"]')?.firstElementChild,
            shell.querySelector('[data-testid="models-panel-scroll-area"]')?.firstElementChild
        ].filter((element): element is Element => element instanceof Element)

        observedElements.forEach((element) => resizeObserver?.observe(element))

        return () => {
            window.removeEventListener('resize', scheduleMeasure)
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId)
            }
            resizeObserver?.disconnect()
        }
    }, [barRef, bottomBarScale, isOpen])

    return panelHeight
}
