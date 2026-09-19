// QuizLab Windows 11 üst-menü kabuk eklentisini (Rust COM DLL) derler ve
// electron-builder'ın paketleyeceği `resources/shell/` klasörüne kopyalar.
//
// Windows dışında sessizce atlanır (macOS/Linux derlemeleri etkilenmez).
// DLL ikili dosyası git'e girmez; `resources/shell/*.dll` yok sayılır.

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

if (process.platform !== 'win32') {
  console.log('[shell-ext] non-Windows platform, skipping.')
  process.exit(0)
}

const crateDir = path.join(root, 'shell-ext')
if (!fs.existsSync(path.join(crateDir, 'Cargo.toml'))) {
  console.log('[shell-ext] shell-ext/Cargo.toml not found, skipping.')
  process.exit(0)
}

let cargo = 'cargo'
try {
  execSync('cargo --version', { stdio: 'ignore' })
} catch {
  console.error(
    '[shell-ext] Rust toolchain (cargo) not found. Install it from https://rustup.rs/ ' +
      'or run the Windows build on a machine with Rust installed.'
  )
  process.exit(1)
}

console.log('[shell-ext] building QuizLabShellExt.dll (release)...')
execSync(`${cargo} build --release --manifest-path ${path.join(crateDir, 'Cargo.toml')}`, {
  stdio: 'inherit'
})

const built = path.join(crateDir, 'target', 'release', 'QuizLabShellExt.dll')
if (!fs.existsSync(built)) {
  console.error(`[shell-ext] expected output missing: ${built}`)
  process.exit(1)
}

const outDir = path.join(root, 'resources', 'shell')
fs.mkdirSync(outDir, { recursive: true })
fs.copyFileSync(built, path.join(outDir, 'QuizLabShellExt.dll'))
console.log('[shell-ext] copied to resources/shell/QuizLabShellExt.dll')
