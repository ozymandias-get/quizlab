# QuizLab Reader 📚✨

[![Turkish](https://img.shields.io/badge/lang-Türkçe-red.svg)](README_TR.md) ![Version](https://img.shields.io/badge/version-1.0.3-blue.svg) ![License](https://img.shields.io/badge/license-MIT-green.svg) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

> **🇹🇷 [Türkçe Dokümantasyon için Tıklayın](README_TR.md)**

**QuizLab Reader** is a next-generation study tool designed to supercharge your learning workflow. It seamlessly merges a professional **PDF Reader** with an embedded **AI Assistant**.

> **The AI-Powered PDF Reader that turns your documents into interactive quizzes.** 📚✨

Unlike typical wrappers, QuizLab Reader features **Native Gemini Integration** (generating quizzes directly from your notes via CLI) and a revolutionary **"Magic Selector"** engine that lets you integrate *any* web-based chatbot (ChatGPT, Claude, DeepSeek) into your study session—no API keys required.

![App Overview](docs/images/app-overview.png)
*Split-screen interface: Your PDF on the left, your AI assistant on the right.*

---

## 🚀 Key Features

### 🧠 Native Gemini Integration & Quiz Module

Generate comprehensive quizzes from your PDFs in seconds using the Google Gemini CLI.

### 1. Quiz Settings

![Quiz Config](docs/images/quiz-creation.png)
*Customize difficulty, question count, and topics.*

### 2. Gameplay Interface

![Quiz Mode](docs/images/quiz-gameplay.png)
*Distraction-free interactive quiz environment.*

### 3. Detailed Results

![results](docs/images/quiz-results.png)
*Comprehensive scoring and correct/incorrect answer analysis.*

### 🪄 The "Magic Selector" Engine

Maximize your "Read & Ask" workflow flexibility.

![AI Integration](docs/images/ai-integration.png)
*Select text in the PDF and click "Send to AI". Your chosen AI (ChatGPT, Claude, etc.) responds instantly.*

### 📖 Advanced PDF Reflow & Tools

* **Split-Screen Interface:** Resizable panels with "Swap" functionality.
* **Smart Text Selection:** Selecting text in the PDF populates a floating toolbar to instantly Summarize, Translate, or Explain.
* **Screenshot-to-Prompt:** Capture a region of the PDF (e.g., a diagram) and paste it directly into the AI chat for visual analysis.

### 🗄️ Local Database & Library Management

Organize your documents with folders, take persistent notes, and manage your study library using a robust SQLite-based local database.

## 🏗 Tech Stack

Built with a cutting-edge stack for performance and maintainability:

* **Core:**
  * [Electron](https://www.electronjs.org/): Cross-platform desktop runtime
  * [React 18](https://reactjs.org/): Component-based UI library
  * [TypeScript](https://www.typescriptlang.org/): Static typing for robust code
  * [Vite](https://vitejs.dev/): Next-generation frontend tooling

* **UI & Styling:**
  * [TailwindCSS](https://tailwindcss.com/): Rapid UI development
  * [Framer Motion](https://www.framer.com/motion/): Production-ready animation library
  * [Lucide React](https://lucide.dev/): Beautiful & consistent icons
  * [Headless UI](https://headlessui.com/): Unstyled, fully accessible UI components

* **PDF Engine:**
  * [@react-pdf-viewer](https://react-pdf-viewer.dev/): Professional PDF viewing components
  * [PDF.js](https://mozilla.github.io/pdf.js/): Core PDF parsing standard

* **AI & Logic:**
  * **Google Gemini CLI:** Native integration via `@google/gemini-cli`
  * **Custom DOM Injector:** Proprietary "Magic Selector" engine for web automation

* **Build System:**
  * [Electron Builder](https://www.electron.build/): Multi-platform installer generation (NSIS, DMG, AppImage)

---

## 🛠 Installation & Setup

### Prerequisites

* Node.js (v18 or higher)
* Git
* A Google Account (for Gemini features)

### Development Setup

1. **Clone the repository**

    ```bash
    git clone https://github.com/ozymandias-get/quizlab.git
    cd quizlab
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

    *Note: This will also install the `@google/gemini-cli` package required for quiz generation.*

3. **Run in Development Mode**

    ```bash
    npm run dev
    ```

    *This runs three processes concurrently: The Vite dev server, the Electron main process, and the Tailwind compiler.*

### Building for Production

To create an executable installer/app image:

* **Windows:** `npm run build:win` (Produces `.exe` in `release/` folder)
* **macOS:** `npm run build:mac` (Produces `.dmg`)
* **Linux:** `npm run build:linux` (Produces `.AppImage`)

---

## 🎮 How to Use

### 1. Connecting Google Gemini (for Quizzes)

The app uses the **Gemini Developer CLI**. You do not need to paste an API Key.

1. Go to the **Settings** or **Quiz** tab.
2. Click **"Login with Google"**.
3. A terminal window will open. Follow the link, authorize the application, and copy the verification code.
4. Paste the code back into the terminal.
5. Status will change to **"Connected"**, enabling unlimited quiz generation based on your account quotas.

### 2. Setting up the Magic Selector (for Chat)

1. Open the right-hand **AI Panel**.
2. Navigate to a chat site (e.g., `chatgpt.com`).
3. Click the **Magic Wand 🪄** icon in the bottom toolbar.
4. **Step 1:** Click on the text input area of the website.
5. **Step 2:** Click on the "Send" button of the website.
6. The app now "knows" this website. Any text selected in your PDF can be sent here automatically.

---

## 📂 Project Structure

```bash
quizlab/
├── .github/                     # GitHub Actions and configurations
├── backend/                     # Electron Main Process
│   ├── main/                    # Main process logic
│   │   ├── handlers/            # IPC Handlers for various modules
│   │   │   ├── aiConfigHandlers.ts
│   │   │   ├── aiRegistryHandlers.ts
│   │   │   ├── automationHandlers.ts
│   │   │   ├── helpers.ts
│   │   │   ├── index.ts
│   │   │   ├── libraryHandlers.ts
│   │   │   ├── pdfHandlers.ts
│   │   │   ├── screenshotHandlers.ts
│   │   │   └── systemHandlers.ts
│   │   ├── constants.ts
│   │   ├── index.ts
│   │   ├── ipcHandlers.ts
│   │   ├── pdfProtocol.ts
│   │   ├── updater.ts
│   │   └── windowManager.ts
│   ├── managers/                # Business logic managers
│   │   ├── database/            # Database repositories and schema
│   │   │   ├── FileRepository.ts
│   │   │   ├── FolderRepository.ts
│   │   │   ├── NoteRepository.ts
│   │   │   └── SchemaManager.ts
│   │   ├── ConfigManager.ts
│   │   └── DatabaseManager.ts
│   ├── modules/                 # Functional modules
│   │   ├── ai/                  # AI platform integrations
│   │   │   ├── platforms/
│   │   │   │   ├── chatgpt.ts
│   │   │   │   ├── claude.ts
│   │   │   │   ├── deepseek.ts
│   │   │   │   └── qwen.ts
│   │   │   └── aiManager.ts
│   │   ├── automation/          # Browser automation logic
│   │   │   ├── automationScripts.ts
│   │   │   └── userElementPicker.ts
│   │   └── quiz/                # Quiz generation logic
│   │       ├── geminiService.ts
│   │       ├── promptBuilder.ts
│   │       └── quizCliHandler.ts
│   └── preload/                 # Electron preload scripts
│       └── index.ts
├── docs/                        # Documentation and screenshots
│   └── images/
│       ├── ai-integration.png
│       ├── app-overview.png
│       ├── quiz-creation.png
│       ├── quiz-gameplay.png
│       └── quiz-results.png
├── frontend/                    # React Renderer Process
│   ├── __tests__/               # Frontend tests
│   │   └── AiWebview.test.ts
│   ├── api/                     # API client definitions
│   │   └── quizApi.ts
│   ├── assets/                  # Frontend assets
│   │   └── icon.png
│   ├── components/              # UI Components
│   │   ├── BottomBar/           # Application bottom toolbar
│   │   │   ├── AIItem.tsx
│   │   │   ├── CenterHub.tsx
│   │   │   ├── ModelsPanel.tsx
│   │   │   ├── SettingsLoadingSpinner.tsx
│   │   │   ├── ToolButton.tsx
│   │   │   ├── ToolsPanel.tsx
│   │   │   ├── animations.ts
│   │   │   └── index.tsx
│   │   ├── FileExplorer/        # Library file explorer
│   │   │   ├── hooks/
│   │   │   │   ├── useExternalDragDrop.ts
│   │   │   │   ├── useFileDragDrop.ts
│   │   │   │   └── useFileExplorerActions.ts
│   │   │   ├── icons/
│   │   │   │   └── FileExplorerIcons.tsx
│   │   │   ├── DeleteConfirmModal.tsx
│   │   │   ├── DropOverlay.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── NewFolderInput.tsx
│   │   │   ├── TreeItem.tsx
│   │   │   └── index.tsx
│   │   ├── pdf/                 # PDF viewer and tools
│   │   │   ├── hooks/
│   │   │   │   ├── index.ts
│   │   │   │   ├── usePdfContextMenu.ts
│   │   │   │   ├── usePdfNavigation.ts
│   │   │   │   ├── usePdfPlugins.ts
│   │   │   │   ├── usePdfScreenshot.ts
│   │   │   │   └── usePdfTextSelection.ts
│   │   │   ├── PdfPlaceholder.tsx
│   │   │   ├── PdfSearchBar.tsx
│   │   │   ├── PdfToolbar.tsx
│   │   │   ├── PdfViewer.tsx
│   │   │   └── index.ts
│   │   ├── QuizModule/          # Quiz game and configuration
│   │   │   ├── QuizActive.tsx
│   │   │   ├── QuizConfigPanel.tsx
│   │   │   ├── QuizGenerating.tsx
│   │   │   ├── QuizModule.tsx
│   │   │   ├── QuizResults.tsx
│   │   │   └── index.ts
│   │   ├── SplashScreen/        # App startup screen
│   │   │   └── index.tsx
│   │   ├── Toast/               # Notification system
│   │   │   ├── ToastContainer.tsx
│   │   │   └── ToastItem.tsx
│   │   ├── AestheticLoader.tsx
│   │   ├── AiWebview.tsx
│   │   ├── AppBackground.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── FloatingButton.tsx
│   │   ├── Icons.tsx
│   │   ├── LeftPanel.tsx
│   │   ├── ScreenshotTool.tsx
│   │   ├── SettingsModal.tsx
│   │   ├── UpdateBanner.tsx
│   │   └── UsageAssistant.tsx
│   ├── constants/               # Global constants
│   │   ├── appConstants.ts
│   │   ├── appearance.ts
│   │   ├── prompts.ts
│   │   ├── storageKeys.ts
│   │   └── translations.ts
│   ├── context/                 # React Context providers
│   │   ├── AiContext.tsx
│   │   ├── AppToolContext.tsx
│   │   ├── AppearanceContext.tsx
│   │   ├── FileContext.tsx
│   │   ├── LanguageContext.tsx
│   │   ├── NavigationContext.tsx
│   │   ├── ToastContext.tsx
│   │   ├── UpdateContext.tsx
│   │   └── index.ts
│   ├── hooks/                   # Custom React hooks
│   │   ├── webview/
│   │   │   └── useWebviewLifecycle.ts
│   │   ├── index.ts
│   │   ├── useAiSender.ts
│   │   ├── useElementPicker.ts
│   │   ├── useLocalStorage.ts
│   │   ├── useOnlineStatus.ts
│   │   ├── usePanelResize.ts
│   │   ├── usePdfSelection.ts
│   │   ├── usePrompts.ts
│   │   ├── useScreenshot.ts
│   │   └── useSettings.ts
│   ├── locales/                 # Internationalization files
│   │   ├── en.json
│   │   └── tr.json
│   ├── public/                  # Static assets for renderer
│   │   ├── icon.png
│   │   ├── logo.png
│   │   └── splash.html
│   ├── styles/                  # Styling files
│   │   ├── modules/
│   │   │   ├── _aesthetic-loader.css
│   │   │   ├── _animations.css
│   │   │   ├── _backgrounds.css
│   │   │   ├── _base.css
│   │   │   ├── _buttons.css
│   │   │   ├── _floating-bar.css
│   │   │   ├── _fonts.css
│   │   │   ├── _glass-panel.css
│   │   │   ├── _pdf-viewer.css
│   │   │   ├── _quiz.css
│   │   │   ├── _resizer.css
│   │   │   ├── _screenshot.css
│   │   │   ├── _splash.css
│   │   │   └── _utilities.css
│   │   └── index.css
│   ├── types/                   # TypeScript type definitions
│   │   ├── global.d.ts
│   │   ├── pdf.ts
│   │   ├── vitest.d.ts
│   │   └── webview.ts
│   ├── utils/                   # Shared utility functions
│   │   ├── automation/
│   │   │   ├── domHelpers.ts
│   │   │   ├── styles.ts
│   │   │   └── uiTemplates.ts
│   │   ├── fileUtils.ts
│   │   ├── logger.ts
│   │   ├── uiUtils.ts
│   │   └── webviewUtils.ts
│   ├── App.tsx
│   ├── index.html
│   ├── main.tsx
│   └── vite-env.d.ts
├── installer/                   # Installer configuration
│   └── installer.nsh
├── resources/                   # Platform-specific resources
│   ├── icon.ico
│   └── icon.png
├── .gitignore
├── LICENSE
├── package-lock.json
├── package.json
├── postcss.config.js
├── README.md
├── README_TR.md
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## 🛡️ Security & Privacy

This project is **100% Open Source**. You can inspect every line of code here on GitHub.

* **Data Privacy:** No data is stored on our servers. All PDF processing and AI queries happen locally on your machine via your own Google/OpenAI accounts.
* **Virus Scan:** Every release is built from clean code. However, since we don't have an expensive "Code Signing Certificate" yet, Windows SmartScreen might flag the installer.
  * *If you see a warning: Click "More Info" -> "Run Anyway".*

[![VirusTotal](https://img.shields.io/badge/VirusTotal-Clean-brightgreen)](https://www.virustotal.com/gui/file/d78216b97311a074f2e92f0aae1c25c5a73780593855db370a92424d2268cebf/detection) *(Latest scan report - v1.0.3)*

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
