import path from 'path'

import { getComponentsRootPath } from '../../core/coreHelpers.js'

/**
 * Private on-disk layout for the Docling component. Everything lives inside
 * the app's own userData tree — the system Python, pip and the user's global
 * environment are never touched:
 *
 *   userData/components/docling/
 *     runtime/       uv-managed CPython installations (private)
 *     environment/   the project venv docling is installed into
 *     models/        model/artifact cache handed to docling
 *     temp/          download + extraction staging (wiped aggressively)
 *     bin/           pinned uv binary
 *     component.json installer metadata (manifest)
 *
 * SECURITY: User-generated content (extraction results, exports) must never
 * be stored under this directory — uninstall removes these folders wholesale.
 */
export interface DoclingDirLayout {
  root: string
  runtime: string
  environment: string
  models: string
  temp: string
  bin: string
  manifestFile: string
}

export function getDoclingLayout(componentsRoot?: string): DoclingDirLayout {
  const base = componentsRoot ?? getComponentsRootPath()
  const root = path.join(base, 'docling')
  return {
    root,
    runtime: path.join(root, 'runtime'),
    environment: path.join(root, 'environment'),
    models: path.join(root, 'models'),
    temp: path.join(root, 'temp'),
    bin: path.join(root, 'bin'),
    manifestFile: path.join(root, 'component.json')
  }
}

export const UV_BINARY_FILENAME = process.platform === 'win32' ? 'uv.exe' : 'uv'

export function getUvBinaryPath(layout: DoclingDirLayout): string {
  return path.join(layout.bin, UV_BINARY_FILENAME)
}

/** python.exe on Windows, bin/python elsewhere — relative to the venv root. */
export function getVenvPythonPath(layout: DoclingDirLayout): string {
  return process.platform === 'win32'
    ? path.join(layout.environment, 'Scripts', 'python.exe')
    : path.join(layout.environment, 'bin', 'python')
}

export const KNOWN_COMPONENT_SUBDIRS = [
  'runtime',
  'environment',
  'models',
  'temp',
  'bin',
  'documents',
  'service'
] as const
