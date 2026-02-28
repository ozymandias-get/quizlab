import { useElectronMutation } from '../useElectron'
import type {
    PdfSelectOptions,
    PdfSelection
} from '@shared-core/types'

/**
 * Select PDF Mutation
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
 * Register PDF Path Mutation
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


