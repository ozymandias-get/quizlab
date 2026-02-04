# QuizLab Reader 📚✨

![Version](https://img.shields.io/badge/version-3.1.0-blue.svg) ![License](https://img.shields.io/badge/license-MIT-green.svg) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

**QuizLab Reader**, is a next-generation study tool designed to supercharge your learning workflow. It seamlessly combines a powerful **PDF Reader** with an embedded **AI Assistant** in a split-screen interface, allowing you to read, summarize, and generate quizzes from your study materials instantly.

Unlike standard split-screen setups, QuizLab Reader features a **"Magic Selector"** engine that allows you to integrate *any* web-based AI chatbot (ChatGPT, Claude, DeepSeek, etc.) alongside your documents, enabling specialized workflows like "PDF-to-Quiz" generation using Google's Gemini models.

---

## 🚀 Key Features

### 📖 Professional PDF Reader

* **Split-Screen Interface:** Content on the left, intelligence on the right.
* **Advanced Navigation:** Thumbnail resizing, chapter detection, and smooth scrolling.
* **Smart Interactions:** Select text in your PDF and instantly send it to the AI with a single click.
* **Screenshot Tool:** Capture specific diagrams or text blocks to analyze visually.

### 🧠 Universal AI Integration & "Magic Selector"

* **Bring Your Own AI:** Don't get locked into one model. Use the built-in browser to load ChatGPT, Claude, DeepSeek, or any other web-based AI.
* **Magic Selector Technology:** Visually select the "Input" box and "Send" button on *any* website to enable deep integration. The app "learns" how to talk to that website.
* **Pre-defined Prompts:** Access a library of optimized prompts for summarizing, explaining, or translating text.

### 📝 AI Quiz Generator (Powered by Gemini)

* **Instant Quizzes:** Turn any PDF chapter into a comprehensive quiz in seconds.
* **Detailed Analytics:** Get instant grading, explanations for wrong answers, and performance tracking.
* **Custom Difficulty:** Choose from Easy, Medium, or Hard difficulty levels.
* **Focus Mode:** Tell the AI to focus specifically on certain topics (e.g., "Cardiology" or "Quantum Mechanics").
* *(Requires Google Gemini API Key via integrated CLI)*

### 🎨 Modern & Customizable UI

* **Aesthetic Design:** Glassmorphism effects, smooth animations, and a sleek dark/light mode.
* **Customizable Layouts:** Swap panels, resize the split view, or collapse the sidebar.
* **Internationalization:** Full support for English 🇺🇸 and Turkish 🇹🇷 languages.

---

## 🛠 Installation & Setup

### Prerequisites

* Node.js (v18 or higher)
* NPM or Yarn

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

3. **Run in Development Mode**

    ```bash
    npm run dev
    ```

    *This runs both the React frontend (Vite) and the Electron backend concurrently.*

### Building for Production

To create an executable file (reducer/installer) for your OS:

* **Windows:** `npm run build:win`
* **macOS:** `npm run build:mac`
* **Linux:** `npm run build:linux`

Artifacts will be generated in the `release/` directory.

---

## 🎮 How to Use

### 1. The Magic Selector (Connecting an AI)

1. Open the **AI Panel** on the right.
2. Navigate to your favorite AI website (e.g., chatgpt.com).
3. Click the **Magic Wand** icon in the toolbar.
4. Follow the on-screen guide:
    * **Click** the text input box on the page.
    * **Click** the send button on the page.
5. Done! Now, any text you select in the PDF can be sent directly to this AI.

### 2. Generating a Quiz

1. Open a PDF document.
2. Click the **"Quiz"** tab in the bottom bar.
3. Authenticate with your Google Account (for Gemini CLI) if prompted.
4. Select a **Difficulty** and optionally enter a **Focus Topic**.
5. Click **"Generate Quiz"**. The AI will read your document and prepare a test for you.

---

## 🏗 Tech Stack

* **Core:** [Electron](https://www.electronjs.org/) + [React](https://reactjs.org/)
* **Build Tool:** [Vite](https://vitejs.dev/)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **Styling:** [TailwindCSS](https://tailwindcss.com/) + CSS Modules
* **PDF Engine:** [React PDF Viewer](https://react-pdf-viewer.dev/) / PDF.js
* **AI Bridge:** Google Gemini CLI + Custom DOM Automation

---

## 📂 Project Structure

```bash
quizlab-reader/
├── backend/                 # Electron Main Process
│   ├── main/               # Main process entry points (IPC, window management)
│   └── preload/            # Preload scripts (Bridging Node.js and Browser)
├── frontend/                # React Renderer Process
│   ├── components/         # Reusable UI components (PDF Viewer, AI Panel, etc.)
│   ├── context/            # Global state management (Context API)
│   ├── hooks/              # Custom React hooks
│   ├── locales/            # i18n translation files (en.json, tr.json)
│   ├── styles/             # Global styles and CSS modules
│   ├── utils/              # Helper functions (File system, formatting)
│   └── main.tsx            # App entry point
├── resources/               # Static assets for Electron build (icons)
├── installer/               # NSIS installer configuration
├── release/                 # Build artifacts (executables generate here)
├── .github/                 # GitHub workflows (CI/CD)
├── tailwind.config.js       # TailwindCSS configuration
├── vite.config.ts           # Vite bundler configuration
└── package.json            # Project dependencies and scripts
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
