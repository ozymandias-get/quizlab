# Quizlab Reader — AI PDF reader and study workspace

<p align="center">
  <img src="resources/icon.png" alt="Quizlab Reader icon" width="120" />
</p>

<p align="center">
  <strong>Quizlab Reader is a desktop app for reading PDFs alongside ChatGPT, Gemini, Claude, and other AI sites in a split-screen workspace.</strong>
</p>

<p align="center">
  <a href="README_TR.md">Türkçe README</a> |
  <a href="https://github.com/ozymandias-get/quizlab/releases">Latest Release</a> |
  <a href="CONTRIBUTING.md">Contributing</a> |
  <a href="SECURITY.md">Security</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fozymandias-get%2Fquizlab%2Fmain%2Fpackage.json&amp;query=%24.version&amp;label=version&amp;style=flat-square" alt="Current package version from package.json on main branch" />
  <img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="MIT License open source" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg?style=flat-square" alt="Cross-platform desktop app for Windows macOS Linux" />
  <img src="https://img.shields.io/badge/built%20with-Electron%20%7C%20React%20%7C%20TypeScript-24292f?style=flat-square" alt="Built with Electron React TypeScript" />
</p>

## Screenshots

### Split-Screen PDF Workspace and AI Home Dashboard

Shows the main split layout with the PDF reader on the left and the AI home dashboard on the right.

<p align="center">
  <img src="docs/images/workspace-home-overview.png" alt="Quizlab Reader PDF workspace and AI home dashboard" width="900" />
</p>

### Built-in AI Models and Custom Sites

Shows the screen where ready-to-use AI models and custom sites are listed in the workspace.

<p align="center">
  <img src="docs/images/ai-models-and-sites.png" alt="Quizlab Reader AI models and custom sites management view" width="900" />
</p>

### Prompt Library and Automation Settings

Shows the settings screen for managing saved prompts and selecting an automatic prompt workflow.

<p align="center">
  <img src="docs/images/prompts-settings-library.png" alt="Quizlab Reader prompt library settings screen" width="900" />
</p>

### PDF Reader with ChatGPT Quick Actions

Shows the PDF reader together with the ChatGPT panel and the quick action tools beside the document.

<p align="center">
  <img src="docs/images/pdf-chatgpt-quick-actions.png" alt="Quizlab Reader PDF view with ChatGPT and quick actions" width="900" />
</p>

### AI Send Draft Review Modal

Shows the review modal where selected PDF content is prepared before being sent to the active AI tab.

<p align="center">
  <img src="docs/images/auto-send-draft-review.png" alt="Quizlab Reader AI send draft review modal" width="900" />
</p>

### Auto Send to AI Workflow

Shows the auto-send mode where selected content is delivered directly to the active AI session.

<p align="center">
  <img src="docs/images/auto-send-enabled.png" alt="Quizlab Reader auto send enabled workflow" width="900" />
</p>

## Overview

Quizlab Reader is a free, open-source, cross-platform desktop application that combines a PDF reader with an embedded AI web workspace in one Electron app. It is built for students, researchers, and anyone who reads long PDFs and wants to send excerpts, screenshots, and notes to AI without juggling multiple windows.

Instead of switching between a PDF app, browser tabs, and notes, you keep the core loop in one place:

- Open and manage PDF tabs
- Select text and send it to AI instantly
- Capture screenshots and forward them to the active AI tab
- Keep your AI sessions and local study data on your machine

## Why Quizlab Reader

The UI is designed around real reading and research workflows, not generic chat.

- AI PDF reader: read, search, navigate, and inspect documents without leaving context
- Prompt library and automation: send structured prompts to your AI session
- Split-screen desktop workspace: PDF on one side, AI on the other
- Premium Glassmorphism UI: Modern, state-of-the-art interface with directional lighting and depth
- Local-first Electron app: your files stay local and AI access happens through your own accounts
- Multi-platform AI support: ChatGPT, Gemini, Claude, Mistral, Perplexity, Grok, DeepSeek, and more

## Core Features

### Split-Screen PDF Reader and AI Workspace

