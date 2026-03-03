# QuizLab Reader - Yapay Zeka Destekli PDF Calisma Araci ve Quiz Olusturucu

<p align="center">
  <img src="docs/images/app-logo.png" alt="QuizLab Reader Logo" width="120" />
</p>

<p align="center">
  <strong>Tip Ogrencileri ve Profesyoneller icin Masaustu Calisma Arkadasi</strong><br/>
  <em>PDF ders kitaplarinizi Google Gemini AI ile interaktif quizlere donusturun</em>
</p>

<p align="center">
  <a href="README.md">
    <img src="https://img.shields.io/badge/lang-English-blue.svg?style=flat-square" alt="English" />
  </a>
  <img src="https://img.shields.io/badge/versiyon-2.1.8-blue.svg?style=flat-square" alt="Versiyon" />
  <img src="https://img.shields.io/badge/lisans-MIT-green.svg?style=flat-square" alt="Lisans" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/YZ-Gemini%20%7C%20ChatGPT%20%7C%20Claude-4285F4?style=flat-square" alt="YZ Destegi" />
</p>

<p align="center">
  <a href="#-neden-quizlab">Neden QuizLab?</a> •
  <a href="#-temel-ozellikler">Ozellikler</a> •
  <a href="#-kurulum">Kurulum</a> •
  <a href="#-hizli-baslangic">Hizli Baslangic</a> •
  <a href="#-teknik-altyapi">Teknik Altyapi</a> •
  <a href="#-mimari">Mimari</a>
</p>

---

## icerikler

