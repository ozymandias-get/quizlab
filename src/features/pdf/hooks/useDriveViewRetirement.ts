import { useManagedViewRetirement } from '@shared/hooks/aiContent/managedViewLifecycle'

import { useMemo } from 'react'

import { usePdfTabStore } from '../store/usePdfTabStore'

/**
 * Retires the Google Drive managed view when its pdf tab is really closed.
 *
 * `GoogleDrivePanel` unmounts for two very different reasons — a focus-mode
 * switch (the panel is mounted twice, once per surface) and the pdf tab being
 * switched away from or closed — and only the second one ends the content
 * identity. Reconciling here, against the tab store, is what keeps the two apart
 * without teaching the panel itself about focus mode.
 *
 * Switching *away* from a Drive tab intentionally keeps its view alive, exactly
 * like an inactive AI tab: coming back must not reload Drive.
 */
export function useDriveViewRetirement(): void {
  const pdfTabs = usePdfTabStore((state) => state.pdfTabs)

  const liveViewIds = useMemo(
    () => pdfTabs.filter((tab) => tab.kind === 'drive').map((tab) => `gdrive:${tab.id}`),
    [pdfTabs]
  )

  useManagedViewRetirement(liveViewIds)
}
