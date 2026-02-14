# 🧪 QuizLab Reader

<!-- markdownlint-disable MD033 -->
<div align="center">

[![Turkish](https://img.shields.io/badge/lang-Türkçe-red.svg?style=flat-square)](README_TR.md)
[![Version](https://img.shields.io/badge/version-1.1.4-blue.svg?style=flat-square)](https://github.com/ozymandias-get/quizlab/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg?style=flat-square)](https://electronjs.org/)

**The Ultimate Desktop Study Cockpit**  
*Read PDFs, Chat with AI, and Generate Quizzes in one focused flow.*

[Features](#-core-features) • [Installation](#-quick-start) • [Structure](#-project-structure) • [Tech Stack](#-tech-stack)

</div>
<!-- markdownlint-enable MD033 -->

---

## 🚀 Overview

**QuizLab Reader** redefines your study sessions by blending a robust **PDF Reader**, a context-aware **AI Assistant**, and a powerful **Quiz Generator** into a single, seamless desktop application.

Say goodbye to tab-switching. Select text in your textbook, instantly clarify it with AI, and turn your notes into structured quizzes to test your mastery—all without leaving the app.

<!-- TODO: Add new app overview image -->

## ✨ Core Features

### 📚 AI + PDF Split Workspace

Read on the left, understand on the right. fast context transfer allows you to push selected text to the AI instantly.

### 🧠 Quiz Engine (Gemini CLI)

Transform passive reading into active recall.

- **Dynamic Generation:** Create quizzes from your notes or PDF content.
- **Customizable:** Set difficulty, question count, and focus topics.
- **Interactive:** Play through quizzes and track your results.

![Quiz Config](docs/images/quiz-creation.png)
![Quiz Mode](docs/images/quiz-gameplay.png)
![Quiz Results](docs/images/quiz-results.png)

### 🪄 Magic Selector

Integrate *any* web-based AI (ChatGPT, Claude, Gemini, etc.) without API keys. Train the app once to recognize the input box, and you're ready to auto-paste content.


---

## 🛠 Tech Stack

Built with a performance-first, modern architecture:

| Category | Technology |
| :--- | :--- |
| **Core** | ![Electron](https://img.shields.io/badge/Electron-40-2F3241?style=flat-square&logo=electron) ![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react) |
| **Language** | ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript) |
| **Styling** | ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3-06B6D4?style=flat-square&logo=tailwindcss) |
| **Build** | ![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite) ![Electron Builder](https://img.shields.io/badge/Electron_Builder-gray?style=flat-square) |
| **PDF** | React PDF Viewer + PDF.js |

---

## ⚡ Quick Start

### Prerequisites

- **Node.js 18+**
- **npm**
- **Google Account** (Required only for Gemini CLI quiz generation features)
- **Gemini CLI** (Required for quiz generation features):
  ```bash
  npm install -g @google/gemini-cli
  ```

### Installation

```bash
# Clone the repository
git clone https://github.com/ozymandias-get/quizlab.git
cd quizlab

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Build Scripts

```bash
npm run typecheck    # Check TypeScript types
npm run build        # Build for current OS
npm run build:win    # Build for Windows
npm run build:mac    # Build for macOS
npm run build:linux  # Build for Linux
```

---

## 🏗 Project Structure

QuizLab follows a scalable **Feature-Based Architecture**. Code is organized by domain (feature) rather than technical layer (controller, view, etc.), making it easy to navigate and maintain.

```text
quizlab/
├── electron/                 # Main Process (Backend)
│   ├── core/
│   │   ├── ConfigManager.ts
│   │   ├── helpers.ts
│   │   ├── systemHandlers.ts
│   │   └── updater.ts
│   ├── features/             # Feature-specific Main handlers
│   │   ├── ai/
│   │   ├── automation/
│   │   ├── pdf/
│   │   ├── quiz/
│   │   └── screenshot/
│   ├── main/                 # Entry point & window management
│   │   ├── index.ts
│   │   ├── ipcHandlers.ts
│   │   └── windowManager.ts
│   └── preload/              # Context Bridge (Security)
│       └── index.ts
├── shared/                   # Code shared between Main & Renderer
│   ├── constants/
│   └── types/
├── src/                      # Renderer Process (Frontend / React)
│   ├── api/
│   ├── app/                  # App providers & entry
│   ├── components/           # Shared UI components
│   │   ├── layout/
│   │   └── ui/
│   ├── features/             # Feature-specific UI implementations
│   │   ├── ai/
│   │   ├── automation/
│   │   ├── pdf/
│   │   ├── quiz/
│   │   ├── screenshot/
│   │   ├── settings/
│   │   └── tutorial/
│   ├── hooks/                # Global React hooks
│   ├── styles/               # Global styles & Tailwind
│   ├── types/                # Frontend-specific types
│   └── utils/                # Helper functions
├── resources/                # Static assets (icons, etc.)
├── package.json
└── vite.config.mts
```

### Path Aliases

- `@src/*` ➡️ `src/*`
- `@electron/*` ➡️ `electron/*`
- `@shared/*` ➡️ `shared/*`
- `@ui/*` ➡️ `src/components/ui/*`
- `@features/*` ➡️ `src/features/*`

---

## 🔒 Security & Privacy

- **Local-First:** No mandatory cloud backend. Your files stay on your machine.
- **Open Source:** Fully auditable code.
- **Direct Auth:** AI interactions happen directly through your provider sessions.

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
