/**
 * Kullanıcı Tanımlı Element Seçici (Picker) Modülü
 *
 * Bu modül, yönetilen uzak görünüm içine enjekte edilecek ve kullanıcının
 * etkileşime girmek istediği elementleri (Input ve Button)
 * manuel olarak seçmesini sağlayacak mantığı içerir.
 */

import { buildInjectedPickerDomHelpers } from './lib/injectedPickerDom.js'
import { pickerStyles } from './lib/styles.js'
import { getHintHtml, getStepHtml, type TranslationMap } from './lib/uiTemplates.js'
import { buildPickerCleanupBlock } from './pickerScript/cleanup.js'
import { buildPickerHandlersBlock } from './pickerScript/handlers.js'
import { buildPickerScriptHead } from './pickerScript/head.js'
import { buildPickerIframesBlock } from './pickerScript/iframes.js'
import { buildPickerTargetingBlock } from './pickerScript/targeting.js'
import { buildPickerUiBlock } from './pickerScript/ui.js'

/**
 * Yönetilen uzak görünüm içine enjekte edilecek "Picker" scripti.
 * Bu script, sayfadaki elementleri vurgular ve tıklamaları yakalar.
 *
 * Electron executeJavaScript yalnızca ana çerçevede çalışır; ana sayfa içeriği
 * aynı kökenli bir iframe içindeyse olaylar üst document'a gitmez. Bu yüzden
 * dinleyiciler hem ana belgeye hem de erişilebilen iframe belgelerine eklenir.
 *
 * @returns {string} Enjekte edilecek JS kodu
 */
let cachedInjectedPickerDomHelpers: string | null = null
let cachedStepHtmlSource: string | null = null
let cachedHintHtmlSource: string | null = null
let cachedPickerBody: string | null = null

export const generatePickerScript = (
  translations: TranslationMap = {},
  pickerSessionId?: string | null
): string => {
  if (cachedInjectedPickerDomHelpers === null) {
    cachedInjectedPickerDomHelpers = buildInjectedPickerDomHelpers()
  }
  if (cachedStepHtmlSource === null) {
    cachedStepHtmlSource = getStepHtml.toString()
  }
  if (cachedHintHtmlSource === null) {
    cachedHintHtmlSource = getHintHtml.toString()
  }
  if (cachedPickerBody === null) {
    cachedPickerBody = [
      buildPickerUiBlock(pickerStyles),
      buildPickerTargetingBlock(),
      buildPickerHandlersBlock(),
      buildPickerIframesBlock(),
      buildPickerCleanupBlock()
    ].join('')
  }

  const translationsJSON = JSON.stringify(translations)
  const head = buildPickerScriptHead(
    translationsJSON,
    cachedInjectedPickerDomHelpers,
    cachedStepHtmlSource,
    cachedHintHtmlSource,
    pickerSessionId
  )

  return `
    (function() {
${head}${cachedPickerBody}
    })();
    `
}
