# Contributing to QuizLab Reader 🤝

[![Turkish](https://img.shields.io/badge/lang-Türkçe-red.svg)](#türkçe-katkıda-bulunma-rehberi) [![English](https://img.shields.io/badge/lang-English-blue.svg)](#english-contributing-guide)

---

## English Contributing Guide

Thank you for your interest in contributing to QuizLab Reader! This guide will help you understand the project structure and how to get started.

### What is QuizLab Reader?

QuizLab Reader is an AI-powered PDF reader that helps students study more effectively by:
- **Reading PDFs** with a professional viewer
- **Generating quizzes** from PDF content using Google Gemini AI
- **Integrating any AI chatbot** (ChatGPT, Claude, etc.) via the Magic Selector feature
- **Providing smart study tools** like text selection, summarization, and screenshot analysis

### Getting Started

1. **Prerequisites**
   - Node.js v18 or higher
   - Git
   - A code editor (VS Code recommended)
   - Basic knowledge of TypeScript, React, and Electron

2. **Clone and Setup**
   ```bash
   git clone https://github.com/ozymandias-get/quizlab.git
   cd quizlab
   npm install
   ```

3. **Run in Development Mode**
   ```bash
   npm run dev
   ```
   This starts:
   - Vite dev server (frontend)
   - Electron main process (backend)
   - Tailwind CSS compiler

### Project Architecture

QuizLab Reader is built as an Electron application with React:

```
quizlab/
├── backend/              # Electron Main Process (Node.js)
│   ├── main/            # Main process entry points
│   │   ├── index.ts           # Application entry point
│   │   ├── windowManager.ts   # Window creation and management
│   │   ├── ipcHandlers.ts     # IPC (Inter-Process Communication) handlers
│   │   └── pdfProtocol.ts     # Custom protocol for loading PDFs
│   ├── modules/         # Feature modules (quiz, screenshot, etc.)
│   └── preload/         # Preload scripts (secure bridge to renderer)
│
├── frontend/            # React Renderer Process (Browser)
│   ├── components/     
│   │   ├── pdf/              # PDF viewer components
│   │   ├── QuizModule/       # Quiz generation and gameplay UI
│   │   ├── AiWebview.tsx     # AI chatbot integration webview
│   │   └── ...               # Other UI components
│   ├── hooks/               # Custom React hooks
│   ├── context/             # React context providers
│   └── utils/               # Utility functions
│
├── resources/           # Static assets (icons, images)
└── docs/               # Documentation and screenshots
```

### Key Technologies

- **Electron**: Desktop application framework
- **React 18**: UI framework
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool
- **TailwindCSS**: Utility-first CSS
- **PDF.js**: PDF rendering
- **Google Gemini CLI**: AI quiz generation

### Development Guidelines

#### Code Style
- Use TypeScript for all new code
- Follow existing naming conventions
- Use functional components and hooks in React
- Keep components small and focused
- Add JSDoc comments for complex functions

#### Making Changes
1. Create a new branch: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Test thoroughly
4. Commit with clear messages: `git commit -m "feat: add new feature"`
5. Push and create a Pull Request

#### Testing
- Test your changes manually in the Electron app
- Check both light and dark themes
- Test on your target platform (Windows/macOS/Linux)
- Ensure no console errors

### Understanding Key Features

#### 1. Magic Selector
**Purpose**: Allows users to integrate any web-based AI chatbot without API keys.

**How it works**:
- User opens an AI website (e.g., ChatGPT) in the built-in browser
- User clicks "Magic Selector" tool and selects:
  1. The text input field
  2. The send button
- The app stores these selectors
- When user selects text in PDF and clicks "Send to AI", the app:
  - Injects the text into the input field
  - Triggers the send button
  - User sees the AI response in real-time

**Files**: 
- `frontend/components/AiWebview.tsx`
- `frontend/hooks/useAiSender.ts`
- `backend/main/ipcHandlers.ts` (IPC handlers for webview)

#### 2. Quiz Generation
**Purpose**: Generate practice quizzes from PDF content using Google Gemini AI.

**How it works**:
- Uses `@google/gemini-cli` package (official Google CLI tool)
- User authenticates once via OAuth
- App extracts text from current PDF page/section
- Sends text to Gemini with a structured prompt
- Gemini returns JSON with questions and answers
- App displays interactive quiz UI

**Files**:
- `frontend/components/QuizModule/`
- `backend/modules/quizService.ts`

#### 3. PDF Viewer
**Purpose**: Professional PDF viewing with text selection and annotations.

**How it works**:
- Uses Mozilla's PDF.js library
- Custom React wrapper for better integration
- Text selection triggers floating toolbar
- Supports zoom, search, page navigation

**Files**:
- `frontend/components/pdf/`
- `backend/main/pdfProtocol.ts` (custom protocol for loading PDFs)

### Common Tasks

#### Adding a New IPC Handler
IPC (Inter-Process Communication) allows the frontend to call backend functions.

1. Define handler in `backend/main/ipcHandlers.ts`:
```typescript
ipcMain.handle('my-channel', async (event, arg) => {
  // Your backend logic here
  return result;
});
```

2. Add type in `frontend/types/electron.d.ts`:
```typescript
interface Window {
  electron: {
    myFunction: (arg: string) => Promise<Result>;
  }
}
```

3. Expose in `backend/preload/index.ts`:
```typescript
contextBridge.exposeInMainWorld('electron', {
  myFunction: (arg: string) => ipcRenderer.invoke('my-channel', arg)
});
```

4. Use in React component:
```typescript
const result = await window.electron.myFunction(arg);
```

#### Adding a New UI Component
1. Create component in `frontend/components/YourComponent.tsx`
2. Use TypeScript and React hooks
3. Use Tailwind classes for styling
4. Add to parent component

#### Building for Production
```bash
npm run build:win   # Windows .exe
npm run build:mac   # macOS .dmg
npm run build:linux # Linux .AppImage
```

### Need Help?

- Check existing code for examples
- Read the README files (README.md, README_TR.md)
- Ask questions in GitHub Issues
- Review the docs/ folder for screenshots and guides

---

## Türkçe Katkıda Bulunma Rehberi

QuizLab Reader'a katkıda bulunmak istediğiniz için teşekkürler! Bu rehber, proje yapısını anlamanıza ve başlamanıza yardımcı olacaktır.

### QuizLab Reader Nedir?

QuizLab Reader, öğrencilerin daha etkili çalışmasına yardımcı olan yapay zeka destekli bir PDF okuyucudur:
- **PDF okuma** profesyonel bir görüntüleyici ile
- **Quiz oluşturma** PDF içeriğinden Google Gemini AI kullanarak
- **Herhangi bir AI sohbet botunu entegre etme** (ChatGPT, Claude, vb.) Sihirli Seçici özelliği ile
- **Akıllı çalışma araçları** metin seçimi, özetleme ve ekran görüntüsü analizi gibi

### Başlangıç

1. **Gereksinimler**
   - Node.js v18 veya üzeri
   - Git
   - Bir kod editörü (VS Code önerilir)
   - TypeScript, React ve Electron temel bilgisi

2. **Klonlama ve Kurulum**
   ```bash
   git clone https://github.com/ozymandias-get/quizlab.git
   cd quizlab
   npm install
   ```

3. **Geliştirme Modunda Çalıştırma**
   ```bash
   npm run dev
   ```
   Bu komut şunları başlatır:
   - Vite dev sunucusu (frontend)
   - Electron ana süreci (backend)
   - Tailwind CSS derleyicisi

### Proje Mimarisi

QuizLab Reader, React ile Electron uygulaması olarak geliştirilmiştir:

```
quizlab/
├── backend/              # Electron Ana Süreç (Node.js)
│   ├── main/            # Ana süreç giriş noktaları
│   │   ├── index.ts           # Uygulama giriş noktası
│   │   ├── windowManager.ts   # Pencere oluşturma ve yönetimi
│   │   ├── ipcHandlers.ts     # IPC (Süreçler Arası İletişim) işleyicileri
│   │   └── pdfProtocol.ts     # PDF yükleme için özel protokol
│   ├── modules/         # Özellik modülleri (quiz, ekran görüntüsü, vb.)
│   └── preload/         # Preload scriptleri (güvenli köprü)
│
├── frontend/            # React Renderer Süreci (Tarayıcı)
│   ├── components/     
│   │   ├── pdf/              # PDF görüntüleyici bileşenleri
│   │   ├── QuizModule/       # Quiz oluşturma ve oynanış arayüzü
│   │   ├── AiWebview.tsx     # AI chatbot entegrasyon webview'i
│   │   └── ...               # Diğer UI bileşenleri
│   ├── hooks/               # Özel React hook'ları
│   ├── context/             # React context sağlayıcıları
│   └── utils/               # Yardımcı fonksiyonlar
│
├── resources/           # Statik varlıklar (ikonlar, görseller)
└── docs/               # Dokümantasyon ve ekran görüntüleri
```

### Temel Teknolojiler

- **Electron**: Masaüstü uygulama çerçevesi
- **React 18**: UI çerçevesi
- **TypeScript**: Tip güvenli JavaScript
- **Vite**: Hızlı derleme aracı
- **TailwindCSS**: Utility-first CSS
- **PDF.js**: PDF render etme
- **Google Gemini CLI**: AI quiz oluşturma

### Geliştirme Kuralları

#### Kod Stili
- Tüm yeni kodlar için TypeScript kullanın
- Mevcut isimlendirme kurallarını takip edin
- React'te fonksiyonel bileşenler ve hook'lar kullanın
- Bileşenleri küçük ve odaklı tutun
- Karmaşık fonksiyonlar için JSDoc yorumları ekleyin

#### Değişiklik Yapma
1. Yeni bir branch oluşturun: `git checkout -b ozellik/ozellik-ismi`
2. Değişikliklerinizi yapın
3. Kapsamlı test edin
4. Net mesajlarla commit yapın: `git commit -m "feat: yeni özellik eklendi"`
5. Push'layın ve Pull Request oluşturun

#### Test Etme
- Değişikliklerinizi Electron uygulamasında manuel test edin
- Hem açık hem koyu temaları kontrol edin
- Hedef platformunuzda test edin (Windows/macOS/Linux)
- Konsol hatası olmadığından emin olun

### Temel Özellikleri Anlama

#### 1. Sihirli Seçici (Magic Selector)
**Amaç**: Kullanıcıların API anahtarı olmadan web tabanlı herhangi bir AI sohbet botunu entegre etmesini sağlar.

**Nasıl çalışır**:
- Kullanıcı yerleşik tarayıcıda bir AI web sitesi açar (örn. ChatGPT)
- Kullanıcı "Sihirli Seçici" aracına tıklar ve şunları seçer:
  1. Metin giriş alanı
  2. Gönder butonu
- Uygulama bu seçicileri saklar
- Kullanıcı PDF'de metin seçip "AI'ya Gönder"e tıkladığında, uygulama:
  - Metni giriş alanına enjekte eder
  - Gönder butonunu tetikler
  - Kullanıcı AI yanıtını gerçek zamanlı görür

**Dosyalar**: 
- `frontend/components/AiWebview.tsx`
- `frontend/hooks/useAiSender.ts`
- `backend/main/ipcHandlers.ts` (webview için IPC işleyicileri)

#### 2. Quiz Oluşturma
**Amaç**: PDF içeriğinden Google Gemini AI kullanarak pratik quizleri oluşturur.

**Nasıl çalışır**:
- `@google/gemini-cli` paketini kullanır (resmi Google CLI aracı)
- Kullanıcı OAuth ile bir kez kimlik doğrular
- Uygulama mevcut PDF sayfasından/bölümünden metin çıkarır
- Yapılandırılmış bir prompt ile metni Gemini'ye gönderir
- Gemini sorular ve cevaplarla JSON döndürür
- Uygulama interaktif quiz arayüzünü gösterir

**Dosyalar**:
- `frontend/components/QuizModule/`
- `backend/modules/quizService.ts`

#### 3. PDF Görüntüleyici
**Amaç**: Metin seçimi ve notlarla profesyonel PDF görüntüleme.

**Nasıl çalışır**:
- Mozilla'nın PDF.js kütüphanesini kullanır
- Daha iyi entegrasyon için özel React sarmalayıcı
- Metin seçimi yüzen araç çubuğunu tetikler
- Zoom, arama, sayfa gezinmeyi destekler

**Dosyalar**:
- `frontend/components/pdf/`
- `backend/main/pdfProtocol.ts` (PDF yükleme için özel protokol)

### Yaygın Görevler

#### Yeni IPC İşleyici Ekleme
IPC (Süreçler Arası İletişim) frontend'in backend fonksiyonlarını çağırmasını sağlar.

1. `backend/main/ipcHandlers.ts` içinde işleyici tanımlayın:
```typescript
ipcMain.handle('kanal-ismi', async (event, arg) => {
  // Backend mantığınız burada
  return sonuc;
});
```

2. `frontend/types/electron.d.ts` içinde tip ekleyin:
```typescript
interface Window {
  electron: {
    fonksiyonum: (arg: string) => Promise<Sonuc>;
  }
}
```

3. `backend/preload/index.ts` içinde açığa çıkarın:
```typescript
contextBridge.exposeInMainWorld('electron', {
  fonksiyonum: (arg: string) => ipcRenderer.invoke('kanal-ismi', arg)
});
```

4. React bileşeninde kullanın:
```typescript
const sonuc = await window.electron.fonksiyonum(arg);
```

#### Yeni UI Bileşeni Ekleme
1. `frontend/components/BileseniAdı.tsx` içinde bileşen oluşturun
2. TypeScript ve React hook'ları kullanın
3. Stil için Tailwind sınıfları kullanın
4. Ana bileşene ekleyin

#### Production için Derleme
```bash
npm run build:win   # Windows .exe
npm run build:mac   # macOS .dmg
npm run build:linux # Linux .AppImage
```

### Yardıma mı İhtiyacınız Var?

- Örnekler için mevcut kodu inceleyin
- README dosyalarını okuyun (README.md, README_TR.md)
- GitHub Issues'da soru sorun
- Ekran görüntüleri ve rehberler için docs/ klasörünü inceleyin

---

## 📜 Code of Conduct

- Be respectful and inclusive
- Help others learn and grow
- Focus on constructive feedback
- Follow the project's coding standards

## 📝 License

By contributing to QuizLab Reader, you agree that your contributions will be licensed under the MIT License.
