import type { PdfSelection, PdfSelectOptions } from '@shared-core/types'

import { getElectronApi } from '@shared/lib/electronApi'

import { useElectronMutation } from '../useElectron'

/**
 * The absolute path of a dropped file.
 *
 * Electron removed the non-standard `File.path` in 32; the preload resolves the
 * real path through `webUtils.getPathForFile`. The legacy property is kept as a
 * fallback for the browser dev stub and older hosts.
 */
export function getDroppedFilePath(file: File): string {
  const fromBridge = getElectronApi()?.getPathForFile?.(file)
  if (fromBridge) return fromBridge
  return (file as File & { path?: string }).path ?? ''
}

/**
 * User interaction is required (file dialog), so this is a mutation.
 */
export function useSelectPdf() {
  return useElectronMutation<PdfSelection | null, PdfSelectOptions>(
    (api, options) => api.selectPdf(options),
    {
      errorMessage: 'Failed to select PDF'
    }
  )
}

/**
 * Used for drag-and-drop or resuming last session
 */
export function useRegisterPdfPath() {
  return useElectronMutation<PdfSelection | null, string>(
    (api, filePath) => api.registerPdfPath(filePath),
    {
      errorMessage: 'Failed to register PDF path'
    }
  )
}
