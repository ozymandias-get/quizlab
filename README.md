# QuizLab Reader: AI PDF Reader, Quiz Generator, and Study Workspace

<p align="center">
  <img src="resources/icon.png" alt="QuizLab Reader icon" width="120" />
</p>

<p align="center">
  <strong>QuizLab Reader is an AI-powered PDF reader for active recall, quiz generation, and focused study workflows.</strong>
</p>

<p align="center">
  <a href="README_TR.md">Türkçe README</a> |
  <a href="https://github.com/ozymandias-get/quizlab/releases">Latest Release</a> |
  <a href="CONTRIBUTING.md">Contributing</a> |
  <a href="SECURITY.md">Security</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.2.5-blue.svg?style=flat-square" alt="QuizLab Reader version 2.2.5" />
  <img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="MIT License open source" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg?style=flat-square" alt="Cross-platform desktop app for Windows macOS Linux" />
  <img src="https://img.shields.io/badge/built%20with-Electron%20%7C%20React%20%7C%20TypeScript-24292f?style=flat-square" alt="Built with Electron React TypeScript" />
</p>

## Screenshots

### Split-Screen PDF Workspace and AI Home Dashboard

Shows the main split layout with the PDF reader on the left and the AI home dashboard on the right.

<p align="center">
  <img src="docs/images/workspace-home-overview.png" alt="QuizLab Reader PDF workspace and AI home dashboard" width="900" />
</p>

### Built-in AI Models and Custom Sites

Shows the screen where ready-to-use AI models and custom sites are listed in the workspace.

<p align="center">
  <img src="docs/images/ai-models-and-sites.png" alt="QuizLab Reader AI models and custom sites management view" width="900" />
</p>

### Prompt Library and Automation Settings

Shows the settings screen for managing saved prompts and selecting an automatic prompt workflow.

<p align="center">
  <img src="docs/images/prompts-settings-library.png" alt="QuizLab Reader prompt library settings screen" width="900" />
</p>

### PDF Reader with ChatGPT Quick Actions

Shows the PDF reader together with the ChatGPT panel and the quick action tools beside the document.

<p align="center">
  <img src="docs/images/pdf-chatgpt-quick-actions.png" alt="QuizLab Reader PDF view with ChatGPT and quick actions" width="900" />
</p>

### AI Send Draft Review Modal

Shows the review modal where selected PDF content is prepared before being sent to the active AI tab.

<p align="center">
  <img src="docs/images/auto-send-draft-review.png" alt="QuizLab Reader AI send draft review modal" width="900" />
</p>

### Auto Send to AI Workflow

Shows the auto-send mode where selected content is delivered directly to the active AI session.

<p align="center">
  <img src="docs/images/auto-send-enabled.png" alt="QuizLab Reader auto send enabled workflow" width="900" />
</p>

## Overview

QuizLab Reader is a free, open-source, cross-platform desktop application that combines a PDF study reader, AI web workspace, and interactive quiz generator in a single Electron app. Built for medical students, exam candidates, researchers, and heavy PDF readers who want to turn passive reading into active recall.

Instead of switching between a PDF app, browser tabs, notes, and quiz tools, QuizLab keeps the full study loop in one place:

- Open and manage PDF tabs
- Select text and send it to AI instantly
- Generate quizzes from the current PDF or selection
- Review answers, explanations, and weak areas
- Keep your AI sessions and local study data on your machine

## Why QuizLab Reader — AI-Powered Study Workspace

QuizLab is designed around real study workflows, not generic chat UI.

- AI PDF reader: read, search, navigate, and inspect documents without leaving context
- Quiz generator for study and exam prep: turn PDF content into active-recall questions
- Split-screen desktop workspace: PDF on one side, AI on the other
- Local-first Electron app: your files stay local and AI access happens through your own accounts
- Multi-platform AI support: Gemini, ChatGPT, Claude, DeepSeek, Qwen, Kimi, NotebookLM, and AI Studio

## Core Features

### Split-Screen PDF Reader and AI Workspace

- Multi-tab PDF reading
- Drag and drop PDF opening
- Page navigation, zoom, search, and text selection
- Persistent reading state for recent documents
- Instant send-to-AI actions from selected text

### AI-Powered Quiz Generator for Active Recall

QuizLab includes a structured quiz flow instead of a plain prompt box.

- Multiple choice questions
- Negative questions
- Statement-based questions
- Ordering questions
- Fill-in-the-blank questions
- Matching questions
- Clinical reasoning style prompts
- Adjustable difficulty, question count, language, and focus topic

### Multi-Platform AI Webview Workspace

Built-in AI registry currently includes:

- ChatGPT
- Gemini
- NotebookLM
- AI Studio
- YouTube
- Claude
- DeepSeek
- Qwen
- Kimi

The app also supports custom AI or website entries, plus selector-based automation for web UIs that need custom input or send button targeting.

### AI Home Page and Pinned Tab Management

The current app includes a dedicated AI home page and improved tab management:

- Home page for open tabs, built-in AI models, and custom sites
- Pinned AI tabs restored on startup
- Cleaner startup behavior with fewer unnecessary webviews
- Grid-based model ordering
- Automatic navigation back to the AI home page when no session tab is active

