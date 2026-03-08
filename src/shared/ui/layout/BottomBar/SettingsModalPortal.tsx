import { Suspense, lazy } from 'react'
import { createPortal } from 'react-dom'
import { SettingsLoadingSpinner } from './SettingsLoadingSpinner'

const SettingsModal = lazy(() =>
    import('@features/settings').then((module) => ({ default: module.SettingsModal }))
)

interface SettingsModalPortalProps {
    isOpen: boolean
    initialTab: string
    onClose: () => void
}

function SettingsModalPortal({ isOpen, initialTab, onClose }: SettingsModalPortalProps) {
    return createPortal(
        <Suspense fallback={<SettingsLoadingSpinner />}>
            {isOpen && (
                <SettingsModal
                    isOpen={isOpen}
                    onClose={onClose}
                    initialTab={initialTab}
                />
            )}
        </Suspense>,
        document.body
    )
}

export default SettingsModalPortal
