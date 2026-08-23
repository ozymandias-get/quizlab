import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { createServer } from 'node:net'
import path from 'node:path'

export function generateToken(): string {
  return randomBytes(32).toString('hex')
}

export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      if (addr && typeof addr === 'object') {
        const port = addr.port
        srv.close(() => resolve(port))
      } else {
        srv.close(() => reject(new Error('Failed to acquire free port')))
      }
    })
  })
}

export function httpHealthCheck(port: number, token: string, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        path: '/health',
        method: 'GET',
        headers: token ? { 'x-docling-token': token, Authorization: `Bearer ${token}` } : {},
        timeout: timeoutMs
      },
      (res) => {
        resolve(res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300)
        res.resume()
      }
    )
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    req.end()
  })
}

export async function waitForHealthy(
  port: number,
  token: string,
  deadline: number,
  healthCheckFn: (port: number, token: string) => Promise<boolean>,
  healthIntervalMs: number,
  shouldAbort: () => boolean
): Promise<void> {
  while (Date.now() < deadline) {
    if (shouldAbort()) throw new Error('Service process died before becoming healthy')
    const healthy = await healthCheckFn(port, token).catch(() => false)
    if (healthy) return
    await new Promise((resolve) => setTimeout(resolve, healthIntervalMs))
  }
  throw new Error('Service failed to become healthy within deadline')
}

export async function ensureSidecarScript(serviceRoot: string): Promise<string> {
  const serviceDir = path.join(serviceRoot, 'service')
  const scriptPath = path.join(serviceDir, 'sidecar.py')
  try {
    await fs.access(scriptPath)
    return scriptPath
  } catch {
    // Write minimal sidecar
  }
  await fs.mkdir(serviceDir, { recursive: true })
  const script = `
import os, sys, argparse, json
from http.server import HTTPServer, BaseHTTPRequestHandler
# Architecture note (2026-08):
# - Health lifecycle (start/stop/health/token/port) is fully managed by
#   DoclingServiceManager via this sidecar on 127.0.0.1.
# - Conversion itself is performed by convert_docling.py via direct spawn
#   in doclingConversionService.ts (no HTTP hop) for reliability and to
#   avoid holding a persistent GPU model in memory.
# - This sidecar intentionally stays minimal (health + stub /convert).
#   Future upgrade: replace body with "from docling_serve.app import app"
#   or a FastAPI launcher and pin docling-serve==<ver> in doclingVersions.ts.

parser = argparse.ArgumentParser()
parser.add_argument('--host', default='127.0.0.1')
parser.add_argument('--port', type=int, required=True)
args = parser.parse_args()

TOKEN = os.environ.get('DOCLING_SIDECAR_TOKEN','')

class Handler(BaseHTTPRequestHandler):
    def _auth_ok(self):
        auth = self.headers.get('x-docling-token') or self.headers.get('Authorization','')
        if auth.startswith('Bearer '):
            auth = auth[7:]
        if TOKEN and auth != TOKEN:
            return False
        return True
    def do_GET(self):
        if not self._auth_ok():
            self.send_response(401); self.end_headers(); return
        if self.path == '/health' or self.path == '/':
            self.send_response(200)
            self.send_header('Content-Type','application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_response(404); self.end_headers()
    def do_POST(self):
        if not self._auth_ok():
            self.send_response(401); self.end_headers(); return
        # Stub /convert – real conversion uses direct spawn, but we keep
        # the endpoint so future HTTP path can be enabled without client change.
        if self.path == '/convert':
            self.send_response(501)
            self.send_header('Content-Type','application/json')
            self.end_headers()
            self.wfile.write(b'{"error":"Direct spawn mode – use convert_docling.py"}')
        else:
            self.send_response(404); self.end_headers()
    def log_message(self, format, *args):
        pass

server = HTTPServer((args.host, args.port), Handler)
print(f"Docling sidecar listening on {args.host}:{args.port}", flush=True)
server.serve_forever()
`.trimStart()
  await fs.writeFile(scriptPath, script, 'utf8')
  await fs.chmod(scriptPath, 0o600).catch(() => {})
  return scriptPath
}
