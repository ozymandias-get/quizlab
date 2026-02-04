/**
 * Kullanıcı Tanımlı Element Seçici (Picker) Modülü
 *
 * Bu modül, webview içine enjekte edilecek ve kullanıcının
 * etkileşime girmek istediği elementleri (Input ve Button)
 * manuel olarak seçmesini sağlayacak mantığı içerir.
 */
import { type TranslationMap } from './picker/uiTemplates';
/**
 * Webview içine enjekte edilecek "Picker" scripti.
 * Bu script, sayfadaki elementleri vurgular ve tıklamaları yakalar.
 *
 * @returns {string} Enjekte edilecek JS kodu
 */
export declare const generatePickerScript: (translations?: TranslationMap) => string;
