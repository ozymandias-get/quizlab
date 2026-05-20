/**
 * PDF Text Engine — centralizes all text extraction, normalization, and selection logic.
 * Replaces scattered DOM queries and extraction helpers across hooks/components.
 */

export { normalizePdfText } from './normalizePdfText'
export {
  extractPageTextFromDom,
  invalidatePageCache,
  clearPageCache
} from './extractPageTextFromDom'
export { extractSelectedText } from './extractSelectedText'
