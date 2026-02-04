# QuizLab Reader 📚✨

![Version](https://img.shields.io/badge/sürüm-3.1.0-blue.svg) ![Lisans](https://img.shields.io/badge/lisans-MIT-green.svg) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

**QuizLab Reader**, öğrenme sürecinizi hızlandırmak için tasarlanmış yeni nesil bir çalışma aracıdır. Güçlü bir **PDF Okuyucu** ile entegre **Yapay Zeka Asistanını** tek bir bölünmüş ekran arayüzünde birleştirerek, çalışma materyallerinizi okumanızı, özetlemenizi ve anında sınavlar (quiz) oluşturmanızı sağlar.

Standart uygulamaların aksine, QuizLab Reader **"Sihirli Seçici"** (Magic Selector) teknolojisine sahiptir. Bu özellik sayesinde *herhangi bir* web tabanlı yapay zeka chatbotunu (ChatGPT, Claude, DeepSeek vb.) uygulamanın içine entegre edebilir; PDF'den metin seçip doğrudan yapay zekaya gönderebilirsiniz. Ayrıca Google Gemini modellerini kullanarak dökümanlarınızdan otomatik sınavlar üretebilirsiniz.

---

## 🚀 Temel Özellikler

### 📖 Profesyonel PDF Okuyucu

* **Bölünmüş Ekran (Split-Screen):** Solda içerik, sağda zeka.
* **Gelişmiş Gezinme:** Küçük resim önizlemeleri, bölüm algılama ve akıcı kaydırma.
* **Akıllı Etkileşim:** PDF üzerindeki metni seçin ve tek tıkla yapay zekaya gönderin.
* **Ekran Görüntüsü Aracı:** Diyagramları veya tabloları seçip yapay zekaya görsel olarak sorabilirsiniz.

### 🧠 Evrensel AI Entegrasyonu & "Sihirli Seçici"

* **Kendi Yapay Zekanı Getir:** Tek bir modele bağlı kalmayın. Dahili tarayıcı ile ChatGPT, Claude, Gemini veya dilediğiniz servisi açın.
* **Sihirli Seçici Teknolojisi:** Herhangi bir web sitesindeki "Mesaj Kutusu" ve "Gönder" butonunu görsel olarak tanıtın. Uygulama, o siteyle nasıl konuşacağını öğrenir ve entegre olur.
* **Hazır Prompt Kütüphanesi:** Özetleme, çeviri veya açıklama için optimize edilmiş komutları tek tıkla kullanın.

### 📝 AI Quiz Oluşturucu (Gemini Destekli)

* **Anında Sınav:** Herhangi bir PDF dosyasını saniyeler içinde kapsamlı bir sınava dönüştürün.
* **Detaylı Analiz:** Anında puanlama, yanlış cevaplar için açıklamalar ve başarı takibi.
* **Özelleştirilebilir Zorluk:** Kolay, Orta veya Zor seviyelerinden birini seçin.
* **Odak Modu:** Yapay zekaya sadece belirli bir konuya odaklanmasını söyleyin (örneğin: "Kardiyovasküler Sistem" veya "Osmanlı Tarihi").
* *(Google Gemini API Anahtarı gerektirir)*

### 🎨 Modern ve Özelleştirilebilir Arayüz

* **Estetik Tasarım:** Glassmorphism efektleri, yumuşak animasyonlar ve şık koyu/açık mod.
* **Esnek Yerleşim:** Panellerin yerini değiştirin, boyutlarını ayarlayın veya menüleri gizleyin.
* **Çoklu Dil Desteği:** Türkçe 🇹🇷 ve İngilizce 🇺🇸 tam destek.

---

## 🛠 Kurulum

### Gereksinimler

* Node.js (v18 veya üzeri)
* NPM veya Yarn

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

3. **Geliştirme Modunda Çalıştırın**

    ```bash
    npm run dev
    ```

    *Bu komut hem React arayüzünü (Vite) hem de Electron arka planını eş zamanlı başlatır.*

### Uygulamayı Derleme (Build)

İşletim sisteminiz için çalıştırılabilir dosya (.exe, .dmg, .AppImage) oluşturmak için:

* **Windows:** `npm run build:win`
* **macOS:** `npm run build:mac`
* **Linux:** `npm run build:linux`

Çıktılar `release/` klasöründe oluşturulacaktır.

---

## 🎮 Nasıl Kullanılır?

### 1. Sihirli Seçici (Yapay Zeka Bağlama)

1. Sağ taraftaki **AI Paneli**ni açın.
2. Favori yapay zeka sitenize gidin (örn. chatgpt.com) ve giriş yapın.
3. Alt çubuktaki **Sihirli Değnek** ikonuna tıklayın.
4. Ekranda beliren rehberi izleyin:
    * Sitedeki yazı yazma kutusuna **tıklayın**.
    * Sitedeki gönder butonuna **tıklayın**.
5. Tamamdır! Artık PDF'ten seçtiğiniz herhangi bir metni otomatik olarak bu kutuya yazdırıp gönderebilirsiniz.

### 2. Quiz Oluşturma

1. Bir PDF belgesi açın.
2. Alt çubuktaki **"Quiz"** sekmesine tıklayın.
3. Eğer istenirse Google Hesabınızla giriş yapın (Gemini entegrasyonu için).
4. Bir **Zorluk Seviyesi** seçin ve isterseniz bir **Odak Konusu** girin.
5. **"Sınav Oluştur"** butonuna basın. Yapay zeka dökümanı okuyacak ve sizin için sorular hazırlayacaktır.

---

## 🏗 Teknoloji Yığını

* **Çekirdek:** [Electron](https://www.electronjs.org/) + [React](https://reactjs.org/)
* **Derleyici:** [Vite](https://vitejs.dev/)
* **Dil:** [TypeScript](https://www.typescriptlang.org/)
* **Stil:** [TailwindCSS](https://tailwindcss.com/) + CSS Modules
* **PDF Motoru:** [React PDF Viewer](https://react-pdf-viewer.dev/) / PDF.js
* **AI Köprüsü:** Google Gemini CLI + Özel DOM Otomasyonu

---

## 📂 Proje Yapısı

```bash
quizlab-reader/
├── backend/                 # Electron Ana Süreci (Main Process)
│   ├── main/               # Ana süreç giriş noktaları (IPC, pencere yönetimi)
│   └── preload/            # Preload scriptleri (Node.js ve Tarayıcı köprüsü)
├── frontend/                # React Arayüz Süreci (Renderer Process)
│   ├── components/         # Yeniden kullanılabilir UI bileşenleri (PDF, AI vb.)
│   ├── context/            # Global durum yönetimi (Context API)
│   ├── hooks/              # Özel React hook'ları
│   ├── locales/            # Dil dosyaları (i18n - en.json, tr.json)
│   ├── styles/             # Global stiller ve CSS modülleri
│   ├── utils/              # Yardımcı fonksiyonlar
│   └── main.tsx            # Uygulama giriş noktası
├── resources/               # Electron için statik varlıklar (ikonlar vb.)
├── installer/               # NSIS yükleyici yapılandırması
├── release/                 # Derleme çıktıları (exe dosyaları buraya çıkar)
├── .github/                 # GitHub iş akışları (CI/CD)
├── tailwind.config.js       # TailwindCSS yapılandırması
├── vite.config.ts           # Vite paketleyici ayarları
└── package.json            # Proje bağımlılıkları ve scriptler
```

## 🤝 Katkıda Bulunma

Katkılarınızı bekliyoruz! Lütfen bir Pull Request göndermekten çekinmeyin.

1. Projeyi Fork'layın
2. Kendi özellik dalınızı (branch) oluşturun (`git checkout -b ozellik/YeniOzellik`)
3. Değişikliklerinizi commit'leyin (`git commit -m 'YeniOzellik eklendi'`)
4. Dalınızı Push'layın (`git push origin ozellik/YeniOzellik`)
5. Bir Pull Request oluşturun

---

## 📄 Lisans

Bu proje **MIT Lisansı** ile lisanslanmıştır - detaylar için [LICENSE](LICENSE) dosyasına bakabilirsiniz.
