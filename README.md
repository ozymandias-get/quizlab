# QuizLab Reader 📚✨

[![Turkish](https://img.shields.io/badge/lang-Türkçe-red.svg)](README_TR.md) ![Version](https://img.shields.io/badge/version-3.1.0-blue.svg) ![License](https://img.shields.io/badge/license-MIT-green.svg) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

> **🇹🇷 [Türkçe Dokümantasyon için Tıklayın](README_TR.md)**

**QuizLab Reader**, is a next-generation study tool designed to supercharge your learning workflow by merging a powerful **PDF Reader** with an embedded **AI Assistant**.

It features a unique split-screen architecture that bridges the gap between static documents and dynamic AI models. Unlike typical wrappers, QuizLab Reader uses **Google's Gemini CLI** for native quiz generation and a **DOM-injection "Magic Selector"** engine to integrate *any* web-based chatbot (ChatGPT, Claude, DeepSeek) without needing API keys.

---

## 🚀 Key Features

### 🧠 Native Gemini Integration (CLI Based)

* **No API Keys Required:** Uses the official `@google/gemini-cli` package. Simply log in with your Google Account via the terminal popup, and you're ready to go.
* **AI Quiz Generator:** The app extracts text from your PDF, sends it to Gemini Pro via CLI, and generates comprehensive quizzes with detailed explanations.
* **Context-Aware:** Identify chapters and key concepts automatically to create focused study materials.

### 🪄 The "Magic Selector" Engine

* **Universal AI Support:** Don't be limited to one provider. Use the built-in Chromium browser to load **ChatGPT**, **Claude**, **DeepSeek**, or **Perplexity**.
* **Visual DOM Mapping:** Use the "Magic Wand" tool to visually click on the *Input Box* and *Send Button* of any website.
* **Auto-Injection:** Once mapped, the app can programmatically inject selected text from your PDF into the chatbot and trigger responses, creating a seamless "Read & Ask" workflow.

### 📖 Advanced PDF Reflow & Tools

* **Split-Screen Interface:** Resizable panels with "Swap" functionality.
* **Smart Text Selection:** Selecting text in the PDF populates a floating toolbar to instantly:
  * Summarize via AI
  * Translate
  * Explain Complex Terms
* **Screenshot-to-Prompt:** Capture a region of the PDF (e.g., a diagram) and paste it directly into the AI chat for visual analysis.

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
