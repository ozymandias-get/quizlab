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
      const msg = data.toString()
      // Filter out low-level Linux/Chromium spam that bypasses log-level
      if (
        msg.includes('vaapi_video_decoder') ||
        msg.includes('object_proxy.cc') ||
        msg.includes('media/gpu/')
      ) {
        return
      }
      process.stderr.write(data)
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