### Gemini Web Session Management Tools

QuizLab includes a dedicated Gemini web session management area for Google-backed surfaces.

- Session status monitoring
- Manual re-check and re-auth flows
- Shared Google sign-in experience for Gemini-family surfaces
- Support for Gemini, NotebookLM, AI Studio, and related Google web surfaces

> **⚠️ Important: Google Session Notice**
>
> QuizLab's Gemini web session feature uses a **persistent local Chromium profile** to maintain your Google sign-in state. Please be aware of the following:
>
> - **Google account login is required** to use Gemini, NotebookLM, AI Studio, and other Google-backed AI surfaces within QuizLab.
> - **Session data is stored locally** on your device inside QuizLab's application data directory. QuizLab does **not** transmit your credentials or session data to any external server.
> - **Session may expire or degrade** over time. Google may require re-authentication due to security policies, cookie expiration, or account activity. Use `Settings > Gemini Web > Check Now` to verify session health.
> - **Shared session across Google surfaces**: signing into one Google AI surface (e.g., Gemini) will share the session with other Google surfaces (NotebookLM, AI Studio). Logging out or resetting the profile will affect all Google surfaces.
> - **Profile reset is irreversible**: using the "Reset Profile" option will clear all Google session data and require a fresh login.
> - QuizLab is **not affiliated with Google**. AI interactions happen through your own Google account and are subject to Google's Terms of Service and Privacy Policy.

### Screenshot to AI Workflow

- Full-page capture
- Cropped capture
- Quick handoff to the active AI session
- Useful for diagrams, figures, and non-copyable PDF content

### Appearance, Localization, and Study UX

- Adjustable bottom bar scale and opacity
- Layout swap support
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

[QuizLab Reader Releases](https://github.com/ozymandias-get/quizlab/releases)

Typical artifacts:

- Windows: `QuizlabReader-Setup-<version>.exe`
- macOS: `QuizlabReader-<version>.dmg`
- Linux: `QuizlabReader-<version>.AppImage`

### Build from source

> **Windows Users**: QuizLab enforces `LF` line endings across the source repository. Before cloning or committing, we recommend setting this Git configuration to prevent formatting conflicts:
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

### 3. Connect Gemini CLI for quiz generation

Quiz generation depends on Gemini CLI.

```bash
npm install -g @google/gemini-cli
gemini login
```

Then configure Gemini CLI inside QuizLab settings if needed.

### 4. Generate a quiz

- Select PDF text optionally for tighter context
- Open the quiz flow
- Choose difficulty, question count, and style
- Generate questions and start review mode

### 5. Use web session tools when needed

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
- The dev script can reuse an existing QuizLab Vite server on port `5173`
- The current dev flow preserves the existing Electron and Chromium profile instead of clearing web session data
- GPU acceleration flags are enabled at startup in the Electron main process

## Architecture

QuizLab uses a layered Electron plus React architecture.

```text
electron/
  app/                     Main-process entry, windows, IPC registration
  core/                    Config, updater, helpers
  features/
    ai/                    AI registry and platform definitions
    automation/            Selector and automation helpers
    gemini-web-session/    Shared Google web session management
    pdf/                   Secure PDF protocol and handlers
    quiz/                  Gemini CLI quiz pipeline
    screenshot/            Capture handlers
  preload/                 Context bridge API

src/
  app/                     App shell and providers
  features/
    ai/                    AI home page, sessions, webviews
    pdf/                   PDF viewer and reading flows
    quiz/                  Quiz configuration, play, review, results
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

QuizLab is local-first by design.

- PDF files are handled locally
- Renderer code is isolated behind a preload bridge
- Electron IPC is validated in the main process
- AI usage happens through your own logged-in web sessions or Gemini CLI setup
- Custom PDF loading uses a dedicated Electron protocol instead of exposing arbitrary file paths

See [SECURITY.md](SECURITY.md) for the current security policy and reporting process.

## Configuration

Main settings areas include:

- Prompts
- Models
- Sites
- Gemini CLI
- Gemini Web
- Selectors
- Appearance
- Language
- About

Examples of persisted local data include:

- AI registry custom entries
- quiz preferences
- Gemini web session state
- recent reading state
- pinned AI tabs
- layout and appearance preferences

## Troubleshooting

### Quiz generation is not working

- Confirm Gemini CLI is installed globally
- Run `gemini login`
- Verify the selected PDF is readable and not password-protected

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

This is expected if QuizLab's Vite dev server is already running on port `5173`.

## Contributing

QuizLab accepts contributions for product features, documentation, bug fixes, tests, and platform improvements.

Before opening a pull request, run:

```bash
npm run typecheck
npm run lint
npm run test
```

Contribution details live in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

QuizLab Reader is released under the [MIT License](LICENSE).

---

<p align="center">
  <strong>Keywords:</strong> AI PDF reader, quiz generator, study tool, active recall, flashcard generator, Electron app, split-screen PDF viewer, Gemini AI, ChatGPT integration, medical study app, exam preparation, open source study workspace, PDF annotation tool, AI-powered learning, cross-platform desktop app
</p>
