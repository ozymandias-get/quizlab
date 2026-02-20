import React, { useEffect } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import { hexToRgba } from '@src/utils/uiUtils'

interface AppearanceState {
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

export const useAppearance = create<AppearanceState>()(
    persist(
        (set) => ({
            showOnlyIcons: true,
            setShowOnlyIcons: (value) => set({ showOnlyIcons: value }),
            bottomBarOpacity: 0.7,
            setBottomBarOpacity: (value) => set({ bottomBarOpacity: value }),
            bottomBarScale: 1.0,
            setBottomBarScale: (value) => set({ bottomBarScale: value }),

            bgType: 'solid',
            setBgType: (type) => set({ bgType: type }),
            bgSolidColor: '#000000',
            setBgSolidColor: (color) => set({ bgSolidColor: color }),
            bgAnimatedColors: ['#130a21', '#0a1d21', '#1a1010'],
            setBgAnimatedColors: (colors) => set({ bgAnimatedColors: colors }),
            bgRandomMode: false,
            setBgRandomMode: (value) => set({ bgRandomMode: value }),
            selectionColor: '#EAB308',
            setSelectionColor: (color) => set({ selectionColor: color }),
            isLayoutSwapped: false,
            setIsLayoutSwapped: (value) => set({ isLayoutSwapped: value }),
            toggleLayoutSwap: () => set((state) => ({ isLayoutSwapped: !state.isLayoutSwapped })),

            isTourActive: false,
            setIsTourActive: (value) => set({ isTourActive: value }),
            startTour: () => set({ isTourActive: true })
        }),
        {
            name: 'appearance-storage', // unique name
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                showOnlyIcons: state.showOnlyIcons,
                bottomBarOpacity: state.bottomBarOpacity,
                bottomBarScale: state.bottomBarScale,
                bgType: state.bgType,
                bgSolidColor: state.bgSolidColor,
                bgAnimatedColors: state.bgAnimatedColors,
                bgRandomMode: state.bgRandomMode,
                selectionColor: state.selectionColor,
                isLayoutSwapped: state.isLayoutSwapped
                // isTourActive is specifically excluded because we manage it locally per session
            })
        }
    )
)

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
    const selectionColor = useAppearance(state => state.selectionColor)
    const setIsTourActive = useAppearance(state => state.setIsTourActive)

    useEffect(() => {
        try {
            const hasSeenTour = localStorage.getItem('has_seen_tour_v1')
            if (!hasSeenTour) {
                const timer = setTimeout(() => setIsTourActive(true), 1500)
                localStorage.setItem('has_seen_tour_v1', 'true')
                return () => clearTimeout(timer)
            }
        } catch (error) {
            console.warn('LocalStorage onboarding check failed:', error)
        }
    }, [setIsTourActive])

    useEffect(() => {
        const rgba = hexToRgba(selectionColor, 0.8);
        document.documentElement.style.setProperty('--selection-color', rgba);
        document.documentElement.style.setProperty('--accent-color', selectionColor);
    }, [selectionColor]);

    return <>{children}</>
}
