import { app, BrowserWindow, clipboard, Menu, type WebContents } from 'electron'

import { getMainWindow } from '../../app/windowManager.js'

/**
 * Native clipboard menu for a managed remote view.
 *
 * A `WebContentsView` is not a browser tab: Electron shows no context menu for a
 * guest page unless the host builds one, so right-clicking inside a provider
 * panel did nothing and Cut/Copy/Paste were reachable only from the keyboard.
 *
 * The menu is deliberately limited to what a hosted page can act on — the
 * selection, the clipboard and the link under the pointer. Reload, history and
 * devtools entries are not offered: reload and history already belong to the tab
 * chrome, and a guest is not allowed to open a window of its own (see
 * `applyRemoteContentSecurity`). Items the current click cannot use are disabled
 * rather than hidden, so the menu keeps a stable shape on Windows.
 *
 * Labels are resolved from `app.getLocale()` instead of the renderer's i18n:
 * this menu is built in the main process, and a round trip to the document being
 * right-clicked would delay it for a cosmetic gain. English is the fallback,
 * matching the other native dialogs.
 */

interface ContextMenuLabels {
  cut: string
  copy: string
  paste: string
  selectAll: string
  copyLinkAddress: string
}

const LABELS: Readonly<Record<'en' | 'tr', ContextMenuLabels>> = {
  en: {
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select all',
    copyLinkAddress: 'Copy link address'
  },
  tr: {
    cut: 'Kes',
    copy: 'Kopyala',
    paste: 'Yapıştır',
    selectAll: 'Tümünü seç',
    copyLinkAddress: 'Bağlantı adresini kopyala'
  }
}

function labelsForLocale(locale: string): ContextMenuLabels {
  return locale.toLowerCase().startsWith('tr') ? LABELS.tr : LABELS.en
}

/**
 * Disposers by `WebContents`, so a view can never accumulate a second listener.
 *
 * Weak keys: the listener belongs to the guest `WebContents`, so once that view
 * is torn down there is nothing left to keep alive.
 */
const installs = new WeakMap<WebContents, () => void>()

/**
 * Installs the menu, or hands back the existing disposer for this guest.
 *
 * Returns a disposer suitable for the manager's per-view teardown.
 */
export function installAiViewContextMenu(webContents: WebContents): () => void {
  const installed = installs.get(webContents)
  if (installed) return installed

  const onContextMenu = (_event: Electron.Event, params: Electron.ContextMenuParams): void => {
    if (webContents.isDestroyed()) return

    const labels = labelsForLocale(app.getLocale())
    const template: Electron.MenuItemConstructorOptions[] = []

    if (params.linkURL) {
      template.push({
        label: labels.copyLinkAddress,
        click: () => clipboard.writeText(params.linkURL)
      })
    }

    // A contenteditable composer and a selected passage are different menus:
    // Cut and Paste have nothing to act on outside an editable field, and Copy
    // only makes sense while something is selected.
    if (params.isEditable) {
      if (template.length > 0) template.push({ type: 'separator' })
      template.push(
        { label: labels.cut, enabled: params.editFlags.canCut, click: () => webContents.cut() },
        { label: labels.copy, enabled: params.editFlags.canCopy, click: () => webContents.copy() },
        {
          label: labels.paste,
          enabled: params.editFlags.canPaste,
          click: () => webContents.paste()
        }
      )
    } else if (params.selectionText.trim().length > 0) {
      if (template.length > 0) template.push({ type: 'separator' })
      template.push({ label: labels.copy, click: () => webContents.copy() })
    }

    if (template.length > 0) template.push({ type: 'separator' })
    template.push({
      label: labels.selectAll,
      enabled: params.editFlags.canSelectAll,
      click: () => webContents.selectAll()
    })

    // A guest `WebContents` is owned by the window, but `fromWebContents` is the
    // exact owner when Electron can resolve it; the main window is the fallback
    // for a view that has not been attached to one yet.
    const owner = BrowserWindow.fromWebContents(webContents) ?? getMainWindow()
    Menu.buildFromTemplate(template).popup(owner && !owner.isDestroyed() ? { window: owner } : {})
  }

  webContents.on('context-menu', onContextMenu)

  const dispose = (): void => {
    if (installs.get(webContents) !== dispose) return
    installs.delete(webContents)
    if (webContents.isDestroyed()) return
    webContents.removeListener('context-menu', onContextMenu)
  }

  installs.set(webContents, dispose)
  return dispose
}
