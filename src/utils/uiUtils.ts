import DOMPurify from 'dompurify'



/**
 * Quiz metinlerini formatlar (bold, italic, yeni satır)
 * ve XSS'e karşı sanitize eder
 * @param {string} text - Formatlanacak metin
 * @returns {string} Güvenli HTML formatlı metin
 */
export const formatQuizText = (text: string): string => {
    if (!text) return ''
    const formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .split('\n').join('<br/>')

    return DOMPurify.sanitize(formatted, {
        ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'br', 'p', 'span', 'code', 'pre'],
        ALLOWED_ATTR: ['class']
    })
}



/**
 * Hex renk kodunu RGBA formatına çevirir
 * @param {string} hex - Hex renk kodu (ör: #ffffff veya ffffff)
 * @param {number} alpha - Opaklık (0-1 arası)
 * @returns {string} rgba(r, g, b, alpha)
 */
export const hexToRgba = (hex: string, alpha: number = 1): string => {
    if (!hex) return `rgba(0, 0, 0, ${alpha})`

    const cleanHex = hex.replace('#', '')

    // Kısa hex (#RGB) desteği
    const fullHex = cleanHex.length === 3
        ? cleanHex.split('').map(char => char + char).join('')
        : cleanHex

    const r = parseInt(fullHex.substring(0, 2), 16)
    const g = parseInt(fullHex.substring(2, 4), 16)
    const b = parseInt(fullHex.substring(4, 6), 16)

    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
