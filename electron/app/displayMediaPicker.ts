import { BrowserWindow, app, ipcMain } from 'electron'
import type { DesktopCapturerSource } from 'electron'
import fs from 'fs'
import path from 'path'

const SELECT_CH = 'display-media-picker:select'
const CANCEL_CH = 'display-media-picker:cancel'
const SOURCES_CH = 'display-media-picker:sources'

/** Minimal HTML; sources are sent over IPC to avoid huge data: URLs. */
const PICKER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; script-src 'unsafe-inline'; style-src 'unsafe-inline'">
<style>
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
  <script>
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

function getPreloadPath(): string {
  return path.join(__dirname, '../preload/displayMediaPickerPreload.js')
}

function resolvePickerIconPath(): string | undefined {
  const extension = process.platform === 'win32' ? 'ico' : 'png'
  const iconName = `icon.${extension}`
  const candidates = [
    path.join(process.resourcesPath, 'resources', iconName),
    path.join(app.getAppPath(), 'resources', iconName),
    path.join(app.getAppPath(), '..', 'resources', iconName)
  ]
  return candidates.find((p) => fs.existsSync(p))
}

/**
 * Modal list UI for picking a desktopCapturer source (replaces unusable multi-button MessageBox on Windows).
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

    const preloadPath = getPreloadPath()
    const iconPath = resolvePickerIconPath()
    const rowCount = Math.min(sources.length, 12)

    const win = new BrowserWindow({
      parent: parent ?? undefined,
      modal: Boolean(parent),
      width: 440,
      height: Math.min(420, 100 + rowCount * 76 + 52),
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
        sandbox: true
      }
    })

    const detachListeners = () => {
      ipcMain.removeListener(SELECT_CH, selectHandler)
      ipcMain.removeListener(CANCEL_CH, cancelHandler)
    }

    const selectHandler = (_e: Electron.IpcMainEvent, index: unknown) => {
      detachListeners()
      const idx = typeof index === 'number' ? index : Number(index)
      if (!Number.isFinite(idx) || idx < 0 || idx >= sources.length) {
        finish(null)
      } else {
        finish(idx)
      }
      if (!win.isDestroyed()) win.close()
    }

    const cancelHandler = () => {
      detachListeners()
      finish(null)
      if (!win.isDestroyed()) win.close()
    }

    ipcMain.on(SELECT_CH, selectHandler)
    ipcMain.on(CANCEL_CH, cancelHandler)

    win.once('ready-to-show', () => {
      win.show()
    })

    win.once('closed', () => {
      detachListeners()
      finish(null)
    })

    const loadUrl = `data:text/html;charset=utf-8,${encodeURIComponent(PICKER_HTML)}`
    void win.loadURL(loadUrl).then(() => {
      const serialized = sources.map((s) => ({
        id: s.id,
        name: s.name,
        thumbnailDataUrl: s.thumbnail.toDataURL()
      }))
      if (!win.isDestroyed()) {
        win.webContents.send(SOURCES_CH, serialized)
      }
    })
  })
}
