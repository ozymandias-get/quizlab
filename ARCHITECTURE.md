# QuizLab Reader - Architecture Documentation

[![Turkish](https://img.shields.io/badge/lang-Türkçe-red.svg)](#türkçe---mimari-dokümantasyon) [![English](https://img.shields.io/badge/lang-English-blue.svg)](#english---architecture-documentation)

---

## English - Architecture Documentation

This document explains the technical architecture and design decisions behind QuizLab Reader.

### System Overview

QuizLab Reader is a desktop application built on **Electron**, which allows us to create a cross-platform app using web technologies (HTML, CSS, JavaScript/TypeScript). The app follows a **multi-process architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                    QuizLab Reader                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐              ┌────────────────────┐    │
│  │  Main Process   │◄────IPC─────►│ Renderer Process   │    │
│  │   (Node.js)     │              │   (Chromium/React) │    │
│  ├─────────────────┤              ├────────────────────┤    │
│  │ • Window Mgmt   │              │ • PDF Viewer       │    │
│  │ • File System   │              │ • UI Components    │    │
│  │ • Quiz Service  │              │ • AI Webview       │    │
│  │ • IPC Handlers  │              │ • State Management │    │
│  │ • Native APIs   │              │                    │    │
│  └─────────────────┘              └────────────────────┘    │
│         │                                   │                │
│         └───────────┬───────────────────────┘                │
│                     │                                        │
│              ┌──────▼──────┐                                │
│              │  Preload    │                                │
│              │   Script    │                                │
│              │ (Bridge)    │                                │
│              └─────────────┘                                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Core Architecture Components

#### 1. Main Process (Backend)
**Location**: `backend/main/`
**Runtime**: Node.js
**Purpose**: Handles system-level operations and native API access

**Key Files**:
- `index.ts`: Application entry point, initializes Electron
- `windowManager.ts`: Creates and manages application windows
- `ipcHandlers.ts`: Handles IPC (Inter-Process Communication) messages
- `pdfProtocol.ts`: Custom protocol handler for loading PDF files
- `updater.ts`: Auto-update functionality

**Responsibilities**:
- Create and manage application windows
- Handle file system operations (open/save PDF files)
- Execute Gemini CLI commands for quiz generation
- Manage native OS integrations (menu, tray, notifications)
- Provide secure bridge to renderer process via IPC

#### 2. Renderer Process (Frontend)
**Location**: `frontend/`
**Runtime**: Chromium (Chrome browser engine)
**Framework**: React 18 + TypeScript
**Purpose**: Renders the user interface

**Key Directories**:
- `components/`: React UI components
  - `pdf/`: Custom PDF viewer implementation
  - `QuizModule/`: Quiz generation and gameplay UI
  - `AiWebview.tsx`: Embedded browser for AI chatbots
  - `SettingsModal.tsx`: Application settings
- `hooks/`: Custom React hooks for reusable logic
- `context/`: React Context providers for global state
- `utils/`: Helper functions and utilities

**Responsibilities**:
- Render user interface
- Handle user interactions
- Manage application state
- Communicate with main process via IPC
- Display PDF documents
- Embed and control AI chatbot webviews

#### 3. Preload Scripts
**Location**: `backend/preload/`
**Purpose**: Secure bridge between main and renderer processes

**Why Preload?**
Electron's security model prevents the renderer process from directly accessing Node.js APIs. The preload script:
- Runs in a privileged context with access to both worlds
- Exposes specific, safe APIs to the renderer via `contextBridge`
- Prevents arbitrary code execution from the renderer

**Example**:
```typescript
// backend/preload/index.ts
contextBridge.exposeInMainWorld('electron', {
  openPDF: () => ipcRenderer.invoke('open-pdf'),
  generateQuiz: (text: string) => ipcRenderer.invoke('generate-quiz', text)
});

// frontend component can now use:
const pdf = await window.electron.openPDF();
```

### Key Features Implementation

#### Feature 1: PDF Viewing

**Technology Stack**:
- **PDF.js**: Mozilla's PDF parsing engine
- **@react-pdf-viewer**: React wrapper components
- Custom protocol handler for loading files

**Flow**:
```
User clicks "Open PDF"
      ↓
Frontend calls window.electron.openPDF()
      ↓
Main process shows native file picker
      ↓
User selects PDF file
      ↓
Main process registers file with custom protocol (pdf://local/path)
      ↓
Returns protocol URL to renderer
      ↓
React PDF Viewer loads and renders PDF
```

**Files**:
- `backend/main/pdfProtocol.ts`: Custom protocol registration
- `frontend/components/pdf/PdfViewer.tsx`: Main viewer component
- `frontend/components/pdf/PdfToolbar.tsx`: Zoom, navigation controls

**Key Code**:
```typescript
// Register custom protocol
protocol.handle('pdf', async (request) => {
  const filePath = decodeURIComponent(request.url.slice('pdf://'.length));
  return net.fetch(`file://${filePath}`);
});
```

#### Feature 2: Magic Selector (AI Integration)

**Purpose**: Allow users to integrate any web-based AI chatbot without API keys

**Technology**:
- Electron's `<webview>` tag: Embeds entire websites
- DOM manipulation via `executeJavaScript()`
- Selector storage in application state

**How It Works**:

1. **Setup Phase** (One-time per website):
   ```
   User navigates to chatgpt.com in webview
         ↓
   User clicks "Magic Selector" button
         ↓
   App enters "selector mode"
         ↓
   User clicks on text input → App captures selector
         ↓
   User clicks on send button → App captures selector
         ↓
   App stores selectors: { input: "#prompt-textarea", send: "button[type=submit]" }
   ```

2. **Usage Phase**:
   ```
   User selects text in PDF
         ↓
   User clicks "Send to AI"
         ↓
   App executes JavaScript in webview:
         ↓
   document.querySelector(input).value = selectedText;
   document.querySelector(send).click();
         ↓
   AI responds in webview (user sees it immediately)
   ```

**Files**:
- `frontend/components/AiWebview.tsx`: Webview container
- `frontend/hooks/useAiSender.ts`: Text injection logic
- `frontend/hooks/useMagicSelector.ts`: Selector capture logic

**Key Code**:
```typescript
// Execute JavaScript in webview
await webview.executeJavaScript(`
  const input = document.querySelector('${inputSelector}');
  if (input) {
    input.value = ${JSON.stringify(text)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
`);
```

#### Feature 3: Quiz Generation

**Technology**:
- **@google/gemini-cli**: Official Google Gemini command-line tool
- OAuth authentication (no API keys needed)
- Structured prompts for consistent output

**Flow**:
```
User clicks "Generate Quiz"
      ↓
