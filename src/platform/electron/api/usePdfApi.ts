import { useElectronQuery, useElectronMutation } from '../useElectron'
import type {
    PdfSelectOptions,
    PdfSelection,
    PdfStreamResult
} from '@shared/types'

export const PDF_STREAM_KEY = (path?: string) => ['pdf', 'stream', path]

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

/**
 * Get PDF Stream URL Query
 */
export function useGetPdfStreamUrl(filePath?: string) {
    return useElectronQuery<PdfStreamResult | null>({
        key: PDF_STREAM_KEY(filePath),
        queryFn: (api) => api.getPdfStreamUrl(filePath!),
        options: {
            enabled: !!filePath,
            staleTime: Infinity, // Stream URLs shouldn't change for the same file session
            gcTime: 1000 * 60 * 5 // Keep in cache for 5 min if unused
        }
    })
}
