# Quizlab Reader — Yapay zeka destekli PDF okuyucu ve çalışma alanı

<p align="center">
  <img src="resources/icon.png" alt="Quizlab Reader ikonu" width="120" />
</p>

<p align="center">
  <strong>Quizlab Reader, PDF okumayı ChatGPT, Gemini, Claude ve diğer yapay zeka siteleriyle bölünmüş ekranda birleştiren bir masaüstü uygulamasıdır.</strong>
</p>

<p align="center">
  <a href="README.md">English README</a> |
  <a href="https://github.com/ozymandias-get/quizlab/releases">Son Sürüm</a> |
  <a href="CONTRIBUTING.md">Katkı</a> |
  <a href="SECURITY.md">Güvenlik</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fozymandias-get%2Fquizlab%2Fmain%2Fpackage.json&amp;query=%24.version&amp;label=s%C3%BCr%C3%BCm&amp;style=flat-square" alt="Ana daldaki package.json sürümü" />
  <img src="https://img.shields.io/badge/lisans-MIT-green.svg?style=flat-square" alt="MIT Lisansı açık kaynak" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg?style=flat-square" alt="Windows macOS Linux çapraz platform masaüstü uygulaması" />
  <img src="https://img.shields.io/badge/teknoloji-Electron%20%7C%20React%20%7C%20TypeScript-24292f?style=flat-square" alt="Electron React TypeScript ile geliştirildi" />
</p>

## Ekran Görüntüleri

### Bölünmüş Ekran PDF Çalışma Alanı ve Yapay Zeka Ana Ekranı

Bu görünüm, solda PDF okuyucuyu ve sağda yapay zeka ana ekranını aynı anda gösteren ana yerleşimi gösterir.

<p align="center">
  <img src="docs/images/workspace-home-overview.png" alt="Quizlab Reader PDF çalışma alanı ve yapay zeka ana ekranı" width="900" />
</p>

### Yerleşik Yapay Zeka Modelleri ve Özel Siteler

Bu ekran, çalışma alanında hazır yapay zeka modellerinin ve eklenen özel sitelerin listelendiği bölümü gösterir.

<p align="center">
  <img src="docs/images/ai-models-and-sites.png" alt="Quizlab Reader yapay zeka modelleri ve özel siteler ekranı" width="900" />
</p>

### Prompt Kütüphanesi ve Otomasyon Ayarları

Bu ekran, kayıtlı promptları yönetme ve otomatik prompt akışını seçme bölümünü gösterir.

<p align="center">
  <img src="docs/images/prompts-settings-library.png" alt="Quizlab Reader prompt kütüphanesi ve ayarlar ekranı" width="900" />
</p>

### PDF Okuyucu ve ChatGPT Hızlı İşlemleri

Bu görünüm, PDF okuyucuyu, ChatGPT panelini ve belge yanında yer alan hızlı işlem araçlarını birlikte gösterir.

<p align="center">
  <img src="docs/images/pdf-chatgpt-quick-actions.png" alt="Quizlab Reader PDF görünümü, ChatGPT paneli ve hızlı işlemler" width="900" />
</p>

### Yapay Zekaya Gönderim Taslağı İnceleme Penceresi

Bu pencere, seçilen PDF içeriğinin aktif yapay zeka sekmesine gönderilmeden önce gözden geçirildiği alanı gösterir.

<p align="center">
  <img src="docs/images/auto-send-draft-review.png" alt="Quizlab Reader yapay zekaya gönderim taslağı inceleme penceresi" width="900" />
</p>

### Yapay Zekaya Otomatik Gönderim Akışı

Bu görünüm, seçilen içeriğin aktif yapay zeka oturumuna doğrudan gönderildiği otomatik gönderim akışını gösterir.

<p align="center">
  <img src="docs/images/auto-send-enabled.png" alt="Quizlab Reader otomatik gönderim etkin iş akışı" width="900" />
</p>

## Genel Bakış

Quizlab Reader; PDF okuyucuyu gömülü yapay zeka web çalışma alanıyla tek bir Electron uygulamasında birleştiren ücretsiz ve açık kaynaklı bir yazılımdır. Uzun PDF’lerle çalışan öğrenciler ve araştırmacılar için metin alıntıları, ekran görüntüleri ve notları yapay zekaya tek pencereden göndermeyi kolaylaştırır.

Bir PDF uygulaması, tarayıcı sekmeleri ve notlar arasında gidip gelmek yerine temel akışı tek yerde toplarsınız:

- PDF sekmeleri açma ve yönetme
- Seçili metni tek tıkla yapay zekaya gönderme
- Ekran görüntüsü alıp aktif yapay zeka sekmesine iletme
- Yapay zeka oturumlarını ve yerel çalışma verilerini cihazda tutma

## Neden Quizlab Reader

