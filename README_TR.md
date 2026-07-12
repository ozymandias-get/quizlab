<h1 align="center">Quizlab Reader</h1>

<p align="center">
  <strong>Yapay Zeka Destekli PDF Çalışma Alanı</strong>
  <br>
  <sub>PDF okuyun, vurgulayın ve içerikleri yapay zeka platformlarına &mdash; tek bir bölünmüş ekran uygulamasında gönderin.</sub>
</p>

<p align="center">
  <a href="README.md">🇬🇧 English</a>
  &nbsp;•&nbsp;
  <a href="https://github.com/ozymandias-get/quizlab/releases">📦 Sürümler</a>
  &nbsp;•&nbsp;
  <a href="CONTRIBUTING.md">🤝 Katkıda Bulunma</a>
  &nbsp;•&nbsp;
  <a href="SECURITY.md">🔒 Güvenlik</a>
  &nbsp;•&nbsp;
  <a href="docs/ARCHITECTURE.md">📐 Mimari</a>
  &nbsp;•&nbsp;
  <a href="docs/ROADMAP.md">🗺️ Yol Haritası</a>
  <br>
  <img alt="GitHub version" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fozymandias-get%2Fquizlab%2Fmain%2Fpackage.json&query=%24.version&label=sürüm&color=blue">
</p>

---

## 📋 İçindekiler

