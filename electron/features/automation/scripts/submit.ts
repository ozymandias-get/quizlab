import { VOICE_CONTROL_LABEL_PATTERN } from '../automationScripts/lib/siteStrategyRegistry.js'
import { normalizeMs } from '../automationScripts/preamble.js'
import {
  buildResolveSendButtonScript,
  resolveSubmitButtonBudget,
  type SubmitButtonBudgetOptions
} from './resolveSendButton.js'

/**
 * Gönderim betiğinin gerçek zaman bütçeleri.
 *
 * Bu değerler birer kural DEĞİL, birer ölçüm düzeltmesidir: hepsi canlı
 * chatgpt.com ölçümlerinden çıkarıldı (bkz. ilgili sabitlerin yorumları).
 * Bu yüzden değiştirilebilir birer "ayar" olarak değil, testlerin küçük
 * bütçeyle koşabilmesi için GEÇERSİZ KILINABİLİR birer varsayılan olarak
 * tutulur.
 *
 * ⛔ Sözleşme: HİÇBİR parametre geçilmediğinde üretilen betik, bu
 * değerlerin sabit hâlinde yazıldığı betikle BAYT BAYT aynıdır. Testler bu
 * eşitliği `automationScripts.test.ts` içinde ölçer; bozulursa gerçek kullanıcı
 * 15 saniyelik bütçesini kaybetmiştir.
 */
export interface SubmitBudgetOptions extends SubmitButtonBudgetOptions {
  /** `__observeSubmitEffect` yoklama turu sayısı. */
  observeAttempts?: number
  /** `__observeSubmitEffect` yoklamaları arası bekleme. */
  observeIntervalMs?: number
}

interface BuildPerformSubmitScriptOptions extends SubmitBudgetOptions {
  includeInputLookupForEnter: boolean
}

/**
 * Gönderim sonrası teslimat gözleminin penceresi (25 × 120ms = 3 saniye).
 * Gerekçe betik metninin içindedir: `__observeSubmitEffect` tanımı.
 */
const OBSERVE_EFFECT_ATTEMPTS = 25
const OBSERVE_EFFECT_INTERVAL_MS = 120

/**
 * Builds the shared submit routine used by the auto-send and click-send scripts.
 *
 * Besides submitting, this is the single place that decides whether a *button*
 * or *input* recovery counts as a real, successful usage. The rule is
 * deliberately branch-local: a `click` submit only credits the button, an
 * `enter_key` submit only credits the input, so an untouched locator can never
 * be promoted on the strength of the other one's success.
 *
 * Gönderim durumu (task §8) üç ayrı kavram olarak modellenir ve birbirine
 * karıştırılmaz:
 *   - `submit_attempted`   → gönderim gerçekten tetiklendi (click/Enter)
 *   - `submit_observed`    → arayüzde beklenen etki GÖZLEMLENDİ
 *   - `delivery_unconfirmed` → gönderim denendi ama etki doğrulanamadı
 *
 * `submit_attempted` tek başına SONUÇ DEĞİLDİR: `success` yalnızca
 * `submit_observed` karşılığı geldiğinde `true` olur. Click ve Enter yolu bu
 * sözleşmeyi paylaşır — etkisi görülmeyen bir tıklama, yanlış öğeye düşen
 * bir locator'ın sahte başarısıdır. Canlı chatgpt.com ölçümünde
 * `button[type="submit"]` sorgusu composer boşken gizli olan gönder butonu
 * yerine görünür MİKROFON butonuna düşüyor, tıklama dikteyi başlatıyor ve
 * mesaj hiç gönderilmiyordu.
 *
 * Bir gönderim girişimi `delivery_unconfirmed` ile bittiğinde buton onarımına
 * KREDİ VERİLMEZ (`__finalizeSelectorRepair(..., false)`): hiçbir etki
 * üretmeyen bir tıklama locator'ın doğru olduğunun kanıtı değildir.
 * `submitWrongControl` teşhisi (tıklanan öğenin bir dikte/kayıt kontrolü
 * olduğu) günlüğü "teslimat doğrulanamadı" genel mesajından daha aksiyona
 * dönük kılar.
 *
 * Bu aynı zamanda `mixed` modda Enter yoluna sessiz geçişi kapatır: tıklamadan
 * sonra mesajın GİTMİŞ olma ihtimali vardır ve üst üste ikinci bir gönderim
 * mükerrer mesaj üretir.
 *
 * Sentetik `KeyboardEvent` için `dispatchEvent()` dönüşü BAŞARI sayılmaz:
 * birçok web uygulaması `isTrusted === false` olayları yok sayar ve mesaj
 * hiç gönderilmez. Bu yüzden Enter yolu gönderimden sonra editörü ve konuşma
 * bölgesini GÖZLEMLER; etki yoksa `submit_unverified` döner ve üst katman
 * bunu "teslim edilmedi" olarak işaretler (mükerrer gönderim de engellenir).
 */
