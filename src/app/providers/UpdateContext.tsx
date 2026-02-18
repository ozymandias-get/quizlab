import React, { createContext, useContext, useMemo, useEffect } from 'react'
import { useCheckForUpdates } from '@platform/electron/api/useSystemApi'
import type { UpdateCheckResult } from '@shared/types'

export interface UpdateInfo extends UpdateCheckResult { }

interface UpdateContextType {
    updateAvailable: boolean;
    updateInfo: UpdateInfo | null;
    isCheckingUpdate: boolean;
    hasCheckedUpdate: boolean;
    checkForUpdates: () => Promise<UpdateInfo>;
}

const UpdateContext = createContext<UpdateContextType | null>(null)
const UPDATE_CHECK_DELAY = 5000

export function UpdateProvider({ children }: { children: React.ReactNode }) {
    // Enable query after 5 seconds to simulate the original delay
    // or just let it run immediately. The original code simulated delay with setTimeout.
    // We can use 'enabled' to control start time if strictly needed, but eager check is usually better.
    // However, to respect the "don't block startup" intention, we can delay enablement.
    const [isEnabled, setIsEnabled] = React.useState(false)

    useEffect(() => {
        const timer = setTimeout(() => setIsEnabled(true), UPDATE_CHECK_DELAY)
        return () => clearTimeout(timer)
    }, [])

    const { data, isLoading, isFetched, refetch } = useCheckForUpdates(isEnabled)

    const updateInfo: UpdateInfo | null = useMemo(() => {
        if (!data) return null
        return data
    }, [data])

    const updateAvailable = !!data?.available

    const checkForUpdates = async (): Promise<UpdateInfo> => {
        // Force refetch
        const result = await refetch()
        return result.data || { available: false, error: 'Refetch failed' }
    }

    const value = useMemo(() => ({
        updateAvailable,
        updateInfo,
        isCheckingUpdate: isLoading && isEnabled, // Only checking if enabled
        hasCheckedUpdate: isFetched,
        checkForUpdates
    }), [updateAvailable, updateInfo, isLoading, isEnabled, isFetched, refetch])

    return (
        <UpdateContext.Provider value={value}>
            {children}
        </UpdateContext.Provider>
    )
}

export const useUpdate = () => {
    const context = useContext(UpdateContext)
    if (!context) throw new Error('useUpdate must be used within UpdateProvider')
    return context
}