- [✨ Özellikler](#-özellikler)
- [📖 Genel Bakış](#-genel-bakış)
- [🛠️ Teknoloji Altyapısı](#️-teknoloji-altyapısı)
- [🌐 Uluslararasılaştırma](#-uluslararasılaştırma)
- [📦 Kurulum](#-kurulum)
- [⚙️ Geliştirici Kılavuzu](#️-geliştirici-kılavuzu)
- [🔬 CI/CD Süreci](#-cicd-süreci)
- [📂 Proje Yapısı](#-proje-yapısı)
- [🔒 Güvenlik & Gizlilik](#-güvenlik--gizlilik)
- [📄 Lisans](#-lisans)

---

## ✨ Özellikler

<table>
  <tr>
    <td width="50%">
      <h4>📑 Çok Sekmeli PDF Çalışma Alanı</h4>
      Özelleştirilebilir panellerde PDF'leri açın, okuyun, arama yapın ve yerleşimleri değiştirin.
    </td>
    <td width="50%">
      <h4>🤖 Çoklu Yapay Zeka Entegrasyonu</h4>
      <strong>ChatGPT</strong>, <strong>Gemini</strong>, <strong>Claude</strong>, <strong>DeepSeek</strong>, <strong>Perplexity</strong>, <strong>Mistral</strong>, <strong>Grok</strong> ve daha fazlası için yerleşik destek &mdash; tek bir çalışma alanından erişilebilir.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>⚡ Hızlı Aktarım Kanalları</h4>
      Ekran görüntülerini sürükleyin veya seçilen metinleri sıfır bağlam değişikliğiyle aktif yapay zeka sekmesine gönderin.
    </td>
    <td width="50%">
      <h4>🔐 Gizlilik Odaklı Mimari</h4>
      PDF'leriniz, kimlik bilgileriniz ve oturum verileriniz tamamen yerel kalır. Telemetri yok, bulut yüklemesi yok. Hassas veriler AES-256-GCM şifreleme ile korunur.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>🎨 Glassmorphic Arayüz</h4>
      Dinamik arka plan animasyonları, ayarlanabilir cam efekt seviyeleri, yönsel ışıklandırma ve zarif taş tonları.
    </td>
    <td width="50%">
      <h4>📚 Prompt Kütüphanesi</h4>
      Bağlamsal prompt taslaklarını kaydedin, çalışma makroları oluşturun ve hızlı gönderim için otomasyon rutinleri yapılandırın.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>🛡️ Güvenli PDF Protokolü</h4>
      Üst düzey güvenlik ve hızlı işleme için özel <code>local-pdf://</code> akış protokolü, bayt aralığı desteğiyle.
    </td>
    <td width="50%">
      <h4>🌐 Özel Yapay Zeka Siteleri</h4>
      Herhangi bir yapay zeka arayüzü için hedef CSS giriş alanlarıyla özel web uç noktalarını kolayca yapılandırın ve kaydedin.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>💬 Doğrudan API Sohbeti</h4>
      Kendi API anahtarlarınızı (Gemini, ChatGPT, Claude, OpenRouter uyumlu) kullanarak yapay zeka modelleriyle doğrudan, gizlilik odaklı bir arayüzde sohbet edin.
    </td>
    <td width="50%">
      <h4>⚙️ Esnek Anahtar Yönetimi</h4>
      Özel API anahtarlarınızı ve model parametrelerinizi doğrudan ayarlar panelinden güvenli bir şekilde yapılandırın, test edin ve kaydedin.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>🔍 Ekran Görüntüsü & Yakalama</h4>
      Tam sayfa veya kırpılmış ekran görüntüleri alın, panoya kopyalayın veya doğrudan yapay zekaya gönderin.
    </td>
    <td width="50%">
      <h4>🤖 Gemini Web Oturumu</h4>
      Çerez tabanlı kimlik doğrulama, sağlık izleme, otomatik kurtarma ve oturum dışa/içe aktarma ile kalıcı Google AI oturumları.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>🖱️ Eleman Seçici</h4>
      Yapay zeka sohbet giriş alanlarını hedeflemek için sihirli CSS seçici &mdash; manuel yapılandırma gerektirmez.
    </td>
    <td width="50%">
      <h4>🔌 Chrome Eklenti Köprüsü</h4>
      Google oturum çerezlerini Chrome ve Electron arasında paylaşmak için native messaging sunucusu ve Chrome eklentisi.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>📖 Interaktif Eğitimler</h4>
      Kullanıcıyı tanıtma ve özellik keşfi için yerleşik rehberli eğitimler.
    </td>
    <td width="50%">
      <h4>🗣️ Tam i18n Desteği</h4>
      Her biri 19 çeviri ad alanıyla eksiksiz İngilizce ve Türkçe yerelleştirme.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>🔄 Otomatik Güncellemeler</h4>
      Semver karşılaştırması ve periyodik kontrollerle GitHub Releases tabanlı otomatik güncelleme.
    </td>
    <td width="50%">
      <h4>🧹 Önbellek Yönetimi</h4>
      Akıllı önbellek izleme, zamanlanmış temizlik ve %80 kapasitede uyarı eşiği.
    </td>
  </tr>
</table>

---

## 📖 Genel Bakış

**Quizlab Reader**, çok sekmeli bir belge okuma deneyimini ve popüler yapay zeka arayüzlerini şık bir "Glassmorphic" tasarım altında bir araya getiren, açık kaynaklı ve yerel odaklı bir masaüstü çalışma alanıdır. **Akademisyenler, araştırmacılar ve profesyonel öğrenciler** için özel olarak geliştirilmiş olup, sürekli uygulama değiştirme ve sekme kalabalığı sorununu ortadan kaldırır.

Uygulama, yüksek performanslı bir PDF görüntüleyiciyi gömülü yapay zeka webview'ları, doğrudan API sohbeti, otomasyon betikleri ve kapsamlı oturum yönetimi ile birleştirir &mdash; tüm bunları sıfır telemetri ile katı gizlilik garantileri altında sunar.

---

## 🛠️ Teknoloji Altyapısı

| Kategori                  | Teknoloji                                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Masaüstü Çatısı**       | [Electron 42](https://www.electronjs.org/)                                                                           |
| **Arayüz Kütüphanesi**    | [React 19](https://react.dev/)                                                                                       |
| **Dil**                   | [TypeScript 6.0](https://www.typescriptlang.org/)                                                                    |
| **Paketleyici**           | [Vite 8](https://vitejs.dev/)                                                                                        |
| **PDF Motoru**            | [pdfjs-dist 3.11](https://mozilla.github.io/pdf.js/) + [@react-pdf-viewer 3.12](https://react-pdf-viewer.dev/)       |
| **Stil**                  | [Tailwind CSS 4](https://tailwindcss.com/)                                                                           |
| **Animasyon**             | [Motion](https://motion.dev/) (eski adıyla Framer Motion)                                                            |
| **Durum Yönetimi**        | [Zustand 5](https://zustand-demo.pmnd.rs/) + [TanStack React Query 5](https://tanstack.com/query/latest)             |
| **Yapay Zeka Otomasyonu** | [Playwright](https://playwright.dev/) (webview oturum yönetimi ve betikleme)                                         |
| **Arayüz Bileşenleri**    | [Radix UI](https://www.radix-ui.com/) + [Headless UI](https://headlessui.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| **İkonlar**               | [Tabler Icons](https://tabler.io/icons) + [Lucide](https://lucide.dev/)                                              |
| **Parçacıklar**           | [tsParticles](https://particles.js.org/)                                                                             |
| **Yazı Tipleri**          | [Inter Variable](https://fonts.google.com/specimen/Inter) üzerinden Fontsource                                       |
| **i18n**                  | [i18next](https://www.i18next.com/) + [react-i18next](https://react.i18next.com/)                                    |
| **Test**                  | [Vitest 4](https://vitest.dev/) + [Testing Library](https://testing-library.com/)                                    |
| **Lint**                  | [ESLint 10](https://eslint.org/) + [Prettier](https://prettier.io/)                                                  |
| **Güvenlik Analizi**      | [Electronegativity](https://github.com/doyensec/electronegativity) + [Semgrep](https://semgrep.dev/)                 |
| **Mutasyon Testi**        | [Stryker](https://stryker-mutator.io/)                                                                               |
| **Yükleyici**             | [electron-builder](https://www.electron.build/) + NSIS (Windows)                                                     |

---

## 🌐 Uluslararasılaştırma

Quizlab Reader iki dilde tamamen yerelleştirilmiştir:

| Dil           | Kod  | Ad Alanı Sayısı |
| ------------- | ---- | --------------- |
| **İngilizce** | `en` | 19 JSON dosyası |
| **Türkçe**    | `tr` | 19 JSON dosyası |

Ad alanları şunları kapsar: genel arayüz, navigasyon, ayarlar, görünüm, PDF görüntüleyici, yapay zeka entegrasyonu, yapay zeka sohbeti, seçiciler, eğitimler, Gemini web oturumu, hatalar, bildirimler, otomatik gönderim ve bağlamsal promptlar.

İlk çalıştırmada dil seçimi iletişim kutusu gösterilir. Dil ayarlardan her zaman değiştirilebilir.

Kapsamlı bir [terminoloji standardı](docs/TERMINOLOGY.md), uygulama genelinde tutarlı EN/TR çevirisi sağlar.

---

## 📦 Kurulum

### Gereksinimler

| Ölçüt               | Minimum                                 | Önerilen                              |
| ------------------- | --------------------------------------- | ------------------------------------- |
| **İşletim Sistemi** | Windows 10 / macOS 10.15 / Ubuntu 20.04 | Windows 11 / macOS 13+ / Ubuntu 22.04 |
| **RAM**             | 4 GB                                    | 8 GB+                                 |
| **Depolama**        | 500 MB                                  | 2 GB+                                 |
| **İnternet**        | Yapay zeka özellikleri için gerekli     | Yüksek hızlı genişbant                |

### İndirme

Platformunuza uygun en son yükleyiciyi [Sürümler sayfasından](https://github.com/ozymandias-get/quizlab/releases) indirin:

| Platform   | Format                                               |
| ---------- | ---------------------------------------------------- |
| 🪟 Windows | `QuizlabReader-Setup-<version>.exe` (NSIS yükleyici) |
| 🍏 macOS   | `QuizlabReader-<version>.dmg`                        |
| 🐧 Linux   | `QuizlabReader-<version>.AppImage` veya `.deb`       |

Yükleyici, isteğe bağlı olarak Google oturum köprüsü eklentisi için bir Chrome Native Messaging Sunucusu kaydeder.

---

## ⚙️ Geliştirici Kılavuzu

> [!TIP]
> **Windows Kullanıcıları**: Bu depo `LF` satır sonlarını zorunlu kılar. Kopyalamadan önce <code>git config --global core.autocrlf input</code> komutunu çalıştırın.

```bash
# Kopyalama ve kurulum
git clone https://github.com/ozymandias-get/quizlab.git
cd quizlab
npm install

# Geliştirme
npm run dev

# Kalite kontrolleri
npm run typecheck    # TypeScript
npm run lint         # ESLint (sıfır uyarı)
npm run test         # Vitest (~2285 test)
npm run test:coverage # Coverage raporu

# Analiz
npm run analyze:all  # Tüm analiz paketi (bundle, türler, ölü kod, kopyalar, döngüsel bağımlılıklar, vb.)
npm run analyze:security  # Electronegativity + Semgrep güvenlik taraması

# Derleme
npm run build:win    # Windows NSIS yükleyicisi
npm run build:mac    # macOS DMG
npm run build:linux  # Linux AppImage + deb
```

### Commit Kuralı

Bu proje [Geleneksel Commitler](https://www.conventionalcommits.org/) kullanır:

- `feat:` — yeni özellik
- `fix:` — hata düzeltmesi
- `docs:` — dokümantasyon
- `refactor:` — kod yeniden yapılandırması
- `test:` — test değişiklikleri
- `chore:` — bakım

Commit mesajları, husky hook'ları ile commitlint tarafından doğrulanır.

---

## 🔬 CI/CD Süreci

Proje, üç aşamalı GitHub Actions ([`.github/workflows/build.yml`](.github/workflows/build.yml)) kullanır:

1. **Kalite** (ubuntu-latest, main'e her push/PR'da):
   - Depo hijyeni ve versiyon tutarlılığı kontrolleri
   - ESLint (sıfır uyarı), Prettier biçimlendirme, CSS lint
   - TypeScript tip kontrolü
   - Mimari doğrulama (dependency-cruiser)
   - Test takımı ve coverage
   - Tip coverage kontrolü, yazım denetimi
   - Kopya kod ve döngüsel bağımlılık tespiti

2. **Derleme** (windows-latest + ubuntu-22.04, etiketlerde):
   - Windows: NSIS yükleyici
   - Linux: AppImage + deb
   - Yapıtlar yüklenir

3. **Sürüm** (etiketlerde):
   - Otomatik oluşturulan sürüm notlarıyla GitHub Release oluşturur
   - Tüm platform yapıtlarını ekler

---

## 📂 Proje Yapısı

```
quizlab/
├── .github/               # Issue şablonları, CI iş akışları
├── docs/                  # Yol haritaları, mimari dökümanlar, terminoloji
├── electron/              # Ana süreç (Electron)
│   ├── app/               # Giriş noktaları, IPC işleyicileri, pencere yönetimi
│   │   └── window/        # Güvenlik, oturumlar, ortam, arayüz yükleyici
│   ├── core/              # Config yöneticisi, şifreleme, logger, CSP, güncelleyici, IPC güvenliği
│   ├── features/          # Özellik işleyicileri (AI, Otomasyon, Gemini, PDF, Ekran Gör., Native Mesajlaşma)
│   ├── preload/           # Context bridge betikleri
│   └── __tests__/         # Ana süreç testleri (69 test dosyası)
├── extensions/            # Google oturum köprüsü için Chrome eklentisi
│   └── quizlab-session-extension/
├── installer/             # NSIS Windows yükleyici betiği
├── patches/               # patch-package yamaları
├── resources/             # Statik yükleyici varlıkları, uygulama ikonları
├── scripts/               # Geliştirme/derleme otomasyon betikleri
├── shared/                # Süreçler arası sözleşmeler (IPC kanalları, tipler, sabitler)
│   ├── constants/
│   ├── lib/
│   └── types/
├── src/                   # Arayüz (React + Vite)
│   ├── app/               # Kabuk, sağlayıcılar, global bağlamlar, efektler
│   │   ├── components/    # shadcn/ui bileşenleri
│   │   ├── hooks/
│   │   ├── providers/     # AppProviders, AiContext, QueryProvider, UpdateContext, AppTool
│   │   └── ui/            # MainWorkspace, FocusOverlay, AiSendComposer
│   ├── features/          # Özellik modülleri (AI, PDF, Ayarlar, Ekran Gör., Otomasyon, Eğitim, Tanıtım)
│   ├── platform/          # Electron köprü adaptörleri
│   ├── public/            # Statik varlıklar
│   ├── shared/            # Paylaşılan UI bileşenleri, hook'lar, i18n, stiller, store'lar, lib
│   │   ├── i18n/locales/  # en/ (19 dosya) + tr/ (19 dosya)
│   │   ├── stores/        # Zustand store'ları (görünüm, dil, bildirimler)
│   │   └── ui/            # Paylaşılan düzen ve bileşenler
│   ├── types/             # Global tip bildirimleri
│   └── __tests__/         # Arayüz testleri (177 test dosyası)
├── package.json
└── tsconfig.json
```

---

## 🔒 Güvenlik & Gizlilik

- **Telemetri Yok** &mdash; sıfır veri toplama, bulut yüklemesi yok
- **İzole Arayüz** &mdash; sıkı `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- **Minimal Preload** &mdash; yalnızca açık IPC kanalları context bridge üzerinden sunulur
- **Güvenli PDF Protokolü** &mdash; içerik `local-pdf://` akış protokolü üzerinden dosya beyaz listesi ve bayt aralığı desteğiyle sunulur
- **WebView Sertleştirme** &mdash; bölüm beyaz liste doğrulaması, pano erişimi engelleme, sertifika hatalarını reddetme, harici navigasyonu sistem tarayıcısına yönlendirme, açılır pencere engelleme
- **İçerik Güvenlik Politikası** &mdash; nonce tabanlı script etiketleri ile katı CSP, sınırlı `frame-src` izin verilen AI alan adlarına
- **IPC Güvenliği** &mdash; tüm IPC işleyicilerinde güvenilir gönderici doğrulaması
- **Şifreleme** &mdash; API anahtarları ve kimlik bilgileri için makine kaynaklı anahtar + Electron `safeStorage` yedeklemesi ile AES-256-GCM
- **Şifrelenmiş Oturumlar** &mdash; izole Chromium oturum profillerinde şifrelenmiş çerezler
- **Otomatik Güvenlik Taraması** &mdash; CI'da Electronegativity ve Semgrep çalıştırılır

Güvenlik politikamız ve zafiyet bildirim talimatları için [SECURITY.md](SECURITY.md) dosyasını inceleyin.

---

## 📄 Lisans

Bu proje açık kaynaklı olup [MIT Lisansı](LICENSE) ile korunmaktadır.

---

<p align="center">
  <sub>
    <a href="https://github.com/ozymandias-get/quizlab/issues">Hata Bildir</a>
    &nbsp;•&nbsp;
    <a href="https://github.com/ozymandias-get/quizlab/discussions">Tartışmalar</a>
    &nbsp;•&nbsp;
    <a href="CONTRIBUTING.md">Katkı Rehberi</a>
  </sub>
  <br>
  <sub>Akademisyenler, araştırmacılar ve yaşam boyu öğrenenler için ❤️ ile geliştirildi.</sub>
</p>
