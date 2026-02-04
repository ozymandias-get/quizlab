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
 * Benzersiz bir ID oluşturur
 * @returns {string} Unique ID
 */
export const generateId = (): string => {
    return Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
}

/**
 * Hex renk kodunu RGBA formatına çevirir
 * @param {string} hex - Hex renk kodu (ör: #ffffff veya ffffff)
 * @param {number} alpha - Opaklık (0-1 arası)
 * @returns {string} rgba(r, g, b, alpha)
 */
export const hexToRgba = (hex: string, alpha: number = 1): string => {
    if (!hex) return `rgba(0, 0, 0, ${alpha})`

    let c: string | string[] = hex.substring(1).split('')
    if (c.length === 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]]
    }
    const hexVal = parseInt('0x' + (c as string[]).join(''), 16)
    return 'rgba(' + [(hexVal >> 16) & 255, (hexVal >> 8) & 255, hexVal & 255].join(',') + ',' + alpha + ')'
}
