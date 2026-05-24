<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/public/icon.png">
    <img src="src/public/icon.png" alt="Quizlab Reader" width="120" style="border-radius: 28px;">
  </picture>
</p>

<h1 align="center">Quizlab Reader</h1>

<p align="center">
  <strong>Yapay Zeka Destekli PDF Çalışma Alanı</strong>
  <br>
  <sub>PDF okuyun, vurgulayın ve içerikleri ChatGPT, Gemini, Claude'a &mdash; tek bir bölünmüş ekran uygulamasında gönderin.</sub>
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
</p>

<p align="center">
  <a href="https://github.com/ozymandias-get/quizlab/releases">
    <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fozymandias-get%2Fquizlab%2Fmain%2Fpackage.json&query=%24.version&label=s%C3%BCr%C3%BCm&style=flat-square&color=6b5b4c" alt="Mevcut sürüm">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/lisans-MIT-green.svg?style=flat-square&color=8c7a6b" alt="MIT Lisansı">
  </a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg?style=flat-square&color=bda48f" alt="Çapraz platform">
  <img src="https://img.shields.io/badge/Electron-40-47848F?style=flat-square&logo=electron&logoColor=white&color=443e38" alt="Electron">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white&color=443e38" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white&color=443e38" alt="TypeScript">
</p>

---

## 📋 İçindekiler

