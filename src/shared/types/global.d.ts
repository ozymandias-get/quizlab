import type { ElectronApi } from '@shared-core/types/ipcContract'

declare global {
  interface ImportMetaEnv {
    readonly MODE: string
    readonly BASE_URL: string
    readonly PROD: boolean
    readonly DEV: boolean
    readonly SSR: boolean
    readonly [key: string]: string | boolean | undefined
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }

  interface Window {
    electronAPI: ElectronApi
    __APP_VERSION__: string
  }
}
