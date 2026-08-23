import path from 'node:path'

import { app } from 'electron'

import { ConfigManager as CM } from '../../core/ConfigManager.js'

export type DoclingGpuPrefs = {
  enabled: boolean
  // last auto-detected device, cached for UI hint
  lastDetected?: 'cuda' | 'mps' | 'cpu' | 'none'
  updatedAt?: number
}

const DEFAULT_PREFS: DoclingGpuPrefs = { enabled: false }

function getGpuConfigPath(): string {
  return path.join(app.getPath('userData'), 'components', 'docling', 'gpu.json')
}

let manager: CM<DoclingGpuPrefs> | null = null
function getManager(): CM<DoclingGpuPrefs> {
  if (!manager) manager = new CM<DoclingGpuPrefs>(getGpuConfigPath())
  return manager
}

export async function getGpuPrefs(): Promise<DoclingGpuPrefs> {
  const data = await getManager().read()
  return { ...DEFAULT_PREFS, ...data }
}

export async function setGpuEnabled(enabled: boolean): Promise<DoclingGpuPrefs> {
  const next: DoclingGpuPrefs = { enabled, updatedAt: Date.now() }
  // keep lastDetected if exists
  const cur = await getGpuPrefs()
  if (cur.lastDetected) next.lastDetected = cur.lastDetected
  await getManager().write(next)
  return next
}

export async function setLastDetected(device: DoclingGpuPrefs['lastDetected']): Promise<void> {
  await getManager().update((cur) => ({
    ...DEFAULT_PREFS,
    ...cur,
    lastDetected: device,
    updatedAt: Date.now()
  }))
}

export function resetGpuManagerForTests(): void {
  manager = null
}