- Multi-tab PDF reading
- Drag and drop PDF opening
- Page navigation, zoom, search, and text selection
- Persistent reading state for recent documents
- Instant send-to-AI actions from selected text

### Multi-Platform AI Webview Workspace

Built-in AI registry currently includes:

- ChatGPT / GPT-4o
- Gemini / Gemini Pro 1.5
- Claude 3 / 3.5
- DeepSeek-V3 / R1
- Mistral / Le Chat
- Perplexity
- Grok (xAI)
- Manus AI
- NotebookLM
- AI Studio
- HuggingChat
- Qwen
- Kimi
- YouTube

The app also supports custom AI or website entries, plus selector-based automation for web UIs that need custom input or send button targeting.

### AI Home Page and Pinned Tab Management

The current app includes a dedicated AI home page and improved tab management:

- Home page for open tabs, built-in AI models, and custom sites
- Pinned AI tabs restored on startup
- Cleaner startup behavior with fewer unnecessary webviews
- Grid-based model ordering
- Automatic navigation back to the AI home page when no session tab is active

### Performance and Architecture (v3.0.7)

The latest version includes significant internal refactoring for better reliability:

- **Modular AI Pipelines**: Extracted text and image sending logic into specialized, testable pipelines.
- **Improved Hook Lifecycle**: Modularized monolithic hooks into focused sub-hooks (`useWebviewMethods`, `useWebviewEvents`, `useWebviewCrasher`) to reduce re-renders.
- **Atomic Automation**: Refactored the automation engine to use smaller, deterministic script generators.
- **PDF Protocol Optimization**: Enhanced the secure `local-pdf://` protocol for faster document loading and better error recovery.

### Gemini Web Session Management Tools

The app includes a dedicated Gemini web session management area for Google-backed surfaces.

- Session status monitoring
- Manual re-check and re-auth flows
- Shared Google sign-in experience for Gemini-family surfaces
- Support for Gemini, NotebookLM, AI Studio, and related Google web surfaces

> **⚠️ Important: Google Session Notice**
>
> The Gemini web session feature uses a **persistent local Chromium profile** to maintain your Google sign-in state. Please be aware of the following:
>
> - **Google account login is required** to use Gemini, NotebookLM, AI Studio, and other Google-backed AI surfaces in the app.
> - **Session data is stored locally** on your device inside the application data directory. The app does **not** transmit your credentials or session data to any external server.
> - **Session may expire or degrade** over time. Google may require re-authentication due to security policies, cookie expiration, or account activity. Use `Settings > Gemini Web > Check Now` to verify session health.
> - **Shared session across Google surfaces**: signing into one Google AI surface (e.g., Gemini) will share the session with other Google surfaces (NotebookLM, AI Studio). Logging out or resetting the profile will affect all Google surfaces.
> - **Profile reset is irreversible**: using the "Reset Profile" option will clear all Google session data and require a fresh login.
> - This project is **not affiliated with Google**. AI interactions happen through your own Google account and are subject to Google's Terms of Service and Privacy Policy.

### Screenshot to AI Workflow

- Full-page capture
- Cropped capture
- Quick handoff to the active AI session
- Useful for diagrams, figures, and non-copyable PDF content

### Appearance, Localization, and Study UX

- Premium Glassmorphic UI with directional lighting and 3D depth
- Adjustable bottom bar scale and opacity
- Layout swap support (PDF/AI left-right toggle)
- Refined Dark Mode with elegant stone tones
- Animated or solid backgrounds
- Custom selection highlight color
- Guided onboarding tutorial
- English and Turkish localization

## Installation

### System requirements

| Item     | Minimum                               | Recommended                        |
| -------- | ------------------------------------- | ---------------------------------- |
| OS       | Windows 10, macOS 10.15, Ubuntu 20.04 | Windows 11, macOS 13, Ubuntu 22.04 |
| RAM      | 4 GB                                  | 8 GB or more                       |
| Storage  | 500 MB                                | 2 GB or more                       |
| Internet | Required for AI features              | Stable broadband                   |

### Download prebuilt releases

Download the latest installer from the GitHub releases page:

