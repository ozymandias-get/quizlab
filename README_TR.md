# 🧪 QuizLab Reader - Yapay Zeka Destekli PDF Çalışma Aracı & Quiz Oluşturucu

<p align="center">
  <img src="docs/images/app-logo.png" alt="QuizLab Reader Logo" width="120" />
</p>

<p align="center">
  <strong>Tıp Öğrencileri ve Profesyoneller için Nihai Masaüstü Çalışma Arkadaşı</strong><br/>
  <em>PDF ders kitaplarınızı Google Gemini AI ile interaktif quizlere dönüştürün</em>
</p>

<p align="center">
  <a href="README.md">
    <img src="https://img.shields.io/badge/lang-English-blue.svg?style=flat-square" alt="English" />
  </a>
  <img src="https://img.shields.io/badge/versiyon-2.1.9-blue.svg?style=flat-square" alt="Versiyon" />
  <img src="https://img.shields.io/badge/lisans-MIT-green.svg?style=flat-square" alt="Lisans" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/YZ-Gemini%20%7C%20ChatGPT%20%7C%20Claude-4285F4?style=flat-square" alt="YZ Desteği" />
</p>

<p align="center">
  <a href="#-neden-quizlab">Neden QuizLab?</a> •
  <a href="#-temel-özellikler">Özellikler</a> •
  <a href="#-kurulum">Kurulum</a> •
  <a href="#-hızlı-başlangıç">Hızlı Başlangıç</a> •
  <a href="#-teknik-altyapı">Teknik Altyapı</a> •
  <a href="#-mimari">Mimari</a>
</p>

---

## 📖 İçindekiler

