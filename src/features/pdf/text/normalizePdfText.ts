/**
 * Text normalization for PDF-extracted content.
 *
 * Everything in here must be **lossless**: it may only change whitespace, line
 * endings, typographic ligatures and Unicode composition. Substituting one
 * printable character for another is not normalization, it is a guess about the
 * source document, and the text produced here is fed straight into an AI prompt
 * (both the "add page text to AI" menu action and plain text selection), so a
 * wrong guess is presented to the model as authoritative.
 *
 * ## Why there is no Turkish corruption repair here
 *
 * This module used to rewrite U+02C6 -> ö, U+00B8 -> ü and U+02DC -> ğ whenever
 * the surrounding text looked Turkish, on the premise that pdf.js' ToUnicode
 * CMap emits those codepoints when a font has a non-standard encoding table.
 * That repair was removed because nothing in the repository supported it:
 *
 *   - No fixture, no captured sample, no issue and no test. The mapping arrived
 *     fully formed in the root snapshot commit and the literal characters appear
 *     in zero test files.
 *   - The stated recovery mechanism does not exist. `pdfjs-dist` 6.4.299 — and
 *     the 3.x it replaced — contain no ::before/beforeCSS text-layer code, and the
 *     text layer's span content comes straight from getTextContent()'s item.str,
 *     so no rendering-time fix-up was available.
 *   - The guard could not contain the damage. `looksLikeTurkish` matched ö and ü
 *     themselves, so a single stray cedilla in a French, Catalan, Spanish or
 *     German document was enough to rewrite every artifact on the page.
 *   - The three codepoints are legitimate elsewhere: U+00B8 is the Latin-1
 *     cedilla used in French/Catalan and as a currency symbol, U+02C6 is used in
 *     Sami orthographies and U+02DC in Turkic transliteration.
 *
 * Reintroducing character repair requires a real document that demonstrably
 * exhibits the corruption, a sample of the extracted text it produces, and a
 * test asserting the mapping only fires on that signature. Until then the text
 * is passed through unchanged.
 */

/**
 * Typographic ligatures emitted by PDF fonts (pdf.js passes them through
 * verbatim). NFC does NOT expand compatibility characters, so without this map
 * "efﬁcient" / "ﬁzyoloji" keep the single U+FB01 glyph and break both in-app
 * search and AI prompts. Each ligature expands to the letters it is composed of,
 * so this is lossless.
 */
const LIGATURE_MAP = {
  ﬀ: 'ff',
  ﬁ: 'fi',
  ﬂ: 'fl',
  ﬃ: 'ffi',
  ﬄ: 'ffl',
  ﬅ: 'st',
  ﬆ: 'st'
} as const

const LIGATURE_REGEX = /[ﬀﬁﬂﬃﬄﬅﬆ]/g

function expandLigatures(text: string): string {
  return text.replaceAll(
    LIGATURE_REGEX,
    (match) => LIGATURE_MAP[match as keyof typeof LIGATURE_MAP] || match
  )
}

/**
 * Normalizes raw PDF text output: collapses whitespace, fixes line breaks,
 * removes excessive blank lines, expands typographic ligatures (ﬁ→fi), and
 * applies Unicode NFC normalization to combine decomposed characters.
 * Shared across all text extraction paths.
 */
export function normalizePdfText(raw: string): string {
  const normalized = raw
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replaceAll(/[\t ]+/g, ' ')
    .replaceAll(/\n[\t ]+/g, '\n')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim()

  // Expand ligatures before NFC: NFC preserves compatibility characters, so
  // without this "ﬁzyoloji" would keep the single U+FB01 glyph.
  const deligatured = expandLigatures(normalized)

  // NFC combines decomposed characters (e.g. o + combining diaeresis → ö),
  // which fixes text pdf.js emitted in NFD form. This is a composition, so the
  // characters are preserved.
  return deligatured.normalize('NFC')
}
