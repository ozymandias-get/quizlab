# ğŸ§ª QuizLab Reader | Yapay Zeka Destekli PDF Ã‡alÄ±ÅŸma AracÄ± & Quiz OluÅŸturucu

<!-- markdownlint-disable MD033 -->
<div align="center">

[![English](https://img.shields.io/badge/lang-English-blue.svg?style=flat-square)](README.md)
[![SÃ¼rÃ¼m](https://img.shields.io/badge/sÃ¼rÃ¼m-2.1.1-blue.svg?style=flat-square)](https://github.com/ozymandias-get/quizlab/releases)
[![Lisans](https://img.shields.io/badge/lisans-MIT-green.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg?style=flat-square)](https://electronjs.org/)
[![Built with](https://img.shields.io/badge/AltyapÄ±-Electron%20%26%20React-61DAFB?style=flat-square&logo=react)](https://react.dev/)

**Ã–ÄŸrenciler ve GeliÅŸtiriciler iÃ§in En KapsamlÄ± MasaÃ¼stÃ¼ Ã‡alÄ±ÅŸma Kokpiti**  
*PDF Okuyun, Google Gemini Yapay Zeka ile Sohbet Edin ve Tek Bir AkÄ±ÅŸta Quizler OluÅŸturun.*

[Ã–zellikler](#-ana-Ã¶zellikler-ve-faydalar) â€¢ [Kurulum](#-hÄ±zlÄ±-baÅŸlangÄ±Ã§-kÄ±lavuzu) â€¢ [Neden QuizLab?](#-neden-quizlab) â€¢ [Teknoloji](#-teknoloji-yÄ±ÄŸÄ±nÄ±)

</div>
<!-- markdownlint-enable MD033 -->

---

## ğŸš€ Genel BakÄ±ÅŸ: En Ä°yi Ãœcretsiz Yapay Zeka Ã‡alÄ±ÅŸma AsistanÄ±

**QuizLab Reader**, Ã¶ÄŸrenme sÃ¼recinizi hÄ±zlandÄ±rmak iÃ§in tasarlanmÄ±ÅŸ, aÃ§Ä±k kaynaklÄ±, **yapay zeka destekli bir PDF okuyucu** ve **Ã§alÄ±ÅŸma aracÄ±dÄ±r**. Standart PDF gÃ¶rÃ¼ntÃ¼leyicilerin aksine, QuizLab, ders kitaplarÄ±nÄ±zÄ± ve notlarÄ±nÄ±zÄ± anÄ±nda etkileÅŸimli sÄ±navlara ve bilgi kartlarÄ±na dÃ¶nÃ¼ÅŸtÃ¼rmek iÃ§in doÄŸrudan **Google Gemini AI** ile entegre olur.

GÃ¼Ã§lÃ¼ bir PDF gÃ¶rÃ¼ntÃ¼leyiciyi baÄŸlam farkÄ±ndalÄ±ÄŸÄ±na sahip bir yapay zeka asistanÄ±yla birleÅŸtiren **bÃ¶lÃ¼nmÃ¼ÅŸ ekranlÄ± bir Ã§alÄ±ÅŸma alanÄ±** ile Ã§alÄ±ÅŸma oturumlarÄ±nÄ±zÄ± yeniden tanÄ±mlayÄ±n. SÄ±navlara hazÄ±rlanÄ±yor, yeni bir dil Ã¶ÄŸreniyor veya teknik belgeleri analiz ediyor olun, QuizLab uygulamadan Ã§Ä±kmadan **aktif hatÄ±rlama (active recall)** yapmanÄ±za yardÄ±mcÄ± olur.

![PDF Okuyucu ve Yapay Zeka Sohbet ArayÃ¼zÃ¼nÃ¼ gÃ¶steren QuizLab UygulamasÄ±](docs/images/app-overview.png)

---

## âœ¨ Ana Ã–zellikler ve Faydalar

### ğŸ“š AkÄ±llÄ± BÃ¶lÃ¼nmÃ¼ÅŸ Ekran Ã‡alÄ±ÅŸma AlanÄ± (PDF + Yapay Zeka)
Solda rahatÃ§a okurken saÄŸda bir yapay zeka Ã¶ÄŸretmeniyle etkileÅŸime geÃ§in.
- **AnÄ±nda BaÄŸlam AktarÄ±mÄ±:** PDF'inizdeki herhangi bir metni seÃ§in ve Ã¶zetleme, Ã§eviri veya aÃ§Ä±klama iÃ§in anÄ±nda yapay zekaya gÃ¶nderin.
- **Odak Modu:** Derinlemesine Ã§alÄ±ÅŸma iÃ§in optimize edilmiÅŸ, dikkat daÄŸÄ±tmayan okuma ortamÄ±.
- **Ã‡oklu Sekme DesteÄŸi:** AynÄ± anda birden fazla PDF ve referans materyali aÃ§Ä±n.
- **Panel Yer DeÄŸiÅŸtirme:** PDF ve yapay zeka panellerinin konumlarÄ±nÄ± anÄ±nda deÄŸiÅŸtirin.

### ğŸ§  GeliÅŸmiÅŸ Quiz OluÅŸturucu & Flashcard YapÄ±cÄ±
YerleÅŸik **Quiz Motorumuz** ile pasif okumayÄ± aktif Ã¶ÄŸrenmeye dÃ¶nÃ¼ÅŸtÃ¼rÃ¼n.
- **Dinamik Soru OluÅŸturma:** SeÃ§tiÄŸiniz metinden veya tam sayfalardan otomatik olarak Ã§oktan seÃ§meli sorular (Test), doÄŸru/yanlÄ±ÅŸ ve aÃ§Ä±k uÃ§lu sorular oluÅŸturun.
- **Gemini CLI Entegrasyonu:** YÃ¼ksek kaliteli ve baÄŸlama uygun sorular iÃ§in Google'Ä±n Gemini modellerinin gÃ¼cÃ¼nden yararlanÄ±r.
- **Ã–zelleÅŸtirilebilir Zorluk:** ZayÄ±f olduÄŸunuz konularÄ± hedeflemek iÃ§in zorluk seviyelerini (Kolay, Orta, Zor), soru sayÄ±sÄ±nÄ± (1-30) ve belirli konularÄ± ayarlayÄ±n.
- **Soru Stilleri:** Klasik, Analitik, DoÄŸru/YanlÄ±ÅŸ veya KarÄ±ÅŸÄ±k soru stilleri arasÄ±ndan seÃ§im yapÄ±n.
- **Demo Modu:** PDF yÃ¼klemeden Ã¶rnek iÃ§erikle quiz oluÅŸturmayÄ± deneyin.
- **OyunlaÅŸtÄ±rÄ±lmÄ±ÅŸ Ã–ÄŸrenme:** PuanlarÄ±nÄ±zÄ±, sÃ¼renizi ve zaman iÃ§indeki ilerlemenizi detaylÄ± sonuÃ§larla takip edin.

![Ã‡alÄ±ÅŸma SorularÄ± OluÅŸturmak Ä°Ã§in Quiz YapÄ±landÄ±rma EkranÄ±](docs/images/quiz-creation.png)
![EtkileÅŸimli Quiz Modu ArayÃ¼zÃ¼](docs/images/quiz-gameplay.png)
![Quiz SonuÃ§larÄ± ve Performans Takibi](docs/images/quiz-results.png)

### ğŸ¤– Ã‡oklu Platform Yapay Zeka DesteÄŸi
Favori yapay zeka servislerinizle sorunsuz baÄŸlantÄ± kurun.
- **Dahili Yapay Zeka PlatformlarÄ±:** ChatGPT, Claude, DeepSeek, Qwen ve Kimi iÃ§in yerel destek.
- **Ã–zel Yapay Zeka Entegrasyonu:** URL'sini girerek herhangi bir web tabanlÄ± yapay zeka platformu ekleyin.
- **Model YÃ¶netimi:** Yapay zeka platformlarÄ±nÄ± tercihlerinize gÃ¶re etkinleÅŸtirin/devre dÄ±ÅŸÄ± bÄ±rakÄ±n.
- **Magic Selector (Sihirli SeÃ§ici):** Otomatik yapÄ±ÅŸtÄ±rma fonksiyonuyla evrensel yapay zeka entegrasyonuâ€”uygulamaya giriÅŸ alanlarÄ±nÄ± tanÄ±masÄ±nÄ± Ã¶ÄŸretin ve seÃ§ilen metni PDF'den yapay zeka sohbetine otomatik yapÄ±ÅŸtÄ±rÄ±n.

### ğŸ¨ Premium Cam Efekti (Glass Morphism) UI ve Ã–zelleÅŸtirme
Ã‡alÄ±ÅŸma ortamÄ±nÄ±zÄ± kapsamlÄ± gÃ¶rÃ¼nÃ¼m seÃ§enekleriyle kiÅŸiselleÅŸtirin.
- **GÃ¶rsel Temalar:** Ã–zelleÅŸtirilebilir renklerle animasyonlu gradyan veya dÃ¼z renk arka planlarÄ±.
- **Alt Ã‡ubuk Ã–zelleÅŸtirme:** OpaklÄ±k, Ã¶lÃ§ek ve simge-Ã¶ncelikli kompakt mod ayarlarÄ±.
- **SeÃ§im Renkleri:** PDF metin seÃ§imi vurgu rengini Ã¶zelleÅŸtirin.
- **Rastgele Arka Plan Modu:** Her oturum iÃ§in taze bir gÃ¶rÃ¼nÃ¼m sunan dinamik renk geÃ§iÅŸleri.
- **Animasyonlar:** Framer Motion ile gÃ¼Ã§lendirilmiÅŸ, akÄ±cÄ± GPU hÄ±zlandÄ±rmalÄ± geÃ§iÅŸler.

### ğŸ“¸ Ekran GÃ¶rÃ¼ntÃ¼sÃ¼ ile Yapay Zekaya GÃ¶nderme
EkranÄ±nÄ±zÄ±n herhangi bir bÃ¶lÃ¼mÃ¼nÃ¼ yakalayÄ±p analiz edin.
- **Ekran Yakalama AracÄ±:** EkranÄ±nÄ±zÄ±n herhangi bir alanÄ±nÄ± seÃ§in ve doÄŸrudan yapay zekaya analiz iÃ§in gÃ¶nderin.
- **GÃ¶rsel Ã–ÄŸrenme:** Diyagramlar, grafikler ve gÃ¶rsel iÃ§erik analizi iÃ§in mÃ¼kemmel.

### ğŸŒ Ã‡oklu Dil DesteÄŸi
Tercih ettiÄŸiniz dilde Ã§alÄ±ÅŸÄ±n.
- **Ä°ngilizce ve TÃ¼rkÃ§e:** Kolay dil deÄŸiÅŸtirme ile tam UI yerelleÅŸtirmesi.
- **GeniÅŸletilebilir:** JSON dil dosyalarÄ± aracÄ±lÄ±ÄŸÄ±yla daha fazla dil eklenebilir.

### ğŸ”„ Otomatik GÃ¼ncelleme Sistemi
Zahmetsizce gÃ¼ncel kalÄ±n.
- **GÃ¼ncelleme Bildirimleri:** GitHub sÃ¼rÃ¼mlerinden yeni versiyonlar iÃ§in otomatik kontrol.
- **Tek TÄ±kla Ä°ndirme:** En son sÃ¼rÃ¼mÃ¼ indirmek iÃ§in doÄŸrudan baÄŸlantÄ±.

### ğŸ¯ EtkileÅŸimli KullanÄ±m AsistanÄ±
EtkileÅŸimli bir tur ile uygulamayÄ± Ã¶ÄŸrenin.
- **AdÄ±m AdÄ±m Ã–ÄŸretici:** Temel Ã¶zellikleri ve kontrolleri vurgulayan rehber tur.
- **EkranÄ± Karartmadan:** Karartma olmadan vurgu tabanlÄ± rehberlik.

### ğŸ”’ Gizlilik OdaklÄ± ve Yerel Ã–ncelikli
- **Ã‡evrimdÄ±ÅŸÄ± Ã–zellik:** Temel okuma Ã¶zellikleri internet olmadan da Ã§alÄ±ÅŸÄ±r.
- **Verileriniz Size Aittir:** Notlar ve ayarlar cihazÄ±nÄ±zda yerel olarak saklanÄ±r. DoÄŸrudan yapay zeka etkileÅŸimleri kendi gÃ¼venli oturumlarÄ±nÄ±z Ã¼zerinden gerÃ§ekleÅŸir.

---

## â“ SÄ±kÃ§a Sorulan Sorular (SSS)

**S: QuizLab Reader Ã¼cretsiz mi?**
C: Evet, QuizLab **Ã¼cretsiz ve aÃ§Ä±k kaynaklÄ± bir yazÄ±lÄ±mdÄ±r (FOSS)**. Ä°ndirebilir ve herhangi bir abonelik Ã¼creti Ã¶demeden kullanabilirsiniz.

**S: Hangi yapay zeka modellerini destekliyor?**
C: Quiz oluÅŸturma iÃ§in yerel olarak CLI Ã¼zerinden **Google Gemini** ile entegre olur. AyrÄ±ca, **Magic Selector** Ã¶zelliÄŸi sayesinde ChatGPT, Claude, DeepSeek, Qwen veya Kimi gibi hemen hemen tÃ¼m web tabanlÄ± yapay zekalarla etkileÅŸim kurabilirsiniz. Ã–zel yapay zeka platformlarÄ± da ekleyebilirsiniz.

**S: Mac ve Linux Ã¼zerinde kullanabilir miyim?**
C: Kesinlikle! QuizLab Electron ile geliÅŸtirilmiÅŸtir ve **Windows, macOS ve Linux** ile tam uyumludur.

**S: Quiz OluÅŸturucu nasÄ±l Ã§alÄ±ÅŸÄ±r?**
C: Quiz OluÅŸturucu, PDF iÃ§eriÄŸinizi analiz etmek ve baÄŸlama uygun sorular oluÅŸturmak iÃ§in Google Gemini CLI kullanÄ±r. Zorluk, soru sayÄ±sÄ± ve odak konularÄ± Ã¶zelleÅŸtirilebilir.

**S: GÃ¶rÃ¼nÃ¼mÃ¼ Ã¶zelleÅŸtirebilir miyim?**
C: Evet! QuizLab, arka plan temalarÄ±, renkler, panel dÃ¼zeni, alt Ã§ubuk opaklÄ±ÄŸÄ±/Ã¶lÃ§eÄŸi ve seÃ§im renkleri dahil olmak Ã¼zere kapsamlÄ± Ã¶zelleÅŸtirme sunar.

---

## ğŸ›  Teknoloji YÄ±ÄŸÄ±nÄ±

HÄ±z ve gÃ¼venilirlik saÄŸlayan performans Ã¶ncelikli, modern bir mimari ile geliÅŸtirildi:

| Kategori | Teknoloji |
| :--- | :--- |
| **Ã‡ekirdek** | ![Electron](https://img.shields.io/badge/Electron-33-2F3241?style=flat-square&logo=electron) ![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react) |
| **Dil** | ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript) |
| **Stil** | ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3-06B6D4?style=flat-square&logo=tailwindcss) |
| **Derleme** | ![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite) ![Electron Builder](https://img.shields.io/badge/Electron_Builder-gray?style=flat-square) |
| **PDF Motoru** | React PDF Viewer + PDF.js |
| **Animasyonlar** | Framer Motion |
| **UI BileÅŸenleri** | Headless UI |

---

## âš¡ HÄ±zlÄ± BaÅŸlangÄ±Ã§ KÄ±lavuzu

QuizLab Reader'Ä± yerel makinenize kurmak ve Ã§alÄ±ÅŸtÄ±rmak iÃ§in aÅŸaÄŸÄ±daki adÄ±mlarÄ± izleyin.

### Gereksinimler

- Sisteminizde **Node.js 18+** yÃ¼klÃ¼ olmalÄ±dÄ±r.
- **npm** (Node Paket YÃ¶neticisi).
- **Google HesabÄ±** (Gemini CLI Ã¶zellikleri iÃ§in gereklidir).
- **Gemini CLI** (Quiz oluÅŸturma iÃ§in):
  ```bash
  npm install -g @google/gemini-cli
  ```

### Kurulum

```bash
# Depoyu klonlayÄ±n
git clone https://github.com/ozymandias-get/quizlab.git
cd quizlab

# BaÄŸÄ±mlÄ±lÄ±klarÄ± yÃ¼kleyin
npm install

# GeliÅŸtirme modunda Ã§alÄ±ÅŸtÄ±rÄ±n
npm run dev
```

### Derleme KomutlarÄ±

UygulamayÄ± daÄŸÄ±tÄ±m iÃ§in derleyin:

```bash
npm run typecheck    # TypeScript tÃ¼rlerini kontrol et
npm run build        # Mevcut iÅŸletim sistemi iÃ§in derle
npm run build:win    # Windows yÃ¼kleyicisi iÃ§in derle
npm run build:mac    # macOS .dmg iÃ§in derle
npm run build:linux  # Linux .AppImage iÃ§in derle
```

---

## ğŸ— Proje YapÄ±sÄ±

QuizLab, refactor sonrasÄ± katmanlarÄ± belirgin ayrÄ±lmÄ±ÅŸ Ã¶lÃ§eklenebilir bir mimari izler. Uygulama kabuÄŸu, feature modÃ¼lleri, renderer-shared katmanÄ± ve sÃ¼reÃ§ler arasÄ± paylaÅŸÄ±lan sÃ¶zleÅŸmeler net olarak ayrÄ±lmÄ±ÅŸtÄ±r.

```text
quizlab/
â”œâ”€â”€ electron/                # Ana SÃ¼reÃ§ (Node.js / IPC iÅŸleyicileri)
â”‚   â”œâ”€â”€ app/
â”‚   â”œâ”€â”€ core/
â”‚   â”œâ”€â”€ features/
â”‚   â””â”€â”€ preload/
â”‚
â”œâ”€â”€ src/                     # Renderer SÃ¼reci (React)
â”‚   â”œâ”€â”€ app/
â”‚   â”œâ”€â”€ features/
â”‚   â”œâ”€â”€ shared/
â”‚   â”œâ”€â”€ platform/            # Electron kÃ¶prÃ¼sÃ¼ ve API hook'larÄ±
â”‚   â””â”€â”€ __tests__/
â”‚
â”œâ”€â”€ shared/                  # SÃ¼reÃ§ler arasÄ± ortak IPC kanallarÄ± ve tipler
â”œâ”€â”€ docs/                    # Mimari ve proje dokÃ¼mantasyonu
â”œâ”€â”€ resources/               # Statik varlÄ±klar ve ikonlar
â””â”€â”€ package.json
```

---

## ğŸ® Ayarlar ve YapÄ±landÄ±rma

QuizLab, sezgisel sekmeler halinde organize edilmiÅŸ kapsamlÄ± ayarlar sunar:

| Sekme | AÃ§Ä±klama |
|-----|-------------|
| **Promptlar** | FarklÄ± baÄŸlamlar iÃ§in yapay zeka promptlarÄ±nÄ± Ã¶zelleÅŸtirin |
| **Modeller** | Yapay zeka platformlarÄ±nÄ± etkinleÅŸtirin/devre dÄ±ÅŸÄ± bÄ±rakÄ±n, Ã¶zel yapay zeka servisleri ekleyin |
| **Gemini CLI** | Quiz oluÅŸturma iÃ§in Gemini CLI yolunu ve ayarlarÄ±nÄ± yapÄ±landÄ±rÄ±n |
| **SeÃ§iciler** | Otomatik yapÄ±ÅŸtÄ±rma fonksiyonu iÃ§in Magic Selector'Ä± yapÄ±landÄ±rÄ±n |
| **GÃ¶rÃ¼nÃ¼m** | TemalarÄ±, renkleri, opaklÄ±ÄŸÄ± ve gÃ¶rsel tercihleri Ã¶zelleÅŸtirin |
| **Dil** | Ä°ngilizce ve TÃ¼rkÃ§e arasÄ±nda geÃ§iÅŸ yapÄ±n |
| **HakkÄ±nda** | Uygulama sÃ¼rÃ¼mÃ¼nÃ¼ gÃ¶rÃ¼ntÃ¼leyin ve gÃ¼ncellemeleri kontrol edin |

---

## ğŸ“„ Lisans

**MIT LisansÄ±** altÄ±nda daÄŸÄ±tÄ±lmaktadÄ±r. Bu, yazÄ±lÄ±mÄ± Ã¶zgÃ¼rce kullanabileceÄŸiniz, deÄŸiÅŸtirebileceÄŸiniz ve daÄŸÄ±tabileceÄŸiniz anlamÄ±na gelir. Daha fazla bilgi iÃ§in [LICENSE](LICENSE) dosyasÄ±na bakÄ±n.

---

<div align="center">

**Her yerdeki Ã¶ÄŸrenenler iÃ§in â¤ï¸ ile yapÄ±ldÄ±.**

[â¬† BaÅŸa DÃ¶n](#-quizlab-reader--yapay-zeka-destekli-pdf-Ã§alÄ±ÅŸma-aracÄ±--quiz-oluÅŸturucu)

</div>