Frontend extracts text from current PDF page
      ↓
Sends text to main process via IPC
      ↓
Main process executes Gemini CLI:
  $ gemini chat --prompt "Generate quiz from: [text]"
      ↓
Gemini returns JSON with questions
      ↓
Main process parses and validates JSON
      ↓
Returns quiz data to renderer
      ↓
React Quiz component displays questions
```

**Authentication**:
- User logs in via Google OAuth (browser popup)
- CLI stores credentials locally
- All subsequent requests use stored auth

**Files**:
- `backend/modules/quizService.ts`: Gemini CLI wrapper
- `frontend/components/QuizModule/QuizCreator.tsx`: Quiz setup UI
- `frontend/components/QuizModule/QuizGame.tsx`: Quiz gameplay
- `frontend/components/QuizModule/QuizResults.tsx`: Score display

**Key Code**:
```typescript
// Call Gemini CLI
const { exec } = require('child_process');
exec(`gemini chat --prompt "${prompt}"`, (error, stdout) => {
  const quiz = JSON.parse(stdout);
  return quiz;
});
```

### Data Flow

#### IPC Communication Pattern

All communication between renderer and main follows this pattern:

```typescript
// 1. Define handler in main process
ipcMain.handle('channel-name', async (event, arg1, arg2) => {
  // Process request
  return result;
});

// 2. Expose in preload script
contextBridge.exposeInMainWorld('electron', {
  functionName: (arg1, arg2) => ipcRenderer.invoke('channel-name', arg1, arg2)
});

