import React, { createContext, useContext, useMemo, useEffect, useState } from 'react'
import { Logger } from '@src/utils/logger'
import { STORAGE_KEYS } from '@src/constants/storageKeys'
import { useLocalStorage, useLocalStorageString, useLocalStorageBoolean } from '@src/hooks'
import { hexToRgba } from '@src/utils/uiUtils'

interface AppearanceContextType {
    showOnlyIcons: boolean;
    setShowOnlyIcons: (value: boolean) => void;
    bottomBarOpacity: number;
    setBottomBarOpacity: (value: number) => void;
    bottomBarScale: number;
    setBottomBarScale: (value: number) => void;

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
    const [bottomBarOpacity, setBottomBarOpacity] = useLocalStorage<number>(STORAGE_KEYS.BOTTOM_BAR_OPACITY, 0.7)
    const [bottomBarScale, setBottomBarScale] = useLocalStorage<number>(STORAGE_KEYS.BOTTOM_BAR_SCALE, 1.0)

    const [bgType, setBgType] = useLocalStorageString(STORAGE_KEYS.BG_TYPE, 'solid', ['solid', 'animated'])
    const [bgSolidColor, setBgSolidColor] = useLocalStorageString(STORAGE_KEYS.BG_SOLID_COLOR, '#000000')
    const [bgAnimatedColors, setBgAnimatedColors] = useLocalStorage<string[]>(STORAGE_KEYS.BG_ANIMATED_COLORS, ['#130a21', '#0a1d21', '#1a1010'])
    const [bgRandomMode, setBgRandomMode] = useLocalStorageBoolean(STORAGE_KEYS.BG_RANDOM_MODE, false)
    const [selectionColor, setSelectionColor] = useLocalStorageString(STORAGE_KEYS.SELECTION_COLOR, '#EAB308')
    const [isLayoutSwapped, setIsLayoutSwapped] = useLocalStorageBoolean(STORAGE_KEYS.IS_LAYOUT_SWAPPED, false)
    const [isTourActive, setIsTourActive] = useState(false)

    useEffect(() => {
        try {
            const hasSeenTour = localStorage.getItem('has_seen_tour_v1')
            if (!hasSeenTour) {
                const timer = setTimeout(() => setIsTourActive(true), 1500)
                localStorage.setItem('has_seen_tour_v1', 'true')
                return () => clearTimeout(timer)
            }
        } catch (error) {
            Logger.warn('LocalStorage onboarding check failed:', error)
        }
    }, [])

    const startTour = () => {
        setIsTourActive(true)
    }

    const toggleLayoutSwap = () => setIsLayoutSwapped(prev => !prev)

    useEffect(() => {
        const rgba = hexToRgba(selectionColor, 0.8);
        document.documentElement.style.setProperty('--selection-color', rgba);
        document.documentElement.style.setProperty('--accent-color', selectionColor);
    }, [selectionColor]);

    const value = useMemo(() => ({
        showOnlyIcons, setShowOnlyIcons,
        bottomBarOpacity, setBottomBarOpacity,
        bottomBarScale, setBottomBarScale,
        bgType, setBgType,
        bgSolidColor, setBgSolidColor,
        bgAnimatedColors, setBgAnimatedColors,
        bgRandomMode, setBgRandomMode,
        selectionColor, setSelectionColor,
        isLayoutSwapped, setIsLayoutSwapped, toggleLayoutSwap,
        isTourActive, setIsTourActive, startTour
    }), [
        showOnlyIcons, setShowOnlyIcons,
        bottomBarOpacity, setBottomBarOpacity,
        bottomBarScale, setBottomBarScale,
        bgType, setBgType,
        bgSolidColor, setBgSolidColor,
        bgAnimatedColors, setBgAnimatedColors,
        bgRandomMode, setBgRandomMode,
        selectionColor, setSelectionColor,
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