export function buildPerformSubmitScript(options: BuildPerformSubmitScriptOptions): string {
  // `normalizeMs` aynı zamanda `generateWaitForSubmitReadyScript`'in bütçe
  // seçeneğini de normalize eder; geçersiz/eksik bir değer üretim
  // varsayılanına düşer. Buton arama bütçeleri `resolveSendButton.ts`te,
  // gözlem bütçeleri aşağıda normalize edilir (bkz. `SubmitBudgetOptions`).
  const buttonBudget = resolveSubmitButtonBudget(options)
  const observeAttempts = normalizeMs(options.observeAttempts, OBSERVE_EFFECT_ATTEMPTS, 1)
  const observeIntervalMs = normalizeMs(options.observeIntervalMs, OBSERVE_EFFECT_INTERVAL_MS, 0)

  const enterDispatch = (target: string) => `
                {
                    const eventParams = {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true,
                        cancelable: true,
                        composed: true
                    };
                    ${target}.dispatchEvent(new KeyboardEvent('keydown', eventParams));
                    ${target}.dispatchEvent(new KeyboardEvent('keypress', eventParams));
                    ${target}.dispatchEvent(new KeyboardEvent('keyup', eventParams));
                }
`

  /**
   * Enter yolunun input locator'ına verdiği kredi.
   *
   * Self-healing sözleşmesi: kredi yalnızca YUKARI taşınır, aşağı değil.
   * auto_send betiğinde metin yerleştirme zaten doğrulanıp ödüllendirilir.
   * Site sentetik Enter'ı yok sayıp gönderimi doğrulamazsa, çalışan bir
   * locator'ı "başarısız" sayıp operation_failed ile onarım dışı bırakmak,
   * Magic Picker'ın tam da bu durumda toparlanmasını engeller.
   *
   * Kredisi henüz olmayan durumda (click_send betiği) davranış eskisiyle
   * aynıdır: gönderim gözlemlendiyse ödüllendirilir, aksi halde ödüllendirilmez.
   */
  const inputRepairCredit = (
    indent: string
  ) => `${indent}if (diagnostics.input.operationSucceeded !== true) {
${indent}    __finalizeSelectorRepair(diagnostics.input, 'input', success);
${indent}}`

  const inputLookup = options.includeInputLookupForEnter
    ? `
                const inputResult = await waitForElement(config.input, 'input', diagnostics.input, config, 10000, false);
                const inputElement = inputResult.element;

                if (inputElement) {
                    inputElement.focus();
                    const beforeEnter = __submitFingerprint(inputElement, null);
                    diagnostics.submitMethod = 'enter_key';
${enterDispatch('inputElement')}                    const enterObserved = await __observeSubmitEffect(inputElement, null, beforeEnter);
                    diagnostics.submitObserved = enterObserved;
                    success = enterObserved;
                    if (!enterObserved) {
                        // Mesaj editörden AYRILMADI: gönderim gerçekleşmedi.
                        // Editör hâlâ dolu olduğu için taslak kaybolmaz.
                        error = 'submit_unverified';
                        diagnostics.submitOutcome = 'delivery_unconfirmed';
                    } else {
                        // Editörün temizlenmesi tek başına sunucu teslim kanıtı
                        // değildir; yalnızca arayüz etkisi gözlemlendi.
                        diagnostics.submitOutcome = 'observed';
                    }
${inputRepairCredit('                    ')}
                } else {
                    error = resolveLookupError(config.input, 'input_not_found', config.health);
                    diagnostics.submitOutcome = 'not_attempted';
                    __finalizeSelectorRepair(diagnostics.input, 'input', false);
                }
`
    : `
                inputElement.focus();
                const beforeEnter = __submitFingerprint(inputElement, null);
                diagnostics.submitMethod = 'enter_key';
${enterDispatch('inputElement')}                const enterObserved = await __observeSubmitEffect(inputElement, null, beforeEnter);
                diagnostics.submitObserved = enterObserved;
                success = enterObserved;
                if (!enterObserved) {
                    error = 'submit_unverified';
                    diagnostics.submitOutcome = 'delivery_unconfirmed';
                } else {
                    diagnostics.submitOutcome = 'observed';
                }
${inputRepairCredit('                ')}`

  return `
        // ── Gönderim gözlemi ────────────────────────────────────────────────
        // Sentetik klavye/click olaylarının "gerçekten bir işe yaradığı" yalnızca
        // sayfa durumu izlenerek anlaşılır. Bu yardımcılar yalnızca GÖZLEM yapar:
        // ikinci bir Enter veya ikinci bir click asla gönderilmez.
        const __submitFingerprint = (inputElement, buttonElement) => {
            const text = normalizeForCompare(readComposerText(inputElement));
            const composerRoot = getComposerRoot(inputElement, buttonElement);
            let root = composerRoot;
            let conversationNodes = -1;
            let streaming = false;
            try {
                const CONVERSATION_NODES =
                    'article, [data-message-author-role], [data-message-id], [data-testid*="conversation-turn" i], [data-testid*="user-message" i], [class*="message" i], [class*="markdown" i]';

                // 2026-10-17 ölçümü (canlı chatgpt.com, konuşma sayfası):
                // getComposerRoot bir COMPOSER kabuğuna çözülür
                // ([data-composer-body] → ComposerLayoutBody, 768×52) ve bu kabuğun
                // içinde 0 konuşma düğümü vardır; oysa sayfada 5 düğüm var ve hepsi
                // <main> içindedir. Parmakizin konuşma sayacı bu yüzden kalıcı 0'a
                // düşüyor ve gönderim tespiti YALNIZCA "metin kutudan silindi"
                // sinyaline kalıyor. Composer tek başına bir teslimat kanıtı
                // değildir: sayfa yeniden çizim yaparken metin bir anlığına
                // değişip geri dönebilir ve gerçek gönderim "doğrulanamadı"
                // diye raporlanır.
                //
                // Düzeltme: konuşma düğümü içermeyen bir kabuk, konuşmanın
                // GERÇEKTE bulunduğu kapsayıcıya genişletilir.
                //
                // "En yakın eşleşen" yaklaşımı YETMEZ: ChatGPT'in composer'ı bir
                // <form> içindedir ve \`closest('main, …, form')\` form'u seçer
                // (daha yakın olduğu için), o da 0 konuşma düğümü içerir. Bu
                // yüzden kapsayıcı, "içinde konuşma düğümü bulunan İLK" atas
                // olacak şekilde yukarı taranır; hiçbiri yoksa gövdeye düşülür.
                if (root.querySelectorAll(CONVERSATION_NODES).length === 0) {
                    let widened = null;
                    let ancestor = root.parentElement;
                    for (let depth = 0; ancestor && depth < 12; depth++) {
                        try {
                            if (ancestor.querySelectorAll(CONVERSATION_NODES).length > 0) {
                                widened = ancestor;
                                break;
                            }
                        } catch (_) {}
                        ancestor = ancestor.parentElement;
                    }
                    if (!widened && root.closest) {
                        widened = root.closest('main, [role="main"]');
                    }
                    if (!widened) widened = document.body;
                    if (widened) root = widened;
                }

                conversationNodes = root.querySelectorAll(CONVERSATION_NODES).length;
                streaming = Boolean(root.querySelector(
                    'button[aria-label*="Stop" i], button[data-testid*="stop" i], button[aria-label*="Durdur" i], [data-testid*="stop-button" i]'
                ));
            } catch (_) {}
            return text.length + '|' + text.slice(0, 80) + '|' + conversationNodes + '|' + (streaming ? '1' : '0');
        };

        // 2026-10-17 ölçüm düzeltmesi: 10×80ms = 800ms pencere, ChatGPT'de
        // yeterli değil — composer temizlenmesi ve konuşma düğümünün eklenmesi
        // React'in yeniden çiziminde 1-2 saniye sürebiliyor ve bu koşularda
        // mesaj GİTİYOR ama "teslimat doğrulanamadı" deniyordu. 3 saniyelik
        // pencere yavaş yolayı normalleştirir; mükerrer gönderim riski yoktur
        // çünkü \`submit_unverified\` zaten \`retry: 'never'\` taşır — bu yalnızca
        // hükmün doğruluğunu etkiler, gönderim sayısını değil.
        const __observeSubmitEffect = async (inputElement, buttonElement, before, attempts = ${observeAttempts}, intervalMs = ${observeIntervalMs}) => {
            for (let i = 0; i < attempts; i++) {
                if (typeof isAborted === 'function' && isAborted()) return false;
                await wait(intervalMs);
                let after = null;
                try {
                    after = __submitFingerprint(inputElement, buttonElement);
                } catch (_) {
                    after = null;
                }
                // Beklenen etki: mesaj editörden ayrıldı (metin temizlendi /
                // kısaldı) ya da konuşmaya yeni bir düğüm eklendi / durum
                // "yanıt üretiliyor"a geçti.
                if (after && before && after !== before) return true;
            }
            return false;
        };

        // ── Gönderim hedefi doğruluğu ──────────────────────────────────────
        // Etkileşime hazır bir düğme "gönder butonu" olduğu anlamına gelmez.
        // Canlı chatgpt.com ölçümünde composer boşken gerçek gönder butonu
        // GİZLİ, dikte (mikrofon) butonu görünür durumdadır; geniş bir
        // \`button\` sorgusu ikincisine düşer. Tıklamak mesajı değil dikteyi
        // başlatır. Bu, teslimatın doğrulanamamasının en sık nedenidir ve
        // kesin olarak "yanlış kontrol seçildi" demektir; teşhis olarak
        // kaydedilir.
        const __submitWrongControl = (buttonElement) => {
            if (!buttonElement || typeof buttonElement.hasAttribute !== 'function') return null;
            const controls = ['data-start-dictation', 'data-cancel-dictation', 'data-submit-dictation'];
            for (let i = 0; i < controls.length; i++) {
                try {
                    if (buttonElement.hasAttribute(controls[i])) return controls[i];
                } catch (_) {}
            }
            // 2026-10-17 ölçümü (canlı chatgpt.com): gerçek dikte düğmesinin
            // data özniteliği YOK; tam öznitelikleri type="button", class,
            // aria-busy="false", aria-label="Dikte et". Bu yüzden teşhis de
            // etiketi dinlemeli — aksi halde bu tam olarak senaryodur: tıklama
            // yanlış öğeye düşer, teşhis "genel başarısızlık" der ve hangi
            // düğmenin hedef olduğu günlükte görünmez.
            try {
                const label = ((buttonElement.getAttribute && buttonElement.getAttribute('aria-label')) || '')
                    + ' ' + ((buttonElement.getAttribute && buttonElement.getAttribute('title')) || '');
                if (label.trim() && ${VOICE_CONTROL_LABEL_PATTERN.toString()}.test(label)) {
                    return 'voice_control:' + label.trim();
                }
            } catch (_) {}
            return null;
        };

        const performSubmit = async (${options.includeInputLookupForEnter ? '' : 'inputElement'}) => {
            const start = now();
            const mode = config.submitMode;
            let success = false;
            let error = null;
            let notReadyReason = null;

            // click_send betiği performSubmit'i parametresiz çağırır: bu
            // kapsamda \`inputElement\` bağlı değildir. Gözlem için gerekiyorsa
            // bloklamayan bir aramayla çözülür (yoksa gözlem yalnızca buton
            // tarafına düşer, gönderim yine de yapılır).
            const __resolveSubmitInput = () => {
                if (typeof inputElement !== 'undefined' && inputElement) return inputElement;
                if (!hasLookup(config.input) || !diagnostics.input) return null;
                try {
                    return findElement(config.input, 'input', diagnostics.input, config).element;
                } catch (_) {
                    return null;
                }
            };

            if (mode === 'click' || mode === 'mixed') {
                // ── Gönder düğmesi çözümü: sesli kontroller TIKLANMAZ ──────
                // 2026-10-17 kök neden ölçümü (uygulama günlüğü, canlı
                // chatgpt.com proje sayfası):
                //   matchedSelector = "button.cursor-interaction.size-token-button-composer.flex"
                //   submitWrongControl = "voice_control:Sesli iletişim yükleniyor"
                //   durationMs = 4.5, waitIterations = 1
                // Metin editöre girdikten sonra gönder düğmesi henüz çizilmemişti;
                // arama 4.5ms'de ilk eşleşmeye durdu. Aday listesi çıplak
                // \`button\` ile bittiği için "bir şey bulundu" sayılıyor ve
                // bekleme gerçek düğmeyi hiç beklemiyordu. Bulunan öğe sesli
                // sohbet düğmesiydi (gönder düğmesiyle AYNI class ailesi:
                // \`cursor-interaction size-token-button-composer\`).
                //
                // Düzeltme: sesli/dikte kontrolü bir "eşleşme" değil, "bu bir
                // gönder düğmesi değil" sinyalidir. Böyle bir aday bulunduğunda
                // önbellekten düşürülür ve gerçek gönder düğmesi için beklemeye
                // devam edilir. Tıklama yalnızca sesli olmayan bir düğmeye
                // yapılır; süre dolarsa teşhis yine de hangi kontrolün hedef
                // olduğunu yazar.
${buildResolveSendButtonScript(buttonBudget)}

                const buttonResult = await __resolveSendButton();
                const button = buttonResult.element;

                if (button) {
                    const submitInput = __resolveSubmitInput();
                    const beforeClick = __submitFingerprint(submitInput, button);
                    button.click();
                    diagnostics.submitMethod = 'button_click';
                    // Click üzerinde de Enter ile AYNI dürüstlük sözleşmesi
                    // geçerli: tetiklemek gönderim girişimidir, teslimat
                    // ancak arayüzde beklenen etki GÖZLEMLENDİĞİDE kanıttır.
                    // Etkisiz bir tıklama (en sık nedeni yanlış öğe: gönder
                    // butonu gizliyken bulunan mikrofon) başarı diye
                    // raporlanırsa kullanıcı hiç gitmemiş bir mesaj için
                    // "gönderildi" görür.
                    diagnostics.submitObserved = await __observeSubmitEffect(submitInput, button, beforeClick);
                    success = diagnostics.submitObserved === true;
                    if (success) {
                        diagnostics.submitOutcome = 'observed';
                        diagnostics.submitWrongControl = null;
                        // Gözlenen bir etki, butonun gerçek kullanımıdır:
                        // onarım kredisi yalnızca burada verilir.
                        __finalizeSelectorRepair(diagnostics.button, 'button', true);
                    } else {
                        diagnostics.submitOutcome = 'delivery_unconfirmed';
                        // Tıklanan öğenin bir dikte/kayıt kontrolü olması
                        // yanlış butonun seçildiğinin kesin kanıtıdır; günlükte
                        // hangi kontrolün hedef olduğunu adıyla yazar.
                        diagnostics.submitWrongControl = __submitWrongControl(button);
                        // Metin editörde durduğu için taslak kaybolmaz, ama
                        // mükerrer gönderim riski nedeniyle sınıflandırıcı bu
                        // hatada otomatik tekrarı yasaklar (\`retry: 'never'\`).
                        error = 'submit_unverified';
                        // Hiçbir etki üretmeyen bir tıklama locator'ın doğru
                        // olduğunu KANITLAMAZ: onarım kredisi verilmez.
                        __finalizeSelectorRepair(diagnostics.button, 'button', false);
                    }
                } else {
                    notReadyReason = buttonResult.notReadyReason || null;
                    const blocked = buttonResult.blockedElement || null;
                    if (blocked) {
                        // Buton BULUNDU ama etkileşime hazır değil. Bu bir
                        // selector hatası DEĞİLDİR: \`button_not_found\` bildirmek
                        // kullanıcıyı yanlışlıkla selector'ını yeniden seçmeye
                        // yönlendirirdi. Gerçek engel raporlanır.
                        error = 'submit_not_ready';
                        diagnostics.submitOutcome = 'blocked';
                        __finalizeSelectorRepair(diagnostics.button, 'button', false);
                    } else if (buttonResult.rejectedControl) {
                        // Bütün bütçe boyunca yalnızca sesli/dikte kontrolleri
                        // bulundu. Tıklanmadı (böyle bir durumda tıklamak
                        // mesajı değil sesi başlatırdı), bu yüzden "teslimat
                        // doğrulanamadı" değil "gönder düğmesi bulunamadı"
                        // denir ve hangi kontrolün hedef olduğu yazılır.
                        diagnostics.submitWrongControl = buttonResult.rejectedControl;
                        error = resolveLookupError(config.button, 'button_not_found', config.health);
                        diagnostics.submitOutcome = 'not_attempted';
                        __finalizeSelectorRepair(diagnostics.button, 'button', false);
                    } else if (mode === 'click') {
                        error = resolveLookupError(config.button, 'button_not_found', config.health);
                        diagnostics.submitOutcome = 'not_attempted';
                        __finalizeSelectorRepair(diagnostics.button, 'button', false);
                    } else {
                        // \`mixed\`: gerçek bir gönder butonu sayfada yok. Enter
                        // yoluna düşmek güvenlidir (aşağıda doğrulanır).
                        diagnostics.submitOutcome = 'not_attempted';
                    }
                }
            }

            if (!success && !error && (mode === 'enter_key' || mode === 'mixed')) {
${inputLookup}
            }

            diagnostics.submitMs = roundMs(now() - start);
            return {
                success,
                error,
                notReadyReason
            };
        };
    `
}