Arayüz genel sohbet odaklı değil; okuma ve araştırma akışları için tasarlanmıştır.

- Yapay zeka destekli PDF okuyucu: belge bağlamından kopmadan okuma ve inceleme
- Prompt kütüphanesi ve otomasyon: yapılandırılmış promptlarla yapay zekaya gönderim
- Bölünmüş ekran masaüstü düzeni: solda PDF, sağda yapay zeka
- Premium Glassmorphism Arayüzü: Yönsel ışıklandırma ve derinlik hissi veren modern tasarım
- Yerel odaklı Electron uygulaması: dosyalar cihazda kalır, AI erişimi kendi hesaplarınızla olur
- Çoklu AI desteği: ChatGPT, Gemini, Claude, Mistral, Perplexity, Grok, DeepSeek ve daha fazlası

## Temel Özellikler

### Bölünmüş Ekran PDF Okuyucu ve AI Çalışma Alanı

- Çoklu PDF sekmesi
- Sürükle bırak ile PDF açma
- Sayfa geçişi, yakınlaştırma, arama ve metin seçme
- Son okuma durumunu hatırlama
- Seçili metni anında AI tarafına gönderme

### Çoklu Platform AI Webview Çalışma Alanı

Yerleşik AI kaydı şu platformları içerir:

- ChatGPT / GPT-4o
- Gemini / Gemini Pro 1.5
- Claude 3 / 3.5
- DeepSeek-V3 / R1
- Mistral / Le Chat
- Perplexity
- Grok (xAI)
- Manus AI
- NotebookLM
- AI Studio
- HuggingChat
- Qwen
- Kimi
- YouTube

Uygulama ayrıca özel AI veya site eklemeyi, gerekirse seçici tabanlı web otomasyonunu da destekler.

### AI Anasayfası ve Sabitlenmiş Sekme Yönetimi

Güncel sürümde özel bir AI anasayfası ve gelişmiş sekme yönetimi bulunur:

- Açık sekmeler, yerleşik AI modelleri ve özel siteler için anasayfa
- Sabitlenen AI sekmelerinin yeniden yüklenmesi
- Gereksiz webview açılışlarını azaltan daha temiz başlangıç
- Izgara tabanlı model sıralama
- Aktif AI sekmesi kalmadığında otomatik anasayfaya dönüş

### Performans ve Mimari (v3.0.7)

Son sürüm, daha yüksek güvenilirlik için önemli dahili yeniden yapılandırmalar içerir:

- **Modüler AI Pipeline'lar**: Metin ve görüntü gönderim mantığı, özel ve test edilebilir pipeline'lara ayrıldı.
- **İyileştirilmiş Hook Yaşam Döngüsü**: Dev boyutlu hooklar, render sürelerini azaltmak için odaklanmış alt hooklara (`useWebviewMethods`, `useWebviewEvents`, `useWebviewCrasher`) bölündü.
- **Atomik Otomasyon**: Otomasyon motoru, daha küçük ve deterministik betik oluşturucular kullanacak şekilde yenilendi.
- **PDF Protokol Optimizasyonu**: Güvenli `local-pdf://` protokolü, daha hızlı belge yükleme ve daha iyi hata kurtarma için geliştirildi.

### Gemini Web Oturum Yönetim Araçları

Uygulama, Google tabanlı yüzeyler için ayrı bir Gemini web oturumu yönetimi sunar.

- Oturum durumu izleme
- Elle kontrol ve yeniden kimlik doğrulama
- Gemini ailesi yüzeyleri için paylaşılan Google oturumu
- Gemini, NotebookLM, AI Studio ve ilgili Google web yüzeyleri için destek

> **⚠️ Önemli: Google Oturumu Bildirimi**
>
> Gemini web oturumu özelliği, Google oturum durumunuzu korumak için **yerel bir Chromium profili** kullanır. Lütfen aşağıdaki bilgilere dikkat edin:
>
> - Uygulama içinde Gemini, NotebookLM, AI Studio ve diğer Google destekli yapay zeka yüzeylerini kullanmak için **Google hesabıyla giriş yapmanız gerekir**.
> - **Oturum verileri cihazınızda yerel olarak saklanır.** Uygulama, kimlik bilgilerinizi veya oturum verilerinizi herhangi bir dış sunucuya **göndermez**.
> - Google'ın güvenlik politikaları, çerez süresinin dolması veya hesap etkinliğine bağlı olarak **oturum süresi dolabilir veya bozulabilir**. Oturum sağlığını doğrulamak için `Ayarlar > Gemini Web > Şimdi Kontrol Et` seçeneğini kullanın.
> - **Google yüzeyleri arasında paylaşılan oturum**: bir Google AI yüzeyine (ör. Gemini) giriş yapmak, oturumu diğer Google yüzeyleriyle (NotebookLM, AI Studio) paylaşır. Çıkış yapmak veya profili sıfırlamak tüm Google yüzeylerini etkiler.
> - **Profil sıfırlama geri alınamaz**: "Profili Sıfırla" seçeneğini kullanmak tüm Google oturum verilerini temizler ve yeni bir giriş gerektirir.
> - Bu proje **Google ile bağlantılı değildir**. Yapay zeka etkileşimleri kendi Google hesabınız üzerinden gerçekleşir ve Google'ın Hizmet Şartları ile Gizlilik Politikasına tabidir.

