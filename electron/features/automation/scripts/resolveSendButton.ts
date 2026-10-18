import { normalizeMs } from '../automationScripts/preamble.js'

/**
 * `__resolveSendButton` zaman bütçeleri.
 *
 * Bunlar `SubmitBudgetOptions` sözleşmesinin buton arama yarısıdır: hiçbiri
 * verilmediğinde `resolveSubmitButtonBudget` ölçülmüş varsayılanları üretir,
 * üretilen betik bu yüzden bayt bayt aynıdır (bkz. `SubmitBudgetOptions`).
 */
export interface SubmitButtonBudgetOptions {
  /** `__resolveSendButton` için toplam buton arama bütçesi (tanımlı lookup). */
  submitBudgetMs?: number
  /** 1. kademe: buton lookup'ı tanımsızken kullanılan hızlı tarama bütçesi. */
  unconfiguredButtonProbeMs?: number
  /** 2. kademe dâhil tanımsız lookup için TOPLAM bütçe. */
  unconfiguredButtonBudgetMs?: number
  /** Aktivite kapısının "sayfa sessizleşti" eşiği. */
  unconfiguredSilenceMs?: number
  /** "Kararlı biçimde pasif" kapısından çıkma süresi. */
  stableBlockedExitMs?: number
  /** Reddedilen (sesli) bir düğme düşürüldükten sonra yeniden deneme beklemesi. */
  rejectedControlRetryMs?: number
}

/** Buton arama bütçelerinin normalize edilmiş hâli. */
export interface ResolvedSubmitButtonBudget {
  submitBudgetMs: number
  unconfiguredButtonProbeMs: number
  unconfiguredButtonBudgetMs: number
  unconfiguredSilenceMs: number
  stableBlockedExitMs: number
  rejectedControlRetryMs: number
}

/**
 * Buton aramasının kullanıcıya verilen azami bekleme süresi.
 *
 * Ölçüm (2026-10-17, canlı chatgpt.com proje sayfası): kullanıcı seçiciyi
 * kaydettiği için buton GEÇ çizilebilir ve bu bütçe gerçek bir fayda taşır.
 */
const SUBMIT_BUDGET_MS = 15000

/**
 * Gönder butonunun "kararlı biçimde pasif" kalması ne kadar sürebilir?
 *
 * Metin doğrulandıktan sonra gönder butonu hâlâ `disabled` ise sorun bekleme
 * değildir: editörün iç modeli metni almamıştır (DOM'a elle eklenmiş olabilir).
 * 15 saniyeyi doldurmak yalnızca kullanıcıyı bekletir ve sonucu değiştirmez,
 * bu yüzden bekleme 2 saniyede sonlanır ve gerçek neden raporlanır.
 */
const STABLE_BLOCKED_EXIT_MS = 2000

/**
 * 1. KADEME: buton selector'ı HİÇ yapılandırılmamışsa yapılan hızlı tarama.
 *
 * Arama zinciri (önbellek → selector'lar → parmakizi → fallback pipeline)
 * bir selector'a BAĞIMLI DEĞİLDİR: yapılandırma boş olsa bile semantik
 * tarama, site stratejisi ve son çare sezgisali çalışır. Ölçülen örnekler
 * (2026-10-18): yapılandırmasız `click` modunda semantik tarama gerçek gönder
 * düğmesini BİRİNCİ turda bulup tıklar (ölçülen ≈660ms). Bu yüzden bu arama
 * asla "boş dön" diye atlanmaz — atlanırsa selector'ı kaybolmuş kullanıcılar
 * gönderemez.
 *
 * Bu tek BAŞINA neden yeterli DEĞİL: ölçüm, buton 2000ms sonra eklendiğinde
 * 1000ms'lik taramanın `button_not_found` ile erken çıktığını gösteriyordu
 * (waitIterations 4, ~1070ms). Tarama penceresi, aramanın gerçekten
 * kısa yolunu ölçer; uzun soluklu kalan durumu 2. kademe devralır.
 */
const UNCONFIGURED_BUTTON_PROBE_MS = 1000

/**
 * 2. KADEME: buton lookup'ı tanımsızken kullanılan TOPLAM bütçe.
 *
 * Düzeltmenin haklı olduğu tek yer burasıydı: buton HİÇ yoksa 15 saniye ölü
 * bekleme oluyordu (ölçüm: waitIterations 57, hepsi depth=3 doygun). Ama
 * "bütçeyi 1 saniyeye indir" çözümü de yanlıştı, çünkü kalan 14 saniyenin
 * hiçbir bilgi ürettiği yanlıştı: \`fallbackDepth\` bir STRATEJİ İMLECİ, zaman
 * değil. Gerçekle 15 saniyelik bütçede buton 2205ms'de bulundu
 * (waitIterations 9) — 5.–9. turlar tam olarak yeni bilgi üretti.
 *
 * Bu yüzden iki kademe + aktivite kapısı: kısa tarama (yukarıda), sonra
 * sayfa hâlâ değişiyorsa bu bütçeye kadar bekleme.
 */
