<h1 align="center">Quizlab Reader</h1>

<p align="center">
  <strong>AI-Powered PDF Study Workspace</strong>
  <br>
  <sub>Read, highlight, and send content to AI platforms — all in one split-screen desktop app.</sub>
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
  <br>
  <img alt="GitHub version" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fozymandias-get%2Fquizlab%2Fmain%2Fpackage.json&query=%24.version&label=version&color=blue">
</p>

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [📖 Overview](#-overview)
- [🛠️ Tech Stack](#️-tech-stack)
- [🌐 Internationalization](#-internationalization)
- [📦 Installation](#-installation)
- [⚙️ Developer Guide](#️-developer-guide)
- [🔬 CI/CD Pipeline](#-cicd-pipeline)
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
      Built-in support for <strong>ChatGPT</strong>, <strong>Gemini</strong>, <strong>Claude</strong>, <strong>DeepSeek</strong>, <strong>Perplexity</strong>, <strong>Mistral</strong>, <strong>Grok</strong>, and more — all accessible from one workspace.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>⚡ Instant Handoff Pipelines</h4>
      Drag screenshots or send highlighted text straight into the active AI tab with zero context-switching.
    </td>
    <td width="50%">
      <h4>🔐 Privacy-First Architecture</h4>
      Your PDFs, credentials, and session data remain strictly local. No telemetry, no cloud uploads. AES-256-GCM encryption for sensitive data.
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
      Custom <code>local-pdf://</code> stream protocol for bulletproof security and fast rendering with byte-range support.
    </td>
    <td width="50%">
      <h4>🌐 Custom AI Sites</h4>
      Easily configure and save custom web endpoints with targeted CSS input hooks for any AI surface.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>💬 Direct API Chat</h4>
      Chat directly with AI models using your own API keys (Gemini, ChatGPT, Claude, OpenRouter-compatible) in a native, privacy-first interface.
    </td>
    <td width="50%">
      <h4>⚙️ Flexible Key Management</h4>
      Securely configure, test, and save your custom API keys and model parameters directly from the settings panel.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>🔍 Screenshot & Capture</h4>
      Capture full-page or cropped screenshots, copy to clipboard, or send directly to AI.
    </td>
    <td width="50%">
      <h4>🤖 Gemini Web Session</h4>
      Persistent Google AI sessions with cookie-based auth, health monitoring, automatic recovery, and session export/import.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>🖱️ Element Picker</h4>
      Magic CSS selector picker for targeting AI chat inputs — no manual configuration needed.
    </td>
    <td width="50%">
      <h4>🔌 Chrome Extension Bridge</h4>
      Native messaging host + Chrome extension for sharing Google session cookies between Chrome and Electron.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>📖 Interactive Tutorials</h4>
      Built-in guided tutorials for onboarding and feature discovery.
    </td>
    <td width="50%">
      <h4>🗣️ Full i18n Support</h4>
      Complete English and Turkish localization with 19 translation namespaces each.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>🔄 Automatic Updates</h4>
      GitHub Releases-based auto-updater with semver comparison and periodic checks.
    </td>
    <td width="50%">
      <h4>🧹 Cache Management</h4>
      Intelligent cache monitoring, cleanup scheduler, and threshold warnings at 80% capacity.
    </td>
  </tr>
</table>

---

## 📖 Overview

**Quizlab Reader** is a state-of-the-art, open-source, local-first desktop workspace that brings native document reading and multiple AI interfaces together under a unified Glassmorphic UI. Designed specifically for **academics, researchers, and professional students**, it eliminates constant app-switching and tab-clutter.

The application combines a high-performance PDF viewer with embedded AI webviews, direct API chat, automation scripting, and comprehensive session management — all while maintaining strict privacy guarantees with zero telemetry.

---

## 🛠️ Tech Stack

| Category              | Technology                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Desktop Framework** | [Electron 42](https://www.electronjs.org/)                                                                           |
| **UI Library**        | [React 19](https://react.dev/)                                                                                       |
| **Language**          | [TypeScript 6.0](https://www.typescriptlang.org/)                                                                    |
| **Bundler**           | [Vite 8](https://vitejs.dev/)                                                                                        |
| **PDF Engine**        | [pdfjs-dist 3.11](https://mozilla.github.io/pdf.js/) + [@react-pdf-viewer 3.12](https://react-pdf-viewer.dev/)       |
| **Styling**           | [Tailwind CSS 4](https://tailwindcss.com/)                                                                           |
| **Animation**         | [Motion](https://motion.dev/) (formerly Framer Motion)                                                               |
| **State Management**  | [Zustand 5](https://zustand-demo.pmnd.rs/) + [TanStack React Query 5](https://tanstack.com/query/latest)             |
| **AI Automation**     | [Playwright](https://playwright.dev/) (webview session management & scripting)                                       |
| **UI Components**     | [Radix UI](https://www.radix-ui.com/) + [Headless UI](https://headlessui.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| **Icons**             | [Tabler Icons](https://tabler.io/icons) + [Lucide](https://lucide.dev/)                                              |
| **Particles**         | [tsParticles](https://particles.js.org/)                                                                             |
| **Fonts**             | [Inter Variable](https://fonts.google.com/specimen/Inter) via Fontsource                                             |
| **i18n**              | [i18next](https://www.i18next.com/) + [react-i18next](https://react.i18next.com/)                                    |
| **Testing**           | [Vitest 4](https://vitest.dev/) + [Testing Library](https://testing-library.com/)                                    |
| **Linting**           | [ESLint 10](https://eslint.org/) + [Prettier](https://prettier.io/)                                                  |
| **Security Analysis** | [Electronegativity](https://github.com/doyensec/electronegativity) + [Semgrep](https://semgrep.dev/)                 |
| **Mutation Testing**  | [Stryker](https://stryker-mutator.io/)                                                                               |
| **Installer**         | [electron-builder](https://www.electron.build/) + NSIS (Windows)                                                     |

---

## 🌐 Internationalization

Quizlab Reader is fully localized in two languages:

| Language    | Code | Namespaces    |
| ----------- | ---- | ------------- |
| **English** | `en` | 19 JSON files |
| **Turkish** | `tr` | 19 JSON files |

Namespaces cover: common UI, navigation, settings, appearance, PDF viewer, AI integration, AI chat, selectors, tutorials, Gemini web session, errors, toasts, notifications, auto-send, and context prompts.

A language selection dialog is shown on first run. Language can be changed at any time from settings.

A comprehensive [terminology standard](docs/TERMINOLOGY.md) ensures consistent EN/TR translation across the entire application.

---

## 📦 Installation

### Requirements

| Metric       | Minimum                                 | Recommended                           |
| ------------ | --------------------------------------- | ------------------------------------- |
| **OS**       | Windows 10 / macOS 10.15 / Ubuntu 20.04 | Windows 11 / macOS 13+ / Ubuntu 22.04 |
| **RAM**      | 4 GB                                    | 8 GB+                                 |
| **Storage**  | 500 MB                                  | 2 GB+                                 |
| **Internet** | Required for AI features                | High-speed broadband                  |

### Download

Download the latest installer for your platform from the [Releases page](https://github.com/ozymandias-get/quizlab/releases):

| Platform   | Format                                               |
| ---------- | ---------------------------------------------------- |
| 🪟 Windows | `QuizlabReader-Setup-<version>.exe` (NSIS installer) |
| 🍏 macOS   | `QuizlabReader-<version>.dmg`                        |
| 🐧 Linux   | `QuizlabReader-<version>.AppImage` or `.deb`         |

The installer optionally registers a Chrome Native Messaging Host for the Google session bridge extension.

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
npm run test         # Vitest (~2285 tests)
npm run test:coverage # Coverage report

# Analysis
npm run analyze:all  # Full analysis suite (bundle, types, dead code, duplicates, circular deps, etc.)
npm run analyze:security  # Electronegativity + Semgrep security scan

# Build for production
npm run build:win    # Windows NSIS installer
npm run build:mac    # macOS DMG
npm run build:linux  # Linux AppImage + deb
```

### Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation
- `refactor:` — code restructuring
- `test:` — test changes
- `chore:` — maintenance

Commit messages are validated via commitlint with husky hooks.

---

## 🔬 CI/CD Pipeline

The project uses GitHub Actions ([`.github/workflows/build.yml`](.github/workflows/build.yml)) with three stages:

1. **Quality** (ubuntu-latest, every push to main/PR):
   - Repository hygiene & version consistency checks
   - ESLint (zero warnings), Prettier formatting, CSS lint
   - TypeScript type checking
   - Architecture validation (dependency-cruiser)
   - Test suite with coverage
   - Type coverage guard, spell check
   - Duplicate code & circular dependency detection

2. **Build** (windows-latest + ubuntu-22.04, on tags):
   - Windows: NSIS installer
   - Linux: AppImage + deb
   - Artifacts uploaded

3. **Release** (on tags):
   - Creates GitHub Release with auto-generated release notes
   - Attaches all platform artifacts

---

## 📂 Project Structure

```
quizlab/
├── .github/               # Issue templates, CI workflows
├── docs/                  # Roadmaps, architecture docs, terminology
├── electron/              # Main process (Electron)
│   ├── app/               # Entrypoints, IPC handlers, window management
│   │   └── window/        # Security, sessions, environment, renderer loader
│   ├── core/              # Config manager, encryption, logger, CSP, updater, IPC security
│   ├── features/          # Feature handlers (AI, Automation, Gemini, PDF, Screenshot, Native Messaging)
│   ├── preload/           # Context bridge scripts
│   └── __tests__/         # Main-process tests (69 test files)
├── extensions/            # Chrome extension for Google session bridge
│   └── quizlab-session-extension/
├── installer/             # NSIS Windows installer script
├── patches/               # patch-package patches
├── resources/             # Static installer assets, app icons
├── scripts/               # Dev/build automation scripts
├── shared/                # Cross-process contracts (IPC channels, types, constants)
│   ├── constants/
│   ├── lib/
│   └── types/
├── src/                   # Renderer UI (React + Vite)
│   ├── app/               # Shell, providers, global contexts, effects
│   │   ├── components/    # shadcn/ui components
│   │   ├── hooks/
│   │   ├── providers/     # AppProviders, AiContext, QueryProvider, UpdateContext, AppTool
│   │   └── ui/            # MainWorkspace, FocusOverlay, AiSendComposer
│   ├── features/          # Feature modules (AI, PDF, Settings, Screenshot, Automation, Tutorial, Onboarding)
│   ├── platform/          # Electron bridge adapters
│   ├── public/            # Static assets
│   ├── shared/            # Shared UI components, hooks, i18n, styles, stores, lib
│   │   ├── i18n/locales/  # en/ (19 files) + tr/ (19 files)
│   │   ├── stores/        # Zustand stores (appearance, language, notifications, toasts)
│   │   └── ui/            # Shared layout & components
│   ├── types/             # Global type declarations
│   └── __tests__/         # Renderer tests (177 test files)
├── package.json
└── tsconfig.json
```

---

## 🔒 Security & Privacy

- **No Telemetry** &mdash; zero data collection, no cloud uploads
- **Isolated Renderer** &mdash; strict `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- **Minimal Preload** &mdash; only explicit IPC channels exposed via context bridge
- **Secure PDF Protocol** &mdash; content served via `local-pdf://` stream protocol with file allowlist and byte-range support
- **WebView Hardening** &mdash; partition allowlist validation, clipboard access blocked, certificate errors rejected, external navigation redirected to system browser, popup blocking
- **Content Security Policy** &mdash; strict CSP with nonce-based script tags, limited `frame-src` to allowed AI domains
- **IPC Security** &mdash; trusted sender validation on all IPC handlers
- **Encryption** &mdash; AES-256-GCM with machine-derived key + Electron `safeStorage` fallback for API keys and credentials
- **Encrypted Sessions** &mdash; encrypted cookies within isolated Chromium session profiles
- **Automated Security Scanning** &mdash; Electronegativity and Semgrep run in CI

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
