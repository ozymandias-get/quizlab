<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/public/icon.png">
    <img src="src/public/icon.png" alt="Quizlab Reader" width="120" style="border-radius: 28px;">
  </picture>
</p>

<h1 align="center">Quizlab Reader</h1>

<p align="center">
  <strong>AI-Powered PDF Study Workspace</strong>
  <br>
  <sub>Read, highlight, and send content to ChatGPT, Gemini, Claude &mdash; all in one split-screen desktop app.</sub>
</p>

<p align="center">
  <a href="README_TR.md">🇹🇷 Türkçe</a>
  &nbsp;•&nbsp;
  <a href="https://github.com/ozymandias-get/quizlab/releases">📦 Releases</a>
  &nbsp;•&nbsp;
  <a href="CONTRIBUTING.md">🤝 Contributing</a>
  &nbsp;•&nbsp;
  <a href="SECURITY.md">🔒 Security</a>
  &nbsp;•&nbsp;
  <a href="docs/ARCHITECTURE.md">📐 Architecture</a>
  &nbsp;•&nbsp;
  <a href="docs/ROADMAP.md">🗺️ Roadmap</a>
</p>

<p align="center">
  <a href="https://github.com/ozymandias-get/quizlab/releases">
    <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fozymandias-get%2Fquizlab%2Fmain%2Fpackage.json&query=%24.version&label=version&style=flat-square&color=6b5b4c" alt="Current version">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square&color=8c7a6b" alt="MIT License">
  </a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg?style=flat-square&color=bda48f" alt="Cross-platform">
  <img src="https://img.shields.io/badge/Electron-40-47848F?style=flat-square&logo=electron&logoColor=white&color=443e38" alt="Electron">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white&color=443e38" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white&color=443e38" alt="TypeScript">