const UNCONFIGURED_BUTTON_BUDGET_MS = 5000

/**
 * AKTİVİTE KAPI EŞİĞİ: sayfa bu kadar süredir hiç değişmediyse arama, buton
 * çizilmeyeceğine inanarak BİTER.
 *
 * Bu eşik bir süs değil, ölçümle dengelenmiş bir ÖDÜLEMDİR. "Statik sayfada
 * çabuk vazgeç" ile "geç çizilen butonu yakala" aynı ölçekte aynı anda
 * mümkün DEĞİLDİR: butonu T anında bekleyen bir arama, T'den önceki en az
 * T kadar bekler. Ölçülen sınır = 1. kademe (1000ms) + bu eşik.
 *
 * Bu değerle ölçülen sınır ≈3.4 saniyedir:
 *   · 2000ms'de gelen buton  → YAKALANIR (ölçülen regresyon)
 *   · 3000ms'de gelen buton  → YAKALANIR
 *   · 5000ms'de gelen buton  → YAKALANMAZ (arama ≈3.4s'de kapanır)
 *   · hiç gelmeyen buton      → ≈3.4s'de vazgeçilir (15 saniyenin ~4.4'ü)
 *
 * SESSİZLİĞİN SEÇİLMESİ: 15 saniyelik bütçe, butonu olmayan her sayfada
 * kullanıcıyı boşuna bekletiyordu (ölçüm: waitIterations 57, hepsi depth=3
 * doygun). Kullanıcıya gösterilecek en kötü süreyi 15 saniyeden ≈3.4
 * saniyeye indirmek, mesajın hiç gönderilmemesinden kat kat iyidir.
 */
const UNCONFIGURED_SILENCE_MS = 2400

/**
 * Reddedilen bir sesli/dikte düğmesi düşürüldükten sonra gerçek gönder
 * düğmesi için beklenecek süre: React'in bir sonraki boyama turunu geçmek
 * yeterlidir.
 */
const REJECTED_CONTROL_RETRY_MS = 120

/**
 * `normalizeMs` aynı zamanda `generateWaitForSubmitReadyScript`'in bütçe
 * seçeneğini de normalize eder; geçersiz/eksik bir değer üretim
 * varsayılanına düşer. Bu yüzden parametresiz çağrı üretim değerlerini
 * korur (bkz. `SubmitBudgetOptions` sözleşmesi).
 */
export function resolveSubmitButtonBudget(
  options: SubmitButtonBudgetOptions
): ResolvedSubmitButtonBudget {
  const submitBudgetMs = normalizeMs(options.submitBudgetMs, SUBMIT_BUDGET_MS, 1)
  const unconfiguredButtonProbeMs = normalizeMs(
    options.unconfiguredButtonProbeMs,
    UNCONFIGURED_BUTTON_PROBE_MS,
    1
  )
  // 2. kademe bütçesi 1. kademeden kısa olamaz: kademeler birbirinin
  // devamıdır, ikisi de aynı aramanın penceresidir.
  const unconfiguredButtonBudgetMs = Math.max(
    unconfiguredButtonProbeMs,
    normalizeMs(options.unconfiguredButtonBudgetMs, UNCONFIGURED_BUTTON_BUDGET_MS, 1)
  )
  const unconfiguredSilenceMs = normalizeMs(
    options.unconfiguredSilenceMs,
    UNCONFIGURED_SILENCE_MS,
    0
  )
  const stableBlockedExitMs = normalizeMs(options.stableBlockedExitMs, STABLE_BLOCKED_EXIT_MS, 0)
  const rejectedControlRetryMs = normalizeMs(
    options.rejectedControlRetryMs,
    REJECTED_CONTROL_RETRY_MS,
    0
  )

  return {
    submitBudgetMs,
    unconfiguredButtonProbeMs,
    unconfiguredButtonBudgetMs,
    unconfiguredSilenceMs,
    stableBlockedExitMs,
    rejectedControlRetryMs
  }
}

/**
 * Buton çözümleme rutininin betik metni: `__resolveSendButton`.
 *
 * Yalnızca `buildPerformSubmitScript` tarafından, üretilen betiğin içine
 * olduğu gibi gömülür; çalışma zamanında bu modül hiç yüklenmez. Kapsam
 * (`config`, `diagnostics`) değişmediği için metin birebir aynıdır.
 */
