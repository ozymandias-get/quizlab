import { BrowserWindow } from 'electron'

import type { DoclingInstallProgressEvent } from '../../../shared/types/index.js'
import { APP_CONFIG } from '../../app/constants.js'
import type { OptionalComponentDefinition } from '../optional-components/types.js'
import {
  inspectDoclingInstallation,
  removeDoclingComponentArtifacts,
  runDoclingPipeline
} from './doclingInstaller.js'

/**
 * Docling Smart Reader optional component.
 *
 * All filesystem/process work happens in the main process through the private
 * runtime installer (uv-managed CPython, isolated venv, pinned docling).
 * Lifecycle state transitions and persistence are owned by the Optional
 * Component Manager; this definition only performs the artifact work and
 * broadcasts fine-grained progress to the renderer.
 */

const DOCLING_COMPONENT_VERSION = '0.1.0'

function broadcastProgress(update: {
  phase: DoclingInstallProgressEvent['phase']
  percent: number | null
  message?: string
}): void {
  const payload: DoclingInstallProgressEvent = {
    componentId: 'docling',
    phase: update.phase,
    percent: update.percent ?? null,
    ...(update.message !== undefined ? { message: update.message } : {})
  }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send(APP_CONFIG.IPC_CHANNELS.DOCLING_INSTALL_PROGRESS, payload)
    }
  }
}

async function installOrUpdate(): Promise<void> {
  try {
    const { doclingServiceManager } = await import('./doclingServiceManager.js')
    await doclingServiceManager.stop().catch(() => {})
  } catch {}
  await runDoclingPipeline({ report: broadcastProgress })
}

export const doclingComponentDefinition: OptionalComponentDefinition = {
  id: 'docling',
  displayName: 'Docling Smart Reader',
  version: DOCLING_COMPONENT_VERSION,

  install() {
    return installOrUpdate()
  },

  async uninstall() {
    // If the sidecar is running, stop it first to avoid holding file locks on Windows
    try {
      const { doclingServiceManager } = await import('./doclingServiceManager.js')
      await doclingServiceManager.stop().catch(() => {})
    } catch {}
    // Removes only the component's own directories (runtime/environment/
    // models/temp/bin). User-generated QuizLab content lives elsewhere and is
    // never touched here.
    return removeDoclingComponentArtifacts()
  },

  repair() {
    return installOrUpdate()
  },

  update() {
    // Bumping pins in doclingVersions.ts invalidates the environment marker;
    // the pipeline then recreates it with the new pinned versions.
    return installOrUpdate()
  },

  async healthCheck() {
    const report = await inspectDoclingInstallation()
    return report.healthy
  }
}
