import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useCheckForUpdates } from '@platform/electron/api/useSystemApi'
import type { UpdateCheckResult } from '@shared-core/types'

export interface UpdateInfo extends UpdateCheckResult { }

interface UpdateContextType {
    updateAvailable: boolean;
    updateInfo: UpdateInfo | null;
    isCheckingUpdate: boolean;
    hasCheckedUpdate: boolean;
    checkForUpdates: () => Promise<UpdateInfo>;
}

const UPDATE_CHECK_DELAY = 5000
const UpdateContext = createContext<UpdateContextType | null>(null)

export function UpdateProvider({ children }: { children: React.ReactNode }) {
    const [isEnabled, setIsEnabled] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => setIsEnabled(true), UPDATE_CHECK_DELAY)
        return () => clearTimeout(timer)
    }, [])

    const { data, isLoading, isFetched, refetch } = useCheckForUpdates(isEnabled)

    const updateInfo: UpdateInfo | null = useMemo(() => {
        return data ?? null
    }, [data])

    const updateAvailable = !!data?.available

    const checkForUpdates = useCallback(async (): Promise<UpdateInfo> => {
        const result = await refetch()
        return result.data || { available: false, error: 'Refetch failed' }
    }, [refetch])

    const value = useMemo(() => ({
        updateAvailable,
        updateInfo,
        isCheckingUpdate: isLoading && isEnabled,
        hasCheckedUpdate: isFetched,
        checkForUpdates
    }), [updateAvailable, updateInfo, isLoading, isEnabled, isFetched, checkForUpdates])

    return (
        <UpdateContext.Provider value={value}>
            {children}
        </UpdateContext.Provider>
    )
}

export function useUpdate(): UpdateContextType {
    const context = useContext(UpdateContext)
    if (!context) throw new Error('useUpdate must be used within UpdateProvider')
    return context
}
