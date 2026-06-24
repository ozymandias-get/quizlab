import crypto from 'crypto'
import type { DesktopCapturerSource } from 'electron'
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'

import { Logger } from '../core/logger.js'
import { resolvePickerIconPath } from './window/windows.js'

const CH_PREFIX = 'display-media-picker'

/**
 * Returns a self-contained HTML page for the display media picker.
 * Uses a CSP nonce to allow the internal script and style while blocking
 * any injected code.  Previously used 'unsafe-inline' which would allow
 * arbitrary inline CSS/script injection if an untrusted source name or
 * other content leaked into the page context.
 */
function buildPickerHtml(): { html: string; nonce: string } {
  // SECURITY: Generate a unique nonce per invocation so that even if an
  // attacker manages to inject content, they cannot predict the nonce.
  const nonce = crypto.randomBytes(16).toString('base64')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'">
<style nonce="${nonce}">
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 12px 14px; background: #1a1a1a; color: #eee; }
  h1 { font-size: 15px; font-weight: 600; margin: 0 0 12px; }
  .list { display: flex; flex-direction: column; gap: 8px; max-height: 56vh; overflow-y: auto; }
  .row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: #252525; border-radius: 8px; cursor: pointer; border: 1px solid #333; }
  .row:hover { border-color: #4285f4; background: #2a2a2a; }
  .row img { width: 88px; height: 50px; object-fit: cover; border-radius: 4px; flex-shrink: 0; background: #111; }
  .name { flex: 1; font-size: 13px; line-height: 1.35; word-break: break-word; }
  .footer { margin-top: 14px; display: flex; justify-content: flex-end; }
  button.cancel { padding: 8px 18px; font-size: 13px; background: #444; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
  button.cancel:hover { background: #555; }
</style>
</head>
<body>
  <h1>Choose what to share</h1>
  <div class="list" id="list"></div>
  <div class="footer"><button type="button" class="cancel" id="cancel">Cancel</button></div>
  <script nonce="${nonce}">
    (function () {
      var list = document.getElementById('list');
      var cancelBtn = document.getElementById('cancel');
      window.displayMediaPicker.onSources(function (sources) {
        sources.forEach(function (s, i) {
          var row = document.createElement('div');
          row.className = 'row';
          row.setAttribute('role', 'button');
          row.onclick = function () { window.displayMediaPicker.select(i); };
          var img = document.createElement('img');
          img.src = s.thumbnailDataUrl;
          img.alt = '';
          var name = document.createElement('div');
          name.className = 'name';
          name.textContent = s.name || s.id;
          row.appendChild(img);
          row.appendChild(name);
          list.appendChild(row);
        });
      });
      cancelBtn.onclick = function () { window.displayMediaPicker.cancel(); };
    })();
  </script>
</body>
</html>`

  return { html, nonce }
}

function getPreloadPath(): string {
  // SECURITY: Use app.getAppPath() instead of __dirname for preload path
  // resolution.  When the app is packaged (electron-builder asar), __dirname
  // points to the unpacked path inside the asar archive, but webPreferences.preload
  // must resolve to a real filesystem path.  app.getAppPath() + relative path
  // is handled correctly by Electron's asar support for preload scripts.
  return path.join(app.getAppPath(), 'dist', 'electron', 'preload', 'displayMediaPickerPreload.js')
}

/**
 * Modal list UI for picking a desktopCapturer source (replaces unusable multi-button MessageBox on Windows).
 *
 * Each invocation creates **isolated** IPC channels (keyed by a random UUID)
 * so that multiple picker windows cannot collide if opened concurrently.
 * Listeners are always cleaned up when the window closes or a choice is made.
 */
export async function showDisplayMediaPicker(
  parent: BrowserWindow | null | undefined,
  sources: DesktopCapturerSource[]
): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (index: number | null) => {
      if (settled) return
      settled = true
      resolve(index)
    }

    const pickerId = crypto.randomUUID()
    const selectCh = `${CH_PREFIX}:select:${pickerId}`
    const cancelCh = `${CH_PREFIX}:cancel:${pickerId}`
    const sourcesCh = `${CH_PREFIX}:sources:${pickerId}`

    const preloadPath = getPreloadPath()
    const iconPath = resolvePickerIconPath()
    const rowCount = Math.min(sources.length, 12)

    const win = new BrowserWindow({
      parent: parent ?? undefined,
      modal: Boolean(parent),
      width: 440,
      // LAYOUT: Ensure calculated height never drops below minHeight (260).
      // With 1 source: 100 + 1*76 + 52 = 228 < 260 (gap/clipping).
      // With 12 sources: 100 + 12*76 + 52 = 1064, capped to 420.
      height: Math.max(260, Math.min(420, 100 + rowCount * 76 + 52)),
      minWidth: 360,
      minHeight: 260,
      resizable: true,
      maximizable: false,
      fullscreenable: false,
      autoHideMenuBar: true,
      title: 'Screen share',
      backgroundColor: '#1a1a1a',
      show: false,
      ...(iconPath ? { icon: iconPath } : {}),
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        additionalArguments: [
          `--picker-ch-select=${selectCh}`,
          `--picker-ch-cancel=${cancelCh}`,
          `--picker-ch-sources=${sourcesCh}`
        ]
      }
    })

    // SECURITY: If the parent window is destroyed while the picker is open,
    // the picker's Promise never settles (hanging promise) AND the picker
    // BrowserWindow leaks as a detached window in Chromium's process tree.
    // Listen for the parent's 'closed' event to clean up the picker.
    const parentCloseCleanup = () => {
      detachListeners()
      if (!win.isDestroyed()) {
        win.destroy() // Use destroy() instead of close() to skip all unload handlers
      }
      finish(null)
    }
    if (parent && !parent.isDestroyed()) {
      parent.once('closed', parentCloseCleanup)
    }

    const detachListeners = () => {
      ipcMain.removeListener(selectCh, selectHandler)
      ipcMain.removeListener(cancelCh, cancelHandler)
    }

    const selectHandler = (_e: Electron.IpcMainEvent, index: unknown) => {
      // SECURITY: Verify the event sender is the picker window's webContents.
      // Without this check, any renderer could send a fake SELECT_CH message
      // and force a source selection (e.g. full screen instead of a single
      // window), even though the IPC channel is per-instance UUID-scoped.
      if (_e.sender !== win.webContents) {
        return
      }
      detachListeners()
      const idx = typeof index === 'number' ? index : Number(index)
      if (!Number.isFinite(idx) || idx < 0 || idx >= sources.length) {
        finish(null)
      } else {
        finish(idx)
      }
      if (!win.isDestroyed()) win.close()
    }

    const cancelHandler = (_e: Electron.IpcMainEvent) => {
      // SECURITY: Same sender check for cancel to prevent another renderer
      // from silently dismissing the picker.
      if (_e.sender !== win.webContents) {
        return
      }
      detachListeners()
      finish(null)
      if (!win.isDestroyed()) win.close()
    }

    ipcMain.on(selectCh, selectHandler)
    ipcMain.on(cancelCh, cancelHandler)

    win.once('ready-to-show', () => {
      // SECURITY: Parent pencere beklenmedik şekilde kapanırsa
      // win.show() imha edilmiş pencereyi göstermeye çalışarak
      // ana süreci çökertebilir.
      if (!win.isDestroyed()) win.show()
    })

    win.once('closed', () => {
      detachListeners()
      finish(null)
    })

    const { html: pickerHtml } = buildPickerHtml()
    const loadUrl = `data:text/html;charset=utf-8,${encodeURIComponent(pickerHtml)}`
    void win
      .loadURL(loadUrl)
      .then(async () => {
        // PERF: Convert source thumbnails to Base64 asynchronously in batches
        // so a large number of windows/sources (30–40) does not block the main
        // thread for hundreds of milliseconds.  toDataURL() is a synchronous
        // CPU-bound bitmap encode; yielding via setImmediate() between batches
        // keeps the main thread responsive for IPC, rendering, and input events.
        const MAX_THUMBNAIL_WIDTH = 150
        const BATCH_SIZE = 4
        const serialized: Array<{ id: string; name: string; thumbnailDataUrl: string }> = []
        for (let i = 0; i < sources.length; i += BATCH_SIZE) {
          const batch = sources.slice(i, i + BATCH_SIZE)
          for (const s of batch) {
            // PERFORMANCE: Resize thumbnails to a maximum of 150px wide before
            // converting to Base64.  DesktopCapturerSource thumbnails can be
            // full-resolution screen captures (thousands of pixels), producing
            // multi-megabyte Base64 strings.  Sending many such strings over
            // IPC in a single message blocks both the main process and the
            // picker renderer during serialization, freezing the UI for seconds.
            let thumbnail = s.thumbnail
            const origSize = thumbnail.getSize()
            if (origSize.width > MAX_THUMBNAIL_WIDTH) {
              const scale = MAX_THUMBNAIL_WIDTH / origSize.width
              thumbnail = thumbnail.resize({
                width: MAX_THUMBNAIL_WIDTH,
                height: Math.max(1, Math.round(origSize.height * scale))
              })
            }
            serialized.push({
              id: s.id,
              name: s.name,
              thumbnailDataUrl: thumbnail.toDataURL()
            })
          }
          // Yield to the event loop after each batch to process pending I/O
          // and IPC messages before continuing with the next batch.
          if (i + BATCH_SIZE < sources.length) {
            await new Promise<void>((r) => setImmediate(r))
          }
        }
        if (!win.isDestroyed()) {
          win.webContents.send(sourcesCh, serialized)
        }
      })
      .catch(() => {
        // SECURITY: If loadURL fails (e.g. data URL exceeds length limits,
        // renderer crashes, or CSP blocks the page), the Promise from
        // loadURL rejects and the outer Promise (showDisplayMediaPicker)
        // would hang forever.  Catch the error and settle the promise.
        Logger.error('[DisplayMediaPicker] Failed to load picker HTML')
        detachListeners()
        if (!win.isDestroyed()) win.close()
        finish(null)
      })
  })
}
