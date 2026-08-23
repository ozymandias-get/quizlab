import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'

import { failure, success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import { getGpuPrefs, setGpuEnabled, setLastDetected } from './doclingGpuSettings.js'
import { getDoclingLayout, getVenvPythonPath } from './doclingPaths.js'
import { runCommand } from './doclingProcessRunner.js'

let handlersRegistered = false

async function hasNvidiaSmi(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader'], {
      shell: false,
      windowsHide: true
    })
    let stdout = ''
    child.stdout?.on('data', (c: Buffer) => (stdout += c.toString('utf8')))
    child.on('error', () => resolve(false))
    child.on('close', (code) => resolve(code === 0 && stdout.trim().length > 0))
    setTimeout(() => {
      try {
        child.kill()
      } catch {}
      resolve(false)
    }, 3000)
  })
}

async function detectGpuDevice(): Promise<{ device: string; available: boolean; detail?: string }> {
  const layout = getDoclingLayout()
  const venvPython = getVenvPythonPath(layout)
  try {
    await fs.access(venvPython)
  } catch {
    // Even without venv, check for nvidia-smi to hint CUDA possibility
    const hasSmi = await hasNvidiaSmi()
    if (hasSmi)
      return {
        device: 'cuda',
        available: false,
        detail: 'NVIDIA driver found, but Docling not installed'
      }
    return { device: 'none', available: false, detail: 'Docling venv not installed' }
  }
  const script = `
import sys
try:
    import torch
    cuda = False
    mps = False
    try:
        cuda = torch.cuda.is_available()
    except Exception:
        cuda = False
    try:
        mps_attr = getattr(torch.backends, 'mps', None)
        if mps_attr is not None and hasattr(mps_attr, 'is_available'):
            mps = mps_attr.is_available()
        else:
            mps = False
    except Exception:
        mps = False
    if cuda:
        print("cuda")
    elif mps:
        print("mps")
    else:
        print("cpu")
except ImportError as e:
    print("none")
    print(str(e), file=sys.stderr)
`.trim()
  try {
    const result = await runCommand(venvPython, ['-c', script], {
      envOverrides: { PYTHONUNBUFFERED: '1' },
      timeoutMs: 10_000
    })
    const out = result.stdout.trim().split('\n').pop()?.trim() ?? 'none'
    if (['cuda', 'mps', 'cpu'].includes(out)) {
      const available = out === 'cuda' || out === 'mps'
      await setLastDetected(out as 'cuda' | 'mps' | 'cpu').catch(() => {})
      if (!available) {
        const hasSmi = await hasNvidiaSmi()
        if (hasSmi) {
          return {
            device: 'cuda',
            available: false,
            detail:
              'NVIDIA GPU bulundu ama torch CUDA değil — "CUDA Paketlerini İndir" ile CUDA torch kurun'
          }
        }
      }
      return {
        device: out,
        available,
        detail: available ? `${out} available` : 'GPU not available, will use CPU'
      }
    }
    return {
      device: out || 'none',
      available: false,
      detail: result.stderr.slice(0, 300) || 'torch not found'
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { device: 'none', available: false, detail: msg.slice(0, 300) }
  }
}

export function registerDoclingGpuHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true
  const { IPC_CHANNELS } = APP_CONFIG

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_GPU_GET_PREFS,
    async () => {
      const prefs = await getGpuPrefs()
      return success({ enabled: !!prefs.enabled, lastDetected: prefs.lastDetected })
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_GPU_SET_ENABLED,
    async (_event, enabled: boolean) => {
      if (typeof enabled !== 'boolean') return failure('invalid_input', 'enabled must be boolean')
      const prefs = await setGpuEnabled(enabled)
      return success({ enabled: !!prefs.enabled, lastDetected: prefs.lastDetected })
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_GPU_DETECT,
    async () => {
      const res = await detectGpuDevice()
      return success(res)
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_GPU_INSTALL_CUDA,
    async () => {
      try {
        const { installCudaPackages } = await import('./doclingInstaller.js')
        await installCudaPackages()
        const res = await detectGpuDevice()
        return success({ success: true, detail: `CUDA kuruldu, cihaz: ${res.device}` })
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        return failure('internal_error', msg.slice(0, 500))
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )
}

export { detectGpuDevice }
