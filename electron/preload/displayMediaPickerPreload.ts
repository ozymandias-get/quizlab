import { contextBridge, ipcRenderer } from 'electron'

const SOURCES = 'display-media-picker:sources'
const SELECT = 'display-media-picker:select'
const CANCEL = 'display-media-picker:cancel'

type SourceRow = { id: string; name: string; thumbnailDataUrl: string }

contextBridge.exposeInMainWorld('displayMediaPicker', {
  onSources: (cb: (sources: SourceRow[]) => void) => {
    ipcRenderer.once(SOURCES, (_e, sources: SourceRow[]) => {
      cb(sources)
    })
  },
  select: (index: number) => ipcRenderer.send(SELECT, index),
  cancel: () => ipcRenderer.send(CANCEL)
})