</p>

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🖼️ Screenshots](#️-screenshots)
- [📖 Overview](#-overview)
- [🛠️ Tech Stack](#️-tech-stack)
- [📦 Installation](#-installation)
- [⚙️ Developer Guide](#️-developer-guide)
- [📂 Project Structure](#-project-structure)
- [🔒 Security & Privacy](#-security--privacy)
- [📄 License](#-license)

---

## ✨ Features

<table>
  <tr>
    <td width="50%">
      <h4>📑 Multi-Tab PDF Workspace</h4>
      Open, read, search, and swap layouts in a fully customizable pane with smooth scrolling and fast rendering.
    </td>
    <td width="50%">
      <h4>🤖 Multi-AI Integration</h4>
      Built-in support for <strong>ChatGPT</strong>, <strong>Gemini</strong>, <strong>Claude</strong>, and custom web endpoints — all accessible from one workspace.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>⚡ Instant Handoff Pipelines</h4>
      Drag screenshots or send highlighted text straight into the active AI tab with zero context-switching.
    </td>
    <td width="50%">
      <h4>🔐 Privacy-First Architecture</h4>
      Your PDFs, credentials, and session data remain strictly local. No telemetry, no cloud uploads.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>🎨 Glassmorphic UI</h4>
      Dynamic background animations, adjustable glass scales, directionally-lit panels, and refined stone tones.
    </td>
    <td width="50%">
      <h4>📚 Prompt Library</h4>
      Store context prompts, design study macros, and configure automated data-flow routines for quick recall.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>🛡️ Secure PDF Protocol</h4>
      Custom <code>local-pdf://</code> stream protocol for bulletproof security and fast rendering.
    </td>
    <td width="50%">
      <h4>🌐 Custom Sites</h4>
      Easily configure and save custom web endpoints with targeted CSS input hooks for any AI surface.
    </td>
  </tr>
</table>

---

## 🖼️ Screenshots

<div align="center">
  <table>
    <tr>
      <td align="center"><strong>Split-Screen Workspace</strong></td>
      <td align="center"><strong>AI Models &amp; Custom Sites</strong></td>
    </tr>
    <tr>
      <td><img src="docs/images/workspace-home-overview.png" alt="Split-Screen PDF Workspace" width="400" style="border-radius: 8px;"></td>
      <td><img src="docs/images/ai-models-and-sites.png" alt="AI Models and Sites" width="400" style="border-radius: 8px;"></td>
    </tr>
    <tr>
      <td align="center"><strong>Prompt Library</strong></td>
      <td align="center"><strong>PDF Quick Actions</strong></td>
    </tr>
    <tr>
      <td><img src="docs/images/prompts-settings-library.png" alt="Prompt Library" width="400" style="border-radius: 8px;"></td>
      <td><img src="docs/images/pdf-chatgpt-quick-actions.png" alt="PDF Quick Actions" width="400" style="border-radius: 8px;"></td>
    </tr>
    <tr>
      <td align="center"><strong>Draft Review Modal</strong></td>
      <td align="center"><strong>Auto-Send Workflow</strong></td>
    </tr>
    <tr>
      <td><img src="docs/images/auto-send-draft-review.png" alt="Draft Review" width="400" style="border-radius: 8px;"></td>
      <td><img src="docs/images/auto-send-enabled.png" alt="Auto-Send Workflow" width="400" style="border-radius: 8px;"></td>
    </tr>
  </table>
</div>

---

## 📖 Overview

**Quizlab Reader** is a state-of-the-art, open-source, local-first desktop workspace that brings native document reading and multiple AI interfaces together under a unified Glassmorphic UI. Designed specifically for **academics, researchers, and professional students**, it eliminates constant app-switching and tab-clutter.

---

## 🛠️ Tech Stack

<table>
  <tr>
    <th align="left">Category</th>
    <th align="left">Technology</th>
  </tr>
  <tr>
    <td><strong>Desktop Framework</strong></td>
    <td>
      <a href="https://www.electronjs.org/">Electron 40</a>
      <img src="https://img.shields.io/badge/-47848F?logo=electron&logoColor=white" alt="Electron" style="vertical-align: middle;">
    </td>
  </tr>
  <tr>
    <td><strong>UI Library</strong></td>
    <td>
      <a href="https://react.dev/">React 19</a>
      <img src="https://img.shields.io/badge/-61DAFB?logo=react&logoColor=white" alt="React" style="vertical-align: middle;">
    </td>
  </tr>
  <tr>
    <td><strong>Language</strong></td>
    <td>
      <a href="https://www.typescriptlang.org/">TypeScript 5.9</a>
      <img src="https://img.shields.io/badge/-3178C6?logo=typescript&logoColor=white" alt="TypeScript" style="vertical-align: middle;">
    </td>
  </tr>
  <tr>
    <td><strong>Bundler</strong></td>
    <td><a href="https://vitejs.dev/">Vite 7</a></td>
  </tr>
  <tr>
    <td><strong>PDF Rendering</strong></td>
    <td><a href="https://mozilla.github.io/pdf.js/">pdfjs-dist 3.11</a> + <a href="https://react-pdf-viewer.dev/">@react-pdf-viewer</a></td>
  </tr>
  <tr>
    <td><strong>State Management</strong></td>
    <td><a href="https://zustand-demo.pmnd.rs/">Zustand</a> + <a href="https://tanstack.com/query/latest">TanStack Query</a></td>
  </tr>
  <tr>
    <td><strong>Styling</strong></td>
    <td><a href="https://tailwindcss.com/">Tailwind CSS 3</a> + <a href="https://www.framer.com/motion/">Framer Motion</a></td>
  </tr>
  <tr>
    <td><strong>AI Automation</strong></td>
    <td><a href="https://playwright.dev/">Playwright</a> (webview session management)</td>
  </tr>
  <tr>
    <td><strong>Testing</strong></td>
    <td><a href="https://vitest.dev/">Vitest</a> + <a href="https://testing-library.com/">Testing Library</a></td>
  </tr>
</table>

---

## 📦 Installation

### Requirements

| Metric       | Minimum                                 | Recommended                           |
| :----------- | :-------------------------------------- | :------------------------------------ |
| **OS**       | Windows 10 / macOS 10.15 / Ubuntu 20.04 | Windows 11 / macOS 13+ / Ubuntu 22.04 |
| **RAM**      | 4 GB                                    | 8 GB+                                 |
| **Storage**  | 500 MB                                  | 2 GB+                                 |
| **Internet** | Required for AI features                | High-speed broadband                  |

### Download

Download the latest installer for your platform from the [Releases page](https://github.com/ozymandias-get/quizlab/releases):

| Platform   | Format                                       |
| :--------- | :------------------------------------------- |
| 🪟 Windows | `QuizlabReader-Setup-<version>.exe`          |
| 🍏 macOS   | `QuizlabReader-<version>.dmg`                |
| 🐧 Linux   | `QuizlabReader-<version>.AppImage` or `.deb` |

---

## ⚙️ Developer Guide

> [!TIP]
> **Windows Users**: This repository enforces `LF` line endings. Run <code>git config --global core.autocrlf input</code> before cloning.

```bash
# Clone & install
git clone https://github.com/ozymandias-get/quizlab.git
cd quizlab
npm install

# Development
npm run dev

# Quality checks
npm run typecheck    # TypeScript
npm run lint         # ESLint (zero warnings required)
npm run test         # Vitest (629+ tests)

# Build for production
npm run build:win    # Windows installer
npm run build:mac    # macOS bundle
npm run build:linux  # Linux package
```

---

## 📂 Project Structure

```
quizlab/
├── .github/               # Issue templates, CI workflows
├── docs/                  # Roadmaps, architecture docs, screenshots
├── electron/              # Main process (Electron)
│   ├── app/               # Entrypoints, IPC handlers, window management
│   ├── core/              # Configs, updaters, system utilities
│   ├── features/          # Feature handlers (AI, Automation, Gemini, PDF, Screenshot)
│   ├── preload/           # Context bridge scripts
│   └── __tests__/         # Main-process tests
├── installer/             # NSIS Windows installer script
├── resources/             # Static installer assets, app icons
├── scripts/               # Dev/build automation scripts
├── shared/                # Cross-process contracts (IPC channels, types)
│   ├── constants/
│   └── types/
├── src/                   # Renderer UI (React + Vite)
│   ├── app/               # Shell, providers, global contexts, effects
│   ├── features/          # Feature modules (AI, PDF, Settings, Screenshot, Automation, Tutorial, Diagnostics)
│   ├── platform/          # Electron bridge adapters
│   ├── public/            # Static assets (app icon, etc.)
│   ├── shared/            # Shared UI components, hooks, i18n, styles, lib
│   ├── types/             # Global type declarations
│   └── __tests__/         # Renderer tests
├── package.json
└── tsconfig.json
```

---

## 🔒 Security & Privacy

- **No Telemetry** &mdash; zero data collection
- **Isolated Renderer** &mdash; strict `contextIsolation: true`, `nodeIntegration: false`
- **Secure PDF Protocol** &mdash; content served via `local-pdf://` stream protocol
- **Session Safety** &mdash; encrypted cookies within isolated Chromium session profiles
- **Minimal Preload** &mdash; only explicit IPC channels exposed via context bridge

See [SECURITY.md](SECURITY.md) for our security policy and vulnerability reporting guidelines.

---

## 📄 License

This project is open-source and licensed under the [MIT License](LICENSE).

---

<p align="center">
  <sub>
    <a href="https://github.com/ozymandias-get/quizlab/issues">Report Bug</a>
    &nbsp;•&nbsp;
    <a href="https://github.com/ozymandias-get/quizlab/discussions">Discussions</a>
    &nbsp;•&nbsp;
    <a href="CONTRIBUTING.md">Contributing Guide</a>
  </sub>
  <br>
  <sub>Built with ❤️ for academics, researchers, and lifelong learners.</sub>
</p>
