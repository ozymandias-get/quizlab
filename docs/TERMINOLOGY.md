# Quizlab Reader — Terminology Standard

This document fixes the wording used across the UI, the code comments and the
documentation. Translations must use these terms consistently.

Where a term has an established name in the code, the code wins. The
authoritative sources for the strings themselves are
`src/shared/i18n/locales/en/*.json` and `src/shared/i18n/locales/tr/*.json`.

## Core Concepts

| EN                    | TR                    | Notes                                                        |
| --------------------- | --------------------- | ------------------------------------------------------------ |
| Workspace             | Çalışma Alanı         | The split-screen work area (settings group "AI & WORKSPACE") |
| PDF panel             | PDF paneli            | Left side of the workspace                                   |
| AI panel              | AI paneli             | Right side of the workspace                                  |
| Hub                   | Merkez                | The floating tool dock between the two panels                |
| Tab                   | Sekme                 | PDF tabs and AI tabs                                         |
| Document              | Belge                 | An opened PDF                                                |
| Reading history       | Okuma geçmişi         | Recently opened files and their last page                    |
| Focus mode            | Odak modu             | Expands one panel to full width                              |
| Prompt                | Prompt                | Instruction text sent to an AI (untranslated)                |
| Prompt Library        | Prompt Kütüphanesi    | Saved prompts, Settings → Prompts                            |
| Quick preset          | Hızlı istem           | One-tap prompt chips in the send composer                    |
| Send composer         | Gönderme bileşeni     | The floating draft queue dock                                |
| Send to AI            | AI'ya Gönder          | Primary send action                                          |
| Auto Send             | Otomatik Gönder       | Deliver instead of only staging content                      |
| Draft                 | Taslak                | An item waiting in the send composer                         |
| Selector              | Selektör              | CSS selector used for automation                             |
| Magic Picker          | Sihirli Seçici        | The in-page element picker (the only name for this tool)     |
| Session               | Oturum                | A signed-in AI web session                                   |
| Google AI Web Session | Google AI Web Oturumu | Shared Google sign-in across Gemini/AI Studio/YouTube        |
| Model                 | Model                 | A site or API model shortcut (untranslated)                  |
| Provider              | Sağlayıcı             | An API Chat provider (OpenAI, Anthropic, …)                  |
| API Chat              | API Sohbet            | The native renderer-drawn chat surface                       |
| Web session           | Web oturumu           | An AI session hosted in a managed WebContentsView            |

## Managed remote content

- **WebContentsView**: Electron native view created and owned by main.
- **Managed view / managed remote view**: that view plus its main-owned lifecycle,
  target, generation and state snapshot; **AI view** when discussing AI tabs.
- **AiContentController**: renderer handle for typed remote commands and events.
- **Host placeholder / host owner**: React surface that positions the native view;
  unmount releases its geometry claim without destroying content.
- **Lifecycle owner**: the tab identity that retires content on close, LRU eviction
  or sleep. Drive identities use `gdrive:<pdfTabId>`; AI tab ids are UUIDs.
- **Generation**: identity of one concrete view, retained across host handoff and
  replaced after destruction. State and events from older generations are ignored.

Electron `WebContents` and guest page remain valid technical terms. Legacy
automation error codes and stored `webviewUrl` fields are compatibility values;
their spelling does not describe the active embedding API. Dock tool ids keep
their `tour-target-*` spelling because they are persisted user preferences.

## Naming rules

- **Magic Picker**, not "Element Picker", "Picker" or "Magic Selector". The
  underlying CSS artifacts are "selectors"; the tool that captures them is the
  Magic Picker.
- **Google AI Web Session**, not "Gemini Web Session". The session is shared by
  several Google surfaces; "Gemini Web" is the name of the dock button that
  opens it, and that name is fine when referring to that button.
- **Send composer** / **Auto Send**, not "handoff pipeline" or "send dock".
- **Selector repair** (or "auto-repaired") for the self-healing behaviour, not
  "selector healing" or "self-healing selectors" in user-facing text.

## UI Actions

| EN         | TR          |
| ---------- | ----------- |
| Cancel     | Vazgeç      |
| Close      | Kapat       |
| Delete     | Sil         |
| Save       | Kaydet      |
| Edit       | Düzenle     |
| Copy       | Kopyala     |
| Search     | Ara         |
| Loading... | Yükleniyor… |
| Try Again  | Tekrar Dene |
| Finish     | Bitir       |
| Confirm    | Onayla      |
| Add        | Ekle        |
| Remove     | Kaldır      |

## Status Terms

| EN       | TR         |
| -------- | ---------- |
| Active   | Aktif      |
| Inactive | Devre Dışı |
| Ready    | Hazır      |
| Error    | Hata       |
| Success  | Başarılı   |
| Warning  | Uyarı      |
| Offline  | Çevrimdışı |
| Online   | Çevrimiçi  |

Selector health states, as rendered in Settings → Selectors: `Ready`,
`Auto-repaired`, `Re-pick needed`, `Not configured` (TR: `Hazır`,
`Otomatik onarıldı`, `Yeniden seçim gerekli`, `Ayarlanmadı`).

## Product Names (Do Not Translate)

Quizlab, Quizlab Reader, ChatGPT, Gemini, AI Studio, NotebookLM, DeepSeek, Qwen,
Claude, Kimi, Mistral, Perplexity, Copilot, OpenAI, Anthropic, NVIDIA, Google
Drive, GitHub, Electron, Node.js, PDF, API, URL, CSS, DOM, IPC, CSP, HMAC.

## Date/Time Terms

| EN          | TR         |
| ----------- | ---------- |
| Today       | Bugün      |
| Yesterday   | Dün        |
| This week   | Bu hafta   |
| Older       | Daha eski  |
| Last opened | Son açılma |

## File Terms

| EN            | TR          |
| ------------- | ----------- |
| File          | Dosya       |
| Files         | Dosyalar    |
| Folder        | Klasör      |
| Folders       | Klasörler   |
| PDF Document  | PDF Belgesi |
| Untitled File | Adsız Dosya |

## i18n Key Naming (STD-025)

Translation keys in `src/shared/i18n/locales/` use **flat `snake_case` with a
domain prefix**:

```
<domain>_<feature>_<action>   e.g.  toast_unhandled_error, api_chat_save, gws_extension_title
```

Rules:

- **New keys must use this format.** Do not introduce `nested.dot.notation` for
  new features; existing dotted keys are grandfathered and will be migrated
  gradually.
- The prefix identifies the owning domain (`api_chat_*`, `gws_*`, `pdf_*`,
  `toast_*`, `error_*`, `selectors_*`, …) so `src/__tests__/i18n.test.ts`
  and simple `rg` searches reliably find missing translations.
- Keep the flat JSON structure — one file per domain (`ai-chat.json`,
  `errors.json`, `gws.json`, …) already groups keys; nesting inside the JSON is
  unnecessary.
- The 19 per-domain files are merged into a single flat `translation` namespace
  in `src/shared/i18n/i18next.ts`, so key names must be globally unique across
  all files.