- [Genel Bakis](#-genel-bakis)
- [Neden QuizLab?](#-neden-quizlab)
- [Temel Ozellikler](#-temel-ozellikler)
- [Ekran Goruntuleri](#-ekran-goruntuleri)
- [Kurulum Rehberi](#-kurulum-rehberi)
- [Hizli Baslangic](#-hizli-baslangic)
- [Kullanim Kilavuzu](#-kullanim-kilavuzu)
- [Teknik Altyapi](#-teknik-altyapi)
- [Mimari Yapi](#-mimari-yapi)
- [Guvenlik](#-guvenlik)
- [Yapilandirma](#-yapilandirma)
- [API Referansi](#-api-referansi)
- [Katkida Bulunma](#-katkida-bulunma)
- [Lisans](#-lisans)

---

## Genel Bakis

**QuizLab Reader**, ozellikle **tip ogrencileri, sinav adaylari ve yasam boyu ogrenenler** icin tasarlanmis acik kaynakli, yapay zeka destekli bir masaustu uygulamasidir. Geleneksel PDF goruntuleyicilerden farkli olarak, QuizLab saglam bir PDF okuyucuyu gelismis yapay zeka yetenekleriyle birlestirerek etkilesimli bir calisma ortami olusturur.

### QuizLab'i Benzersiz Kilan Nedir?

- **Aktif Hatirlama Egitimi**: Pasif okumayi aktif ogrenmeye donusturun
- **Bolunmus Ekran Calisma Alani**: Bir tarafta PDF okuyun, diger tarafta yapay zeka ile sohbet edin
- **Baglam Farkinda YZ**: Secili metni dogrudan yapay zekaya aciklama veya quiz olusturmasi icin gonderin
- **Cok Platformlu YZ Destegi**: Google Gemini, ChatGPT, Claude ve daha fazlasiyla calisir
- **Gizlilik Oncelikli**: Tum veriler yerel kalir; belgeleriniz buluta yuklenmez

### Kimler icin Uygundur?

- USMLE, TUS gibi sinavlara hazirlanan tip ogrencileri
- Yogun okuma materyalleri olan universite ogrencileri
- Sertifikasyon sinavlarina calisan profesyoneller
- Aktif hatirlama ile ogrenmek isteyen herkes
- PDF'lerden flas kart olusturmak isteyenler

---

## Neden QuizLab?

### Geleneksel Calisma Yontemlerinin Sorunlari

| Geleneksel Yontem | Sinirlama | QuizLab Cozumu |
|-------------------|-----------|----------------|
| Pasif okuma | Dusuk kalicilik | Aktif hatirlama quizleri |
| Uygulama degistirme | Baglam kaybi | Bolunmus ekran entegrasyonu |
| Manuel flas kartlar | Zaman alici | YZ otomatik olusturma |
| Genel YZ sohbeti | PDF baglami yok | Baglam farkinda istemler |

### Temel Faydalar

1. **Kaniata Dayali Ogrenme**: Aktif hatirlama ve aralikli tekrar ilkelerini kullanir
2. **Is Akisi Entegrasyonu**: PDF'nizi terk etmeden calisin
3. **Tip Duzeyinde Sorular**: Tip kurulu sinavlarina ozel ayarlanmis YZ persona
4. **Gizlilik**: Belgeleriniz bilgisayarinizdan cikmaz
5. **Ucretsiz ve Acik Kaynak**: Abonelik yok, sinir yok

---

## Temel Ozellikler

### Akilli Bolunmus Ekran Calisma Alani

QuizLab'in kalbi bolunmus ekran tasarimidir:

- **Sol Panel**: Metin secimi ile yuksek performansli PDF goruntuleyici
- **Sag Panel**: Yapay zeka sohbet arayuzu (Gemini, ChatGPT, Claude, vb.)
- **Merkez Hub**: Ekran goruntusu ve quiz olusturma icin hizli erisim arac cubugu
- **Anlik Baglam Aktarimi**: PDF'de metin secin → Tek tikla yapay zekaya gonderin

**Ozellikler:**
- Coklu sekme PDF destegi
- Surukle-birak dosya acma
- Sayfa gezinme ve arama
- Yakinlastirma ve dondurma kontrolleri
- Metin vurgulama

### Gelismis Quiz Olusturucu

Herhangi bir PDF icerigini interaktif quizlere donusturun:

**Soru Turleri:**
- Coktan Secmeli (Klasik)
- Olumsuz Sorular ("Hangi degildir...")
- Ifade Tabanli (Aciklamali dogru/yanlis)
- Siralama Sorulari (Adim siralamasi)
- Bosluk Doldurma
- Klinik Akil Yurutme (Karmasik vakalar)
- Eslestirme Sorulari

**Ozellestirme Secenekleri:**
- **Zorluk**: Kolay (Preklinik) | Orta (Staj) | Zor (Uzmanlik)
- **Soru Sayisi**: Olusturma basina 1-30 soru
- **Stil**: Karisik veya belirli soru turleri
- **Odak Konusu**: Belirli konulara odaklanma
- **Dil**: Ingilizce veya Turkce

**Tip Kurulu Sinavci Personasi:**
Yapay zeka, sunlari olusturan kidemli bir tip kurulu sinavcisi gibi davranir:
- Sadece ezber degil, klinik akil yurutme gerektiren sorular
- Gercekci hasta vinyetleri (%70 soru)
- Yuksek kaliteli celdiriciler (mantikli yanlis cevaplar)
- Neden-sonuc iliskilerini test eden sorular

### Cok Platformlu Yapay Zeka Entegrasyonu

**Yerlesik YZ Platformlari:**

| Platform | Tur | Gonderim Modu | Ozel Ozellikler |
|----------|-----|---------------|-----------------|
| **Google Gemini** | Web + CLI | Karisik | Yerel quiz olusturma, dosya yukleme |
| **ChatGPT** | Web | Enter Tusl | En populer, GPT-4 destegi |
| **Claude** | Web | Enter Tusl | Uzun baglam penceresi |
| **DeepSeek** | Web | Enter Tusl | Kod ve akil yurutme |
| **Qwen** | Web | Enter Tusl | Cok dilli |
| **Kimi** | Web | Enter Tusl | Cinli yapay zeka asistani |

**Magic Selector Teknolojisi:**
- Evrensel yapay zeka entegrasyon sistemi
- Giris alanlarini ve gonderme dugmelerini otomatik algilar
- Herhangi bir web tabanli yapay zeka platformuyla calisir
- Yapilandirma icin 3 adimli gorsel secici
- Shadow DOM destegi (Gemini, vb.)

### Premium Cam Morfizm Arayuz

**Gorsel Ozellestirme:**
- **Arka Plan Temalari**: Animasyonlu gradyan veya duz renkler
- **Alt Cubuk**: Ayarlanabilir opaklik (%0-100), olcek (0.7x-1.3x)
- **Kompakt Mod**: Sadece simge arac cubugu secenegi
- **Secim Renkleri**: Ozellestirilebilir PDF metin vurgusu
- **Rastgele Mod**: Dinamik renk gecisleri

**Animasyon ve Efektler:**
- GPU hizlandirmali gecisler (Framer Motion)
- Puruzsuz panel yeniden boyutlandirma
- Arka plan bulanikligi ile cam panel efektleri
- Giris ve cikis animasyonlari

### Yapay Zekaya Ekran Goruntusu

Herhangi bir icerigi yakalayin ve analiz edin:

- **Tam Sayfa Ekran Goruntusu**: Tum PDF sayfasini yapay zekaya gonderin
- **Kirpma Ekran Goruntusu**: Analiz icin belirli alani secin
- **Otomatik Yapistirma**: Ekran goruntuleri otomatik olarak aktif yapay zekaya gonderilir
- **Baglam Menusu**: PDF goruntuleyicinde sag tik erisimi

### Cok Dilli Destek

**Tamamen Yerellestirilmis:**
- Ingilizce
- Turkce

**Genisletilebilir**: JSON yerel dosyalari araciligiyla yeni diller kolayca eklenebilir

### Gizlilik ve Guvenlik

**Yerel Oncelikli Mimari:**
- Tum PDF'ler yerel olarak islenir
- Buluta belge yukleme yok
- Yapay zeka konusmalari kendi hesaplariniz uzerinden
- Ayarlar yerel sifrelenmis depolamada
- Telemetri veya izleme yok

**Guvenlik Ozellikleri:**
- Context Bridge izolasyonu (Electron guvenlik en iyi uygulamasi)
- PDF yol dogrulama (dizin gecisini onler)
- PDF icin sihirli baytlar dogrulama
- Izin listesi tabanli dosya erisimi

### Otomatik Guncelleme Sistemi

- GitHub surumlerinden otomatik surum kontrolu
- Tek tiklamayla guncelleme indirme
- Degisiklik gunlugu ile guncelleme bildirimleri

### Etkilesimli Ogretici

- Yeni kullanicilar icin adim adim yerlestirme
- Ekrani karartmadan vurgu tabanli kilavuzluk
- Ozellik kesfi

---

## Ekran Goruntuleri

<p align="center">
  <img src="docs/images/app-overview.png" alt="QuizLab Ana Arayuz" width="800" />
  <br/>
  <em>Ana Arayuz: PDF + YZ Bolunmus Ekran</em>
</p>

<p align="center">
  <img src="docs/images/quiz-creation.png" alt="Quiz Yapilandirma" width="800" />
  <br/>
  <em>Quiz Olusturucu: Calisma Oturumunuzu Ozellestirin</em>
</p>

<p align="center">
  <img src="docs/images/quiz-gameplay.png" alt="Aktif Quiz Modu" width="800" />
  <br/>
  <em>Etkilesimli Quiz Modu ile Zamanlayici</em>
</p>

<p align="center">
  <img src="docs/images/quiz-results.png" alt="Quiz Sonuclari" width="800" />
  <br/>
  <em>Aciklamalar ile Detayli Sonuclar</em>
</p>

---

## Kurulum Rehberi

### Sistem Gereksinimleri

| Gereksinim | Minimum | Onerilen |
|------------|---------|----------|
| **Isletim Sistemi** | Windows 10, macOS 10.15, Ubuntu 20.04 | Windows 11, macOS 13, Ubuntu 22.04 |
| **RAM** | 4 GB | 8 GB+ |
| **Depolama** | 500 MB | 2 GB+ |
| **Internet** | YZ ozellikleri icin gerekli | Genisband |

### On Kosullar

1. **Node.js 18+** ve **npm**
2. **Google Hesabi** (Gemini ozellikleri icin)
3. **Gemini CLI** (quiz olusturma icin):
   ```bash
   npm install -g @google/gemini-cli
   gemini login
   ```

### Derlenmis Ikili Dosyalari Indirme

Platformunuz icin en son surumu indirin:

- **Windows**: `QuizlabReader-Setup-2.1.8.exe`
- **macOS**: `QuizlabReader-2.1.8.dmg`
- **Linux**: `QuizlabReader-2.1.8.AppImage`

[En Son Surumu Indir](https://github.com/ozymandias-get/quizlab/releases)

### Kaynaktan Derleme

```bash
# Depoyu klonlayin
git clone https://github.com/ozymandias-get/quizlab.git
cd quizlab

# Bagimliliklari yukleyin
npm install

# Gelistirme modunda calistirin
npm run dev

# Uretim icin derleyin
npm run build

# Platforma ozel yukleyiciler olusturun
npm run build:win    # Windows yukleyici
npm run build:mac    # macOS .dmg
npm run build:linux  # Linux .AppImage
```

---

## Hizli Baslangic

### 1. Ilk Calistirma

1. QuizLab Reader'i acin
2. Etkilesimli ogreticiyi tamamlayin (istege bagli)
3. Ayarlarda tercih ettiginiz yapay zeka platformunu yapilandirin

### 2. PDF Acma

- "PDF Sec"e tiklayin veya dosyayi surukleyip birakin
- PDF sol panelde acilir
- Son dosyalar hizli erisim icin hatirlanir

### 3. Yapay Zeka Yapilandirma (Tek Seferlik Kurulum)

**Gemini Icin (Quiz Olusturma):**
1. Ayarlar → Gemini CLI'ye gidin
2. "Giris Terminalini Ac"a tiklayin
3. Google kimlik dogrulamasini tamamlayin

**Web Yapay Zekasi Icin (ChatGPT, Claude, vb.):**
1. Ayarlar → YZ Sitelerine gidin
2. Tercih ettiginiz platformu secin
3. Sag panelde yapay zeka hizmetinde oturum acin

### 4. Ilk Quizinizi Olusturun

1. PDF'nizde metin secin (baglam icin istege bagli)
2. Merkez hub'daki Quiz dugmesine tiklayin
3. Zorluk ve soru sayisini yapilandirin
4. "Quiz Olustur"a tiklayin
5. Etkilesimli sorularla calisin!

### 5. Magic Selector Kullanin (Istege Bagli)

Ozel yapay zeka platformlari icin:
1. Ayarlar → Secicilere gidin
2. "Magic Selector'i Yapilandir"a tiklayin
3. Giris ve gonderme dugmesini secmek icin 3 adimli gorsel kilavuzu izleyin
4. Otomatik yapistirma simdi yapay zekanizla calisacaktir

---

## Kullanim Kilavuzu

### Klavye Kisayollari

| Kisayol | Islem |
|---------|-------|
| `Ctrl/Cmd + O` | PDF ac |
| `Ctrl/Cmd + S` | Tam sayfa ekran goruntusu |
| `Shift + S` | Kirpma ekran goruntusu |
| `Ctrl/Cmd + +` | Yakinlastir |
| `Ctrl/Cmd + -` | Uzaklastir |
| `Ctrl/Cmd + 0` | Yakinlastirmayi sifirla |
| `Esc` | Ekran goruntusu modunu kapat |

### Quiz Modu Is Akisi

1. **Yapilandirma**: Parametreleri ayarlayin (zorluk, sayi, stil)
2. **Olusturma**: Yapay zeka PDF'nizi isler (10-30 saniye)
3. **Hazir**: Olusturulan sorulari gozden gecirin
4. **Quiz**: Zamanlayici ile sorulari yanitlayin
5. **Sonuclar**: Puani gorun, aciklamalari gozden gecirin, hatalari tekrar deneyin

### Calisma Ipuclari

- **Aktif Hatirlama**: Secenekleri gormeden once yanit vermeye calisin
- **Aralikli Tekrar**: "Hatalari Tekrar Dene" ozelligini kullanin
- **Derin Ogrenme**: Yanlis cevaplarin aciklamalarini okuyun
- **Baglam Degistirme**: Ayni konu icin farkli sorular icin "Yeniden Olustur"

---

## Teknik Altyapi

### Temel Teknolojiler

| Kategori | Teknoloji | Amaç |
|----------|-----------|------|
| **Cerceve** | Electron 40 | Capraz platform masaustu |
| **On Uc** | React 19 | UI bilesenleri |
| **Dil** | TypeScript 5 | Tip guvenligi |
| **Derleme Araci** | Vite 7 | Hizli paketleme |
| **Stil** | TailwindCSS 3 | Utility-first CSS |
| **Animasyonlar** | Framer Motion | GPU hizlandirmali |
| **Durum** | Zustand 5 | Genel durum |
| **Sunucu Durumu** | TanStack Query | Veri getirme |

### PDF Motoru

- **@react-pdf-viewer**: PDF.js icin React sarmalayici
- **PDF.js**: Mozilla'nin PDF olusturma motoru
- **Ozel Protokol**: Guvenli `local-pdf://` akisi

### Yapay Zeka Entegrasyonu

- **Gemini CLI**: Resmi Google CLI araci
- **Playwright**: Bassiz tarayici otomasyonu
- **Ozel Komut Dosyalari**: Shadow DOM gecisi, oge secme

### Test

- **Vitest**: Birim testi
- **@testing-library/react**: Bilesen testi
- **jsdom**: Tarayici ortami simulasyonu

---

## Mimari Yapi

### Yuksek Seviyeli Mimari

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Ana Surec                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  PDF Protokolu│  │  Quiz CLI    │  │  YZ Otomasyonu   │  │
│  │  (Guvenlik)   │  │  (Gemini)    │  │  (Magic Selector)│  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Yapilandirma│  │  Guncelleyici│  │  Oturum Yoneticisi│  │
│  │  (JSON)      │  │  (GitHub)    │  │  (Gemini Web)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                    IPC (Context Bridge)
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Electron Islemli Surec                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    React Uygulamasi                   │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐│  │
│  │  │  PDF     │  │  Alt     │  │  YZ Web Gorunumu     ││  │
│  │  │  Paneli  │◄─┤  Hub     │─►│  (Cok platformlu)    ││  │
│  │  └──────────┘  └──────────┘  └──────────────────────┘│  │
│  │  ┌──────────────────────────────────────────────────┐│  │
│  │  │         Quiz Modulu (Durum Makinesi)             ││  │
│  │  │   Yapilandirma → Olusturma → Quiz → Sonuclar    ││  │
│  │  └──────────────────────────────────────────────────┘│  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Modul Yapisi

```
quizlab/
├── electron/                    # Ana Surec
│   ├── app/                     # Giris noktasi, pencere yoneticisi
│   ├── core/                    # Yapilandirma, guncelleyici, yardimcilar
│   ├── features/                # Ozellik modulleri
│   │   ├── ai/                  # Yapay zeka platform kayit defteri
│   │   ├── automation/          # Magic Selector komut dosyalari
│   │   ├── gemini-web-session/  # Oturum yonetimi
│   │   ├── pdf/                 # PDF protokolu ve isleyiciler
│   │   ├── quiz/                # Quiz CLI entegrasyonu
│   │   │   ├── gemini-runner/   # Izole CLI calistirici
│   │   │   ├── promptBuilder.ts # Tipi istemler
│   │   │   └── quizCliHandler.ts
│   │   └── screenshot/          # Ekran yakalama
│   └── preload/                 # Context Bridge
│
├── src/                         # Islemli Surec
│   ├── app/                     # App.tsx, saglayicilar
│   ├── features/                # Ozellik tabanli moduller
│   │   ├── ai/                  # Yapay zeka web gorunumu bilesenleri
│   │   ├── pdf/                 # PDF goruntuleyici bilesenleri
│   │   ├── quiz/                # Quiz UI bilesenleri
│   │   │   ├── ui/
│   │   │   │   ├── active/      # Quiz oynanisi
│   │   │   │   ├── config/      # Quiz ayarlari
│   │   │   │   └── results/     # Sonuclar ve gozden gecirme
│   │   │   └── hooks/
│   │   ├── screenshot/          # Ekran goruntusu araci
│   │   ├── settings/            # Ayarlar modalı
│   │   └── tutorial/            # Yerlestirme
│   ├── platform/                # Electron koprusu
│   └── shared/                  # Paylasilan yardimci programlar
│
└── shared/                      # Capraz surec tipleri
    ├── constants/
    └── types/
```

---

## Guvenlik

### Guvenlik En Iyi Uygulamalari

1. **Context Izolasyonu**: Islemli, onyukleme komut dosyasi araciligiyla Node.js'den izole edilir
2. **IPC Dogrulama**: Tum IPC mesajlari ana surecte dogrulanir
3. **Yol Gecisi Korumasi**: PDF yollari normalize edilir ve dogrulanir
4. **Icerik Guvenligi Politikasi**: Web gorunumleri icin katı CSP
5. **Guvenli Depolama**: Sinarlandirilmis izinlere sahip yapilandirma dosyalari (0o600)

### PDF Guvenligi

```typescript
// Yol dogrulama dizin gecisini onler
function isPathAllowed(pdfPath: string): boolean {
    const normalized = path.normalize(pdfPath);
    if (pdfPath.includes('\0')) return false;  // Null bayt kontrolu
    if (!path.isAbsolute(resolvedPath)) return false;
    return true;
}

// PDF sihirli baytlari dogrulama
const buffer = Buffer.alloc(5);
await fileHandle.read(buffer, 0, 5, 0);
if (buffer.toString() !== '%PDF-') return invalid;
```

### Yapay Zeka Guvenligi

- API anahtarlari duz metin olarak saklanmaz
- Gemini CLI sistem anahtarligini kullanir
- Web yapay zekasi oturumlari bolumler araciligiyla izole edilir
- Yapay zeka tarafindan olusturulan kodun otomatik yurutulmesi yok

---

## Yapilandirma

### Ayar Kategorileri

| Sekme | Aciklama | Temel Secenekler |
|-------|----------|------------------|
| **Istemler** | Yapay zeka istem sablonlari | Ozel sistem istemleri |
| **Modeller** | Yapay zeka platform yonetimi | Platformlari etkinlestir/devre disi birak |
| **Siteler** | Yapay zeka web sitesi URL'leri | Ozel yapay zeka hizmeti URL'leri |
| **Gemini CLI** | CLI yapilandirmasi | Yol, kimlik dogrulama |
| **Gemini Web** | Web oturumu ayarlari | Oturum kaliciligi |
| **Seciciler** | Magic Selector yapilandirmasi | Oge seciciler |
| **Gorunum** | Gorsel ozellestirme | Renkler, animasyonlar |
| **Dil** | UI dili | Ingilizce, Turkce |
| **Hakkinda** | Uygulama bilgisi ve guncellemeler | Surum kontrolu |

### Yapilandirma Dosyalari

Tumu kullanicinin uygulama verileri dizininde saklanir:

- `settings.json`: Gorunum, dil, yapay zeka yapilandirmalari
- `quiz-settings.json`: Quiz olusturma tercihleri
- `ai-configs.json`: Magic Selector yapilandirmalari
- `gemini-web-session.json`: Gemini web oturum durumu
- `pdf-allowlist.json`: Izin verilen PDF dosya yollari

---

## API Referansi

### IPC Kanallari

```typescript
// PDF Islemleri
SELECT_PDF: 'select-pdf'
GET_PDF_STREAM_URL: 'get-pdf-stream-url'
PDF_REGISTER_PATH: 'pdf:register-path'

// YZ Islemleri
GET_AI_REGISTRY: 'get-ai-registry'
SAVE_AI_CONFIG: 'save-ai-config'
GET_AUTOMATION_SCRIPTS: 'get-automation-scripts'
FORCE_PASTE: 'force-paste-in-webview'

// Quiz Islemleri
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
// window.electronAPI araciligiyla erisim
window.electronAPI.selectPdf(options)
window.electronAPI.quiz.generate(params)
window.electronAPI.automation.generateAutoSendScript(config, text)
window.electronAPI.captureScreen(rect)
```

---

## Katkida Bulunma

Katkilarinizi bekliyoruz! Lutfen yonergeler icin [CONTRIBUTING.md](CONTRIBUTING.md) dosyasina bakin.

### Gelistirme Kurulumu

```bash
# Catallayin ve klonlayin
git clone https://github.com/kullanici-adi/quizlab.git
cd quizlab

# Bagimliliklari yukleyin
npm install

# Testleri calistirin
npm test

# Linting calistirin
npm run lint

# Gelistirmeyi baslatin
npm run dev
```

### Proje Komut Dosyalari

```bash
npm run dev           # Gelistirme modunu baslat
npm run test          # Test paketini calistir
npm run test:coverage # Kapsamla testleri calistir
npm run lint          # ESLint calistir
npm run typecheck     # TypeScript tip kontrolu
npm run build         # Uretim icin derle
npm run build:win     # Windows yukleyici olustur
npm run build:mac     # macOS DMG olustur
npm run build:linux   # Linux AppImage olustur
```

---

## Sorun Giderme

### Sik Karsilasilan Sorunlar

**Quiz Olusturma Basarisiz Oluyor**
- Gemini CLI'nin kurulu oldugundan emin olun: `npm install -g @google/gemini-cli`
- Kimlik dogrulamayi kontrol edin: `gemini login`
- PDF'nin bozuk veya parola korumali olmadigini dogrulayin

**YZ Web Gorunumu Yuklenmiyor**
- Internet baglantisini kontrol edin
- Yenilemeyi deneyin (Ctrl+R)
- Ayarlar → Hakkinda'da onbellegi temizleyin

**Magic Selector Calismiyor**
- Yapay zeka platformunun sohbet sayfasinda oldugunuzdan emin olun
- Web gorunumunu yeniden yuklemeyi deneyin
- Ayarlarda secicileri yeniden yapilandirin

**PDF Acilmiyor**
- Dosyanin gecerli bir PDF oldugunu dogrulayin
- Dosyanin 50MB'dan buyuk olmadigini kontrol edin
- Pencereye surukleyip birakmayi deneyin

### Hata Ayiklama Modu

```bash
# Gelistirme Araclari acikken calistirin
npm run dev

# Konsolda hatalari kontrol edin
# Gelistirme Araclari'nda ag isteklerini goruntuleyin
```

---

## Yol Haritasi

### Gelecek Ozellikler

- [ ] **Flas Kart Modu**: Anki tarzi aralikli tekrar
- [ ] **Not Alma**: Yerlesik PDF aciklama
- [ ] **Bulut Senkronizasyonu**: Istegel bagli sifreli yedekleme
- [ ] **Mobil Yardimci**: iOS/Android goruntuleyici uygulamasi
- [ ] **Isbirlikci Calisma**: Quizleri arkadaslarla paylasma
- [ ] **Eklenti Sistemi**: Ucuncu taraf uzantilar
- [ ] **OCR Destegi**: Taranmis PDF metin tanima
- [ ] **Sesli Giris**: Yapay zeka sohbeti icin konusmadan metne

---

## Lisans

Bu proje **MIT Lisansi** altinda lisanslanmistir - detaylar icin [LICENSE](LICENSE) dosyasina bakin.

---

## Tesekkurler

- **Google Gemini Ekibi**: Guclu yapay zeka API'si icin
- **Electron Ekibi**: Capraz platform cercevesi icin
- **React PDF Viewer**: Mukemmel PDF bileseni icin
- **Framer Motion**: Puruzsuz animasyonlar icin
- **Tum Katkida Bulunanlar**: Bu projeyi daha iyi hale getiren herkes

---

## Iletisim ve Destek

- **Hata Raporlari**: [GitHub Issues](https://github.com/ozymandias-get/quizlab/issues)
- **Ozellik Istekleri**: [GitHub Discussions](https://github.com/ozymandias-get/quizlab/discussions)
- **E-posta**: ozymandias-get@proton.me

---

<p align="center">
  <strong>Her yerdeki ogrenenler icin sevgiyle yapildi</strong>
</p>

<p align="center">
  <a href="#-quizlab-reader---yapay-zeka-destekli-pdf-calisma-araci-ve-quiz-olusturucu">Basa Don</a>
</p>
