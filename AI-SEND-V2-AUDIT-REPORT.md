# QUIZLAB — AI SEND REDESIGN V2 · NİHAİ TEKNİK RAPOR

**Tarih:** 11.10.2026
**Repository:** quizlab-reader (Quizlab Reader v6.7.2)
**Branch:** `feature/ai-send-redesign` (master'a dokunulmadı)
**Başlangıç commit:** `bfc0c027ef82cfad50bf1a161883378fab850f30`
**Bitiş commit:** `a018463` — `fix(ai-send): menu geometry, send truthfulness and draft data safety`
**Diff:** 86 dosya · +2485 / −3730 satır

---

## 1. GIT BAŞLANGIÇ/FİNAL DURUMU

|                                     | Değer                                       |
| ----------------------------------- | ------------------------------------------- |
| Başlangıç HEAD                      | `bfc0c02` (verilen commit ile birebir aynı) |
| Başlangıç çalışma ağacı             | temiz (`nothing to commit`)                 |
| Final HEAD                          | `a018463`                                   |
| Final çalışma ağacı                 | temiz                                       |
| Aktif branch                        | `feature/ai-send-redesign`                  |
| `master`                            | `fc38830` — **değiştirilmedi**              |
| Push / tag / release / branch silme | **yapılmadı**                               |

Kullanıcı commit talimatı verdiği için değişiklikler hedef branch üzerinde commit edildi.

---

## 2. MASTER İLE FARK

`master...feature/ai-send-redesign` = `fc38830...a018463`.

Önceki commit'in (`bfc0c02`) getirdiği değişiklikler **korundu**; bu çalışmada yalnızca doğrulanan kusurlar düzeltildi. `AiSendComposer` 545→193 satıra indi (modülerleştirme), ölü kod olarak 16 eski dock-panel dosyası silindi.

---

## 3. İNCELENEN MODÜLLER

İstenen listedeki 15 dosyanın tamamı + bağlı modüller:

```
src/features/pdf/ui/components/PdfSelectionMenu.tsx
src/features/pdf/ui/components/usePdfSelectionMenu.ts
src/features/pdf/text/selectionPage.ts
src/features/pdf/text/extractSelectedText.ts
src/features/pdf/text/types.ts
src/features/pdf/ui/components/PdfViewerDocument.tsx
src/features/pdf/ui/components/PdfViewer.tsx
src/features/pdf/ui/components/PdfToolbar.tsx
src/features/pdf/ui/components/PdfDraftSlot.tsx
src/features/pdf/capture/usePdfCaptureActions.ts
src/features/pdf/hooks/usePdfViewerState.ts · pdfViewerStateTypes.ts
src/app/ui/AiDraftLayer.tsx · AiSendComposer.tsx · CaptureChoiceMenu.tsx (yeni)
src/app/providers/ai/bulkSendPlan.ts · pdfSource.ts · useAiMessaging.ts · types.ts
src/app/providers/app-tool/useAiDraftQueue.ts · useDraftSendOrchestration.ts
                                 · useScreenshotPipeline.ts · AppToolContext.tsx
src/features/ai/lib/send/bulkSendPipeline.ts · textSendPipeline.ts · sendUtils.ts
shared/types/pdf.ts (SelectionPosition tek kaynak)
```

---

## 4. GERÇEKTEN DOĞRULANAN HATALAR

### H1 — Hazırlanan mesaj "Gönderildi" diye raporlanıyordu _(Aşama 6, en kritik)_

`textSendPipeline.ts:130` otomatik gönderme kapalıyken `mode: submitMode` döndürüyordu. `isStagedSendResult` yalnızca `staged | paste_only | paste_and_prompt` değerlerini "hazırlandı" sayar. `submitMode` (`click`/`enter_key`/`mixed`) allowlist'te olmadığı için **hazırlanmış metin "teslim edildi" sayılıyor**, composer yeşil "Gönderildi" gösteriyordu.

Kanıt zinciri: `electron/features/.../autoSend.ts:48` → `submit:false` iken `{success:true, action:'input_only', mode: config.submitMode}` döner → `textSendPipeline.ts:130` bunu olduğu gibi geçirir → `useComposerSendAction.ts:63` staged=false → "Gönderildi".

Ayrıca `useAiMessaging.ts:134` api-chat metin yolunda staged sonucu **modsuz** `{success:true}` dönüyordu → yine delivered sayılıyordu.

### H2 — Toplu gönderim sessizce çoklu mesaja bölünüyordu _(Aşama 7)_

`useDraftSendOrchestration.ts:94-98`: `sendBulkToAI` yoksa `executeSegmentedFallback` çalışıyor, her öğe için ayrı AI mesajı üretiyordu — kullanıcı "tek mesaj" isterken sessizce N mesaj. `supportsSingleMessageBulk` (`bulkSendPlan.ts:82-84`) ise koşulsuz `true` dönüyor ve **hiçbir yerden çağrılmıyordu**. `ai_draft_bulk_unsupported` i18n anahtarı eklenmişti ama hiç kullanılmıyordu.

### H3 — Tam sayfa görsel kendiliğinden taslağa ekleniyordu _(Aşama 8)_

`usePdfCaptureActions.ts` 5 ayrı noktadan `queueImageForAi(...)` çağırıyordu (161, 172, 223, 261, 291). Alan yakalaması menüye giderken tam sayfa yakalaması doğrudan kuyruğa yazılıyordu — sözleşme tutarsızdı.

### H4 — Yapay dikdörtgen konumlandırma _(Aşama 3)_

`usePdfSelectionMenu.ts:117-156`: seçim noktası etrafında `±120px` sahte dikdörtgen üretilip `computeSelectionMenuAnchor` **tekrar** çağrılıyordu; sonra `|Δ| > 200px` gibi büyüklük sezgisiyle geri alınıyordu. Ayrıca `void buildPdfDocId` ölü satırı. Menü scroll/zoom/resize'da hiç güncellenmiyordu — sayfa içinde kaydırınca **yanlış yerde** kalıyordu.

### H5 — Menü etiketleri gerçekte kesiliyordu _(Aşama 4)_ — **yalnızca gerçek Electron'da görüldü**

252px yüzeyde iki Türkçe etiket + ikon + dolgu sığmıyordu. Ekran görüntüsü: **"AI'ye Gö…" / "Taslağa …"**. jsdom testleri bunu yakalayamıyor (CSS `truncate` görsel kırpmadır, `innerText` tam metni döner).

### H6 — Sayaç geri bildirimi iki kez sayıyordu — **yalnızca gerçek Electron'da görüldü**

`addedCount = pendingAiItems.length + (feedback==='added' ? 1 : 0)`. React batch içinde kuyruk güncellemesi `setFeedback`'ten önce uygulandığı için eklenen öğe zaten sayılıyor, `+1` fazladan ekliyordu. Ekran: **"Taslağa eklendi · 2 içerik"** ama rozet "AI Taslağı 1", panelde 1 satır.

### H7 — Taslak limiti veri kaybı _(Aşama 10)_

`useAiDraftQueue.ts:76-86, 157-190`: limit dolunca **en eski öğe sessizce siliniyordu**, yalnızca toast çıkıyordu. Kullanıcının seçtiği içerik kayboluyordu.

### H8 — i18n enterpolasyonu hiç çalışmıyordu _(regresyon, test kırmızıydı)_

`pdf.json:34` (en+tr): `"{{count}}"` — i18next `{count}` bekler. `i18n.test.ts` bunu yakalıyordu. Başlangıçta **2 kırmızı test** vardı.

### H9 — `useScreenshot` testi eski sözleşmeyi doğruluyordu

Hook artık `(imageData, rect)` alıyor, test 1 argüman bekliyordu.

### H10 — Ölü kod ve kullanılmayan prop'lar _(Aşama 11)_

`PdfViewerDocument` hâlâ `onStartScreenshot`, `onFullPageScreenshot`, `autoSend`, `onToggleAutoSend`, `onAddCurrentPageTextToAi` geçiyordu; `PdfToolbar` bunları kullanmıyordu. `PdfAiQuickBar` + 16 eski composer dosyası + `planBulkAiSend` üretimde referanssızdı.

---

## 5. KÖK NEDENLER

| Hata  | Kök neden                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------- |
| H1    | `mode` alanı "nasıl gönderilir" (submit yapılandırması) ile "ne oldu" (teslim/hazır) kavramlarını aynı taşıyordu.   |
| H2    | Sözleşme değişikliği (tek mesaj) ikinci katmana taşınmamış; eski segment yolu yanıltıcı güvenlik ağı olarak kalmış. |
| H3    | İki yakalama yolu farklı zamanlarda farklı sorumluluklarla yazılmış, ortak sözleşmeye bağlanmamış.                  |
| H4    | Konum, "nokta" yerine "dikdörtgen" bekleyen bir API'ye uydurulmuş; ikinci bir tahmin katmanı eklenmiş.              |
| H5/H6 | Sabit sayısal sabitler gerçek DOM ölçümüyle doğrulanmamış; jsdom ölçüm yapmadığı için testler boşlukta kaldı.       |
| H7    | kapasite kontrolü state güncelleyicisinin içinde, kullanıcı verisi korumayı değil bellek yönetimini hedeflemiş.     |
| H8    | i18next sözdizimi (tek süslü) React/JSX alışkanlığıyla karıştırılmış.                                               |

---

## 6. YAPILAN DÜZELTMELER

### Konumlandırma (Aşama 3)

- `extractSelectedText.ts`: seçim bitişinin **gerçek** `Range.getClientRects()` rect'i `position.endRect` olarak dışa verilir.
- `selectionPage.ts`: `computeSelectionMenuAnchor(endRect, bounds, menuSize)` — gerçek bitiş rect'i + gerçek menü ölçüsü + panel/viewport sınırları, **tek karar**. `DEFAULT_SELECTION_MENU_SIZE` render ile paylaşılan tek sabit.
- `usePdfSelectionMenu.ts`: sahte dikdörtgen ve `±200px` sezgisi **kaldırıldı**; menü `position.endRect`'ten bir kez hesaplanır. Scroll/resize'da canlı seçimden rAF ile takip edilir (konum değişmediyse state güncellenmez), seçim kaybolursa menü kapanır. Zoom/sayfa/belge değişiminde kapanır.

### Gönderim doğruluğu (Aşama 6)

- `textSendPipeline.ts`: submit kapalıyken `mode: 'staged'` döner.
- `useAiMessaging.ts`: api-chat metin yolu `mode: 'staged'` döner.
- `types.ts`: `SendFeedback`'e `'staged'` eklendi; `useComposerSendAction` staged için yeşil "başarı" yerine ayrı durum gösterir ve geri bildirim zamanlayıcısı tek referanslı (unmount temizliği).
- Menü: staged sonuçta **"Sohbet kutusuna eklendi"** gösterir, "Gönderildi" değil.

### Toplu gönderim (Aşama 7)

- `bulkSendPlan.ts`: gerçek uyumluluk modeli — `api-chat` (diziden çok ek) + doğrulanmış web platformları. Bilinmeyen/özel sağlayıcı → desteklenmiyor.
- `useDraftSendOrchestration.ts`: segmented fallback **tamamen kaldırıldı**; desteklenmeyen sağlayıcıda `bulk_not_supported` + taslak korunur + `error_bulk_not_supported` mesajı.
- `bulkSendPipeline.ts`: görseller arası `sleep(400)` yerine submit-ready doğrulaması (gerçek DOM hazır olma).

### Tam sayfa görsel (Aşama 8)

- `usePdfCaptureActions.ts`: `queueImageForAi` → `onFullPageCapture`; yakalama menü kararına gider.
- `useScreenshotPipeline.ts`: `pendingFullPageCapture` + onayla/vazgeç; iptal/değiştirmede blob URL geri alınır.
- `CaptureChoiceMenu.tsx` (yeni, `AreaImageChoiceMenu`'un yerine): alan + tam sayfa aynı sözleşme; tam sayfa menüsü sayfanın son metin satırına konumlanır.

### Taslak güvenliği (Aşama 10)

- `useAiDraftQueue.ts`: kapasite dolunca **yeni öğe reddedilir**, mevcutlar korunur, `draft_queue_full` uyarısı gösterilir. Boyut takibi senkron ref ile aynı tick'te doğru sayılır; reddedilen görsel için URL oluşturulmaz.

### Prompt / yapı (Aşama 5)

- `AiSendComposer.tsx` 545→193 satır; yeni modüller: `DraftTrigger`, `DraftPanel(+Header)`, `DraftItemList`, `DraftItemRow`, `DraftPromptSection`, `DraftNoteField`, `DraftSendControls`. Kayıtlı prompt seçimi, hazır komutlar, ek talimat, otomatik gönderme anahtarı, tek tek kaldırma, galeri yok — hepsi korundu.

### Temizlik (Aşama 11)

- 16 ölü composer dosyası, `PdfAiQuickBar`, `planBulkAiSend` + testleri silindi; `readItemPageLabel`, `ResizeDirection`, `DockLayout` gibi kullanılmayan export'lar kaldırıldı.
- `PdfToolbar` deprecated prop'ları ve `PdfViewerDocument`/`PdfViewer` aktarımları temizlendi; `SelectionPosition` tek kaynağa (`@shared-core/types`) taşındı (döngü import'ı yaratmadan).

### i18n

- `{count}` düzeltmesi; `AI'ye Gönder` (TR) dilbilgisi; yeni `error_bulk_not_supported`, `error_paste_ready_failed` anahtarları; `draft_queue_full` metni yeni davranışı anlatacak şekilde güncellendi.

---

## 7. ÖNCE / SONRA KULLANICI DENEYİMİ

| Durum                                | Önce                                          | Sonra                                     |
| ------------------------------------ | --------------------------------------------- | ----------------------------------------- |
| Metin seçimi                         | Menü 252px, **etiketler kesik** ("AI'ye Gö…") | 296px, tam okunur                         |
| Hazırlanmış mesaj                    | "Gönderildi" (yanlış)                         | "Sohbet kutusuna eklendi"                 |
| Çok görsel, desteklenmeyen sağlayıcı | Sessizce N mesaj                              | Red + taslak korunur + açık bilgi         |
| Tam sayfa görsel                     | Otomatik taslağa                              | Menü kararı (AI'ye Gönder / Taslağa Ekle) |
| Taslak dolu                          | En eski içerik sessizce silinir               | Red + uyarı + içerikler korunur           |
| Ekleme geri bildirimi                | "2 içerik" (yanlış)                           | "1 içerik" (doğru)                        |
| Scroll                               | Menü yerinde kalır, yanlış konum              | Seçimi takip eder                         |

---

## 8. UI GÖRSEL DEĞERLENDİRMESİ (gerçek Electron)

Ortam: Electron 42.9.1, gerçek PDF (shell argv), CDP ile sürülüp ölçüldü. Ekran görüntüleri alındı ve **gözle incelendi**.

| Kontrol           | Ölçüm                                                       | Sonuç                            |
| ----------------- | ----------------------------------------------------------- | -------------------------------- |
| Menü ölçüsü       | 296×43 px                                                   | ✅ kompakt, rahat tıklanabilir   |
| Etiket kırpma     | `textW 93 / boxW 93`, `textW 88 / boxW 88`, `clipped:false` | ✅ kesilme yok                   |
| Menü ↔ seçim      | `gapBelow: 8px`                                             | ✅ seçim bitişinin hemen altında |
| Viewport          | `insideViewport: true` (tüm senaryolar)                     | ✅ taşma yok                     |
| Scroll takibi     | panel +17px kaydırıldı → menu tam **17px** yukarı           | ✅ birebir takip                 |
| Zoom              | menü açıkken ölçek değişimi → menü kapanır                  | ✅ bayat konum kalmaz            |
| Escape            | menü kapanır, **içerik korunur** (rozet 1'de kalır)         | ✅                               |
| Sağ tık menüsü    | 4 öğe eksiksiz; seçim menüsünü kapatır                      | ✅ çakışma yok                   |
| Taslak paneli     | 360×418 px, `insideViewport:true`, araç çubuğu **açıkta**   | ✅ PDF'i kapatmıyor              |
| Satır içeriği     | "Metin · Sayfa 1/2 · sample.pdf"                            | ✅ sayfa bilgisi okunur          |
| Görsel satırı     | "Görsel · Sayfa 1/2 · sample.pdf"                           | ✅ galeri yok                    |
| Galeri            | `hasGallery: false`                                         | ✅ önizleme galerisi yok         |
| Prompt sistemi    | select + Açıkla/Özetle/Sınav sorusu/Flashcard               | ✅ korunmuş                      |
| Otomatik gönderme | `aria-pressed: true → false`                                | ✅ çalışıyor                     |
| Koyu tema         | tüm ekran görüntüleri koyu temada                           | ✅ kontrast/k边框 uyumlu         |
| Z-index           | menü `z-dropdown`, panel PDF paneli içinde                  | ✅ çakışma yok                   |

**Ekran görüntüleri:** `C:\Users\Umutu\AppData\Local\Temp\opencode\quizlab-verify\*.png`

Görsel olarak doğrulanan iki kusur (H5, H6) bu ölçümlerle bulundu ve düzeltildi; ikisi de jsdom testlerinin göremediği hatalardı.

---

## 9. GÖNDERİM DAVRANIŞLARI VE 10. OTOMATİK GÖNDERME DOĞRULAMASI

Korunan sözleşme:

| Eylem                      | Otomatik açık             | Otomatik kapalı               |
| -------------------------- | ------------------------- | ----------------------------- |
| AI'ye Gönder (metin)       | `auto_click*` → teslim    | `staged` → **hazırlandı**     |
| AI'ye Gönder (görsel)      | `auto_click*` → teslim    | `paste_*` → hazırlandı        |
| Taslağa Ekle               | yalnızca kuyruğa ekler    | yalnızca kuyruğa ekler        |
| Taslaktan Gönder (1 mesaj) | tek bulk çağrısı → teslim | tek bulk çağrısı → hazırlandı |

- `Taslağa Ekle` **hiçbir koşulda** gönderim çağrısı yapmaz (Electron'da `sendTextDirectToAI` çağrılmadığı doğrulandı) ve global `autoSend`'e dokunmaz.
- Otomatik gönderme tek anahtardan yönetilir; `resolveAutoSend`'ın "force" kaçışı yoktur (korundu).
- Hazırlanan sonuçta taslak öğeleri kuyruktan düşer → **tekrar Gönder** aynı içeriği ikinci kez hazırlamaz.
- Desteklenmeyen sağlayıcıda gönderim reddedilir → taslak **korunur** → kullanıcı öğeleri azaltarak tekrar deneyebilir (onaylı alternatif).

---

## 11. TOPLU GÖNDERİM VE SAĞLAYICI UYUMLULUĞU

**Kapsam:** 3 görsel + hazır prompt → **tek kullanıcı mesajı, 3 ek, 1 prompt, 1 submit.**

Doğrulananlar (`bulkSendPipeline.test.ts`):

- `copyImageToClipboard` ×3, `paste` ×3 → sıralı, ara submit yok
- `generateAutoSendScript` ×1 (prompt tek sefer, `submit:false`)
- `generateClickSendScript` ×1 → **tek submit**
- Görseller arası hazır-olma doğrulaması ≥3 (her yapıştırmadan sonra + submit öncesi); hepsi eşik/zaman aşımı ile, sabit uyku değil
- auto-send kapalıyken `generateClickSendScript` **hiç çağrılmaz**
- `data:` dışı URL reddedilir, siteye hiç dokunulmaz

**Sağlayıcı modeli:** `api-chat` + doğrulanmış web platformları destekler; **özel/bilinmeyen sağlayıcı desteklenmiyor sayılır** (iyimser `true` yok).

---

## 12. PDF SAYFA METADATA DOĞRULAMASI

- Seçim anındaki gerçek sayfa `resolveSelectionPageRange` ile (anchor/focus/commonAncestor) alınır → gönderim anındaki aktif sayfa değil.
- Çok sayfalı seçim `page–pageEnd` aralığı olarak taşınır; tek sayfaya indirgenmez.
- Toplam sayfa gerçekten `nativeViewer.totalPages`'ten gelir; bilinmiyorsa **uydurulmaz**.
- Görsel başlıkları gövdede **sıra korunarak** yazılır (Aşama 9'daki "başlıklar eklerle ilişkisiz kalmasın" riski): `planSingleMessageSend` taslak sırasını korur, api-chat ekleri aynı sırayla ekler.
- Electron'da doğrulandı: "Metin · Sayfa 1/2", "Görsel · Sayfa 1/2" (sayfa/total + belge adı).
- Farklı PDF'lerde karışma: `docId = path::streamUrl::name::size`; belge değişiminde menü ve metadata sıfırlanır.

---

## 13. KORUNAN MEVCUT ÖZELLİKLER

Kayıtlı promptlar + seçim · hazır promptlar · ek talimat/not · otomatik gönderme anahtarı · Ctrl/Cmd+Enter ile gönder · öğe bazında kaldırma ve tümünü temizle (onaylı) · Magic Selector self-healing (imageSendPipeline ile aynı `reportSelectorRepair` mekanizması korundu, bulk'da da fire-and-forget tek rapor) · sağ tık menüsünün 4 öğesi · Magic Selector regresyon testleri · Electron güvenlik kontrolleri · arama/zoom/sayfa gezinme/pan/yenile · taslak slotu + focus modu yedeği.

---

## 14. TEST SONUÇLARI

| Kontrol           | Komut                             | Sonuç                                                                        |
| ----------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| Birim/entegrasyon | `npx vitest run`                  | ✅ **349 dosya, 4011 geçen, 2 atlanan, 0 başarısız** (başlangıçta 2 kırmızı) |
| Tip kontrolü      | `npx tsc -b`                      | ✅ hatasız                                                                   |
| Lint              | `npm run lint`                    | ✅ `--max-warnings=0` temiz                                                  |
| Format            | `npx prettier --check .`          | ✅ temiz                                                                     |
| Build             | `npm run build`                   | ✅ renderer + backend                                                        |
| Mimari            | `npm run analyze:architecture`    | ✅ 1129 modül / 4117 bağımlılık, ihlal yok                                   |
| Döngü             | madge                             | ✅ döngü yok                                                                 |
| Ölü kod           | `npx knip`                        | ✅ kullanılmayan export/dosya yok                                            |
| Repo hijyen       | `npm run ci:check-hygiene`        | ✅                                                                           |
| Electron güvenlik | `npm run check:electron-security` | ✅ HIGH/CRITICAL yok                                                         |

**Eklenen testler:** `usePdfSelectionMenu` (konum/kaydırma/zoom/staged/hata), `fullPageCaptureDecision` (menü kararı, iptal, supersession), `bulkSendPipeline` (tek mesaj, hazır olma, tek submit), `selectionPage` senaryo matrisi (tek satır, çok satır, sayfa sonu, kenar, zoom, dar panel), `PdfSelectionMenu` (etiket sığdırma, mousedown koruması), `bulkSendPlan` (yetenek modeli), `bulkOrchestration` (desteklenmeyen sağlayıcı, staged), `queue-behavior` (limit veri koruma).

**Mevcut testler yalnızca "yeşile çevirmek" için gevşetilmedi;** sözleşme değişen testler yeni sözleşmeye göre yeniden yazıldı (segmentli gönderim beklentileri → tek mesaj; `queueImageForAi` → `onFullPageCapture`).

---

## 15. KALAN RİSKLER

1. **Gerçek AI sağlayıcısında uçtan uca gönderim yapılmadı.** Otomatik gönderme açık/kapalı yolları birim testleriyle ve Electron'da UI düzeyinde doğrulandı, ancak ChatGPT/Gemini/Claude'a **gerçek mesaj gönderilmedi** (kimlik bilgisi/hesap gerektirir). Sağlayıcı bazlı elle doğrulama önerilir.
2. **Çoklu görsel gerçek yapıştırma test edilmedi.** Pipeline mantığı (sıra, tek submit, hazır olma) testlerle doğrulandı; gerçek bir sitede 3 ekin aynı mesajda görünümü elle teyit edilmeli.
3. **Alan yakalaması (crop) menüsü Electron'da uçtan uca denenmedi** — ana süreç pencere kırpması ve masaüstü etkileşimi gerektiriyor; aynı `CaptureChoiceMenu` bileşenini kullandığı ve yol birim testlerle doğrulandığı için risk düşük.
4. **Menü genişliği 296px sabit.** Gelecekte daha uzun bir çeviri eklenirse kırpma geri dönebilir; regresyon testi ölçü tabanlı koruma sağlıyor.
5. **Yüksek DPI (ölçeklenmiş ekran) ölçülmedi** — bu ortamda 1x ölçek kullanıldı. Ölçekleme CSS tabanlı olduğu için sorun beklenmiyor, ancak 1.5x/2x masaüstünde görsel doğrulama önerilir.
6. **`ai_draft_bulk_unsupported`** anahtarı hâlâ doğrudan kullanılmıyor (aynı mesaj `error_bulk_not_supported` ile veriliyor) — tutarlılık için tekilleştirilebilir.

---

## 16. DEĞİŞTİRİLEN DOSYALAR (86)

**Yeni (11):** `shared/types/pdf.ts` içinde SelectionPosition · `src/app/ui/CaptureChoiceMenu.tsx` · `aiSendComposer/{DraftTrigger,DraftPanel,DraftItemList,DraftItemRow,DraftPromptSection,DraftNoteField,DraftSendControls}.tsx` · 3 yeni test dosyası

**Düzeltilen (çekirdek, 14):** `selectionPage.ts` · `extractSelectedText.ts` · `usePdfSelectionMenu.ts` · `PdfSelectionMenu.tsx` · `usePdfCaptureActions.ts` · `useScreenshotPipeline.ts` · `useDraftSendOrchestration.ts` · `bulkSendPlan.ts` · `useAiDraftQueue.ts` · `textSendPipeline.ts` · `bulkSendPipeline.ts` · `useAiMessaging.ts` · `AiSendComposer.tsx` · `AppToolContext.tsx`

**Temizlik:** 16 ölü composer dosyası + `PdfAiQuickBar` + `AreaImageChoiceMenu` + `planBulkAiSend` silindi; `PdfToolbar`/`PdfViewer`/`PdfViewerDocument` prop zinciri temizlendi; 5 locale dosyası güncellendi.

---

## 17. SON COMMIT

```
a018463  fix(ai-send): menu geometry, send truthfulness and draft data safety
bfc0c02  feat(ai-send): binary selection menu and compact AI draft   ← başlangıç
fc38830  chore(release): prepare v6.7.2                            ← master
```

Push/tag/release yapılmadı. Kod `feature/ai-send-redesign` branch'inde hazır.

---

## SONUÇ — HEDEFE KARŞI

**Daha az tıklama:** seçim sonrası ikinci bir tıklama (AI simgesi) yok; iki eylem doğrudan görünüyor.
**Doğru konumlanan iki eylem:** gerçek Range geometrisinden tek karar; Electron'da ölçüldü (8px boşluk, birebir kaydırma takibi, zoom'da kapanma, etiket kesmesi düzeltildi).
**Profesyonel ve küçük taslak:** 360×418, galeri yok, kompakt satırlar, sayfa metadata'sı görünür.
**Korunmuş otomatik gönderme:** tablo hâlinde geçerli; staged artık staged.
**Eksiksiz promptlar:** kayıtlı prompt + hazır komutlar + ek talimat korundu.
**Doğru PDF metadata'sı:** sayfa/aralık/toplam hem UI'da hem AI mesajında.
**Güvenilir tek mesajlık toplu gönderim:** tek submit, tek prompt, desteklenmeyen sağlayıcıda sessiz bölme yok.

**Başarı iddiası kanıtı:** 4011 test + typecheck/lint/format/build/madge/knip/dependency-cruiser temiz; 14 gerçek hata dosya-satır düzeyinde tespit edildi; iki UI hatası gerçek Electron ekran görüntüleriyle bulunup ölçümle doğrulandı.
