import { describe, expect, it } from 'vitest'

import { extractShellPdfPaths, isPdfPath } from '../../../features/shell-open/parseShellPdfPaths.js'

describe('isPdfPath', () => {
  it('matches .pdf case-insensitively', () => {
    expect(isPdfPath('C:\\Docs\\tez.PDF')).toBe(true)
    expect(isPdfPath('/home/user/a.pdf')).toBe(true)
  })

  it('rejects non-pdf files', () => {
    expect(isPdfPath('notes.txt')).toBe(false)
    expect(isPdfPath('pdf')).toBe(false)
    expect(isPdfPath('a.pdf.exe')).toBe(false)
  })
})

describe('extractShellPdfPaths', () => {
  it('returns empty when no pdf args', () => {
    expect(extractShellPdfPaths(['C:\\app\\Quizlab Reader.exe'])).toEqual([])
  })

  it('extracts a quoted path with spaces and Turkish chars', () => {
    const argv = [
      'C:\\app\\Quizlab Reader.exe',
      '"C:\\Users\\Umut Üstün\\Documents\\sınav notları.pdf"'
    ]
    expect(extractShellPdfPaths(argv)).toEqual([
      'C:\\Users\\Umut Üstün\\Documents\\sınav notları.pdf'
    ])
  })

  it('skips flags, dev args and urls', () => {
    const argv = ['/app/electron', '.', '--enable-logging', 'http://localhost:5173/', 'C:\\a.pdf']
    expect(extractShellPdfPaths(argv)).toEqual(['C:\\a.pdf'])
  })

  it('dedupes repeat paths and keeps all unique pdfs', () => {
    const argv = ['exe', 'C:\\a.pdf', 'C:\\A.PDF', 'D:\\b.pdf', 'notes.txt']
    expect(extractShellPdfPaths(argv)).toEqual(['C:\\a.pdf', 'D:\\b.pdf'])
  })

  it('filters missing files when existsSync is provided', () => {
    const argv = ['exe', 'C:\\var.pdf', 'C:\\yok.pdf']
    const existsSync = (p: string) => p === 'C:\\var.pdf'
    expect(extractShellPdfPaths(argv, { existsSync })).toEqual(['C:\\var.pdf'])
  })
})
