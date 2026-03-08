export const getElectronApi = () => {
    if (typeof window === 'undefined' || !window.electronAPI) {
        throw new Error('Electron API is not available')
    }

    return window.electronAPI
}
