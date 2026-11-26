import { beforeEach, describe, expect, it, vi } from 'vitest'

const menu = vi.hoisted(() => ({
  buildFromTemplate: vi.fn(),
  popup: vi.fn()
}))
const writeText = vi.hoisted(() => vi.fn())
const getLocale = vi.hoisted(() => vi.fn(() => 'en'))

vi.mock('electron', () => ({
  app: { getLocale },
  clipboard: { writeText },
  BrowserWindow: { fromWebContents: () => null },
  Menu: { buildFromTemplate: menu.buildFromTemplate }
}))

vi.mock('../../../app/windowManager.js', () => ({ getMainWindow: () => null }))

import { installAiViewContextMenu } from '../../../features/ai-view/aiViewContextMenu.js'

type ContextMenuHandler = (event: unknown, params: Electron.ContextMenuParams) => void

const ALL_FLAGS: Electron.EditFlags = {
  canUndo: true,
  canRedo: true,
  canCut: true,
  canCopy: true,
  canPaste: true,
  canDelete: true,
  canSelectAll: true,
  canEditRichly: true
}

function fakeGuest() {
  const handlers = new Set<ContextMenuHandler>()
  const guest = {
    on: (event: string, handler: ContextMenuHandler) => {
      if (event === 'context-menu') handlers.add(handler)
    },
    removeListener: vi.fn((event: string, handler: ContextMenuHandler) => {
      if (event === 'context-menu') handlers.delete(handler)
    }),
    isDestroyed: () => false,
    cut: vi.fn(),
    copy: vi.fn(),
    paste: vi.fn(),
    selectAll: vi.fn(),
    rightClick: (params: Partial<Electron.ContextMenuParams> = {}) => {
      const full = {
        isEditable: false,
        selectionText: '',
        linkURL: '',
        editFlags: ALL_FLAGS,
        ...params
      } as Electron.ContextMenuParams
      for (const handler of handlers) handler({}, full)
    },
    handlerCount: () => handlers.size
  }
  return guest
}

function templateFromLastMenu(): Electron.MenuItemConstructorOptions[] {
  const call = menu.buildFromTemplate.mock.calls.at(-1)
  return (call?.[0] ?? []) as Electron.MenuItemConstructorOptions[]
}

function labelsOf(template: Electron.MenuItemConstructorOptions[]): Array<string | undefined> {
  return template.map((item) => (item.type === 'separator' ? '---' : item.label))
}

function click(item: Electron.MenuItemConstructorOptions | undefined): void {
  ;(item?.click as (() => void) | undefined)?.()
}

describe('installAiViewContextMenu', () => {
  beforeEach(() => {
    menu.buildFromTemplate.mockReset().mockReturnValue({ popup: menu.popup })
    menu.popup.mockReset()
    writeText.mockReset()
    getLocale.mockReset().mockReturnValue('en')
  })

  it('offers cut, copy, paste and select all in an editable field', () => {
    const guest = fakeGuest()
    installAiViewContextMenu(guest as never)

    guest.rightClick({ isEditable: true })

    const template = templateFromLastMenu()
    expect(labelsOf(template)).toEqual(['Cut', 'Copy', 'Paste', '---', 'Select all'])
    expect(menu.popup).toHaveBeenCalledTimes(1)
  })

  it('disables the items the click cannot use', () => {
    const guest = fakeGuest()
    installAiViewContextMenu(guest as never)

    guest.rightClick({
      isEditable: true,
      editFlags: { ...ALL_FLAGS, canCut: false, canCopy: false, canSelectAll: false }
    })

    const enabled = templateFromLastMenu().map((item) => item.enabled)
    expect(enabled).toEqual([false, false, true, undefined, false])
  })

  it('offers only copy and select all on a selected passage', () => {
    const guest = fakeGuest()
    installAiViewContextMenu(guest as never)

    guest.rightClick({ isEditable: false, selectionText: 'seçili metin' })

    const template = templateFromLastMenu()
    expect(labelsOf(template)).toEqual(['Copy', '---', 'Select all'])

    click(template[0])
    expect(guest.copy).toHaveBeenCalledTimes(1)
  })

  it('copies the link under the pointer before the clipboard actions', () => {
    const guest = fakeGuest()
    installAiViewContextMenu(guest as never)

    guest.rightClick({ isEditable: true, linkURL: 'https://example.com/a' })

    const template = templateFromLastMenu()
    expect(labelsOf(template)[0]).toBe('Copy link address')

    click(template[0])
    expect(writeText).toHaveBeenCalledWith('https://example.com/a')
  })

  it('uses the Turkish labels when the app locale is Turkish', () => {
    getLocale.mockReturnValue('tr-TR')
    const guest = fakeGuest()
    installAiViewContextMenu(guest as never)

    guest.rightClick({ isEditable: true })

    expect(labelsOf(templateFromLastMenu())).toEqual([
      'Kes',
      'Kopyala',
      'Yapıştır',
      '---',
      'Tümünü seç'
    ])
  })

  it('installs one listener per guest and removes it on dispose', () => {
    const guest = fakeGuest()
    const dispose = installAiViewContextMenu(guest as never)
    const same = installAiViewContextMenu(guest as never)

    expect(same).toBe(dispose)
    expect(guest.handlerCount()).toBe(1)

    dispose()
    expect(guest.removeListener).toHaveBeenCalledTimes(1)

    guest.rightClick({ isEditable: true })
    expect(menu.buildFromTemplate).not.toHaveBeenCalled()
  })
})
