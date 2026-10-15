/**
 * Metin yerleştirme doğrulaması (paylaşılan script parçası).
 *
 * Yerleştirmeden önce alanın okunabilir içeriği yakalanır; yerleştirme sonrası
 * TAM (normalize edilmiş) içerik karşılaştırılır. Amaç:
 *
 *   - "baş/son 40 karakterden biri göründü" yanlış pozitifini ortadan
 *     kaldırmak: içerik ya tamamen oradadır ya da doğrulama başarısızdır
 *     (`verified`),
 *   - kısmi yerleştirmeyi (ör. yalnızca ilk/son parça) başarı saymamak
 *     (`partial`) — yeniden yazım mükerrer içerik üretir, otomatik deneme
 *     yapılmaz,
 *   - metnin zaten alanda bulunduğu durumu (`ambiguous`) başarıdan ayırmak:
 *     gözlenen değişiklik yoksa yapıştırmanın etkisi kanıtlanamaz,
 *   - hiçbir değişiklik yokken (`unchanged`) yazım fallback'ine izin vermek
 *     (tek güvenli tamamlayıcı: alan değişmediyse içerik eklenmemiş demektir).
 *
 * Editörler (ProseMirror/Lexical) içeriği kendi blok modeline göre okur:
 *   - contenteditable içerikte `textContent` blok ayırıcılarını kaybedebilir;
 *     `innerText` satır sonlarını korur → iki okuma varyantı da denenir
 *     (innerText yoksa tek varyant kalır).
 *   - blok sınırındaki çift satır sonu tek satır sonuna dönüşebilir, görünmez
 *     karakterler eklenebilir → karşılaştırma `normalizeForCompare` ile
 *     yapılır (baseHelpers).
 *
 * `APPEND_TEXT_MODE` preamble'da tanımlıdır; append sözleşmesi önceki içeriğin
 * korunmasını şart koşar, replace sözleşmesi eski içeriğin kaybolmasını.
 */
export function buildTextVerificationScript(): string {
  return `
        const readFieldTextVariants = (element) => {
            const isCE = element.isContentEditable || element.getAttribute('contenteditable') === 'true';
            if (!isCE) return [String(element.value || '')];
            const variants = [element.textContent || ''];
            try {
                if (typeof element.innerText === 'string' && element.innerText !== variants[0]) {
                    variants.push(element.innerText);
                }
            } catch (_) {}
            return variants;
        };

        const classifyPlacement = (actual, before, expectedNormalized, appendMode) => {
            const delta = actual.length - before.length;
            const changed = actual !== before;
            const fullPresent = actual.includes(expectedNormalized);
            if (appendMode) {
                const gained = delta >= Math.max(1, Math.floor(expectedNormalized.length * 0.5));
                const preserved = !before || actual.includes(before);
                if (fullPresent && gained && preserved) {
                    return { applied: true, state: 'verified', delta: delta };
                }
                if (!changed) {
                    return { applied: false, state: fullPresent ? 'ambiguous' : 'unchanged', delta: delta };
                }
                return { applied: false, state: 'partial', delta: delta };
            }
            const previousGone = !before
                || !actual.includes(before)
                || expectedNormalized.includes(before);
            if (fullPresent && changed && previousGone) {
                return { applied: true, state: 'verified', delta: delta };
            }
            if (!changed) {
                // Aynı metnin yeniden gönderimi: replace aynı içeriği yeniden
                // yazar; alan TAM olarak beklenen metni taşıyorsa hedef durum
                // sağlanmıştır (gönderilen metin yine birebir istenen metindir).
                // Beklenen metin alanın yalnızca bir parçasıysa (ör. eski
                // taslak yeni metni kapsıyor) hedef durum sağlanmamış sayılır;
                // yazım fallback'i alanı temizleyip tam metni yazar.
                if (actual === expectedNormalized) {
                    return { applied: true, state: 'verified', delta: delta };
                }
                return { applied: false, state: 'unchanged', delta: delta };
            }
            return { applied: false, state: 'partial', delta: delta };
        };

        const placementStateRank = { unchanged: 0, ambiguous: 1, partial: 2, verified: 3 };

        const verifyTextPlacement = (element, expected, beforeVariants) => {
            const expectedNormalized = normalizeForCompare(expected);
            if (!expectedNormalized) {
                return { applied: false, state: 'unchanged', delta: 0 };
            }
            const actualVariants = readFieldTextVariants(element).map(normalizeForCompare);
            let result = { applied: false, state: 'unchanged', delta: 0 };
            for (let i = 0; i < actualVariants.length; i++) {
                const before = normalizeForCompare((beforeVariants && beforeVariants[i]) || '');
                const placement = classifyPlacement(actualVariants[i], before, expectedNormalized, APPEND_TEXT_MODE);
                if (placement.applied) return placement;
                if (placementStateRank[placement.state] > placementStateRank[result.state]) {
                    result = placement;
                }
            }
            return result;
        };

        const verifyTextPlacementWithRetries = async (element, expected, beforeVariants) => {
            let placement = verifyTextPlacement(element, expected, beforeVariants);
            // Yalnızca alan HİÇ değişmediyse kısa bir pencere taranır: geç
            // (asenkron) DOM güncellemeleri burada yakalanır. Bu sırada
            // alana içerik eklenmez.
            for (let attempt = 0; attempt < 2 && !placement.applied && placement.state === 'unchanged'; attempt++) {
                await wait(50);
                placement = verifyTextPlacement(element, expected, beforeVariants);
            }
            if (!placement.applied && placement.state === 'partial') {
                // Kısmi yerleştirmede editörün son durumu gecikebilir; yalnızca
                // TEK teyit okuması yapılır (yeniden yazma/ekleme yok).
                await wait(80);
                const confirmed = verifyTextPlacement(element, expected, beforeVariants);
                if (confirmed.applied) {
                    placement = confirmed;
                }
            }
            return placement;
        };
  `
}