- [Genel Bakış](#-genel-bakış)
- [Neden QuizLab?](#-neden-quizlab)
- [Temel Özellikler](#-temel-özellikler)
- [Ekran Görüntüleri](#-ekran-görüntüleri)
- [Kurulum Rehberi](#-kurulum-rehberi)
- [Hızlı Başlangıç](#-hızlı-başlangıç)
- [Kullanım Kılavuzu](#-kullanım-kılavuzu)
- [Teknik Altyapı](#-teknik-altyapı)
- [Mimari Yapı](#-mimari-yapı)
- [Güvenlik](#-güvenlik)
- [Yapılandırma](#-yapılandırma)
- [API Referansı](#-api-referansı)
- [Katkıda Bulunma](#-katkıda-bulunma)
- [Lisans](#-lisans)

---

## 🎯 Genel Bakış

**QuizLab Reader**, özellikle **tıp öğrencileri, sınav adayları ve yaşam boyu öğrenenler** için tasarlanmış açık kaynaklı, yapay zeka destekli bir masaüstü uygulamasıdır. Geleneksel PDF görüntüleyicilerden farklı olarak, QuizLab sağlam bir PDF okuyucuyu gelişmiş yapay zeka yetenekleriyle birleştirerek etkileşimli bir çalışma ortamı oluşturur.

### QuizLab'i Benzersiz Kılan Nedir?

- **Aktif Hatırlama Eğitimi**: Pasif okumayı aktif öğrenmeye dönüştürün
- **Bölünmüş Ekran Çalışma Alanı**: Bir tarafta PDF okuyun, diğer tarafta yapay zeka ile sohbet edin
- **Bağlam Farkında YZ**: Seçili metni doğrudan yapay zekaya açıklama veya quiz oluşturması için gönderin
- **Çok Platformlu YZ Desteği**: Google Gemini, ChatGPT, Claude, DeepSeek ve daha fazlasıyla çalışır
- **Gizlilik Öncelikli**: Tüm veriler yerel kalır; belgeleriniz buluta yüklenmez

### Kimler İçin Uygundur?

- 📚 USMLE, TUS gibi sınavlara hazırlanan tıp öğrencileri
- 🎓 Yoğun okuma materyalleri olan üniversite öğrencileri
- 💼 Sertifikasyon sınavlarına çalışan profesyoneller
- 🧠 Aktif hatırlama ile öğrenmek isteyen herkes
- 📝 PDF'lerden flaş kart oluşturmak isteyenler

---

## 💡 Neden QuizLab?

### Geleneksel Çalışma Yöntemlerinin Sorunları

| Geleneksel Yöntem | Sınırlama | QuizLab Çözümü |
|-------------------|-----------|----------------|
| Pasif okuma | Düşük kalıcılık | Aktif hatırlama quizleri |
| Uygulama değiştirme | Bağlam kaybı | Bölünmüş ekran entegrasyonu |
| Manuel flaş kartlar | Zaman alıcı | YZ otomatik oluşturma |
| Genel YZ sohbeti | PDF bağlamı yok | Bağlam farkında istemler |

### Temel Faydalar

1. **🧠 Kanıta Dayalı Öğrenme**: Aktif hatırlama ve aralıklı tekrar ilkelerini kullanır
2. **⚡ İş Akışı Entegrasyonu**: PDF'nizi terk etmeden çalışın
3. **🎯 Tıp Düzeyinde Sorular**: Tıp kurulu sınavlarına özel ayarlanmış YZ persona
4. **🔒 Gizlilik**: Belgeleriniz bilgisayarınızdan çıkmaz
5. **💰 Ücretsiz ve Açık Kaynak**: Abonelik yok, sınır yok

---

## ✨ Temel Özellikler

### 📖 Akıllı Bölünmüş Ekran Çalışma Alanı

QuizLab'in kalbi bölünmüş ekran tasarımıdır:

- **Sol Panel**: Metin seçimi ile yüksek performanslı PDF görüntüleyici
- **Sağ Panel**: Yapay zeka sohbet arayüzü (Gemini, ChatGPT, Claude, vb.)
- **Merkez Hub**: Ekran görüntüsü ve quiz oluşturma için hızlı erişim araç çubuğu
- **Anlık Bağlam Aktarımı**: PDF'de metin seçin → Tek tıkla yapay zekaya gönderin

**Özellikler:**
- Çoklu sekme PDF desteği
- Sürükle-bırak dosya açma
- Sayfa gezinme ve arama
- Yakınlaştırma ve döndürme kontrolleri
- Metin vurgulama

### 🧠 Gelişmiş Quiz Oluşturucu

Herhangi bir PDF içeriğini interaktif quizlere dönüştürün:

**Soru Türleri:**
- ✅ Çoktan Seçmeli (Klasik)
- ❌ Olumsuz Sorular ("Hangi değildir...")
- 🧩 İfade Tabanlı (Açıklamalı doğru/yanlış)
- 📋 Sıralama Soruları (Adım sıralaması)
- 🔍 Boşluk Doldurma
- 🧠 Klinik Akıl Yürütme (Karmaşık vakalar)
- 🔗 Eşleştirme Soruları

**Özelleştirme Seçenekleri:**
- **Zorluk**: Kolay (Preklinik) | Orta (Staj) | Zor (Uzmanlık)
- **Soru Sayısı**: Oluşturma başına 1-30 soru
- **Stil**: Karışık veya belirli soru türleri
- **Odak Konusu**: Belirli konulara odaklanma
- **Dil**: İngilizce veya Türkçe

**Tıp Kurulu Sınavıcı Personası:**
Yapay zeka, şunları oluşturan kıdemli bir tıp kurulu sınavıcısı gibi davranır:
- Sadece ezber değil, klinik akıl yürütme gerektiren sorular
- Gerçekçi hasta vinyetleri (soruların %70'i)
- Yüksek kaliteli çeldiriciler (mantıklı yanlış cevaplar)
- Neden-sonuç ilişkilerini test eden sorular

### 🤖 Çok Platformlu Yapay Zeka Entegrasyonu

**Yerleşik YZ Platformları:**

| Platform | Tür | Gönderim Modu | Özel Özellikler |
|----------|-----|---------------|-----------------|
| **Google Gemini** | Web + CLI | Karışık | Yerel quiz oluşturma, dosya yükleme |
| **ChatGPT** | Web | Enter Tuşu | En popüler, GPT-4 desteği |
| **Claude** | Web | Enter Tuşu | Uzun bağlam penceresi |
| **DeepSeek** | Web | Enter Tuşu | Kod ve akıl yürütme |
| **Qwen** | Web | Enter Tuşu | Çok dilli |
| **Kimi** | Web | Enter Tuşu | Çinli yapay zeka asistanı |

**Magic Selector Teknolojisi:**
- Evrensel yapay zeka entegrasyon sistemi
- Giriş alanlarını ve gönderme düğmelerini otomatik algılar
- Herhangi bir web tabanlı yapay zeka platformuyla çalışır
- Yapılandırma için 3 adımlı görsel seçici
- Shadow DOM desteği (Gemini, vb.)

### 🎨 Premium Cam Morfizm Arayüz

**Görsel Özelleştirme:**
- **Arka Plan Temaları**: Animasyonlu gradyan veya düz renkler
- **Alt Çubuk**: Ayarlanabilir opaklık (%0-100), ölçek (0.7x-1.3x)
- **Kompakt Mod**: Sadece simge araç çubuğu seçeneği
- **Seçim Renkleri**: Özelleştirilebilir PDF metin vurgusu
- **Rastgele Mod**: Dinamik renk geçişleri

**Animasyon ve Efektler:**
- GPU hızlandırmalı geçişler (Framer Motion)
- Pürüzsüz panel yeniden boyutlandırma
- Arka plan bulanıklığı ile cam panel efektleri
- Giriş ve çıkış animasyonları

### 📸 Yapay Zekaya Ekran Görüntüsü

Herhangi bir içeriği yakalayın ve analiz edin:

- **Tam Sayfa Ekran Görüntüsü**: Tüm PDF sayfasını yapay zekaya gönderin
- **Kırpma Ekran Görüntüsü**: Analiz için belirli alanı seçin
- **Otomatik Yapıştırma**: Ekran görüntüleri otomatik olarak aktif yapay zekaya gönderilir
- **Bağlam Menüsü**: PDF görüntüleyicide sağ tık erişimi

### 🌍 Çok Dilli Destek

**Tamamen Yerelleştirilmiş:**
- 🇺🇸 İngilizce
- 🇹🇷 Türkçe

**Genişletilebilir**: JSON yerel dosyaları aracılığıyla yeni diller kolayca eklenebilir

### 🔒 Gizlilik ve Güvenlik

**Yerel Öncelikli Mimari:**
- ✅ Tüm PDF'ler yerel olarak işlenir
- ✅ Buluta belge yükleme yok
- ✅ Yapay zeka konuşmaları kendi hesaplarınız üzerinden
- ✅ Ayarlar yerel şifreli depolamada
- ✅ Telemetri veya izleme yok

**Güvenlik Özellikleri:**
- Context Bridge izolasyonu (Electron güvenlik en iyi uygulaması)
- PDF yol doğrulama (dizin geçişini önler)
- PDF için sihirli baytlar doğrulama
- İzin listesi tabanlı dosya erişimi

### 🔄 Otomatik Güncelleme Sistemi

- GitHub sürümlerinden otomatik sürüm kontrolü
- Tek tıklamayla güncelleme indirme
- Değişiklik günlüğü ile güncelleme bildirimleri

### 🎓 Etkileşimli Öğretici

- Yeni kullanıcılar için adım adım yerleştirme
- Ekranı karartmadan vurgu tabanlı kılavuzluk
- Ekranı karartmadan özellik keşfi

---

## 📸 Ekran Görüntüleri

<p align="center">
  <img src="docs/images/app-overview.png" alt="QuizLab Ana Arayüz" width="800" />
  <br/>
  <em>Ana Arayüz: PDF + YZ Bölünmüş Ekran</em>
</p>

<p align="center">
  <img src="docs/images/quiz-creation.png" alt="Quiz Yapılandırma" width="800" />
  <br/>
  <em>Quiz Oluşturucu: Çalışma Oturumunuzu Özelleştirin</em>
</p>

<p align="center">
  <img src="docs/images/quiz-gameplay.png" alt="Aktif Quiz Modu" width="800" />
  <br/>
  <em>Etkileşimli Quiz Modu ile Zamanlayıcı</em>
</p>

<p align="center">
  <img src="docs/images/quiz-results.png" alt="Quiz Sonuçları" width="800" />
  <br/>
  <em>Açıklamalar ile Detaylı Sonuçlar</em>
</p>

---

## 📥 Kurulum Rehberi

### Sistem Gereksinimleri

| Gereksinim | Minimum | Önerilen |
|------------|---------|----------|
| **İşletim Sistemi** | Windows 10, macOS 10.15, Ubuntu 20.04 | Windows 11, macOS 13, Ubuntu 22.04 |
| **RAM** | 4 GB | 8 GB+ |
| **Depolama** | 500 MB | 2 GB+ |
| **İnternet** | YZ özellikleri için gerekli | Genişbant |

### Ön Koşullar

1. **Node.js 18+** ve **npm**
2. **Google Hesabı** (Gemini özellikleri için)
3. **Gemini CLI** (quiz oluşturma için):
   ```bash
   npm install -g @google/gemini-cli
   gemini login
   ```

### Derlenmiş İkili Dosyaları İndirme

Platformunuz için en son sürümü indirin:

- 🪟 **Windows**: `QuizlabReader-Setup-2.1.9.exe`
- 🍎 **macOS**: `QuizlabReader-2.1.9.dmg`
- 🐧 **Linux**: `QuizlabReader-2.1.9.AppImage`

[En Son Sürümü İndir](https://github.com/ozymandias-get/quizlab/releases)

### Kaynaktan Derleme

```bash
# Depoyu klonlayın
git clone https://github.com/ozymandias-get/quizlab.git
cd quizlab

# Bağımlılıkları yükleyin
npm install

# Geliştirme modunda çalıştırın
npm run dev

# Üretim için derleyin
npm run build

# Platforma özel yükleyiciler oluşturun
npm run build:win    # Windows yükleyici
npm run build:mac    # macOS .dmg
npm run build:linux  # Linux .AppImage
```

---

## 🚀 Hızlı Başlangıç

### 1. İlk Çalıştırma

1. QuizLab Reader'ı açın
2. Etkileşimli öğreticiyi tamamlayın (isteğe bağlı)
3. Ayarlarda tercih ettiğiniz yapay zeka platformunu yapılandırın

### 2. PDF Açma

- "PDF Seç"e tıklayın veya dosyayı sürükleyip bırakın
- PDF sol panelde açılır
- Son dosyalar hızlı erişim için hatırlanır

### 3. Yapay Zeka Yapılandırma (Tek Seferlik Kurulum)

**Gemini İçin (Quiz Oluşturma):**
1. Ayarlar → Gemini CLI'ye gidin
2. "Giriş Terminalini Aç"a tıklayın
3. Google kimlik doğrulamasını tamamlayın

**Web Yapay Zekası İçin (ChatGPT, Claude, vb.):**
1. Ayarlar → YZ Sitelerine gidin
2. Tercih ettiğiniz platformu seçin
3. Sağ panelde yapay zeka hizmetinde oturum açın

### 4. İlk Quizinizi Oluşturun

1. PDF'nizde metin seçin (bağlam için isteğe bağlı)
2. Merkez hub'daki Quiz düğmesine tıklayın
3. Zorluk ve soru sayısını yapılandırın
4. "Quiz Oluştur"a tıklayın
5. Etkileşimli sorularla çalışın!

### 5. Magic Selector Kullanın (İsteğe Bağlı)

Özel yapay zeka platformları için:
1. Ayarlar → Seçicilere gidin
2. "Magic Selector'ı Yapılandır"a tıklayın
3. Giriş ve gönderme düğmesini seçmek için 3 adımlı görsel kılavuzu izleyin
4. Otomatik yapıştırma artık yapay zekanızla çalışacaktır

---

## 📚 Kullanım Kılavuzu

### Klavye Kısayolları

| Kısayol | İşlem |
|---------|-------|
| `Ctrl/Cmd + O` | PDF aç |
| `Ctrl/Cmd + S` | Tam sayfa ekran görüntüsü |
| `Shift + S` | Kırpma ekran görüntüsü |
| `Ctrl/Cmd + +` | Yakınlaştır |
| `Ctrl/Cmd + -` | Uzaklaştır |
| `Ctrl/Cmd + 0` | Yakınlaştırmayı sıfırla |
| `Esc` | Ekran görüntüsü modunu kapat |

### Quiz Modu İş Akışı

1. **Yapılandırma**: Parametreleri ayarlayın (zorluk, sayı, stil)
2. **Oluşturma**: Yapay zeka PDF'nizi işler (10-30 saniye)
3. **Hazır**: Oluşturulan soruları gözden geçirin
4. **Quiz**: Zamanlayıcı ile soruları yanıtlayın
5. **Sonuçlar**: Puanı görün, açıklamaları gözden geçirin, hataları tekrar deneyin

### Çalışma İpuçları

- **Aktif Hatırlama**: Seçenekleri görmeden önce yanıt vermeye çalışın
- **Aralıklı Tekrar**: "Hataları Tekrar Dene" özelliğini kullanın
- **Derin Öğrenme**: Yanlış cevapların açıklamalarını okuyun
- **Bağlam Değiştirme**: Aynı konu için farklı sorular için "Yeniden Oluştur"

---

## 🛠 Teknik Altyapı

### Temel Teknolojiler

| Kategori | Teknoloji | Amaç |
|----------|-----------|------|
| **Çerçeve** | Electron 40 | Çapraz platform masaüstü |
| **Ön Uç** | React 19 | UI bileşenleri |
| **Dil** | TypeScript 5 | Tip güvenliği |
| **Derleme Aracı** | Vite 7 | Hızlı paketleme |
| **Stil** | TailwindCSS 3 | Utility-first CSS |
| **Animasyonlar** | Framer Motion | GPU hızlandırmalı |
| **Durum** | Zustand 5 | Genel durum |
| **Sunucu Durumu** | TanStack Query | Veri getirme |

### PDF Motoru

- **@react-pdf-viewer**: PDF.js için React sarmalayıcı
- **PDF.js**: Mozilla'nın PDF oluşturma motoru
- **Özel Protokol**: Güvenli `local-pdf://` akışı

### Yapay Zeka Entegrasyonu

- **Gemini CLI**: Resmi Google CLI aracı
- **Playwright**: Başsız tarayıcı otomasyonu
- **Özel Komut Dosyaları**: Shadow DOM geçişi, öğe seçme

### Test

- **Vitest**: Birim testi
- **@testing-library/react**: Bileşen testi
- **jsdom**: Tarayıcı ortamı simülasyonu

---

## 🏗 Mimari Yapı

### Yüksek Seviyeli Mimari

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Ana Süreç                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  PDF Protokolü│  │  Quiz CLI    │  │  YZ Otomasyonu   │  │
│  │  (Güvenlik)   │  │  (Gemini)    │  │  (Magic Selector)│  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Yapılandırma│  │  Güncelleyici│  │  Oturum Yöneticisi│  │
│  │  (JSON)      │  │  (GitHub)    │  │  (Gemini Web)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                    IPC (Context Bridge)
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Electron İşlemci Süreci                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    React Uygulaması                   │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐│  │
│  │  │  PDF     │  │  Alt     │  │  YZ Web Görünümü     ││  │
│  │  │  Paneli  │◄─┤  Hub     │─►│  (Çok platformlu)    ││  │
│  │  └──────────┘  └──────────┘  └──────────────────────┘│  │
│  │  ┌──────────────────────────────────────────────────┐│  │
│  │  │         Quiz Modülü (Durum Makinesi)             ││  │
│  │  │   Yapılandırma → Oluşturma → Quiz → Sonuçlar    ││  │
│  │  └──────────────────────────────────────────────────┘│  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Modül Yapısı

```
quizlab/
├── electron/                    # Ana Süreç
│   ├── app/                     # Giriş noktası, pencere yöneticisi
│   ├── core/                    # Yapılandırma, güncelleyici, yardımcılar
│   ├── features/                # Özellik modülleri
│   │   ├── ai/                  # Yapay zeka platform kayıt defteri
│   │   ├── automation/          # Magic Selector komut dosyaları
│   │   ├── gemini-web-session/  # Oturum yönetimi
│   │   ├── pdf/                 # PDF protokolü ve işleyiciler
│   │   ├── quiz/                # Quiz CLI entegrasyonu
│   │   │   ├── gemini-runner/   # İzole CLI çalıştırıcı
│   │   │   ├── promptBuilder.ts # Tıp istemleri
│   │   │   └── quizCliHandler.ts
│   │   └── screenshot/          # Ekran yakalama
│   └── preload/                 # Context Bridge
│
├── src/                         # İşlemci Süreci
│   ├── app/                     # App.tsx, sağlayıcılar
│   ├── features/                # Özellik tabanlı modüller
│   │   ├── ai/                  # Yapay zeka web görünümü bileşenleri
│   │   ├── pdf/                 # PDF görüntüleyici bileşenleri
│   │   ├── quiz/                # Quiz UI bileşenleri
│   │   │   ├── ui/
│   │   │   │   ├── active/      # Quiz oynanışı
│   │   │   │   ├── config/      # Quiz ayarları
│   │   │   │   └── results/     # Sonuçlar ve gözden geçirme
│   │   │   └── hooks/
│   │   ├── screenshot/          # Ekran görüntüsü aracı
│   │   ├── settings/            # Ayarlar modalı
│   │   └── tutorial/            # Yerleştirme
│   ├── platform/                # Electron köprüsü
│   └── shared/                  # Paylaşılan yardımcı programlar
│
└── shared/                      # Çapraz süreç tipleri
    ├── constants/
    └── types/
```

---

## 🔐 Güvenlik

### Güvenlik En İyi Uygulamaları

1. **Context İzolasyonu**: İşlemci, ön yükleme komut dosyası aracılığıyla Node.js'den izole edilir
2. **IPC Doğrulama**: Tüm IPC mesajları ana süreçte doğrulanır
3. **Yol Geçişi Koruması**: PDF yolları normalize edilir ve doğrulanır
4. **İçerik Güvenliği Politikası**: Web görünümleri için katı CSP
5. **Güvenli Depolama**: Sınırlandırılmış izinlere sahip yapılandırma dosyaları (0o600)

### PDF Güvenliği

```typescript
// Yol doğrulama dizin geçişini önler
function isPathAllowed(pdfPath: string): boolean {
    const normalized = path.normalize(pdfPath);
    if (pdfPath.includes('\0')) return false;  // Null bayt kontrolü
    if (!path.isAbsolute(resolvedPath)) return false;
    return true;
}

// PDF sihirli baytları doğrulama
const buffer = Buffer.alloc(5);
await fileHandle.read(buffer, 0, 5, 0);
if (buffer.toString() !== '%PDF-') return invalid;
```

### Yapay Zeka Güvenliği

- API anahtarları düz metin olarak saklanmaz
- Gemini CLI sistem anahtarlığını kullanır
- Web yapay zekası oturumları bölümler aracılığıyla izole edilir
- Yapay zeka tarafından oluşturulan kodun otomatik yürütülmesi yok

---

## ⚙️ Yapılandırma

### Ayar Kategorileri

| Sekme | Açıklama | Temel Seçenekler |
|-------|----------|------------------|
| **İstemler** | Yapay zeka istem şablonları | Özel sistem istemleri |
| **Modeller** | Yapay zeka platform yönetimi | Platformları etkinleştir/devre dışı bırak |
| **Siteler** | Yapay zeka web sitesi URL'leri | Özel yapay zeka hizmeti URL'leri |
| **Gemini CLI** | CLI yapılandırması | Yol, kimlik doğrulama |
| **Gemini Web** | Web oturumu ayarları | Oturum kalıcılığı |
| **Seçiciler** | Magic Selector yapılandırması | Öğe seçiciler |
| **Görünüm** | Görsel özelleştirme | Renkler, animasyonlar |
| **Dil** | UI dili | İngilizce, Türkçe |
| **Hakkında** | Uygulama bilgisi ve güncellemeler | Sürüm kontrolü |

### Yapılandırma Dosyaları

Tümü kullanıcının uygulama verileri dizininde saklanır:

- `settings.json`: Görünüm, dil, yapay zeka yapılandırmaları
- `quiz-settings.json`: Quiz oluşturma tercihleri
- `ai-configs.json`: Magic Selector yapılandırmaları
- `gemini-web-session.json`: Gemini web oturum durumu
- `pdf-allowlist.json`: İzin verilen PDF dosya yolları

---

## 📡 API Referansı

### IPC Kanalları

```typescript
// PDF İşlemleri
SELECT_PDF: 'select-pdf'
GET_PDF_STREAM_URL: 'get-pdf-stream-url'
PDF_REGISTER_PATH: 'pdf:register-path'

// YZ İşlemleri
GET_AI_REGISTRY: 'get-ai-registry'
SAVE_AI_CONFIG: 'save-ai-config'
GET_AUTOMATION_SCRIPTS: 'get-automation-scripts'
FORCE_PASTE: 'force-paste-in-webview'

// Quiz İşlemleri
GENERATE_QUIZ_CLI: 'generate-quiz-cli'
ASK_AI: 'ask-ai-assistant'
GET_QUIZ_SETTINGS: 'get-quiz-settings'
SAVE_QUIZ_SETTINGS: 'save-quiz-settings'
GET_GEMINI_CLI_PATH: 'get-gemini-cli-path'
OPEN_GEMINI_LOGIN: 'open-gemini-login'
CHECK_GEMINI_AUTH: 'check-gemini-auth'
GEMINI_LOGOUT: 'gemini-logout'

// Gemini Web Oturumu
GEMINI_WEB_STATUS: 'gemini-web-status'
GEMINI_WEB_OPEN_LOGIN: 'gemini-web-open-login'
GEMINI_WEB_CHECK_NOW: 'gemini-web-check-now'
GEMINI_WEB_REAUTH: 'gemini-web-reauth'
GEMINI_WEB_RESET_PROFILE: 'gemini-web-reset-profile'
```

### Pencere API'si

```typescript
// window.electronAPI aracılığıyla erişim
window.electronAPI.selectPdf(options)
window.electronAPI.quiz.generate(params)
window.electronAPI.automation.generateAutoSendScript(config, text)
window.electronAPI.captureScreen(rect)
```

---

## 🤝 Katkıda Bulunma

Katkılarınızı bekliyoruz! Lütfen yönergeler için [CONTRIBUTING.md](CONTRIBUTING.md) dosyasına bakın.

### Geliştirme Kurulumu

```bash
# Çatallayın ve klonlayın
git clone https://github.com/kullanici-adi/quizlab.git
cd quizlab

# Bağımlılıkları yükleyin
npm install

# Testleri çalıştırın
npm test

# Linting çalıştırın
npm run lint

# Geliştirmeyi başlatın
npm run dev
```

### Proje Komut Dosyaları

```bash
npm run dev           # Geliştirme modunu başlat
npm run test          # Test paketini çalıştır
npm run test:coverage # Kapsamla testleri çalıştır
npm run lint          # ESLint çalıştır
npm run typecheck     # TypeScript tip kontrolü
npm run build         # Üretim için derle
npm run build:win     # Windows yükleyici oluştur
npm run build:mac     # macOS DMG oluştur
npm run build:linux   # Linux AppImage oluştur
```

---

## 🐛 Sorun Giderme

### Sık Karşılaşılan Sorunlar

**Quiz Oluşturma Başarısız Oluyor**
- Gemini CLI'nin kurulu olduğundan emin olun: `npm install -g @google/gemini-cli`
- Kimlik doğrulamayı kontrol edin: `gemini login`
- PDF'nin bozuk veya parola korumalı olmadığını doğrulayın

**YZ Web Görünümü Yüklenmiyor**
- İnternet bağlantısını kontrol edin
- Yenilemeyi deneyin (Ctrl+R)
- Ayarlar → Hakkında'da önbelleği temizleyin

**Magic Selector Çalışmıyor**
- Yapay zeka platformunun sohbet sayfasında olduğunuzdan emin olun
- Web görünümünü yeniden yüklemeyi deneyin
- Ayarlarda seçicileri yeniden yapılandırın

**PDF Açılmıyor**
- Dosyanın geçerli bir PDF olduğunu doğrulayın
- Dosyanın 50MB'dan büyük olmadığını kontrol edin
- Pencereye sürükleyip bırakmayı deneyin

### Hata Ayıklama Modu

```bash
# Geliştirme Araçları açıkken çalıştırın
npm run dev

# Konsolda hataları kontrol edin
# Geliştirme Araçları'nda ağ isteklerini görüntüleyin
```

---

## 🗺 Yol Haritası

### Gelecek Özellikler

- [ ] **Flaş Kart Modu**: Anki tarzı aralıklı tekrar
- [ ] **Not Alma**: Yerleşik PDF açıklama
- [ ] **Bulut Senkronizasyonu**: İsteğe bağlı şifreli yedekleme
- [ ] **Mobil Yardımcı**: iOS/Android görüntüleyici uygulaması
- [ ] **İşbirlikçi Çalışma**: Quizleri arkadaşlarla paylaşma
- [ ] **Eklenti Sistemi**: Üçüncü taraf uzantılar
- [ ] **OCR Desteği**: Taranmış PDF metin tanıma
- [ ] **Sesli Giriş**: Yapay zeka sohbeti için konuşmadan metne

---

## 📄 Lisans

Bu proje **MIT Lisansı** altında lisanslanmıştır - detaylar için [LICENSE](LICENSE) dosyasına bakın.

---

## 🙏 Teşekkürler

- **Google Gemini Ekibi**: Güçlü yapay zeka API'si için
- **Electron Ekibi**: Çapraz platform çerçevesi için
- **React PDF Viewer**: Mükemmel PDF bileşeni için
- **Framer Motion**: Pürüzsüz animasyonlar için
- **Tüm Katkıda Bulunanlar**: Bu projeyi daha iyi hale getiren herkes

---

## 📞 İletişim ve Destek

- 🐛 **Hata Raporları**: [GitHub Issues](https://github.com/ozymandias-get/quizlab/issues)
- 💡 **Özellik İstekleri**: [GitHub Discussions](https://github.com/ozymandias-get/quizlab/discussions)
- 📧 **E-posta**: ozymandias-get@proton.me

---

<p align="center">
  <strong>Her yerdeki öğrenenler için sevgiyle yapıldı</strong>
</p>

<p align="center">
  <a href="#-quizlab-reader---yapay-zeka-destekli-pdf-çalışma-aracı--quiz-oluşturucu">Başa Dön</a>
</p>
