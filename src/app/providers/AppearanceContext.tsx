import React, { createContext, useContext, useMemo, useEffect } from 'react'
import { STORAGE_KEYS } from '@src/constants/storageKeys'
import { useLocalStorage, useLocalStorageString, useLocalStorageBoolean } from '@src/hooks'
import { DEFAULT_BOTTOM_BAR_POSITION, DEFAULT_BOTTOM_BAR_ALIGNMENT, VALID_BOTTOM_BAR_POSITIONS, VALID_BOTTOM_BAR_ALIGNMENTS, DEFAULT_BOTTOM_BAR_LAYOUT, VALID_BOTTOM_BAR_LAYOUTS } from '@src/constants/appearance'
import { hexToRgba } from '@src/utils/uiUtils'

interface AppearanceContextType {
    showOnlyIcons: boolean;
    setShowOnlyIcons: (value: boolean) => void;
    bottomBarPosition: string;
    setBottomBarPosition: (value: string) => void;
    bottomBarAlignment: string;
    setBottomBarAlignment: (value: string) => void;
    bottomBarOpacity: number;
    setBottomBarOpacity: (value: number) => void;
    bottomBarScale: number;
    setBottomBarScale: (value: number) => void;
    bottomBarLayout: string;
    setBottomBarLayout: (value: string) => void;
    floatingBarPos: { x: number; y: number };
    setFloatingBarPos: (pos: { x: number; y: number }) => void;
    bgType: string;
    setBgType: (type: string) => void;
    bgSolidColor: string;
    setBgSolidColor: (color: string) => void;
    bgAnimatedColors: string[];
    setBgAnimatedColors: (colors: string[]) => void;
    bgRandomMode: boolean;
    setBgRandomMode: (value: boolean) => void;
    selectionColor: string;
    setSelectionColor: (color: string) => void;
    isLayoutSwapped: boolean;
    setIsLayoutSwapped: (value: boolean) => void;
    toggleLayoutSwap: () => void;
    isTourActive: boolean;
    setIsTourActive: (value: boolean) => void;
    startTour: () => void;
}

const AppearanceContext = createContext<AppearanceContextType | null>(null)

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
    const [showOnlyIcons, setShowOnlyIcons] = useLocalStorageBoolean(STORAGE_KEYS.SHOW_ONLY_ICONS, true)
    const [bottomBarPosition, setBottomBarPosition] = useLocalStorageString(STORAGE_KEYS.BOTTOM_BAR_POSITION, DEFAULT_BOTTOM_BAR_POSITION, VALID_BOTTOM_BAR_POSITIONS)
    const [bottomBarAlignment, setBottomBarAlignment] = useLocalStorageString(STORAGE_KEYS.BOTTOM_BAR_ALIGNMENT, DEFAULT_BOTTOM_BAR_ALIGNMENT, VALID_BOTTOM_BAR_ALIGNMENTS)
    const [bottomBarOpacity, setBottomBarOpacity] = useLocalStorage<number>(STORAGE_KEYS.BOTTOM_BAR_OPACITY, 0.7)
    const [bottomBarScale, setBottomBarScale] = useLocalStorage<number>(STORAGE_KEYS.BOTTOM_BAR_SCALE, 1.0)
    const [bottomBarLayout, setBottomBarLayout] = useLocalStorageString(STORAGE_KEYS.BOTTOM_BAR_LAYOUT, DEFAULT_BOTTOM_BAR_LAYOUT, VALID_BOTTOM_BAR_LAYOUTS)
    const [floatingBarPos, setFloatingBarPos] = useLocalStorage<{ x: number; y: number }>(STORAGE_KEYS.FLOATING_BAR_POS, { x: 0, y: 0 })

    const [bgType, setBgType] = useLocalStorageString(STORAGE_KEYS.BG_TYPE, 'solid', ['solid', 'animated'])
    const [bgSolidColor, setBgSolidColor] = useLocalStorageString(STORAGE_KEYS.BG_SOLID_COLOR, '#000000')
    const [bgAnimatedColors, setBgAnimatedColors] = useLocalStorage<string[]>(STORAGE_KEYS.BG_ANIMATED_COLORS, ['#130a21', '#0a1d21', '#1a1010'])
    const [bgRandomMode, setBgRandomMode] = useLocalStorageBoolean(STORAGE_KEYS.BG_RANDOM_MODE, false)
    const [selectionColor, setSelectionColor] = useLocalStorageString(STORAGE_KEYS.SELECTION_COLOR, '#EAB308')
    const [isLayoutSwapped, setIsLayoutSwapped] = useLocalStorageBoolean(STORAGE_KEYS.IS_LAYOUT_SWAPPED, false)
    const [isTourActive, setIsTourActive] = React.useState(false)

    // Onboarding check
    useEffect(() => {
        try {
            const hasSeenTour = localStorage.getItem('has_seen_tour_v1')
            if (!hasSeenTour) {
                // Küçük bir gecikme ile başlat ki uygulama yüklensin
                const timer = setTimeout(() => setIsTourActive(true), 1500)
                localStorage.setItem('has_seen_tour_v1', 'true')
                return () => clearTimeout(timer)
            }
        } catch (error) {
            console.warn('LocalStorage onboarding check failed:', error)
        }
    }, [])

    const startTour = () => {
        setIsTourActive(true)
    }

    const toggleLayoutSwap = () => setIsLayoutSwapped(prev => !prev)

    // Seçim rengini CSS değişkenine aktar
    useEffect(() => {
        const rgba = hexToRgba(selectionColor, 0.8);
        document.documentElement.style.setProperty('--selection-color', rgba);
        document.documentElement.style.setProperty('--accent-color', selectionColor);
    }, [selectionColor]);

    const value = useMemo(() => ({
        showOnlyIcons, setShowOnlyIcons,
        bottomBarPosition, setBottomBarPosition,
        bottomBarAlignment, setBottomBarAlignment,
        bottomBarOpacity, setBottomBarOpacity,
        bottomBarScale, setBottomBarScale,
        bottomBarLayout, setBottomBarLayout,
        floatingBarPos, setFloatingBarPos,
        bgType, setBgType,
        bgSolidColor, setBgSolidColor,
        bgAnimatedColors, setBgAnimatedColors,
        bgRandomMode, setBgRandomMode,
        selectionColor, setSelectionColor,
        isLayoutSwapped, setIsLayoutSwapped, toggleLayoutSwap,
        isTourActive, setIsTourActive, startTour
    }), [
        showOnlyIcons, setShowOnlyIcons, bottomBarPosition, setBottomBarPosition,
        bottomBarAlignment, setBottomBarAlignment, bottomBarOpacity, setBottomBarOpacity,
        bottomBarScale, setBottomBarScale, bottomBarLayout, setBottomBarLayout,
        floatingBarPos, setFloatingBarPos, bgType, setBgType,
        bgSolidColor, setBgSolidColor, bgAnimatedColors, setBgAnimatedColors,
        bgRandomMode, setBgRandomMode, selectionColor, setSelectionColor,
        isLayoutSwapped, setIsLayoutSwapped, isTourActive, setIsTourActive
    ])

    return (
        <AppearanceContext.Provider value={value}>
            {children}
        </AppearanceContext.Provider>
    )
}

export const useAppearance = () => {
    const context = useContext(AppearanceContext)
    if (!context) throw new Error('useAppearance must be used within AppearanceProvider')
    return context
}