- [✨ Özellikler](#-özellikler)
- [🖼️ Ekran Görüntüleri](#️-ekran-görüntüleri)
- [📖 Genel Bakış](#-genel-bakış)
- [🛠️ Teknoloji Altyapısı](#️-teknoloji-altyapısı)
- [📦 Kurulum](#-kurulum)
- [⚙️ Geliştirici Kılavuzu](#️-geliştirici-kılavuzu)
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
      <strong>ChatGPT</strong>, <strong>Gemini</strong>, <strong>Claude</strong> ve özel web uç noktaları için yerleşik destek &mdash; tek bir çalışma alanından erişilebilir.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>⚡ Hızlı Aktarım Kanalları</h4>
      Ekran görüntülerini sürükleyin veya seçilen metinleri sıfır bağlam değişikliğiyle aktif yapay zeka sekmesine gönderin.
    </td>
    <td width="50%">
      <h4>🔐 Gizlilik Odaklı Mimari</h4>
      PDF'leriniz, kimlik bilgileriniz ve oturum verileriniz tamamen yerel kalır. Telemetri yok, bulut yüklemesi yok.
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
      Üst düzey güvenlik ve hızlı işleme için özel <code>local-pdf://</code> akış protokolü.
    </td>
    <td width="50%">
      <h4>🌐 Özel Siteler</h4>
      Herhangi bir yapay zeka arayüzü için hedef CSS giriş alanlarıyla özel web uç noktalarını kolayca yapılandırın ve kaydedin.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>💬 Yerel API Sohbet Arayüzü</h4>
      Kendi API anahtarlarınızı (Gemini, ChatGPT, Claude) kullanarak yapay zeka modelleriyle doğrudan, gizlilik odaklı bir arayüzde sohbet edin.
    </td>
    <td width="50%">
      <h4>⚙️ Esnek Anahtar Yönetimi</h4>
      Özel API anahtarlarınızı ve model parametrelerinizi doğrudan ayarlar panelinden güvenli bir şekilde yapılandırın, test edin ve kaydedin.
    </td>
  </tr>
</table>

---

## 🖼️ Ekran Görüntüleri

<div align="center">
  <table>
    <tr>
      <td align="center"><strong>Bölünmüş Ekran Çalışma Alanı</strong></td>
      <td align="center"><strong>Yapay Zeka Modelleri &amp; Özel Siteler</strong></td>
    </tr>
    <tr>
      <td><img src="docs/images/workspace-home-overview.png" alt="Bölünmüş Ekran PDF Çalışma Alanı" width="400" style="border-radius: 8px;"></td>
      <td><img src="docs/images/ai-models-and-sites.png" alt="Yapay Zeka Modelleri ve Siteler" width="400" style="border-radius: 8px;"></td>
    </tr>
    <tr>
      <td align="center"><strong>Prompt Kütüphanesi</strong></td>
      <td align="center"><strong>PDF Hızlı İşlemler</strong></td>
    </tr>
    <tr>
      <td><img src="docs/images/prompts-settings-library.png" alt="Prompt Kütüphanesi" width="400" style="border-radius: 8px;"></td>
      <td><img src="docs/images/pdf-chatgpt-quick-actions.png" alt="PDF Hızlı İşlemler" width="400" style="border-radius: 8px;"></td>
    </tr>
    <tr>
      <td align="center"><strong>Taslak İnceleme Penceresi</strong></td>
      <td align="center"><strong>Otomatik Gönderim İş Akışı</strong></td>
    </tr>
    <tr>
      <td><img src="docs/images/auto-send-draft-review.png" alt="Taslak İnceleme" width="400" style="border-radius: 8px;"></td>
      <td><img src="docs/images/auto-send-enabled.png" alt="Otomatik Gönderim" width="400" style="border-radius: 8px;"></td>
    </tr>
  </table>
</div>

---

## 📖 Genel Bakış

**Quizlab Reader**, çok sekmeli bir belge okuma deneyimini ve popüler yapay zeka arayüzlerini şık bir "Glassmorphic" tasarım altında bir araya getiren, açık kaynaklı ve yerel odaklı bir masaüstü çalışma alanıdır. **Akademisyenler, araştırmacılar ve profesyonel öğrenciler** için özel olarak geliştirilmiş olup, sürekli uygulama değiştirme ve sekme kalabalığı sorununu ortadan kaldırır.

---

## 🛠️ Teknoloji Altyapısı

<table>
  <tr>
    <th align="left">Kategori</th>
    <th align="left">Teknoloji</th>
  </tr>
  <tr>
    <td><strong>Masaüstü Çatısı</strong></td>
    <td>
      <a href="https://www.electronjs.org/">Electron 40</a>
      <img src="https://img.shields.io/badge/-47848F?logo=electron&logoColor=white" alt="Electron" style="vertical-align: middle;">
    </td>
  </tr>
  <tr>
    <td><strong>Arayüz Kütüphanesi</strong></td>
    <td>
      <a href="https://react.dev/">React 19</a>
      <img src="https://img.shields.io/badge/-61DAFB?logo=react&logoColor=white" alt="React" style="vertical-align: middle;">
    </td>
  </tr>
  <tr>
    <td><strong>Dil</strong></td>
    <td>
      <a href="https://www.typescriptlang.org/">TypeScript 5.9</a>
      <img src="https://img.shields.io/badge/-3178C6?logo=typescript&logoColor=white" alt="TypeScript" style="vertical-align: middle;">
    </td>
  </tr>
  <tr>
    <td><strong>Paketleyici</strong></td>
    <td><a href="https://vitejs.dev/">Vite 7</a></td>
  </tr>
  <tr>
    <td><strong>PDF İşleme</strong></td>
    <td><a href="https://mozilla.github.io/pdf.js/">pdfjs-dist 3.11</a> + <a href="https://react-pdf-viewer.dev/">@react-pdf-viewer</a></td>
  </tr>
  <tr>
    <td><strong>Durum Yönetimi</strong></td>
    <td><a href="https://zustand-demo.pmnd.rs/">Zustand</a> + <a href="https://tanstack.com/query/latest">TanStack Query</a></td>
  </tr>
  <tr>
    <td><strong>Stil</strong></td>
    <td><a href="https://tailwindcss.com/">Tailwind CSS 3</a> + <a href="https://www.framer.com/motion/">Framer Motion</a></td>
  </tr>
  <tr>
    <td><strong>Yapay Zeka Otomasyonu</strong></td>
    <td><a href="https://playwright.dev/">Playwright</a> (webview oturum yönetimi)</td>
  </tr>
  <tr>
    <td><strong>Test</strong></td>
    <td><a href="https://vitest.dev/">Vitest</a> + <a href="https://testing-library.com/">Testing Library</a></td>
  </tr>
</table>

---

## 📦 Kurulum

### Gereksinimler

| Ölçüt               | Minimum                                 | Önerilen                              |
| :------------------ | :-------------------------------------- | :------------------------------------ |
| **İşletim Sistemi** | Windows 10 / macOS 10.15 / Ubuntu 20.04 | Windows 11 / macOS 13+ / Ubuntu 22.04 |
| **RAM**             | 4 GB                                    | 8 GB+                                 |
| **Depolama**        | 500 MB                                  | 2 GB+                                 |
| **İnternet**        | Yapay zeka özellikleri için             | Yüksek hızlı genişbant                |

### İndirme

Platformunuza uygun en son yükleyiciyi [Sürümler sayfasından](https://github.com/ozymandias-get/quizlab/releases) indirin:

| Platform   | Format                                         |
| :--------- | :--------------------------------------------- |
| 🪟 Windows | `QuizlabReader-Setup-<version>.exe`            |
| 🍏 macOS   | `QuizlabReader-<version>.dmg`                  |
| 🐧 Linux   | `QuizlabReader-<version>.AppImage` veya `.deb` |

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
npm run test         # Vitest (610+ test)

# Derleme
npm run build:win    # Windows yükleyicisi
npm run build:mac    # macOS paketi
npm run build:linux  # Linux paketi
```

---

## 📂 Proje Yapısı

```
quizlab/
├── .github/               # Issue şablonları, CI iş akışları
├── docs/                  # Yol haritaları, mimari dökümanlar, ekran görüntüleri
├── electron/              # Ana süreç (Electron)
│   ├── app/               # Giriş noktaları, IPC işleyicileri, pencere yönetimi
│   ├── core/              # Yapılandırma, güncelleyiciler, sistem araçları
│   ├── features/          # Özellik işleyicileri (AI, Otomasyon, Gemini, PDF, Ekran Gör.)
│   ├── preload/           # Context bridge betikleri
│   └── __tests__/         # Ana süreç testleri
├── installer/             # NSIS Windows yükleyici betiği
├── resources/             # Statik yükleyici varlıkları, uygulama ikonları
├── scripts/               # Geliştirme/derleme otomasyon betikleri
├── shared/                # Süreçler arası sözleşmeler (IPC kanalları, tipler)
│   ├── constants/
│   └── types/
├── src/                   # Arayüz (React + Vite)
│   ├── app/               # Kabuk, sağlayıcılar, global bağlamlar, efektler
│   ├── features/          # Özellik modülleri (AI, PDF, Ayarlar, Ekran Gör., Otomasyon, Eğitim, Tanılama)
│   ├── platform/          # Electron köprü adaptörleri
│   ├── public/            # Statik varlıklar (uygulama ikonu, vb.)
│   ├── shared/            # Paylaşılan UI bileşenleri, hook'lar, i18n, stiller, lib
│   ├── types/             # Global tip bildirimleri
│   └── __tests__/         # Arayüz testleri
├── package.json
└── tsconfig.json
```

---

## 🔒 Güvenlik & Gizlilik

- **Telemetri Yok** &mdash; sıfır veri toplama
- **İzole Arayüz** &mdash; sıkı `contextIsolation: true`, `nodeIntegration: false`
- **Güvenli PDF Protokolü** &mdash; içerik `local-pdf://` akış protokolü üzerinden sunulur
- **Güvenli Oturumlar** &mdash; şifrelenmiş çerezler izole Chromium oturum profillerinde saklanır
- **Minimal Preload** &mdash; yalnızca açık IPC kanalları context bridge üzerinden sunulur

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
