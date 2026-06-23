/**
 * Characters that indicate pdfjs-dist CMap/encoding corruption in Turkish text.
 * These are artifact characters that should never appear in properly encoded
 * Turkish text. When detected alongside other suspicious patterns, we attempt
 * heuristic repair.
 *
 * Not: flagsız versiyon (varlık testi), global-flagsız replace regex aşağıda.
 */
const SUSPICIOUS_ARTIFACTS = /[\u00B8\u02C6\u02DC]/

/**
 * Önceden derlenmiş global regex — .split().join() zinciri yerine tek
 * geçişte tüm bozuk karakterleri değiştirmek için. Her replace çağrısında
 * yeniden derlenmez, modül yüklendiğinde bir kere oluşturulur.
 */
const TURKISH_REPLACE_REGEX = /[\u00B8\u02C6\u02DC]/g

/**
 * Known pdfjs-dist Turkish character corruption mapping.
 * Maps artifact characters to their most likely Turkish replacements.
 * This covers the common case where pdfjs-dist's ToUnicode CMap produces
 * wrong Unicode codepoints for fonts with non-standard encoding tables.
 *
 * IMPORTANT: These replacements are only applied when the text is detected
 * as likely Turkish (contains other Turkish-specific characters).
 */
const TURKISH_CORRUPTION_MAP = {
  '\u02C6': 'ö', // MODIFIER LETTER CIRCUMFLEX ACCENT → ö
  '\u00B8': 'ü', // CEDILLA → ü (most common in Turkish context)
  '\u02DC': 'ğ' // SMALL TILDE → ğ (less common but possible)
} as const satisfies Record<string, string>

/**
 * Checks whether a string likely contains Turkish text by looking for
 * common Turkish characters (ı, ş, ç, ğ, ü, ö, İ, Ş, Ç, Ğ, Ü, Ö).
 */
function looksLikeTurkish(text: string): boolean {
  const turkishChars = /[ÇÖÜçöüĞğİıŞş]/
  return turkishChars.test(text)
}

/**
 * Attempts to repair known pdfjs-dist Turkish character corruption.
 * Only activates when the text looks like Turkish AND contains suspicious
 * artifact characters. This avoids false positives on other languages.
 *
 * Performans notu: Her karakter türü için ayrı split().join() zinciri
 * yerine önceden derlenmiş tek bir regex + callback kullanılır. Bu
 * yaklaşım string'i üç kez değil bir kez geçer ve ara string nesneleri
 * oluşturmaz — özellikle büyük metin bloklarında (sayfa seçimi)
 * belirgin fark yaratır.
 */
function repairPdfjsTurkishCorruption(text: string): string {
  if (!SUSPICIOUS_ARTIFACTS.test(text)) return text
  if (!looksLikeTurkish(text)) return text

  return text.replaceAll(TURKISH_REPLACE_REGEX, (match) => TURKISH_CORRUPTION_MAP[match] || match)
}

/**
 * Normalizes raw PDF text output: collapses whitespace, fixes line breaks,
 * removes excessive blank lines, applies Unicode NFC normalization to combine
 * decomposed characters, and attempts to repair known pdfjs-dist Turkish
 * character corruption patterns. Shared across all text extraction paths.
 */
export function normalizePdfText(raw: string): string {
  const normalized = raw
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replaceAll(/[\t ]+/g, ' ')
    .replaceAll(/\n[\t ]+/g, '\n')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim()

  // NFC normalization combines decomposed characters (e.g., o + combining
  // diaeresis → ö). This fixes characters that pdfjs-dist may have output
  // in NFD form.
  const nfc = normalized.normalize('NFC')

  // Attempt to repair known pdfjs-dist Turkish font encoding corruption.
  return repairPdfjsTurkishCorruption(nfc)
}