export function buildResolveSendButtonScript(budget: ResolvedSubmitButtonBudget): string {
  return `                const __resolveSendButton = async () => {
                    // ── Bütçe seçimi ─────────────────────────────────────────
                    // Beklemeden ÖNCE buton lookup'ının gerçekten tanımlı
                    // olup olmadığına bakılır (submitReady.ts'teki
                    // \`hasLookup\` kalıbı).
                    //
                    // TANIMLI (hasLookup === true): KESİNTİSİZ tek kademe,
                    // 15 saniyelik bütçe. Kullanıcı seçiciyi kaydettiği için
                    // buton GEÇ çizilebilir ve bu bütçe gerçek bir fayda
                    // taşır. Bu yolun davranışı değişmez.
                    //
                    // TANIMSIZ: İKİ KADEME + AKTİVİTE KAPISI (aşağıda).
                    // Arama zinciri selector'dan bağımsız olduğu için yine de
                    // çalışır; yalnızca bekleme stratejisi değişir.
                    const configured = hasLookup(config.button);
                    const probeMs = configured ? ${budget.submitBudgetMs} : ${budget.unconfiguredButtonProbeMs};
                    const budgetMs = configured ? ${budget.submitBudgetMs} : ${budget.unconfiguredButtonBudgetMs};
                    const deadline = now() + budgetMs;
                    const gateClosedSentinel = '__submit_activity_gate_closed__';
                    let rejectedControl = null;
                    let lastNotReadyReason = null;
                    let lastBlockedElement = null;

                    // Bir tarama penceresi. \`windowMs\` kadar sürede buton
                    // çözülürse bulunur; çözülemezse nedenini durum olarak
                    // bildirir. Bütçe ayrımı: kademeler birbirinin devamıdır,
                    // ikisi de aynı aramanın penceresidir.
                    const __scanForSendButton = async (windowMs) => {
                        const remaining = deadline - now();
                        if (remaining <= 0) return { state: 'exhausted' };
                        const attempt = await waitForElement(
                            config.button,
                            'button',
                            diagnostics.button,
                            config,
                            Math.max(1, Math.min(windowMs, remaining)),
                            true,
                            ${budget.stableBlockedExitMs}
                        );
                        const element = attempt.element;
                        if (!element) {
                            lastNotReadyReason = attempt.notReadyReason || null;
                            lastBlockedElement = attempt.blockedElement || null;
                            // Bulundu ama etkileşime hazır değil bir düğme
                            // "bulunamadı" durumu DEĞİLDİR (bkz. çağıran
                            // taraftaki \`blocked\` dalı). Bu yüzden 2. kademeye
                            // devretmek onu yanlışlıkla \`button_not_found\`a
                            // düşürürdü; karar nettir, kademe biter.
                            return { state: lastBlockedElement ? 'blocked' : 'empty' };
                        }
                        const wrongControl = __submitWrongControl(element);
                        if (!wrongControl) return { state: 'found', element };
                        rejectedControl = wrongControl;
                        // Bu düğmeyi hedef tutmayı bırak: aksi halde önbellek
                        // aynı yanlış öğeyi bir sonraki denemede de verir.
                        try { invalidateCacheEntry('button', config.button, diagnostics.button); } catch (_) {}
                        await wait(${budget.rejectedControlRetryMs});
                        return { state: 'rejected' };
                    };

                    // ── TANIMLI YOL: tek kademe, 15 saniye ─────────────────
                    // Ölçülen davranış: etkin buton ilk turda bulunur; sesli
                    // kontroller düşürülür ve gerçek düğme beklenir.
                    if (configured) {
                        while (true) {
                            const outcome = await __scanForSendButton(budgetMs);
                            if (outcome.state === 'found') {
                                return { element: outcome.element, notReadyReason: null, blockedElement: null, rejectedControl: null };
                            }
                            if (outcome.state === 'empty' || outcome.state === 'blocked') {
                                return { element: null, notReadyReason: lastNotReadyReason, blockedElement: lastBlockedElement, rejectedControl };
                            }
                            if (outcome.state === 'exhausted') break;
                        }
                        return { element: null, notReadyReason: null, blockedElement: null, rejectedControl };
                    }

                    // ── 1. KADEME: hızlı tarama ─────────────────────────────
                    // Ölçüm (2026-10-18): semantik tarama gerçek gönder
                    // düğmesini çoğunlukla İLK turda bulup tıklar (≈660ms).
                    // Bu kademe yalnızca o kısa yolu ölçer; 2. kademe
                    // uzun soluklu kalan durumu devralır.
                    let probe = await __scanForSendButton(probeMs);
                    while (probe.state === 'rejected') probe = await __scanForSendButton(probeMs);
                    if (probe.state === 'found') {
                        return { element: probe.element, notReadyReason: null, blockedElement: null, rejectedControl: null };
                    }
                    if (probe.state === 'blocked') {
                        return { element: null, notReadyReason: lastNotReadyReason, blockedElement: lastBlockedElement, rejectedControl };
                    }
                    if (probe.state === 'exhausted') {
                        return { element: null, notReadyReason: null, blockedElement: null, rejectedControl };
                    }

                    // ── 2. KADEME: AKTİVİTE KAPI ───────────────────────────
                    // 1. kademede hiçbir şey bulunamadı. Kalan soru "kaç tur
                    // döndü" DEĞİLDİR: \`fallbackDepth\` bir STRATEJİ İMLECİ,
                    // zaman değil (bkz. selectorEngine.ts) ve DOM her an
                    // değişebilir. Ölçülen karşıt örnek: 15 saniyelik bütçede
                    // buton 2205ms'de bulundu (waitIterations 9) — 5.–9. turlar
                    // tam olarak yeni bilgi üretti. "Kalan 14 saniye hiçbir
                    // bilgi üretmez" gerekçesi bu yüzden yanlıştır.
                    //
                    // Doğru soru şudur: "sayfa HÂLÂ değişiyor mu?"
                    //   · sayfa mutasyon almaya devam ediyorsa → toplam
                    //     bütçeye kadar bekle
                    //   · sayfa SESSİZLİK_MS boyunca hiç değişmediyse → HEMEN
                    //     vazgeç (ölü bekleme)
                    //
                    // Bekleme yoklaması DEĞİLDİR: \`__eventDrivenWait\`
                    // mutasyonda uyanır (submitReady.ts'teki kullanımın aynısı);
                    // yalnızca 50ms'lik güvenlik adımıyla ilerler. Aktivite
                    // saati için ayrı bir gözlemci kurulur çünkü
                    // \`__eventDrivenWait\` "son mutasyondan beri geçen süreyi"
                    // yalnızca döndüğünde ölçer, kapı kararı döndürmeden önce
                    // verilmelidir. Kurulum başarısız olursa saat hiç
                    // ilerlemez ve kapı sessizlik eşiğinde kapanır: güvenli taraf.
                    const silenceMs = ${budget.unconfiguredSilenceMs};
                    let lastActivityAt = now();
                    let activityProbe = null;
                    try {
                        activityProbe = new MutationObserver(() => { lastActivityAt = now(); });
                        activityProbe.observe(document.body, {
                            subtree: true,
                            childList: true,
                            attributes: true,
                            characterData: true
                        });
                    } catch (_) {
                        activityProbe = null;
                    }
                    // \`depth\` zaman değil strateji imleci olduğu için tur
                    // ilerledikçe tırmanır ve \`__MAX_FALLBACK_ATTEMPTS\`'te
                    // doyar — 15 saniyelik döngüde de olan budur.
                    let gateDepth = 0;

                    const gate = await (async () => {
                        try {
                            return await __eventDrivenWait({
                                root: document.body,
                                timeoutMs: Math.max(1, deadline - now()),
                                settleMs: 0,
                                minimumWaitMs: 0,
                                check: () => {
                                    const checkStart = now();
                                    const found = queryElementWithPipeline(
                                        config.button,
                                        'button',
                                        diagnostics.button,
                                        config,
                                        gateDepth
                                    );
                                    diagnostics.button.durationMs = roundMs(
                                        diagnostics.button.durationMs + (now() - checkStart)
                                    );
                                    if (gateDepth < 3) gateDepth += 1;
                                    const element = found && found.element;
                                    if (element) {
                                        const wrongControl = __submitWrongControl(element);
                                        if (!wrongControl) {
                                            if (isReadyForInteraction(element)) return element;
                                            lastBlockedElement = element;
                                            lastNotReadyReason = typeof describeNotReady === 'function'
                                                ? describeNotReady(element)
                                                : 'not_interactive';
                                        } else {
                                            rejectedControl = wrongControl;
                                            try { invalidateCacheEntry('button', config.button, diagnostics.button); } catch (_) {}
                                        }
                                        return null;
                                    }
                                    if (now() - lastActivityAt >= silenceMs) return gateClosedSentinel;
                                    return null;
                                }
                            });
                        } finally {
                            try { if (activityProbe) activityProbe.disconnect(); } catch (_) {}
                        }
                    })();

                    if (gate && gate.result && gate.result !== gateClosedSentinel) {
                        return { element: gate.result, notReadyReason: null, blockedElement: null, rejectedControl: null };
                    }
                    return { element: null, notReadyReason: lastNotReadyReason, blockedElement: lastBlockedElement, rejectedControl };
                };`
}
