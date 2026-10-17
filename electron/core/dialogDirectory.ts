/**
 * Default directory for OS file dialogs.
 *
 * Electron 43 dropped the OS-level "reopen in the last used directory"
 * behaviour and starts every dialog in Downloads when no `defaultPath` is
 * given. This module keeps the last selection in memory (it is never
 * persisted) so every picker in the app reopens where the user left off,
 * the way a single native file dialog used to.
 */
import { app } from 'electron'
import path from 'path'

let lastDirectory: string | undefined

/**
 * Directory the next file dialog should open in. Never `undefined`: omitting
 * `defaultPath` entirely would hand the choice back to the Electron 43
 * Downloads default, so first run falls back to the documents directory.
 */
export function getDefaultDialogDirectory(): string {
  return lastDirectory ?? app.getPath('documents')
}

/**
 * Remember the directory of a dialog selection so the next dialog reopens
 * there. A bare filename (no directory component) is ignored: its `dirname` is
 * `"."`, which would make the dialog open relative to the process cwd.
 */
export function rememberDialogDirectory(selectedPath: string): void {
  const dir = path.dirname(selectedPath)
  if (dir && dir !== '.' && path.isAbsolute(dir)) lastDirectory = dir
}
