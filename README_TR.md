# QuizLab Reader 📚✨

[![English](https://img.shields.io/badge/lang-English-blue.svg)](README.md) ![Sürüm](https://img.shields.io/badge/sürüm-1.0.3-blue.svg) ![Lisans](https://img.shields.io/badge/lisans-MIT-green.svg) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

> **🇺🇸 [Click here for English Documentation](README.md)**

**QuizLab Reader**, öğrenme sürecinizi süper şarj etmek için tasarlanmış yeni nesil bir çalışma aracıdır. Güçlü bir **PDF Okuyucu** ile gömülü bir **AI Asistanı** tek ekranda birleştirir.
  
> **PDF dokümanlarınızı saniyeler içinde interaktif sınavlara dönüştüren yapay zeka destekli okuyucu.** 📚✨

Sıradan uygulamaların aksine, QuizLab karmaşık API anahtarlarıyla uğraşmanızı gerektirmez. Doğrudan **Google Gemini CLI** entegrasyonu ile yerel bir sınav oluşturucu sunar ve devrim niteliğindeki **"Sihirli Seçici" (Magic Selector)** teknolojisi sayesinde tarayıcı tabanlı *herhangi bir* yapay zekayı (ChatGPT, Claude, DeepSeek) ders çalışma arkadaşınıza dönüştürür.

![Uygulama Genel Görünüm](docs/images/app-overview.png)
*Çift panelli arayüz: Solda PDF dokümanınız, sağda dilediğiniz yapay zeka asistanı.*

---

## 🚀 Temel Özellikler

### 🧠 Yerel Gemini Entegrasyonu ve Sınav Modülü

Google Gemini CLI kullanarak PDF'lerinizden saniyeler içinde zenginleştirilmiş sınavlar oluşturun.

### 1. Sınav Ayarları

![Quiz Ayarları](docs/images/quiz-creation.png)
*Zorluk seviyesi, soru sayısı ve konu seçimini dilediğiniz gibi yapın.*

### 2. Soru Çözme Arayüzü

![Quiz Modu](docs/images/quiz-gameplay.png)
*Dikkatinizi dağıtmayacak şekilde tasarlanmış interaktif soru ekranı.*

### 3. Detaylı Sonuçlar

![Quiz Sonuçları](docs/images/quiz-results.png)
*Sınav sonunda detaylı puanlama ve doğru/yanlış analizi.*

### 🪄 "Sihirli Seçici" (Magic Selector) ile Kesintisiz Entegrasyon

"Oku ve Sor" iş akışını en üst düzeye çıkarın.

![AI Entegrasyonu](docs/images/ai-integration.png)
*PDF üzerinden metni seçin ve "Send to AI" butonuna tıklayın. Seçtiğiniz yapay zeka (ChatGPT, Claude vb.) anında yanıtlasın.*

### 📖 Gelişmiş PDF ve Çalışma Araçları

* **Bölünmüş Ekran (Split-Screen):** Sol panelde ders notlarınız, sağ panelde yapay zeka asistanınız.
* **Akıllı Bağlam Menüsü:** Metin seçtiğinizde açılan menü ile anında Özet Çıkar, Çeviri Yap veya Kavram Açıkla.
* **Ekran Görüntüsü Analizi:** PDF'teki bir grafiği kesip, anında yapay zekaya görsel olarak sorabilirsiniz.

### 🗄️ Yerel Veritabanı ve Kütüphane Yönetimi

SQLite tabanlı yerel veritabanı ile dökümanlarınızı klasörleyin, notlar alın ve çalışma kütüphanenizi dilediğiniz gibi organize edin.

## 🏗 Teknoloji Yığını

Uygulama, performans ve modülerlik için en modern teknolojilerle geliştirilmiştir:

* **Çekirdek (Core):**
  * [Electron](https://www.electronjs.org/): Masaüstü entegrasyonu (IPC, Shell)
  * [React 18](https://reactjs.org/): Kullanıcı arayüzü
  * [TypeScript](https://www.typescriptlang.org/): Tip güvenliği ve ölçeklenebilirlik
  * [Vite](https://vitejs.dev/): Ultra hızlı geliştirme sunucusu ve bundler

* **Arayüz & Tasarım (UI/UX):**
  * [TailwindCSS](https://tailwindcss.com/): Utility-first CSS framework
  * [Framer Motion](https://www.framer.com/motion/): Akıcı animasyonlar ve geçişler
  * [Lucide React](https://lucide.dev/): Modern ve tutarlı ikon seti
  * [Headless UI](https://headlessui.com/): Erişilebilir UI bileşenleri

* **PDF Motoru:**
  * [@react-pdf-viewer](https://react-pdf-viewer.dev/): Yüksek performanslı PDF görüntüleme
  * [PDF.js](https://mozilla.github.io/pdf.js/): PDF okuma ve işleme altyapısı

* **Yapay Zeka & Entegrasyon:**
  * **Google Gemini CLI:** `@google/gemini-cli` ile yerel quiz üretimi
  * **DOM Otomasyonu:** "Sihirli Seçici" için özel geliştirilmiş DOM enjeksiyon motoru

* **Paketleme & Dağıtım:**
  * [Electron Builder](https://www.electron.build/): Windows, macOS ve Linux için installer oluşturma

---

## 🛠 Kurulum

### Gereksinimler

* Node.js (v18 veya üzeri)
* Git
* Bir Google Hesabı (Gemini özellikleri için)

### Geliştirici Kurulumu

1. **Repoyu klonlayın**

    ```bash
    git clone https://github.com/ozymandias-get/quizlab.git
    cd quizlab
    ```

2. **Bağımlılıkları yükleyin**

    ```bash
    npm install
    ```

    *Not: Bu işlem, quiz üretimi için gerekli olan `@google/gemini-cli` paketini de yükleyecektir.*

3. **Geliştirme Modunda Çalıştırın**

    ```bash
    npm run dev
    ```

    *Bu komut Vite sunucusunu ve Electron ana sürecini eş zamanlı olarak başlatır.*

### Uygulamayı Derleme (Build)

İşletim sisteminiz için çalıştırılabilir dosya (.exe, .dmg, .AppImage) oluşturmak için:

* **Windows:** `npm run build:win` (`release/` klasöründe .exe oluşturur)
* **macOS:** `npm run build:mac`
* **Linux:** `npm run build:linux`

---

## 🎮 Nasıl Kullanılır?

### 1. Google Gemini Bağlantısı (Quiz İçin)

Uygulama **Gemini Developer CLI** kullanır. API Key kopyalamakla uğraşmazsınız.

1. Uygulamada **Ayarlar** veya **Quiz** sekmesine gidin.
2. **"Google ile Giriş Yap"** (Login with Google) butonuna tıklayın.
3. Açılan terminal penceresindeki linki tarayıcıda açın, izin verin ve size verilen kodu kopyalayın.
4. Kodu tekrar terminale yapıştırın.
5. Durum **"Bağlandı"** olduğunda artık dökümanlarınızdan sınırsız quiz oluşturabilirsiniz.

### 2. Sihirli Seçici Kurulumu (Chat İçin)

1. Sağ taraftaki **AI Paneli**ni açın.
2. Favori sohbet sitenize gidin (örn. `chatgpt.com`).
3. Alt çubuktaki **Sihirli Değnek 🪄** ikonuna tıklayın.
4. **Adım 1:** Sitedeki mesaj yazma kutusuna tıklayın.
5. **Adım 2:** Sitedeki gönder (send) butonuna tıklayın.
6. Artık PDF okurken seçtiğiniz metinler otomatik olarak bu siteye gönderilecektir.

---

## 📂 Proje Yapısı

```bash
quizlab/
├── .github/                     # GitHub Actions yapılandırması
├── backend/                     # Electron Ana Süreci (Main Process)
│   ├── main/                    # Ana süreç mantığı
│   │   ├── handlers/            # Çeşitli modüller için IPC İşleyicileri
│   │   │   ├── aiConfigHandlers.ts
│   │   │   ├── aiRegistryHandlers.ts
│   │   │   ├── automationHandlers.ts
│   │   │   ├── helpers.ts
│   │   │   ├── index.ts
│   │   │   ├── libraryHandlers.ts
│   │   │   ├── pdfHandlers.ts
│   │   │   ├── screenshotHandlers.ts
│   │   │   └── systemHandlers.ts
│   │   ├── constants.ts
│   │   ├── index.ts
│   │   ├── ipcHandlers.ts
│   │   ├── pdfProtocol.ts
│   │   ├── updater.ts
│   │   └── windowManager.ts
│   ├── managers/                # İş mantığı yöneticileri
│   │   ├── database/            # Veritabanı depoları ve şema
│   │   │   ├── FileRepository.ts
│   │   │   ├── FolderRepository.ts
│   │   │   ├── NoteRepository.ts
│   │   │   └── SchemaManager.ts
│   │   ├── ConfigManager.ts
│   │   └── DatabaseManager.ts
│   ├── modules/                 # Fonksiyonel modüller
│   │   ├── ai/                  # Yapay zeka platform entegrasyonları
│   │   │   ├── platforms/
│   │   │   │   ├── chatgpt.ts
│   │   │   │   ├── claude.ts
│   │   │   │   ├── deepseek.ts
│   │   │   │   └── qwen.ts
│   │   │   └── aiManager.ts
│   │   ├── automation/          # Tarayıcı otomasyon mantığı
│   │   │   ├── automationScripts.ts
│   │   │   └── userElementPicker.ts
│   │   └── quiz/                # Sınav oluşturma mantığı
│   │       ├── geminiService.ts
│   │       ├── promptBuilder.ts
│   │       └── quizCliHandler.ts
│   └── preload/                 # Electron preload scriptleri
│       └── index.ts
├── docs/                        # Dokümantasyon ve ekran görüntüleri
│   └── images/
│       ├── ai-integration.png
│       ├── app-overview.png
│       ├── quiz-creation.png
│       ├── quiz-gameplay.png
│       └── quiz-results.png
├── frontend/                    # React Arayüz Süreci (Renderer Process)
│   ├── __tests__/               # Ön yüz testleri
│   │   └── AiWebview.test.ts
│   ├── api/                     # API istemci tanımları
│   │   └── quizApi.ts
│   ├── assets/                  # Ön yüz varlıkları
│   │   └── icon.png
│   ├── components/              # UI Bileşenleri
│   │   ├── BottomBar/           # Uygulama alt araç çubuğu
│   │   │   ├── AIItem.tsx
│   │   │   ├── CenterHub.tsx
│   │   │   ├── ModelsPanel.tsx
│   │   │   ├── SettingsLoadingSpinner.tsx
│   │   │   ├── ToolButton.tsx
│   │   │   ├── ToolsPanel.tsx
│   │   │   ├── animations.ts
│   │   │   └── index.tsx
│   │   ├── FileExplorer/        # Kütüphane dosya gezgini
│   │   │   ├── hooks/
│   │   │   │   ├── useExternalDragDrop.ts
│   │   │   │   ├── useFileDragDrop.ts
│   │   │   │   └── useFileExplorerActions.ts
│   │   │   ├── icons/
│   │   │   │   └── FileExplorerIcons.tsx
│   │   │   ├── DeleteConfirmModal.tsx
│   │   │   ├── DropOverlay.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── NewFolderInput.tsx
│   │   │   ├── TreeItem.tsx
│   │   │   └── index.tsx
│   │   ├── pdf/                 # PDF görüntüleyici ve araçlar
│   │   │   ├── hooks/
│   │   │   │   ├── index.ts
│   │   │   │   ├── usePdfContextMenu.ts
│   │   │   │   ├── usePdfNavigation.ts
│   │   │   │   ├── usePdfPlugins.ts
│   │   │   │   ├── usePdfScreenshot.ts
│   │   │   │   └── usePdfTextSelection.ts
│   │   │   ├── PdfPlaceholder.tsx
│   │   │   ├── PdfSearchBar.tsx
│   │   │   ├── PdfToolbar.tsx
│   │   │   ├── PdfViewer.tsx
│   │   │   └── index.ts
│   │   ├── QuizModule/          # Sınav oyunu ve yapılandırması
│   │   │   ├── QuizActive.tsx
│   │   │   ├── QuizConfigPanel.tsx
│   │   │   ├── QuizGenerating.tsx
│   │   │   ├── QuizModule.tsx
│   │   │   ├── QuizResults.tsx
│   │   │   └── index.ts
│   │   ├── SplashScreen/        # Uygulama başlangıç ekranı
│   │   │   └── index.tsx
│   │   ├── Toast/               # Bildirim sistemi
│   │   │   ├── ToastContainer.tsx
│   │   │   └── ToastItem.tsx
│   │   ├── AestheticLoader.tsx
│   │   ├── AiWebview.tsx
│   │   ├── AppBackground.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── FloatingButton.tsx
│   │   ├── Icons.tsx
│   │   ├── LeftPanel.tsx
│   │   ├── ScreenshotTool.tsx
│   │   ├── SettingsModal.tsx
│   │   ├── UpdateBanner.tsx
│   │   └── UsageAssistant.tsx
│   ├── constants/               # Global sabitler
│   │   ├── appConstants.ts
│   │   ├── appearance.ts
│   │   ├── prompts.ts
│   │   ├── storageKeys.ts
│   │   └── translations.ts
│   ├── context/                 # React Context sağlayıcıları
│   │   ├── AiContext.tsx
│   │   ├── AppToolContext.tsx
│   │   ├── AppearanceContext.tsx
│   │   ├── FileContext.tsx
│   │   ├── LanguageContext.tsx
│   │   ├── NavigationContext.tsx
│   │   ├── ToastContext.tsx
│   │   ├── UpdateContext.tsx
│   │   └── index.ts
│   ├── hooks/                   # Özel React hook'ları
│   │   ├── webview/
│   │   │   └── useWebviewLifecycle.ts
│   │   ├── index.ts
│   │   ├── useAiSender.ts
│   │   ├── useElementPicker.ts
│   │   ├── useLocalStorage.ts
│   │   ├── useOnlineStatus.ts
│   │   ├── usePanelResize.ts
│   │   ├── usePdfSelection.ts
│   │   ├── usePrompts.ts
│   │   ├── useScreenshot.ts
│   │   └── useSettings.ts
│   ├── locales/                 # Uluslararasılaştırma dosyaları
│   │   ├── en.json
│   │   └── tr.json
│   ├── public/                  # Renderer için statik varlıklar
│   │   ├── icon.png
│   │   ├── logo.png
│   │   └── splash.html
│   ├── styles/                  # Stil dosyaları
│   │   ├── modules/
│   │   │   ├── _aesthetic-loader.css
│   │   │   ├── _animations.css
│   │   │   ├── _backgrounds.css
│   │   │   ├── _base.css
│   │   │   ├── _buttons.css
│   │   │   ├── _floating-bar.css
│   │   │   ├── _fonts.css
│   │   │   ├── _glass-panel.css
│   │   │   ├── _pdf-viewer.css
│   │   │   ├── _quiz.css
│   │   │   ├── _resizer.css
│   │   │   ├── _screenshot.css
│   │   │   ├── _splash.css
│   │   │   └── _utilities.css
│   │   └── index.css
│   ├── types/                   # TypeScript tip tanımları
│   │   ├── global.d.ts
│   │   ├── pdf.ts
│   │   ├── vitest.d.ts
│   │   └── webview.ts
│   ├── utils/                   # Paylaşılan yardımcı fonksiyonlar
│   │   ├── automation/
│   │   │   ├── domHelpers.ts
│   │   │   ├── styles.ts
│   │   │   └── uiTemplates.ts
│   │   ├── fileUtils.ts
│   │   ├── logger.ts
│   │   ├── uiUtils.ts
│   │   └── webviewUtils.ts
│   ├── App.tsx
│   ├── index.html
│   ├── main.tsx
│   └── vite-env.d.ts
├── installer/                   # Yükleyici yapılandırması
│   └── installer.nsh
├── resources/                   # Platforma özel kaynaklar
│   ├── icon.ico
│   └── icon.png
├── .gitignore
├── LICENSE
├── package-lock.json
├── package.json
├── postcss.config.js
├── README.md
├── README_TR.md
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## 🛡️ Güvenlik ve Gizlilik

Bu proje **%100 Açık Kaynak** kodludur. Tüm kodları bu sayfadan inceleyebilirsiniz.

* **Veri Gizliliği:** Hiçbir veriniz sunucularımızda saklanmaz. PDF işleme ve AI sorguları tamamen sizin bilgisayarınızda ve kendi Google/OpenAI hesabınız üzerinden gerçekleşir.
* **Antivirüs Taraması:** Derlenen her sürüm temizdir. Ancak "Kod İmzalama Sertifikası" (Code Signing) çok pahalı olduğu için Windows SmartScreen uyarı verebilir.
  * *Uyarı alırsanız: "Ek Bilgi" -> "Yine de Çalıştır" seçeneğini kullanabilirsiniz.*

[![VirusTotal](https://img.shields.io/badge/VirusTotal-Temiz-brightgreen)](https://www.virustotal.com/gui/file/d78216b97311a074f2e92f0aae1c25c5a73780593855db370a92424d2268cebf/detection) *(Son sürüm tarama raporu - v1.0.3)*

## 🤝 Katkıda Bulunma

Katkılarınızı bekliyoruz! Lütfen bir Pull Request göndermekten çekinmeyin.

1. Fork'layın
2. Branch oluşturun (`git checkout -b ozellik/YeniOzellik`)
3. Commit yapın (`git commit -m 'Yeni özellik eklendi'`)
4. Push'layın (`git push origin ozellik/YeniOzellik`)
5. Pull Request açın

---

## 📄 Lisans

Bu proje **MIT Lisansı** ile lisanslanmıştır - detaylar için [LICENSE](LICENSE) dosyasına bakabilirsiniz.
