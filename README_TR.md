# QuizLab Reader 📚✨

[![English](https://img.shields.io/badge/lang-English-blue.svg)](README.md) ![Sürüm](https://img.shields.io/badge/sürüm-3.1.0-blue.svg) ![Lisans](https://img.shields.io/badge/lisans-MIT-green.svg) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

> **🇺🇸 [Click here for English Documentation](README.md)**

**QuizLab Reader**, PDF okuma deneyimini gelişmiş **Yapay Zeka** yetenekleriyle birleştiren, öğrenciler ve araştırmacılar için tasarlanmış modern bir masaüstü uygulamasıdır.

Sıradan uygulamaların aksine, QuizLab karmaşık API anahtarlarıyla uğraşmanızı gerektirmez. Doğrudan **Google Gemini CLI** entegrasyonu ile yerel bir sınav oluşturucu sunar ve benzersiz **"Sihirli Seçici" (Magic Selector)** teknolojisi sayesinde tarayıcı tabanlı *herhangi bir* yapay zekayı (ChatGPT, Claude, DeepSeek) uygulamanın bir parçası gibi kullanmanıza olanak tanır.

---

## 🚀 Temel Özellikler

### 🧠 Yerel Gemini Entegrasyonu (CLI Tabanlı)

* **API Anahtarı Gerekmez:** Resmi `@google/gemini-cli` paketini kullanır. Terminal üzerinden Google Hesabınızla bir kez giriş yapmanız yeterlidir.
* **Otomatik Sınav (Quiz) Oluşturucu:** PDF'inizdeki metinleri analiz eder, konuları ayırır ve Gemini Pro modelini kullanarak size özel sınavlar, boşluk doldurma testleri veya doğru/yanlış soruları hazırlar.
* **Limitsiz Öğrenme:** Kendi Google hesabınızın kotalarını kullanır, üçüncü parti servislere bağımlı değildir.

### � "Sihirli Seçici" (Magic Selector) Teknolojisi

* **Evrensel AI Desteği:** Tek bir modele sıkışıp kalmayın. Dahili tarayıcıda **ChatGPT**, **Claude**, **Perplexity** veya kurumsal AI araçlarını açın.
* **Görsel DOM Eşleştirme:** "Sihirli Değnek" aracını kullanarak, web sitesindeki yazı yazma kutusunu ve gönder butonunu görsel olarak seçin.
* **Otomatik Enjeksiyon:** Eşleştirme yapıldıktan sonra, PDF üzerinde seçtiğiniz herhangi bir metin otomatik olarak bu kutuya yazılır ve gönderilir. "Oku ve Sor" iş akışı kesintisiz hale gelir.

### 📖 Gelişmiş PDF ve Çalışma Araçları

* **Bölünmüş Ekran (Split-Screen):** Sol panelde ders notlarınız, sağ panelde yapay zeka asistanınız. Paneller yer değiştirebilir ve boyutlandırılabilir.
* **Akıllı Bağlam Menüsü:** Metin seçtiğinizde açılan menü ile anında:
  * Özet Çıkar
  * Çeviri Yap
  * Kavram Açıkla
* **Ekran Görüntüsü Analizi:** PDF'teki bir grafiği veya formülü kesip, anında yapay zekaya görsel olarak sorabilirsiniz.

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
quizlab-reader/
├── backend/                 # Electron Ana Süreci (Main Process)
│   ├── main/               # Ana giriş noktaları (IPC, pencere yönetimi)
│   └── preload/            # Preload scriptleri (Güvenli köprü)
├── frontend/                # React Arayüz Süreci (Renderer Process)
│   ├── components/         #
│   │   ├── pdf/            # Özel PDF Görüntüleyici bileşenleri
│   │   ├── QuizModule/     # Gemini CLI entegrasyonu ve Quiz arayüzü
│   │   └── ...
│   ├── hooks/              # Özel hook'lar (useAiSender, usePdfSelection)
│   ├── locales/            # Dil dosyaları (en, tr)
│   └── styles/             # Tailwind ve CSS Modülleri
├── resources/               # Statik varlıklar (ikonlar, görsel materyaller)
├── installer/               # Windows için NSIS yükleyici ayarları
└── package.json            # Bağımlılıklar (@google/gemini-cli dahil)
```

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