// 3. Call from renderer
const result = await window.electron.functionName(arg1, arg2);
```

**Why this pattern?**
- **Security**: Renderer can't access arbitrary IPC channels
- **Type Safety**: TypeScript types ensure correct usage
- **Simplicity**: Clean API for frontend developers

### State Management

**React Context API** is used for global state:

```
AppContext
├── PdfContext (current PDF, page number, zoom level)
├── QuizContext (quiz state, current question, score)
├── SettingsContext (user preferences, theme, language)
└── AiContext (AI integration settings, Magic Selector data)
```

**Why Context over Redux?**
- Simpler for this app's scope
- Built-in to React (no extra dependencies)
- Sufficient for our state complexity

### Build System

**Development**:
```bash
npm run dev
```
- Vite dev server (port 5173) for hot-reload
- Electron process starts after Vite is ready
- TypeScript compilation in watch mode

**Production**:
```bash
npm run build        # Compile TypeScript + Vite build
npm run build:win    # Create Windows installer
npm run build:mac    # Create macOS DMG
npm run build:linux  # Create Linux AppImage
```

**Electron Builder Configuration**:
- Packages app with all dependencies
- Creates native installers (NSIS for Windows)
- Code signing (optional, requires certificate)
- Auto-updater integration

### Security Considerations

1. **Context Isolation**: Enabled by default
   - Renderer process can't access Node.js directly
   - All access goes through preload script

2. **Content Security Policy**:
   - Restricts what the renderer can load
   - Prevents XSS attacks

3. **Webview Security**:
   - Used for AI integration
   - Runs in isolated context
   - No access to app internals

4. **No API Keys in Code**:
   - Gemini uses OAuth (credentials stored by CLI)
   - Magic Selector doesn't need API access

### Performance Optimizations

1. **PDF Rendering**:
   - Virtualized scrolling (only render visible pages)
   - Web Worker for PDF parsing (doesn't block UI)
   - Canvas rendering with hardware acceleration

2. **React Optimization**:
   - `React.memo` for expensive components
   - `useMemo` and `useCallback` to prevent re-renders
   - Code splitting with dynamic imports

3. **Electron**:
   - Lazy window creation
   - Reuse windows when possible
   - Efficient IPC (avoid large data transfers)

---

## Türkçe - Mimari Dokümantasyon

Bu belge QuizLab Reader'ın teknik mimarisini ve tasarım kararlarını açıklar.

### Sistem Genel Bakış

QuizLab Reader, **Electron** üzerine inşa edilmiş bir masaüstü uygulamasıdır. Electron, web teknolojileri (HTML, CSS, JavaScript/TypeScript) kullanarak çapraz platform uygulama oluşturmamıza olanak tanır. Uygulama **çoklu-süreç mimarisi** takip eder:

```
┌─────────────────────────────────────────────────────────────┐
│                    QuizLab Reader                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐              ┌────────────────────┐    │
│  │  Ana Süreç      │◄────IPC─────►│ Renderer Süreci    │    │
│  │   (Node.js)     │              │   (Chromium/React) │    │
│  ├─────────────────┤              ├────────────────────┤    │
│  │ • Pencere Yön.  │              │ • PDF Görüntüleyici│    │
│  │ • Dosya Sistemi │              │ • UI Bileşenleri   │    │
│  │ • Quiz Servisi  │              │ • AI Webview       │    │
│  │ • IPC İşleyici  │              │ • Durum Yönetimi   │    │
│  │ • Native API'ler│              │                    │    │
│  └─────────────────┘              └────────────────────┘    │
│         │                                   │                │
│         └───────────┬───────────────────────┘                │
│                     │                                        │
│              ┌──────▼──────┐                                │
│              │  Preload    │                                │
│              │   Script    │                                │
│              │  (Köprü)    │                                │
│              └─────────────┘                                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Temel Mimari Bileşenler

#### 1. Ana Süreç (Backend)
**Konum**: `backend/main/`
**Çalışma Zamanı**: Node.js
**Amaç**: Sistem seviyesi işlemleri ve native API erişimini yönetir

**Ana Dosyalar**:
- `index.ts`: Uygulama giriş noktası, Electron'u başlatır
- `windowManager.ts`: Uygulama pencerelerini oluşturur ve yönetir
- `ipcHandlers.ts`: IPC (Süreçler Arası İletişim) mesajlarını işler
- `pdfProtocol.ts`: PDF dosyalarını yüklemek için özel protokol
- `updater.ts`: Otomatik güncelleme işlevi

**Sorumluluklar**:
- Uygulama pencerelerini oluştur ve yönet
- Dosya sistemi işlemlerini yönet (PDF aç/kaydet)
- Quiz oluşturmak için Gemini CLI komutlarını çalıştır
- Native işletim sistemi entegrasyonlarını yönet (menü, tray, bildirimler)
- IPC aracılığıyla renderer sürecine güvenli köprü sağla

#### 2. Renderer Süreci (Frontend)
**Konum**: `frontend/`
**Çalışma Zamanı**: Chromium (Chrome tarayıcı motoru)
**Framework**: React 18 + TypeScript
**Amaç**: Kullanıcı arayüzünü render eder

**Ana Dizinler**:
- `components/`: React UI bileşenleri
  - `pdf/`: Özel PDF görüntüleyici implementasyonu
  - `QuizModule/`: Quiz oluşturma ve oynanış arayüzü
  - `AiWebview.tsx`: AI chatbot'lar için gömülü tarayıcı
  - `SettingsModal.tsx`: Uygulama ayarları
- `hooks/`: Yeniden kullanılabilir mantık için özel React hook'ları
- `context/`: Global durum için React Context provider'ları
- `utils/`: Yardımcı fonksiyonlar ve araçlar

