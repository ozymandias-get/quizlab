/**
 * File Explorer için yardımcı fonksiyonlar
 */

/**
 * Dosya boyutunu insan tarafından okunabilir formata dönüştürür
 * @param {number} bytes - Byte cinsinden boyut
 * @returns {string} Formatlanmış boyut (Örn: 1.2 MB)
 */
export const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

interface FileSystemItemBase {
    type: 'folder' | 'file';
    name: string;
}

/**
 * Dosya ve klasörleri sıralar (Önce klasörler, sonra alfabetik)
 * @param {Array} items - Sıralanacak öğeler listesi
 * @returns {Array} Sıralanmış liste
 */
export const sortFileSystemItems = <T extends FileSystemItemBase>(items: T[]): T[] => {
    if (!Array.isArray(items)) return []

    return [...items].sort((a, b) => {
        // Tip bazlı sıralama (Klasörler üstte)
        if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1
        }
        // İsim bazlı sıralama (TR karakter duyarlı)
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
}

/**
 * Dosya uzantısını alır
 * @param {string} fileName - Dosya adı
 * @returns {string} Uzantı
 */
export const getFileExtension = (fileName: string): string => {
    if (!fileName) return ''
    const parts = fileName.split('.')
    return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : ''
}

interface ValidateFileNameResult {
    valid: boolean;
    name?: string;
    error?: string;
}

/**
 * Dosya/Klasör ismini doğrular
 * @param {string} name - Doğrulanacak isim
 * @returns {Object} { valid: boolean, name: string, error?: string }
 */
export const validateFileName = (name: string): ValidateFileNameResult => {
    const trimmed = name?.trim()
    if (!trimmed) return { valid: false, error: 'empty_name' }

    // Windows/Unix geçersiz karakterleri
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(trimmed)) {
        return { valid: false, error: 'invalid_chars' }
    }

    return { valid: true, name: trimmed }
}
