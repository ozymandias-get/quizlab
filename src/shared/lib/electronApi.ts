export const getElectronApi = () => {
  if (typeof window === 'undefined' || !window.electronAPI) {
    if (typeof console !== 'undefined') {
      console.warn(
        '[electronApi] Electron API is not available — running outside Electron or in test environment.'
      )
    }
    return null
  }

  return window.electronAPI
}

export const hasElectronApi = () => {
  return typeof window !== 'undefined' && Boolean(window.electronAPI)
}