**Sorumluluklar**:
- Kullanıcı arayüzünü render et
- Kullanıcı etkileşimlerini yönet
- Uygulama durumunu yönet
- IPC aracılığıyla ana süreç ile iletişim kur
- PDF dokümanlarını göster
- AI chatbot webview'lerini göm ve kontrol et

#### 3. Preload Scriptleri
**Konum**: `backend/preload/`
**Amaç**: Ana ve renderer süreçleri arasında güvenli köprü

**Neden Preload?**
Electron'un güvenlik modeli, renderer sürecinin doğrudan Node.js API'lerine erişmesini engeller. Preload scripti:
- Her iki dünyaya da erişimi olan ayrıcalıklı bir bağlamda çalışır
- `contextBridge` aracılığıyla renderer'a belirli, güvenli API'leri açar
- Renderer'dan keyfi kod çalıştırılmasını engeller

### Temel Özellik İmplementasyonları

#### Özellik 1: PDF Görüntüleme

**Teknoloji Yığını**:
- **PDF.js**: Mozilla'nın PDF ayrıştırma motoru
- **@react-pdf-viewer**: React sarmalayıcı bileşenler
- Dosya yükleme için özel protokol işleyici

#### Özellik 2: Sihirli Seçici (AI Entegrasyonu)

**Amaç**: Kullanıcıların API anahtarı olmadan web tabanlı herhangi bir AI chatbot'u entegre etmesini sağlar

**Nasıl Çalışır**:

1. **Kurulum Aşaması** (Her website için tek seferlik):
   - Kullanıcı webview'de chatgpt.com'a gider
   - Kullanıcı "Sihirli Seçici" butonuna tıklar
   - Uygulama "seçici modu"na girer
   - Kullanıcı metin girişine tıklar → Uygulama seçiciyi yakalar
   - Kullanıcı gönder butonuna tıklar → Uygulama seçiciyi yakalar

2. **Kullanım Aşaması**:
   - Kullanıcı PDF'de metin seçer
   - Kullanıcı "AI'ya Gönder"e tıklar
   - Uygulama webview'de JavaScript çalıştırır
   - AI webview'de yanıt verir

#### Özellik 3: Quiz Oluşturma

**Teknoloji**:
- **@google/gemini-cli**: Resmi Google Gemini komut satırı aracı
- OAuth kimlik doğrulama (API anahtarı gerekmez)
- Tutarlı çıktı için yapılandırılmış prompt'lar

### Veri Akışı

#### IPC İletişim Şablonu

Renderer ve main arasındaki tüm iletişim bu şablonu takip eder:

```typescript
// 1. Ana süreçte işleyici tanımla
ipcMain.handle('kanal-adi', async (event, arg1, arg2) => {
  // İsteği işle
  return sonuc;
});

// 2. Preload scriptinde aç
contextBridge.exposeInMainWorld('electron', {
  fonksiyonAdi: (arg1, arg2) => ipcRenderer.invoke('kanal-adi', arg1, arg2)
});

// 3. Renderer'dan çağır
const sonuc = await window.electron.fonksiyonAdi(arg1, arg2);
```

### Güvenlik Değerlendirmeleri

1. **Context Isolation**: Varsayılan olarak etkin
2. **Content Security Policy**: XSS saldırılarını önler
3. **Webview Güvenliği**: İzole bağlamda çalışır
4. **Kodda API Anahtarı Yok**: Gemini OAuth kullanır

### Performans Optimizasyonları

1. **PDF Rendering**: Sadece görünür sayfaları render et
2. **React Optimizasyonu**: `React.memo`, `useMemo`, `useCallback`
3. **Electron**: Pencere yeniden kullanımı, verimli IPC

---

## 📊 Technology Decision Rationale

### Why Electron?
- Cross-platform (Windows, macOS, Linux)
- Native file system access
- Webview integration for AI
- Rich ecosystem

### Why React?
- Component-based architecture
- Large community and libraries
- Excellent TypeScript support
- Fast development

### Why Vite?
- Extremely fast HMR (Hot Module Replacement)
- Modern build tool
- Better than Webpack for our use case

### Why Gemini CLI?
- No API key management
- Official Google tool
- OAuth-based (secure)
- Free tier generous enough

---

## 🔄 Future Architecture Improvements

1. **Plugin System**: Allow third-party plugins
2. **Cloud Sync**: Optional cloud storage for PDFs and quizzes
3. **Mobile Companion App**: View quizzes on mobile
4. **Offline AI**: Local LLM integration (Ollama, LM Studio)
5. **Collaborative Features**: Share quizzes with classmates

---

For more details on specific components, see:
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guide
- [README.md](README.md) - User documentation
- Code comments in source files
