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

| Quiz Settings | Gameplay Interface | Detailed Results |
| :---: | :---: | :---: |
| ![Quiz Config](docs/images/quiz-creation.png) | ![Quiz Mode](docs/images/quiz-gameplay.png) | ![results](docs/images/quiz-results.png) |
| *Select difficulty and question count* | *Interactive quiz interface* | *Scoring and correct/incorrect analysis* |

### 🪄 The "Magic Selector" Engine

Maximize your "Read & Ask" workflow flexibility.

![AI Integration](docs/images/ai-integration.png)
*Select text in the PDF and click "Send to AI". Your chosen AI (ChatGPT, Claude, etc.) responds instantly.*

### 📖 Advanced PDF Reflow & Tools

* **Split-Screen Interface:** Resizable panels with "Swap" functionality.
* **Smart Text Selection:** Selecting text in the PDF populates a floating toolbar to instantly Summarize, Translate, or Explain.
* **Screenshot-to-Prompt:** Capture a region of the PDF (e.g., a diagram) and paste it directly into the AI chat for visual analysis.

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
quizlab-reader/
├── backend/                 # Electron Main Process
│   ├── main/               # Main process entry points (IPC, window management)
│   └── preload/            # Preload scripts (Secure bridge between Node & UI)
├── frontend/                # React Renderer Process
│   ├── components/         #
│   │   ├── pdf/            # Custom PDF Viewer implementation
│   │   ├── QuizModule/     # Gemini CLI integration & Quiz UI
│   │   └── ...
│   ├── hooks/              # Custom hooks (useAiSender, usePdfSelection)
│   ├── locales/            # i18n JSON files (en, tr)
│   └── styles/             # Tailwind & CSS Modules
├── resources/               # Static assets (icons, tray images)
├── installer/               # NSIS installer configuration for Windows
└── package.json            # Dependencies (includes @google/gemini-cli)
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