### Ekran Görüntüsünden AI'ya Gönderim Akışı

- Tam sayfa yakalama
- Kırpılarak alan seçme
- Aktif AI oturumuna hızlı gönderim
- Kopyalanamayan PDF grafik ve şekilleri için kullanım

### Görünüm, Dil Desteği ve Çalışma Deneyimi

- Yönsel ışıklandırma ve 3D derinlik içeren Premium Glassmorphism arayüzü
- Ayarlanabilir alt bar boyutu ve opaklığı
- Panel yer değiştirme desteği (PDF/AI sağ-sol değişimi)
- Zarif taş tonlarıyla zenginleştirilmiş koyu mod (Dark Mode)
- Animasyonlu veya düz arka plan
- Özelleştirilebilir seçim rengi
- Rehberli ilk kullanım turu
- İngilizce ve Türkçe arayüz

## Kurulum

### Sistem gereksinimleri

| Öğe             | Minimum                               | Önerilen                           |
| --------------- | ------------------------------------- | ---------------------------------- |
| İşletim sistemi | Windows 10, macOS 10.15, Ubuntu 20.04 | Windows 11, macOS 13, Ubuntu 22.04 |
| RAM             | 4 GB                                  | 8 GB veya üstü                     |
| Depolama        | 500 MB                                | 2 GB veya üstü                     |
| İnternet        | AI özellikleri için gerekli           | Stabil genişbant                   |

### Hazır sürümü indirme

En güncel yükleyiciyi GitHub releases sayfasından indirebilirsiniz:

[Quizlab Reader Releases](https://github.com/ozymandias-get/quizlab/releases)

Tipik çıktılar:

- Windows: `QuizlabReader-Setup-<version>.exe`
- macOS: `QuizlabReader-<version>.dmg`
- Linux: `QuizlabReader-<version>.AppImage`

### Kaynaktan çalıştırma

> **Windows Kullanıcıları**: Bu depo kaynak ağacında `LF` satır sonu biçimini (line endings) zorunlu kılar. Kodu klonlamadan veya commit atmadan önce, format çakışmalarını önlemek için şu Git ayarını yapmanızı öneririz:
>
> ```bash
> git config --global core.autocrlf input
> ```

```bash
git clone https://github.com/ozymandias-get/quizlab.git
cd quizlab
npm install
npm run dev
```

Üretim derlemesi:

```bash
npm run build
```

Platform paketleri:

```bash
npm run build:win
npm run build:mac
npm run build:linux
```

## Hızlı Başlangıç

### 1. Uygulamayı açın ve PDF yükleyin

- PDF seç butonunu kullanın veya dosyayı pencereye bırakın
- Son okuma bilgisiyle önceki belgeye hızla dönün

### 2. AI çalışma alanını seçin

- Anasayfadan yerleşik bir AI sekmesi açın
- Ya da ayarlardan özel AI veya site ekleyin

### 3. Gerekirse web session araçlarını kullanın

Google AI yüzeyleri kullanıyorsanız Ayarlar > Gemini Web alanından:

- oturum sağlığını kontrol edebilir
- yeniden giriş akışını başlatabilir
- paylaşılan Google web oturumunu yönetebilirsiniz

## Geliştirme

### Temel komutlar

```bash
npm run dev
npm run dev:web
npm run build:backend
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

### Güncel geliştirme notları

- `npm run dev`, Vite renderer ve Electron uygulamasını birlikte başlatır
- Dev scripti, `5173` portunda zaten çalışan Vite geliştirme sunucusunu tekrar kullanabilir
- Güncel dev akışı, mevcut Electron ve Chromium profilini korur; web oturum verilerini otomatik silmez
- GPU hızlandırma bayrakları Electron açılışında etkinleştirilir

## Proje Yapısı

```text
quizlab/
├── .github/               # GitHub iş akışları ve issue şablonları
├── docs/                  # Dokümantasyon, mimari ve yol haritaları
├── electron/              # Electron ana süreç (main process) kaynak kodu
│   ├── __tests__/         # Ana süreç birim ve entegrasyon testleri
│   ├── app/               # Pencere yönetimi, oturumlar ve IPC kaydı
│   ├── core/              # Yapılandırma, güncelleyici ve başlangıç yardımcıları
│   ├── features/          # Alan odaklı ana süreç mantığı
│   │   ├── ai/            # AI kaydı, platform tanımları ve handlerlar
│   │   ├── automation/    # Modüler betik oluşturucular ve DOM yardımcıları
│   │   ├── gemini-web-session/ # Playwright tabanlı Google oturum yönetimi
│   │   ├── pdf/           # Güvenli PDF protokolü ve akış tabanlı handlerlar
│   │   └── screenshot/    # Yerel yakalama ve kırpma handlerları
│   └── preload/           # Context bridge ve güvenli IPC API tanımları
├── resources/             # Statik varlıklar (uygulama ikonları, kaynaklar)
├── scripts/               # Derleme, geliştirme ve bakım betikleri
├── shared/                # Süreçler arası ortak kontratlar
│   ├── constants/         # Ortak sabit tanımları (IPC, depolama vb.)
│   └── types/             # Ortak TypeScript arayüzleri ve tipleri
├── src/                   # React arayüz (renderer) kaynak kodu (Vite)
│   ├── __tests__/         # Arayüz birim ve bileşen testleri
│   ├── app/               # Uygulama kabuğu, ana bileşen ve global providerlar
│   ├── features/          # Alan odaklı UI ve iş mantığı
│   │   ├── ai/            # AI ana sayfası, oturum yönetimi ve webviewlar
│   │   ├── automation/    # Otomasyon hookları ve seçici UI
│   │   ├── pdf/           # PDF görüntüleyici çalışma alanı ve belge akışları
│   │   ├── screenshot/    # Ekran yakalama ve kırpma UI bileşenleri
│   │   ├── settings/      # Ayarlar modalı ve yapılandırma panelleri
│   │   └── tutorial/      # Kullanım kılavuzu ve rehberli turlar
│   ├── platform/          # Platforma özel adaptörler (Electron köprüsü)
│   └── shared/            # Yeniden kullanılabilir UI bileşenleri, hooklar, i18n ve stiller
├── package.json           # Proje bağımlılıkları, meta veriler ve betikler
└── tsconfig.json          # TypeScript yapılandırması
```

## Güvenlik ve Gizlilik

Uygulama tasarım olarak yerel odaklıdır.

- PDF dosyaları yerel olarak ele alınır
- Renderer kodu preload bridge arkasında izole edilir
- Electron IPC ana süreçte doğrulanır
- AI kullanımı gömülü webview’lerde kendi oturumlarınız üzerinden ilerler
- PDF yükleme için rastgele dosya yollarını açmak yerine özel Electron protokolü kullanılır

Güncel güvenlik politikası ve bildirim süreci için [SECURITY.md](SECURITY.md) dosyasına bakın.

## Yapılandırma

Başlıca ayar alanları:

- Promptlar
- Modeller
- Siteler
- Gemini Web
- Seçiciler
- Görünüm
- Dil
- Hakkında

Yerelde saklanan veri örnekleri:

- özel AI kayıtları
- Gemini web session durumu
- son okuma bilgisi
- sabit AI sekmeleri
- yerleşim ve görünüm tercihleri

## Sorun Giderme

### AI sayfası boş açılıyor veya prompt göndermiyor

- Aktif AI sekmesini yenileyin
- Platformun giriş isteyip istemediğini kontrol edin
- Özel sitelerde seçicileri yeniden yapılandırın
- Hedef servisin girdi akışının değişmediğini doğrulayın

### Gemini web session bozuk veya yeniden giriş istiyor

- Ayarlar > Gemini Web ekranını açın
- Elle kontrol çalıştırın
- Google oturumunu yeniden doğrulayın
- Profili sadece temiz bir Google oturumu istiyorsanız sıfırlayın

### `npm run dev` mevcut sunucuyu kullanıyor

`5173` portunda bir Vite geliştirme sunucusu zaten çalışıyorsa bu beklenen davranıştır.

## Katkı

Ürün özellikleri, dokümantasyon, hata düzeltmeleri, testler ve platform iyileştirmeleri için katkılar kabul edilir.

Pull request açmadan önce:

```bash
npm run typecheck
npm run lint
npm run test
```

Detaylar [CONTRIBUTING.md](CONTRIBUTING.md) içindedir.

## Lisans

Quizlab Reader [MIT Lisansı](LICENSE) ile yayınlanır.

---

<p align="center">
  <strong>Anahtar Kelimeler:</strong> yapay zeka PDF okuyucu, çalışma aracı, Electron uygulaması, bölünmüş ekran PDF, Gemini AI, ChatGPT entegrasyonu, açık kaynak çalışma alanı, PDF görüntüleyici, yapay zeka destekli öğrenme, çapraz platform masaüstü uygulaması
</p>
