# QuizLab Reader - Features Documentation

[![Turkish](https://img.shields.io/badge/lang-Türkçe-red.svg)](#türkçe---özellikler-dokümantasyonu) [![English](https://img.shields.io/badge/lang-English-blue.svg)](#english---features-documentation)

---

## English - Features Documentation

This document provides detailed explanations of each major feature in QuizLab Reader, how they work, and how to use them effectively.

---

## 📚 Core Features

### 1. Professional PDF Reader

**What is it?**
A high-performance PDF viewer integrated directly into the application, allowing you to read and interact with PDF documents.

**Key Capabilities:**
- **Multi-page viewing**: Navigate through documents with smooth scrolling
- **Zoom controls**: Zoom in/out to adjust reading comfort (50% - 400%)
- **Text selection**: Select and copy text from PDF documents
- **Page navigation**: Jump to specific pages or use next/previous buttons
- **Search functionality**: Find specific text within the document
- **Thumbnail sidebar**: View page thumbnails for quick navigation

**How to use:**
1. Click the **"Open PDF"** button in the top bar
2. Select your PDF file from the file picker
3. Use toolbar controls for zoom, navigation, and search
4. Right-click in PDF area for context menu with additional options

**Technical details:**
- Built on Mozilla's **PDF.js** library
- Custom React wrapper for better integration
- Hardware-accelerated canvas rendering
- Web Worker for PDF parsing (doesn't block UI)
- Virtual scrolling for large documents (only renders visible pages)

**Why is this useful?**
Unlike browser PDF viewers or separate apps, having the PDF integrated means you can seamlessly use AI features while reading without switching windows or copy-pasting between apps.

---

### 2. AI Assistant Integration (Magic Selector)

**What is it?**
A revolutionary feature that lets you integrate ANY web-based AI chatbot (ChatGPT, Claude, Gemini, DeepSeek, Perplexity, etc.) into your study session—without needing API keys or technical setup.

**The Problem it Solves:**
- API keys are expensive or have usage limits
- Switching between PDF reader and AI chat websites is tedious
- Copy-pasting questions manually breaks your flow
- Different AI tools require different API implementations

**How Magic Selector Works:**

#### Setup (One-time per AI website):

1. **Open the AI panel** (right side of the screen)
2. **Navigate to your preferred AI website** (e.g., chatgpt.com)
3. **Click the Magic Wand icon** 🪄 in the bottom toolbar
4. **Step 1: Click on the text input field** where you normally type messages
   - The app captures the CSS selector for this element
   - Status shows "Input Selected ✓"
5. **Step 2: Click on the Send button**
   - The app captures the button selector
   - Status shows "Button Selected ✓"
6. **Setup Complete!** The app now knows how to interact with this website

#### Using the Magic Selector:

Once set up, you can:
1. **Select any text in your PDF** (definitions, paragraphs, equations)
2. **Click "Send to AI"** in the floating toolbar
3. **The text automatically appears in the AI chat** and gets sent
4. **View the AI's response** in real-time in the right panel

**Advanced Usage:**
- **Screenshot to AI**: Capture diagrams or complex layouts and paste them into the AI chat
- **Quick Actions**: Use "Explain", "Summarize", or "Translate" buttons for instant queries
- **Multiple AI platforms**: Set up different AIs for different purposes
  - ChatGPT for general questions
  - Claude for detailed analysis
  - Perplexity for research and citations

**Technical Implementation:**
```javascript
// Behind the scenes, the app does:
1. Captures element selectors during setup (e.g., "#prompt-textarea")
2. Injects your text via executeJavaScript():
   webview.executeJavaScript(`
     document.querySelector('#prompt-textarea').value = 'your question';
     document.querySelector('button[type=submit]').click();
   `)
3. The AI website processes it normally, as if you typed it
```

**Why is this better than API integration?**
- ✅ **Free**: Uses your existing AI accounts, no API costs
- ✅ **Flexible**: Works with ANY AI website
- ✅ **Future-proof**: Even works with new AI platforms that launch tomorrow
- ✅ **Full features**: Get access to all website features (image upload, voice, etc.)
- ✅ **No rate limits**: Subject only to your account's web rate limits

**Supported Platforms (Pre-configured):**
- ChatGPT (OpenAI)
- Claude (Anthropic)
- Gemini Web (Google)
- DeepSeek
- Perplexity
- Custom platforms you add

---

### 3. Quiz Generator (Gemini Integration)

**What is it?**
An AI-powered quiz generation system that creates practice quizzes directly from your PDF content using Google's Gemini AI.

**The Learning Science Behind It:**
- **Active Recall**: Testing yourself is more effective than re-reading
- **Spaced Repetition**: Regular quizzes help long-term retention
- **Immediate Feedback**: See correct answers right away
- **Confidence Building**: Track your progress over time

**How it Works:**

#### 1. Authentication (One-time setup):
1. Go to **Settings** or click **Quiz** tab
2. Click **"Login with Google"**
3. A terminal window opens with a link
4. Open the link in your browser and authorize the app
5. Copy the verification code
6. Paste it back in the terminal
7. Status changes to **"Connected ✓"**

**Why OAuth instead of API keys?**
- No need to get/store API keys
- More secure (official Google authentication)
- Easier for non-technical users
- Better quota management

#### 2. Creating a Quiz:

1. **Open your PDF** to the section you want to study
2. **Click "Quiz" tab** in the top navigation
3. **Configure quiz settings:**
   - **Difficulty**: Easy, Medium, Hard
   - **Question Count**: 5, 10, 15, or 20 questions
   - **Topics**: Auto-detected from PDF or manually specify
   - **Question Types**: Multiple choice, True/False, Short answer
4. **Click "Generate Quiz"**
5. **Wait 10-30 seconds** (depending on content length)

#### 3. Taking the Quiz:

- **Interactive UI**: Distraction-free quiz interface
- **Timer**: Optional time limit for pressure training
- **Progress bar**: See how many questions remain
- **Immediate feedback**: Know if you're right or wrong
- **Explanations**: AI provides reasoning for correct answers

#### 4. Review Results:

- **Score breakdown**: X/Y correct (percentage)
- **Question analysis**: See which questions you missed
- **Correct answers**: Learn from mistakes
- **Time statistics**: How long you took
- **Retry option**: Take the quiz again to improve

**Technical Details:**

**Text Extraction:**
```typescript
// App extracts text from current PDF page(s)
const pdfText = await pdfViewer.extractText(startPage, endPage);
// Sends to backend
```

**Gemini Prompt Structure:**
```
You are a quiz generator. Create a quiz from the following text.

Requirements:
- Generate exactly {count} questions
- Difficulty: {difficulty}
- Topics: {topics}
- Format: Multiple choice with 4 options

Text:
{pdfText}

Return JSON format:
{
  "questions": [
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct": 2,
      "explanation": "..."
    }
  ]
}
```

**CLI Execution:**
```bash
# Backend runs:
gemini chat --prompt "{structured_prompt}"
# Returns JSON response
```

**API Quotas:**
- Free tier: 60 requests per minute
- Each quiz = 1 request
- Very generous for personal study use

**Why Gemini?**
- **Free tier**: Generous quota for students
- **Official CLI**: No complex API integration
- **Context window**: Can handle large PDF sections
- **Structured output**: Reliably returns JSON format
- **Quality**: Generates thoughtful, educational questions

---

### 4. Smart Text Selection Tools

**What is it?**
When you select text in the PDF, a floating toolbar appears with instant action buttons.

**Available Actions:**

#### 📝 Summarize
- **Purpose**: Get a concise summary of long passages
- **Use case**: Studying dense textbooks, research papers
- **How it works**: Sends text to AI with "Summarize this:" prefix

#### 🌐 Translate
- **Purpose**: Translate text to your preferred language
- **Use case**: Reading foreign language documents
- **How it works**: Sends text with "Translate to [language]:" prefix
- **Language detection**: Auto-detects source language

#### 💡 Explain
- **Purpose**: Get detailed explanations of complex concepts
- **Use case**: Understanding difficult topics, technical jargon
- **How it works**: Sends text with "Explain this concept:" prefix

#### 🤖 Send to AI
- **Purpose**: Send raw text without any prefix
- **Use case**: Custom questions, follow-up queries
- **How it works**: Direct text injection to AI

**Customization:**
- Can add custom action buttons in settings
- Set your preferred language for translations
- Configure AI prompt templates

---

### 5. Screenshot & Visual Analysis

**What is it?**
Capture portions of your PDF (diagrams, charts, equations) and send them to AI for visual analysis.

**Use Cases:**
- **Math problems**: Snap an equation and ask AI to solve it
- **Diagrams**: Get explanations of complex diagrams
- **Charts/Graphs**: Analyze data visualizations
- **Tables**: Extract and understand tabular data
- **Flowcharts**: Understand process flows

**How to Use:**

#### Full Page Screenshot:
1. Right-click in PDF → "Full Page Screenshot"
2. Or press `Ctrl/Cmd + S`
3. Image is copied to clipboard
4. Use `Ctrl/Cmd + V` to paste in AI chat

#### Crop Screenshot:
1. Right-click → "Crop Screenshot"
2. Or press `Ctrl/Cmd + Shift + S`
3. Click and drag to select region
4. Release to capture
5. Image is copied to clipboard
6. Paste in AI chat

**AI Support:**
- ChatGPT (GPT-4 with vision)
- Claude (vision models)
- Gemini (multimodal)

**Technical Implementation:**
- Uses Electron's `capturePage()` API
- Converts to data URL
- Copies to system clipboard as image
- AI websites accept paste events

---

### 6. Split-Screen Interface

**What is it?**
Resizable split-screen layout with PDF on one side and AI on the other.

**Features:**
- **Adjustable divider**: Drag the center bar to resize panels
- **Swap sides**: Switch PDF and AI positions with one click
- **Remember preferences**: App saves your layout preferences
- **Responsive**: Adapts to different screen sizes
- **Minimize panels**: Focus on one side when needed

**Keyboard Shortcuts:**
- `Ctrl/Cmd + [`: Focus left panel
- `Ctrl/Cmd + ]`: Focus right panel
- `Ctrl/Cmd + \`: Swap panels
- `Ctrl/Cmd + 0`: Reset to 50/50 split

---

### 7. Multi-Language Support

**Available Languages:**
- English
- Turkish (Türkçe)

**What's Translated:**
- All UI text and buttons
- Settings and preferences
- Error messages
- Tutorial content
- Context menus

**How to Change Language:**
1. Click **Settings** gear icon
2. Go to **Language** section
3. Select your preferred language
4. App restarts with new language

**For Developers:**
- Translation files: `frontend/locales/en.json` and `tr.json`
- Uses React Context for language switching
- Easy to add new languages by creating new JSON files

---

### 8. Themes (Light & Dark Mode)

**Dark Mode** (Default):
- Optimized for long reading sessions
- Reduces eye strain
- OLED-friendly (true blacks)

**Light Mode**:
- Better for well-lit environments
- Print-like reading experience

**Auto-switching** (Coming soon):
- Follow system theme
- Time-based switching

---

## 🎯 Study Workflows

### Workflow 1: Active Reading with AI

**Goal**: Understand complex material deeply

1. Open your PDF textbook/paper
2. Read a section
3. Select confusing parts → Click "Explain"
4. Read AI explanation
5. Ask follow-up questions in chat
6. Move to next section

**Best for**: Textbooks, research papers, technical documentation

---

### Workflow 2: Quiz-Based Learning

**Goal**: Memorize and retain information

1. Read a chapter/section
2. Generate a quiz on that content
3. Take the quiz without looking back
4. Review wrong answers
5. Re-read those sections
6. Retake quiz until 100%

**Best for**: Exam preparation, certification studies, language learning

---

### Workflow 3: Research & Note-Taking

**Goal**: Extract insights from multiple sources

1. Open research paper
2. Use "Summarize" on key sections
3. Send summaries to AI chat
4. Ask AI to compare with other papers
5. Generate synthesis questions
6. Screenshot important figures → Discuss with AI

**Best for**: Literature reviews, thesis research, academic writing

---

### Workflow 4: Language Learning

**Goal**: Learn vocabulary and grammar from authentic texts

1. Open document in target language
2. Select unknown words/phrases
3. Click "Translate"
4. Ask AI for usage examples
5. Generate quiz on new vocabulary
6. Practice with AI conversation

**Best for**: Language textbooks, foreign articles, translation practice

---

## 🔧 Advanced Features

### Custom AI Platforms

**Add your own AI tools:**

1. Go to Settings → AI Platforms
2. Click "Add Custom AI"
3. Enter:
   - **Name**: Display name
   - **URL**: Website URL
4. Click Save
5. Use Magic Selector to configure it

**Examples:**
- HuggingChat
- Poe.com
- Local LLMs (Ollama web UI, LM Studio)
- Company-internal AI tools

---

### Automation Scripts

**For advanced users**, the app exposes automation functions:
- Focus input field
- Click send button
- Auto-send with text

**Use cases:**
- Browser extensions
- Custom integrations
- Power-user workflows

---

## 🛡️ Privacy & Security

### Your Data:
- **PDFs**: Stored only on your computer
- **AI Configs**: Saved locally in app data folder
- **No cloud sync**: Nothing leaves your machine except AI requests

### AI Requests:
- **Magic Selector**: Goes directly to AI website (you control the account)
- **Gemini Quiz**: Uses your Google account (OAuth)
- **No middleman**: We don't see or store your queries

### Credentials:
- **No API keys in app**: Everything uses OAuth or web sessions
- **Secure storage**: Credentials stored by official CLIs/browsers

---

## 🚀 Coming Soon

### Planned Features:
1. **Plugin System**: Community-made extensions
2. **Cloud Sync**: Optional sync across devices
3. **Collaborative Quizzes**: Share with study groups
4. **Flashcard Mode**: Spaced repetition system
5. **Voice Input**: Talk to AI while reading
6. **Mobile App**: Quiz companion app for phones
7. **Local LLM Support**: Built-in Ollama integration
8. **PDF Annotations**: Highlight and note-taking

---

## Türkçe - Özellikler Dokümantasyonu

Bu belge QuizLab Reader'daki her ana özelliği, nasıl çalıştıklarını ve nasıl etkili kullanılacaklarını detaylı şekilde açıklar.

---

## 📚 Temel Özellikler

### 1. Profesyonel PDF Okuyucu

**Nedir?**
Doğrudan uygulamaya entegre edilmiş yüksek performanslı bir PDF görüntüleyici, PDF dokümanlarını okumanıza ve onlarla etkileşim kurmanıza olanak tanır.

**Temel Yetenekler:**
- **Çok sayfalı görüntüleme**: Dokümanlar arasında akıcı kaydırma ile gezinme
- **Zoom kontrolleri**: Okuma konforunu ayarlamak için yakınlaştırma/uzaklaştırma (%50 - %400)
- **Metin seçimi**: PDF dokümanlarından metin seçme ve kopyalama
- **Sayfa gezinmesi**: Belirli sayfalara atlama veya sonraki/önceki butonları kullanma
- **Arama işlevi**: Dokümanda belirli metin bulma
- **Küçük resim kenar çubuğu**: Hızlı gezinme için sayfa küçük resimlerini görüntüleme

**Nasıl kullanılır:**
1. Üst çubukta **"PDF Aç"** butonuna tıklayın
2. Dosya seçiciden PDF dosyanızı seçin
3. Zoom, gezinme ve arama için araç çubuğu kontrollerini kullanın
4. Ek seçenekler için PDF alanına sağ tıklayın

**Neden faydalıdır?**
Tarayıcı PDF görüntüleyiciler veya ayrı uygulamalardan farklı olarak, PDF entegrasyonu sayesinde pencere değiştirmeden veya uygulamalar arası kopyala-yapıştır yapmadan okurken AI özelliklerini sorunsuz kullanabilirsiniz.

---

### 2. AI Asistanı Entegrasyonu (Sihirli Seçici)

**Nedir?**
API anahtarlarına veya teknik kuruluma ihtiyaç duymadan HERHANGİ bir web tabanlı AI chatbot'u (ChatGPT, Claude, Gemini, DeepSeek, Perplexity, vb.) çalışma seansınıza entegre etmenizi sağlayan devrim niteliğinde bir özellik.

**Çözdüğü Sorun:**
- API anahtarları pahalı veya kullanım sınırları var
- PDF okuyucu ve AI chat websiteleri arasında geçiş yapmak yorucu
- Soruları manuel olarak kopyala-yapıştır yapmak akışınızı bozuyor
- Farklı AI araçları farklı API implementasyonları gerektiriyor

**Sihirli Seçici Nasıl Çalışır:**

#### Kurulum (Her AI websitesi için tek seferlik):

1. **AI panelini açın** (ekranın sağ tarafı)
2. **Tercih ettiğiniz AI websitesine gidin** (örn. chatgpt.com)
3. **Alt araç çubuğundaki Sihirli Değnek ikonuna tıklayın** 🪄
4. **Adım 1: Normalde mesaj yazdığınız metin giriş alanına tıklayın**
   - Uygulama bu element için CSS seçiciyi yakalar
   - Durum "Giriş Seçildi ✓" gösterir
5. **Adım 2: Gönder butonuna tıklayın**
   - Uygulama buton seçiciyi yakalar
   - Durum "Buton Seçildi ✓" gösterir
6. **Kurulum Tamamlandı!** Uygulama artık bu website ile nasıl etkileşim kuracağını biliyor

#### Sihirli Seçiciyi Kullanma:

Kurulumdan sonra:
1. **PDF'nizde herhangi bir metin seçin** (tanımlar, paragraflar, denklemler)
2. **Yüzen araç çubuğunda "AI'ya Gönder"e tıklayın**
3. **Metin otomatik olarak AI sohbetinde görünür** ve gönderilir
4. **AI'nin yanıtını** sağ panelde gerçek zamanlı görüntüleyin

**Neden API entegrasyonundan daha iyi?**
- ✅ **Ücretsiz**: Mevcut AI hesaplarınızı kullanır, API maliyeti yok
- ✅ **Esnek**: HERHANGİ bir AI websitesi ile çalışır
- ✅ **Geleceğe hazır**: Yarın çıkacak yeni AI platformları ile bile çalışır
- ✅ **Tam özellikler**: Website'in tüm özelliklerine erişin (resim yükleme, ses, vb.)
- ✅ **Oran sınırı yok**: Sadece hesabınızın web oran sınırlarına tabidir

---

### 3. Quiz Oluşturucu (Gemini Entegrasyonu)

**Nedir?**
Google'ın Gemini AI'sını kullanarak PDF içeriğinizden doğrudan pratik quizleri oluşturan yapay zeka destekli bir quiz üretim sistemi.

**Arkasındaki Öğrenme Bilimi:**
- **Aktif Hatırlama**: Kendinizi test etmek yeniden okumaktan daha etkilidir
- **Aralıklı Tekrar**: Düzenli quizler uzun vadeli hafızayı güçlendirir
- **Anında Geri Bildirim**: Doğru cevapları hemen görün
- **Güven Oluşturma**: İlerlemenizi zaman içinde takip edin

**Nasıl Çalışır:**

#### 1. Kimlik Doğrulama (Tek seferlik kurulum):
1. **Ayarlar**a gidin veya **Quiz** sekmesine tıklayın
2. **"Google ile Giriş Yap"** butonuna tıklayın
3. Bir terminal penceresi link ile açılır
4. Linki tarayıcınızda açın ve uygulamaya izin verin
5. Doğrulama kodunu kopyalayın
6. Kodu terminale geri yapıştırın
7. Durum **"Bağlandı ✓"** olarak değişir

#### 2. Quiz Oluşturma:

1. **PDF'nizi** çalışmak istediğiniz bölüme açın
2. Üst gezinmede **"Quiz" sekmesine** tıklayın
3. **Quiz ayarlarını yapılandırın:**
   - **Zorluk**: Kolay, Orta, Zor
   - **Soru Sayısı**: 5, 10, 15 veya 20 soru
   - **Konular**: PDF'den otomatik algılanan veya manuel belirtilen
   - **Soru Türleri**: Çoktan seçmeli, Doğru/Yanlış, Kısa cevap
4. **"Quiz Oluştur"a tıklayın**
5. **10-30 saniye bekleyin** (içerik uzunluğuna bağlı olarak)

---

### 4. Akıllı Metin Seçim Araçları

**Nedir?**
PDF'de metin seçtiğinizde, anında eylem butonları içeren yüzen bir araç çubuğu görünür.

**Mevcut Eylemler:**

#### 📝 Özetle
- **Amaç**: Uzun pasajların özet çıkarılması
- **Kullanım durumu**: Yoğun ders kitapları, araştırma makaleleri çalışmak
- **Nasıl çalışır**: "Bunu özetle:" öneki ile metni AI'ya gönderir

#### 🌐 Çevir
- **Amaç**: Metni tercih ettiğiniz dile çevir
- **Kullanım durumu**: Yabancı dil dokümanları okuma
- **Nasıl çalışır**: "Şu dile çevir [dil]:" öneki ile metin gönderir

#### 💡 Açıkla
- **Amaç**: Karmaşık kavramların detaylı açıklamalarını alın
- **Kullanım durumu**: Zor konuları anlama, teknik jargon
- **Nasıl çalışır**: "Bu kavramı açıkla:" öneki ile metin gönderir

#### 🤖 AI'ya Gönder
- **Amaç**: Herhangi bir önek olmadan ham metni gönderin
- **Kullanım durumu**: Özel sorular, takip soruları

---

### 5. Ekran Görüntüsü & Görsel Analiz

**Nedir?**
PDF'nizin bölümlerini (diyagramlar, grafikler, denklemler) yakalayın ve görsel analiz için AI'ya gönderin.

**Kullanım Durumları:**
- **Matematik problemleri**: Bir denklemi çekin ve AI'dan çözmesini isteyin
- **Diyagramlar**: Karmaşık diyagramların açıklamalarını alın
- **Grafikler/Şemalar**: Veri görselleştirmelerini analiz edin
- **Tablolar**: Tablo verilerini çıkarın ve anlayın

---

### 6. Bölünmüş Ekran Arayüzü

**Nedir?**
Bir tarafta PDF, diğer tarafta AI olan yeniden boyutlandırılabilir bölünmüş ekran düzeni.

**Özellikler:**
- **Ayarlanabilir ayırıcı**: Panelleri yeniden boyutlandırmak için merkez çubuğu sürükleyin
- **Tarafları değiştir**: Tek tıkla PDF ve AI pozisyonlarını değiştirin
- **Tercihleri hatırla**: Uygulama düzen tercihlerinizi kaydeder

---

### 7. Çoklu Dil Desteği

**Mevcut Diller:**
- İngilizce (English)
- Türkçe

**Neler Çevriliyor:**
- Tüm UI metni ve butonlar
- Ayarlar ve tercihler
- Hata mesajları
- Öğretici içerik
- Bağlam menüleri

---

### 8. Temalar (Açık & Koyu Mod)

**Koyu Mod** (Varsayılan):
- Uzun okuma seansları için optimize edilmiş
- Göz yorgunluğunu azaltır
- OLED dostu (gerçek siyahlar)

**Açık Mod**:
- İyi aydınlatılmış ortamlar için daha iyi
- Baskı benzeri okuma deneyimi

---

## 🎯 Çalışma İş Akışları

### İş Akışı 1: AI ile Aktif Okuma

**Hedef**: Karmaşık materyali derinlemesine anlama

1. PDF ders kitabınızı/makalenizi açın
2. Bir bölüm okuyun
3. Kafa karıştırıcı kısımları seçin → "Açıkla"ya tıklayın
4. AI açıklamasını okuyun
5. Sohbette takip soruları sorun
6. Sonraki bölüme geçin

**En iyisi**: Ders kitapları, araştırma makaleleri, teknik dokümantasyon

---

### İş Akışı 2: Quiz Tabanlı Öğrenme

**Hedef**: Bilgiyi ezberleme ve tutma

1. Bir bölüm/kısım okuyun
2. O içerik üzerinde bir quiz oluşturun
3. Geriye bakmadan quiz çözün
4. Yanlış cevapları gözden geçirin
5. O bölümleri yeniden okuyun
6. %100'e ulaşana kadar quizi tekrar çözün

**En iyisi**: Sınav hazırlığı, sertifikasyon çalışmaları, dil öğrenimi

---

### İş Akışı 3: Araştırma & Not Alma

**Hedef**: Çoklu kaynaklardan içgörüler çıkarma

1. Araştırma makalesini açın
2. Anahtar bölümlerde "Özetle" kullanın
3. Özetleri AI sohbetine gönderin
4. AI'dan diğer makalelerle karşılaştırmasını isteyin
5. Sentez soruları oluşturun
6. Önemli figürlerin ekran görüntüsü → AI ile tartışın

**En iyisi**: Literatür incelemeleri, tez araştırması, akademik yazım

---

### İş Akışı 4: Dil Öğrenimi

**Hedef**: Otantik metinlerden kelime ve dilbilgisi öğrenme

1. Hedef dilde doküman açın
2. Bilinmeyen kelime/ifadeleri seçin
3. "Çevir"e tıklayın
4. Kullanım örnekleri için AI'ya sorun
5. Yeni kelime dağarcığı üzerine quiz oluşturun
6. AI konuşması ile pratik yapın

**En iyisi**: Dil ders kitapları, yabancı makaleler, çeviri pratiği

---

## 🛡️ Gizlilik & Güvenlik

### Verileriniz:
- **PDF'ler**: Sadece bilgisayarınızda saklanır
- **AI Yapılandırmaları**: Yerel olarak uygulama veri klasöründe kaydedilir
- **Bulut senkronizasyon yok**: AI istekleri dışında hiçbir şey makinenizden çıkmaz

### AI İstekleri:
- **Sihirli Seçici**: Doğrudan AI websitesine gider (hesabı siz kontrol edersiniz)
- **Gemini Quiz**: Google hesabınızı kullanır (OAuth)
- **Aracı yok**: Sorgularınızı görmüyor veya saklamıyoruz

---

## 🚀 Yakında

### Planlanan Özellikler:
1. **Eklenti Sistemi**: Topluluk yapımı uzantılar
2. **Bulut Senkronizasyonu**: Cihazlar arası opsiyonel senkronizasyon
3. **İşbirlikçi Quizler**: Çalışma grupları ile paylaşım
4. **Flashcard Modu**: Aralıklı tekrar sistemi
5. **Ses Girişi**: Okurken AI ile konuşma
6. **Mobil Uygulama**: Telefonlar için quiz yardımcı uygulaması
7. **Yerel LLM Desteği**: Dahili Ollama entegrasyonu
8. **PDF Notları**: Vurgulama ve not alma

---

Belirli bileşenler hakkında daha fazla detay için:
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Geliştirme rehberi
- [README.md](../README.md) - Kullanıcı dokümantasyonu
- Kaynak dosyalardaki kod yorumları
