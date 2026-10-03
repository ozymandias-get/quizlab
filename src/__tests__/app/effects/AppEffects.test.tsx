import AppEffects from '@app/effects/AppEffects'

import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const setDocumentHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden })
}

describe('AppEffects legacy storage cleanup', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('removes leftover keys from removed features on mount', () => {
    window.localStorage.setItem('ocr-storage', JSON.stringify({ state: { config: {} } }))
    window.localStorage.setItem('useCustomPdfEngine', 'true')
    window.localStorage.setItem('unrelated-key', 'keep-me')

    render(<AppEffects />)

    expect(window.localStorage.getItem('ocr-storage')).toBeNull()
    expect(window.localStorage.getItem('useCustomPdfEngine')).toBeNull()
    expect(window.localStorage.getItem('unrelated-key')).toBe('keep-me')
  })
})

describe('AppEffects ambient animation pausing', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('low-perf')
  })

  afterEach(() => {
    document.querySelector('.app-ambient-background')?.remove()
    setDocumentHidden(false)
    vi.unstubAllGlobals()
  })

  const mountWithAmbientBackground = () => {
    const bg = document.createElement('div')
    bg.className = 'app-ambient-background'
    document.body.appendChild(bg)
    render(<AppEffects />)
    return bg
  }

  it('pauses the ambient animations when the document becomes hidden', () => {
    const bg = mountWithAmbientBackground()

    setDocumentHidden(true)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(bg.style.getPropertyValue('--ambient-paused')).toBe('paused')
  })

  it('resumes the ambient animations when the document becomes visible again', () => {
    const bg = mountWithAmbientBackground()

    setDocumentHidden(true)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    setDocumentHidden(false)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(bg.style.getPropertyValue('--ambient-paused')).toBe('running')
  })

  it('stops listening for visibility changes after unmount', () => {
    const bg = mountWithAmbientBackground()
    const removeSpy = vi.spyOn(document, 'removeEventListener')

    const { unmount } = render(<AppEffects />)
    unmount()

    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    bg.style.removeProperty('--ambient-paused')
  })
})

describe('AppEffects low-perf classification', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('low-perf')
  })

  const renderWith = (overrides: { reducedMotion?: boolean; cores?: number; memory?: number }) => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion')
          ? (overrides.reducedMotion ?? false)
          : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    )
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: overrides.cores ?? 8
    })
    Object.defineProperty(navigator, 'deviceMemory', {
      configurable: true,
      value: overrides.memory ?? 8
    })
    render(<AppEffects />)
    return document.documentElement.classList.contains('low-perf')
  }

  it('marks the document for low-end machines', () => {
    expect(renderWith({ cores: 4 })).toBe(true)
  })

  it('marks the document when the user asked for reduced motion', () => {
    expect(renderWith({ reducedMotion: true })).toBe(true)
  })

  it('leaves capable machines alone', () => {
    expect(renderWith({ cores: 8, memory: 8 })).toBe(false)
  })
})
