import path from 'path'

/**
 * Windows "QuizLab ile Aç" (sağ tık) akışı için argv ayrıştırıcı.
 *
 * Explorer, seçili her PDF için uygulamayı `"...Quizlab Reader.exe" "%1"`
 * komutuyla başlatır. Bu fonksiyon process.argv içinden gerçek PDF
 * dosyalarını ayıklar; Electron/dev bayraklarını ve kurulum
 * argümanlarını (squirrel, --*) eler.
 *
 * Saf (pure) tutuldu: dosya varlık kontrolü opsiyonel `existsSync`
 * enjeksiyonuyla yapılır, böylece birim testlerde fs mock'lanabilir.
 */

const IGNORED_EXACT = new Set(['.', './', '.\\'])

function stripQuotes(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length >= 2) {
    const first = trimmed[0]
    const last = trimmed[trimmed.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1).trim()
    }
  }
  return trimmed
}

export function isPdfPath(candidate: string): boolean {
  return path.extname(candidate).toLowerCase() === '.pdf'
}

function isIgnorableArg(arg: string): boolean {
  if (!arg) return true
  if (arg.startsWith('--')) return true
  if (arg.startsWith('-')) return true
  if (IGNORED_EXACT.has(arg)) return true
  // Electron dev: `electron . "file.pdf"` → proje dizini argümanı elenir.
  if (arg === process.cwd()) return true
  // squirrel.windows kurulum/kaldırma bayrakları
  if (arg.startsWith('--squirrel')) return true
  // Dev server URL'leri vb.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(arg)) return true
  return false
}

export interface ParseShellPdfOptions {
  existsSync?: (filePath: string) => boolean
}

/**
 * argv dizisinden PDF dosya yollarını çıkarır.
 * - argv[0] (çalıştırılabilir yol) her zaman atlanır.
 * - Tırnaklı yollar temizlenir, tekrarlar elenir.
 * - `existsSync` verilirse var olmayan dosyalar elenir.
 */
export function extractShellPdfPaths(
  argv: readonly string[],
  options: ParseShellPdfOptions = {}
): string[] {
  const { existsSync } = options
  const seen = new Set<string>()
  const result: string[] = []

  const args = argv.slice(1)
  for (const raw of args) {
    const cleaned = stripQuotes(raw)
    if (isIgnorableArg(cleaned)) continue
    if (!isPdfPath(cleaned)) continue
    if (existsSync) {
      try {
        if (!existsSync(cleaned)) continue
      } catch {
        continue
      }
    }
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(cleaned)
  }

  return result
}
