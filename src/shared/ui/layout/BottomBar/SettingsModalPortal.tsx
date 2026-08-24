import { InlineSpinner } from '@shared/ui/components/primitives'

import { lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

const SettingsModal = lazy(() =>
  import('@features/settings').then((module) => ({ default: module.SettingsModal }))
)

interface SettingsModalPortalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: string
}

/** Full-screen lazy-loading fallback — panel-level loading uses `InlineSpinner` at `xl` size. */
function SettingsModalFallback() {
  const { t } = useTranslation()
  return (
    <div className="z-overlay bg-background/80 fixed inset-0 flex items-center justify-center backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        <InlineSpinner size="xl" className="border-border border-t-primary" />
        <span className="text-ql-12 text-muted-foreground tracking-ql-caps font-medium uppercase">
          {t('loading')}
        </span>
      </div>
    </div>
  )
}

function SettingsModalPortal({ isOpen, onClose, initialTab }: SettingsModalPortalProps) {
  return createPortal(
    <Suspense fallback={<SettingsModalFallback />}>
      {isOpen && <SettingsModal isOpen={isOpen} onClose={onClose} initialTab={initialTab} />}
    </Suspense>,
    document.body
  )
}

export default SettingsModalPortal