[Quizlab Reader Releases](https://github.com/ozymandias-get/quizlab/releases)

Typical artifacts:

- Windows: `QuizlabReader-Setup-<version>.exe`
- macOS: `QuizlabReader-<version>.dmg`
- Linux: `QuizlabReader-<version>.AppImage`

### Build from source

> **Windows Users**: This repository enforces `LF` line endings across the source tree. Before cloning or committing, we recommend setting this Git configuration to prevent formatting conflicts:
>
> ```bash
> git config --global core.autocrlf input
> ```

```bash
git clone https://github.com/ozymandias-get/quizlab.git
cd quizlab
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Platform packages:

```bash
npm run build:win
npm run build:mac
npm run build:linux
```

## Quick Start

### 1. Open the app and load a PDF

- Click the PDF picker, or drag a PDF into the window
- Use recent reading state to jump back into previous documents

### 2. Choose an AI workspace

- Open a built-in AI tab from the home page
- Or add a custom AI or site entry in settings

### 3. Use web session tools when needed

If you use Google AI surfaces, open the Gemini Web settings tab to:

- check session health
- trigger re-auth
- manage the shared Google session state

## Development

### Common commands

```bash
npm run dev
npm run dev:web
npm run build:backend
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

### Current dev workflow notes

- `npm run dev` starts the Vite renderer and Electron app together
- The dev script can reuse an existing Vite dev server on port `5173`
- The current dev flow preserves the existing Electron and Chromium profile instead of clearing web session data
- GPU acceleration flags are enabled at startup in the Electron main process

## Architecture

The project uses a layered Electron plus React architecture.

```text
electron/
  app/                     Main-process entry, windows, IPC registration
  core/                    Config, updater, helpers
  features/
    ai/                    AI registry and platform definitions
    automation/            Modular script generators and DOM helpers
    gemini-web-session/    Playwright-backed Google session management
    pdf/                   Secure PDF protocol and stream-based handlers
    screenshot/            Native capture and crop handlers
  preload/                 Context bridge API

src/
  app/                     App shell and providers
  features/
    ai/                    AI home page, sessions, webviews
    pdf/                   PDF viewer and reading flows
    settings/              Settings modal and tabs
    screenshot/            Screenshot UI
    tutorial/              Onboarding
  platform/electron/       Renderer to preload bridge
  shared/                  Shared renderer UI, hooks, constants, i18n

shared/
  constants/               Cross-process constants
  types/                   Shared contracts and IPC types
```

## Security and Privacy

The app is local-first by design.

- PDF files are handled locally
- Renderer code is isolated behind a preload bridge
- Electron IPC is validated in the main process
- AI usage happens through your own logged-in web sessions in the embedded webviews
- Custom PDF loading uses a dedicated Electron protocol instead of exposing arbitrary file paths

See [SECURITY.md](SECURITY.md) for the current security policy and reporting process.

## Configuration

Main settings areas include:

- Prompts
- Models
- Sites
- Gemini Web
- Selectors
- Appearance
- Language
- About

Examples of persisted local data include:

- AI registry custom entries
- Gemini web session state
- recent reading state
- pinned AI tabs
- layout and appearance preferences

## Troubleshooting

### AI page is blank or not sending prompts

- Refresh the active AI tab
- Check whether the platform requires login
- Reconfigure selectors for custom sites
- Verify the target service is still using the expected input flow

### Gemini web session shows degraded or re-auth required

- Open Settings > Gemini Web
- Run a manual check
- Re-authenticate the Google session
- Reset the profile only if you intentionally want a clean Google web session

### `npm run dev` uses an existing server

This is expected if a Vite dev server is already running on port `5173`.

## Contributing

Contributions are welcome for features, documentation, bug fixes, tests, and platform improvements.

Before opening a pull request, run:

```bash
npm run typecheck
npm run lint
npm run test
```

Contribution details live in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Quizlab Reader is released under the [MIT License](LICENSE).

---

<p align="center">
  <strong>Keywords:</strong> AI PDF reader, study tool, Electron app, split-screen PDF viewer, Gemini AI, ChatGPT integration, open source workspace, PDF viewer, AI-powered learning, cross-platform desktop app
</p>
