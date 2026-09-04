import { spawn } from 'child_process'

const DEV_SERVER_URL = 'http://localhost:5173/'
const DEV_SERVER_TIMEOUT_MS = 30000
const DEV_SERVER_MARKERS = ['Quizlab Reader', '/app/main.tsx']
const isWindows = process.platform === 'win32'
const windowsShell = process.env.ComSpec || 'cmd.exe'

const viteEnv = { ...process.env, ELECTRON: '1' }
const electronEnv = { ...process.env }
delete electronEnv.ELECTRON_RUN_AS_NODE

let viteProc = null
let electronProc = null
let isShuttingDown = false
let ownsViteProcess = false

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function spawnCommand(command, args, options = {}) {
  if (!isWindows) {
    return spawn(command, args, options)
  }

  return spawn(windowsShell, ['/d', '/s', '/c', command, ...args], {
    windowsHide: true,
    ...options
  })
}

function killProcessTree(proc) {
  try {
    if (!proc?.pid || proc.killed) return
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(proc.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true
      })
      return
    }
    proc.kill('SIGTERM')
  } catch {}
}

async function readServerResponse() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1500)
    const response = await fetch(DEV_SERVER_URL, {
      signal: controller.signal,
      headers: { Accept: 'text/html' }
    })
    clearTimeout(timeoutId)

    const body = await response.text()
    const isAppDevServer = DEV_SERVER_MARKERS.every((marker) => body.includes(marker))

    return {
      reachable: true,
      ok: response.ok,
      isAppDevServer,
      status: response.status
    }
  } catch {
    return {
      reachable: false,
      ok: false,
      isAppDevServer: false,
      status: null
    }
  }
}

async function ensureDevServerReady() {
  const initialProbe = await readServerResponse()
  if (initialProbe.reachable) {
    if (!initialProbe.isAppDevServer) {
      throw new Error(
        'Port 5173 is already serving a different app. Stop that process or free the port before running `npm run dev`.'
      )
    }

    console.log('[dev] Reusing existing Vite dev server on port 5173.')
    return
  }

  ownsViteProcess = true
  viteProc = spawnCommand('npx', ['vite'], {
    stdio: 'inherit',
    env: viteEnv
  })

  const startedAt = Date.now()
  while (Date.now() - startedAt < DEV_SERVER_TIMEOUT_MS) {
    if (viteProc.exitCode !== null) {
      throw new Error(`Vite exited early with code ${viteProc.exitCode}.`)
    }

    const probe = await readServerResponse()
    if (probe.reachable && probe.isAppDevServer && probe.ok) {
      console.log('[dev] Vite dev server is ready.')
      return
    }

    if (probe.reachable && !probe.isAppDevServer) {
      throw new Error(
        'Port 5173 became available but is not serving this app. Refusing to launch Electron against the wrong dev server.'
      )
    }

    await sleep(500)
  }

  throw new Error('Timed out waiting for the Vite dev server to become ready.')
}

async function runBuildBackend() {
  await new Promise((resolve, reject) => {
    const buildProc = spawnCommand('npm', ['run', 'build:backend'], {
      stdio: 'inherit',
      env: electronEnv
    })

    buildProc.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`Backend build failed with code ${code ?? 1}.`))
    })
  })
}

// Substrings identifying dev-only noise on Electron's stderr. Matching is
// deliberately narrow so real app errors are never swallowed.
const ELECTRON_NOISE_MARKERS = [
  // Low-level Linux/Chromium spam that bypasses log-level (pre-existing).
  'vaapi_video_decoder',
  'object_proxy.cc',
  'media/gpu/',
  'wayland_surface_factory.cc',
  // Electron's dev-only "Insecure Content-Security-Policy" warning. It is
  // printed for unpackaged builds only and has two expected triggers here:
  // - our own pages use 'wasm-unsafe-eval' (required by tesseract.js/pdf.js
  //   WebAssembly; the CSP is otherwise strict — see electron/core/csp.ts),
  //   which trips Electron's naive "unsafe-eval" substring check;
  // - third-party AI webview guests (Google/Microsoft/OpenAI pages) send no
  //   CSP of their own, and we must not inject ours (it would break them).
  'Electron Security Warning',
  'Insecure Content-Security-Policy',
  'electronjs.org/docs/tutorial/security',
  'once the app is packaged',
  // Google Identity Services chatter from AI webview guest pages (Gemini /
  // ChatGPT login flows). Third-party code — not app errors, not actionable.
  'GSI_LOGGER',
  'FedCM',
  'fedcm-migration',
  'accounts list is empty',
  'Error retrieving a token'
]

function isNoiseLine(line) {
  return ELECTRON_NOISE_MARKERS.some((marker) => line.includes(marker))
}

// Drop known noise lines from Electron's stderr while preserving everything
// else. Line-based (not chunk-based) so a real error sharing a chunk with
// noise is still printed.
function filterElectronNoise(msg) {
  const result = msg
    .split('\n')
    .filter((line) => !isNoiseLine(line))
    .join('\n')
  return result.trim() ? result : ''
}

function launchElectron() {
  electronProc = spawnCommand('electron', ['.'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: electronEnv
  })

  if (electronProc.stdout) {
    electronProc.stdout.on('data', (data) => process.stdout.write(data))
  }
  if (electronProc.stderr) {
    electronProc.stderr.on('data', (data) => {
      const filtered = filterElectronNoise(data.toString())
      if (filtered) process.stderr.write(filtered)
    })
  }

  electronProc.on('exit', (code) => {
    shutdown(code ?? 0)
  })
}

function shutdown(code = 0) {
  if (isShuttingDown) return
  isShuttingDown = true

  if (electronProc) {
    killProcessTree(electronProc)
  }
  if (ownsViteProcess && viteProc) {
    killProcessTree(viteProc)
  }

  setTimeout(() => process.exit(code), 100)
}

async function main() {
  try {
    await Promise.all([ensureDevServerReady(), runBuildBackend()])

    launchElectron()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[dev] ${message}`)
    shutdown(1)
  }
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

main()
