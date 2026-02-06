# 🧪 QuizLab Reader

<!-- markdownlint-disable MD033 -->
<div align="center">

[![English](https://img.shields.io/badge/lang-English-blue.svg?style=flat-square)](README.md)
[![Sürüm](https://img.shields.io/badge/sürüm-1.1.0-blue.svg?style=flat-square)](https://github.com/ozymandias-get/quizlab/releases)
[![Lisans](https://img.shields.io/badge/lisans-MIT-green.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg?style=flat-square)](https://electronjs.org/)

**Masaüstü Çalışma Kokpiti**  
*PDF Okuyun, Yapay Zeka ile Sohbet Edin ve Tek Bir Akışta Quizler Oluşturun.*

[Özellikler](#-ana-özellikler) • [Kurulum](#-hızlı-başlangıç) • [Yapı](#-proje-yapısı) • [Teknoloji](#-teknoloji-yığını)

</div>
<!-- markdownlint-enable MD033 -->

---

## 🚀 Genel Bakış

**QuizLab Reader**, güçlü bir **PDF Okuyucu**, bağlam farkındalığına sahip **Yapay Zeka Asistanı** ve etkili bir **Quiz Oluşturucu**yu tek bir masaüstü uygulamasında birleştirerek çalışma deneyiminizi yeniden tanımlar.

Sekmeler arasında kaybolmaya son. Ders kitabınızdaki metni seçin, anında yapay zeka ile netleştirin ve notlarınızı bilginizi sınamak için yapılandırılmış testlere dönüştürün—hem de uygulamadan hiç çıkmadan.

![Uygulama Genel Görünüm](docs/images/app-overview.png)

## ✨ Ana Özellikler

### 📚 AI + PDF Bölünmüş Çalışma Alanı

Solda okuyun, sağda anlayın. Hızlı bağlam aktarımı ile seçtiğiniz metni anında yapay zekaya gönderebilirsiniz.

### 🧠 Quiz Motoru (Gemini CLI)

Pasif okumayı aktif öğrenmeye dönüştürün.

- **Dinamik Üretim:** Notlarınızdan veya PDF içeriğinden quizler oluşturun.
- **Özelleştirilebilir:** Zorluk seviyesini, soru sayısını ve odak konularını ayarlayın.
- **İnteraktif:** Quizleri çözün ve sonuçlarınızı takip edin.

![Quiz Ayarlari](docs/images/quiz-creation.png)
![Quiz Modu](docs/images/quiz-gameplay.png)
![Quiz Sonuclari](docs/images/quiz-results.png)

### 🪄 Magic Selector (Sihirli Seçici)

*Herhangi* bir web tabanlı yapay zekayı (ChatGPT, Claude, Gemini vb.) API anahtarı olmadan entegre edin. Uygulamaya giriş kutusunu bir kez öğretin, sonrasında içeriği otomatik yapıştırmaya hazırsınız.

### 📂 Yerel Kütüphane & Notlar

Verileriniz size aittir. Dosyaları düzenleyin, klasörleri yönetin ve zengin metin notlarınızı özel veritabanı yönetimi ile yerel olarak saklayın.

---

## 🛠 Teknoloji Yığını

Performans odaklı, modern bir mimari ile geliştirildi:

| Kategori | Teknoloji |
| :--- | :--- |
| **Çekirdek** | ![Electron](https://img.shields.io/badge/Electron-40-2F3241?style=flat-square&logo=electron) ![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react) |
| **Dil** | ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript) |
| **Stil** | ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3-06B6D4?style=flat-square&logo=tailwindcss) |
| **Derleme** | ![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite) ![Electron Builder](https://img.shields.io/badge/Electron_Builder-gray?style=flat-square) |
| **Veri** | ![SQLite](https://img.shields.io/badge/SQLite-Better--SQLite3-003B57?style=flat-square&logo=sqlite) |
| **PDF** | React PDF Viewer + PDF.js |

---

## ⚡ Hızlı Başlangıç

### Gereksinimler

- **Node.js 18+**
- **npm**
- **Google Hesabı** (Sadece Gemini CLI quiz oluşturma özellikleri için gereklidir)

### Kurulum

```bash
# Depoyu klonlayın
git clone https://github.com/ozymandias-get/quizlab.git
cd quizlab

# Bağımlılıkları yükleyin
npm install

# Geliştirme modunda çalıştırın
npm run dev
```

### Derleme Komutları

```bash
npm run typecheck    # TypeScript türlerini kontrol et
npm run build        # Mevcut işletim sistemi için derle
npm run build:win    # Windows için derle
npm run build:mac    # macOS için derle
npm run build:linux  # Linux için derle
```

---

## 🏗 Proje Yapısı

QuizLab, ölçeklenebilir **Özellik Tabanlı (Feature-Based) Mimari** izler. Kod, teknik katmanlar (controller, view vb.) yerine etki alanına (özellik) göre düzenlenmiştir, bu da gezinmeyi ve bakımı kolaylaştırır.

```text
quizlab/
├── electron/                 # Ana Süreç (Backend)
│   ├── core/
│   │   ├── database/         # SQLite şeması & migrasyonları
│   │   ├── ConfigManager.ts
│   │   ├── DatabaseManager.ts
│   │   └── updater.ts
│   ├── features/             # Özelliğe özgü Main işleyicileri
│   │   ├── ai/
│   │   ├── automation/
│   │   ├── library/
│   │   ├── pdf/
│   │   ├── quiz/
│   │   └── screenshot/
│   ├── main/                 # Giriş noktası & pencere yönetimi
│   │   ├── index.ts
│   │   ├── ipcHandlers.ts
│   │   └── windowManager.ts
│   └── preload/              # Context Bridge (Güvenlik)
│       └── index.ts
├── shared/                   # Main & Renderer arasında paylaşılan kod
│   ├── constants/
│   └── types/
├── src/                      # Renderer Süreci (Frontend / React)
│   ├── api/
│   ├── app/                  # Uygulama sağlayıcıları & giriş
│   ├── components/           # Paylaşılan UI bileşenleri
│   │   ├── layout/
│   │   └── ui/
│   ├── features/             # Özelliğe özgü UI uygulamaları
│   │   ├── ai/
│   │   ├── automation/
│   │   ├── library/
│   │   ├── pdf/
│   │   ├── quiz/
│   │   ├── screenshot/
│   │   ├── settings/
│   │   └── tutorial/
│   ├── hooks/                # Global React hook'ları
│   ├── styles/               # Global stiller & Tailwind
│   ├── types/                # Frontend'e özgü tipler
│   └── utils/                # Yardımcı fonksiyonlar
├── resources/                # Statik varlıklar (ikonlar vb.)
├── package.json
└── vite.config.mts
```

### Path Aliasları

- `@src/*` ➡️ `src/*`
- `@electron/*` ➡️ `electron/*`
- `@shared/*` ➡️ `shared/*`
- `@ui/*` ➡️ `src/components/ui/*`
- `@features/*` ➡️ `src/features/*`

---

## 🔒 Güvenlik ve Gizlilik

- **Yerel-Öncelikli:** Zorunlu bulut backend yok. Dosyalarınız cihazınızda kalır.
- **Açık Kaynak:** Tamamen denetlenebilir kod tabanı.
- **Doğrudan Kimlik Doğrulama:** AI etkileşimleri doğrudan kendi sağlayıcı oturumlarınız üzerinden gerçekleşir.

## 📄 Lisans

MIT Lisansı altında dağıtılmaktadır. Daha fazla bilgi için [LICENSE](LICENSE) dosyasına bakın.
