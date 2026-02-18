# 🧪 QuizLab Reader | AI-Powered PDF Study Tool & Quiz Generator

<!-- markdownlint-disable MD033 -->
<div align="center">

[![Turkish](https://img.shields.io/badge/lang-Türkçe-red.svg?style=flat-square)](README_TR.md)
[![Version](https://img.shields.io/badge/version-2.0.1-blue.svg?style=flat-square)](https://github.com/ozymandias-get/quizlab/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg?style=flat-square)](https://electronjs.org/)
[![Built with](https://img.shields.io/badge/Built%20with-Electron%20%26%20React-61DAFB?style=flat-square&logo=react)](https://react.dev/)

**The Ultimate Desktop Study Cockpit for Students & Developers**  
*Read PDFs, Chat with Google Gemini AI, and Generate Quizzes in one focused flow.*

[Features](#-core-features-and-benefits) • [Installation](#-quick-start-guide) • [Why QuizLab?](#-why-quizlab) • [Tech Stack](#-tech-stack) • [Türkçe](#türkçe-readme)

</div>
<!-- markdownlint-enable MD033 -->

---

## 🚀 Overview: The Best Free AI Study Assistant

**QuizLab Reader** is an open-source, **AI-powered PDF reader** and **study tool** designed to supercharge your learning process. Unlike standard PDF viewers, QuizLab integrates directly with **Google Gemini AI** to transform your textbooks and notes into interactive quizzes and flashcards instantly.

Redefine your study sessions with a **split-screen workspace** that combines a robust PDF viewer with a context-aware AI assistant. Whether you are preparing for exams, learning a new language, or analyzing technical documents, QuizLab helps you achieve **active recall** without leaving the app.

![QuizLab App Dashboard showing PDF Reader and AI Chat Interface](docs/images/app-overview.png)

---

## ✨ Core Features and Benefits

### 📚 Intelligent Split-Screen Workspace (PDF + AI)
Read effortlessly on the left while interacting with an AI tutor on the right.
- **Instant Context Transfer:** Select any text in your PDF and instantly send it to the AI for summarization, translation, or explanation.
- **Focus Mode:** Distraction-free reading environment optimized for deep work.
- **Multi-Tab Support:** Open multiple PDFs and reference materials simultaneously.
- **Panel Layout Swap:** Instantly swap PDF and AI panel positions to match your preference.

### 🧠 Advanced Quiz Generator & Flashcard Maker
Turn passive reading into active learning with our built-in **Quiz Engine**.
- **Dynamic Question Generation:** Automatically generate multiple-choice questions (MCQs), true/false, and open-ended questions from your selected text or entire pages.
- **Gemini CLI Integration:** Leverages the power of Google's Gemini models for high-quality, context-aware questions.
- **Customizable Difficulty:** Set difficulty levels (Easy, Medium, Hard), number of questions (1-30), and specific topics to target your weak areas.
- **Question Styles:** Choose from Classic, Analytical, True/False, or Mixed question styles.
- **Demo Mode:** Try quiz generation with sample content without loading a PDF.
- **Gamified Learning:** Track your scores, time, and progress over time with detailed results.

![Quiz Configuration Screen for Generating Study Questions](docs/images/quiz-creation.png)
![Interactive Quiz Mode Interface](docs/images/quiz-gameplay.png)
![Quiz Results and Performance Tracking](docs/images/quiz-results.png)

### 🤖 Multi-Platform AI Support
Connect with your favorite AI services seamlessly.
- **Built-in AI Platforms:** Native support for ChatGPT, Claude, DeepSeek, Qwen, and Kimi.
- **Custom AI Integration:** Add any web-based AI platform by providing its URL.
- **Model Management:** Enable/disable AI platforms based on your preferences.
- **Magic Selector:** Universal AI integration with auto-paste functionality—train the app to recognize input fields and automatically paste selected text from your PDF into the AI chat.

### 🎨 Premium Glass Morphism UI & Customization
Personalize your study environment with extensive appearance options.
- **Visual Themes:** Animated gradient or solid color backgrounds with customizable colors.
- **Bottom Bar Customization:** Adjust opacity, scale, and icon-only compact mode.
- **Selection Colors:** Customize PDF text selection highlight color.
- **Random Background Mode:** Dynamic color transitions for a fresh look every session.
- **Animations:** Smooth GPU-accelerated transitions powered by Framer Motion.

### 📸 Screenshot to AI
Capture and analyze any part of your screen.
- **Screen Capture Tool:** Select any area of your screen and send it directly to AI for analysis.
- **Visual Learning:** Perfect for diagrams, charts, and visual content analysis.

### 🌍 Multi-Language Support
Study in your preferred language.
- **English & Turkish:** Full UI localization with easy language switching.
- **Extensible:** More languages can be added via JSON locale files.

### 🔄 Auto-Update System
Stay up-to-date effortlessly.
- **Update Notifications:** Automatic check for new versions from GitHub releases.
- **One-Click Downloads:** Direct link to download the latest version.

### 🎯 Interactive Usage Assistant
Learn the app with an interactive tour.
- **Step-by-Step Tutorial:** Guided tour highlighting key features and controls.
- **Non-Intrusive:** Highlight-based guidance without darkening the screen.

### 🔒 Privacy-Focused & Local-First
- **Offline Capability:** Core reading features work offline.
- **Your Data Stays Yours:** Notes and settings are stored locally on your device. Direct AI interactions happen through your own secure sessions.

---

## ❓ Frequently Asked Questions (FAQ)

**Q: Is QuizLab Reader free?**
A: Yes, QuizLab is **free and open-source software (FOSS)**. You can download it and use it without any subscription fees.

**Q: Which AI models does it support?**
A: It natively integrates with **Google Gemini** via the CLI for quiz generation. Additionally, the **Magic Selector** allows you to interface with almost any web-based AI like ChatGPT, Claude, DeepSeek, Qwen, or Kimi. You can also add custom AI platforms.

**Q: Can I use it on Mac and Linux?**
A: Absolutely! QuizLab is built with Electron and is cross-platform compatible with **Windows, macOS, and Linux**.

**Q: How does the Quiz Generator work?**
A: The Quiz Generator uses Google Gemini CLI to analyze your PDF content and generate context-aware questions. You can customize difficulty, question count, and focus topics.

**Q: Can I customize the appearance?**
A: Yes! QuizLab offers extensive customization including background themes, colors, panel layout, bottom bar opacity/scale, and selection colors.

---

## 🛠 Tech Stack

Built with a performance-first, modern architecture ensuring speed and reliability:

| Category | Technology |
| :--- | :--- |
| **Core** | ![Electron](https://img.shields.io/badge/Electron-40-2F3241?style=flat-square&logo=electron) ![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react) |
| **Language** | ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript) |
| **Styling** | ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3-06B6D4?style=flat-square&logo=tailwindcss) |
| **Build** | ![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite) ![Electron Builder](https://img.shields.io/badge/Electron_Builder-gray?style=flat-square) |
| **PDF Engine** | React PDF Viewer + PDF.js |
| **Animations** | Framer Motion |
| **UI Components** | Headless UI |

---

## ⚡ Quick Start Guide

Follow these steps to install and run QuizLab Reader on your local machine.

### Prerequisites

- **Node.js 18+** installed on your system.
- **npm** (Node Package Manager).
- **Google Account** (Required for Gemini CLI features).
- **Gemini CLI** (For quiz generation):
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

Build the application for production:

```bash
npm run typecheck    # Check TypeScript types
npm run build        # Build for current OS
npm run build:win    # Build for Windows installer
npm run build:mac    # Build for macOS .dmg
npm run build:linux  # Build for Linux .AppImage
```

---

## 🏗 Project Structure

QuizLab follows a scalable **Feature-Based Architecture**. Code is organized by domain (feature) rather than technical layer, facilitating easy contribution and maintenance.

```text
quizlab/
├── electron/                # Main Process (Node.js / IPC handlers)
│   ├── core/
│   ├── features/
│   ├── main/
│   └── preload/
│
├── src/                     # Renderer Process (React)
│   ├── app/
│   ├── components/
│   ├── constants/
│   ├── features/
│   ├── hooks/
│   ├── locales/
│   ├── platform/            # Electron bridge and API hooks
│   ├── styles/
│   ├── types/
│   └── utils/
│
├── shared/                  # Shared IPC channels and types
├── resources/               # Static assets and icons
└── package.json
```

---

## 🎮 Settings & Configuration

QuizLab offers comprehensive settings organized in intuitive tabs:

| Tab | Description |
|-----|-------------|
| **Prompts** | Customize AI prompts for different contexts |
| **Models** | Enable/disable AI platforms, add custom AI services |
| **Gemini CLI** | Configure Gemini CLI path and settings for quiz generation |
| **Selectors** | Configure Magic Selector for auto-paste functionality |
| **Appearance** | Customize themes, colors, opacity, and visual preferences |
| **Language** | Switch between English and Turkish |
| **About** | View app version and check for updates |

---

## 📝 License

Distributed under the **MIT License**. This means you can use, modify, and distribute this software freely. See [LICENSE](LICENSE) for more information.

---

## 🇹🇷 Türkçe README

Bu projenin Türkçe dokümantasyonu için [README_TR.md](README_TR.md) dosyasına göz atabilirsiniz.

---

<div align="center">

**Made with ❤️ for learners everywhere.**

[⬆ Back to Top](#-quizlab-reader--ai-powered-pdf-study-tool--quiz-generator)

</div>
