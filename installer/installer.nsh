; QuizLab Reader - NSIS custom installer logic (electron-builder `nsis.include`).
;
; Install model: per-user (perMachine=false, allowElevation=false,
; customInstallMode=currentUser). The installer runs asInvoker, so no UAC
; prompt appears and "Launch QuizLab" at the end starts the app in the
; normal user context - never elevated.
;
; Identity lock (do NOT rename - existing installs key off these values):
;   appId          = com.quizlab.reader
;   productName    = Quizlab Reader
;   executable     = Quizlab Reader.exe
;   default dir    = %LocalAppData%\Programs\Quizlab Reader
;   shell CLSID    = {C7D9E4A1-5B2F-4C8D-9E1F-2A3B4C5D6E7F} (QuizLabShellExt.dll)
;
; electron-builder already handles: running-app detection on upgrade,
; single-version registry identity, shortcut creation without duplicates,
; and full $INSTDIR removal on uninstall. No custom process killing is
; used here - silently killing a running app could destroy user work.

!include "LogicLib.nsh"
!include "WordFunc.nsh"
!include "FileFunc.nsh"

!macro customHeader
  !system "echo QuizLab Reader custom NSIS header loaded"
!macroend

!macro preInit
  ; Per-user install writes only HKCU + user-writable $INSTDIR, so no
  ; SetRegView override is needed. (HKCU is shared across registry views;
  ; forcing 64-bit view here would only add surprise on ARM64/32-bit.)
!macroend

!macro customInit
  ; No custom init pages. electron-builder provides the standard
  ; language selection (EN/TR), directory page and progress pages.
!macroend

!macro customInstall
  ; --- Explorer context menu: "QuizLab ile Aç" (see docs/windows-installer.md).
  ; Per-user HKCU only (no UAC, asInvoker-safe). This does NOT hijack the
  ; default PDF handler — it only adds an extra right-click entry for .pdf
  ; files under SystemFileAssociations (ProgID-independent).
  ; The menu label follows the installer language: Turkish setup writes
  ; "QuizLab ile Aç" (LANG_TR = 1055), every other language writes
  ; "Open with QuizLab". The app can relabel it later from Settings.
  ${If} $LANGUAGE == 1055
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\QuizlabReader" "" "QuizLab ile Aç"
  ${Else}
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\QuizlabReader" "" "Open with QuizLab"
  ${EndIf}
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\QuizlabReader" "Icon" "$INSTDIR\Quizlab Reader.exe,0"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\QuizlabReader\command" "" '"$INSTDIR\Quizlab Reader.exe" "%1"'

  ; --- IExplorerCommand COM extension (classic-menu upgrade) ---
  ; Pointing the verb above at our in-proc COM server gives the classic
  ; entry multi-select (one process, PDF-only filter). NOTE: on current
  ; Windows 11 builds this alone does NOT promote the verb to the new
  ; (sade) top-level menu — that additionally requires package identity
  ; (MSIX / Sparse Package, not yet implemented), so "Show more options"
  ; remains the expected home. Manual HKCU registration is used instead
  ; of regsvr32 (keeps per-user, no elevation). The DLL only returns a
  ; title/icon and launches the exe — no other side effects. If the DLL
  ; is missing from the package, the classic verb above still works.
  ; CLSID is identity-locked: {C7D9E4A1-5B2F-4C8D-9E1F-2A3B4C5D6E7F}
  ${If} ${FileExists} "$INSTDIR\resources\shell\QuizLabShellExt.dll"
    WriteRegStr HKCU "Software\Classes\CLSID\{C7D9E4A1-5B2F-4C8D-9E1F-2A3B4C5D6E7F}" "" "QuizLab Shell Extension"
    WriteRegStr HKCU "Software\Classes\CLSID\{C7D9E4A1-5B2F-4C8D-9E1F-2A3B4C5D6E7F}\InprocServer32" "" "$INSTDIR\resources\shell\QuizLabShellExt.dll"
    WriteRegStr HKCU "Software\Classes\CLSID\{C7D9E4A1-5B2F-4C8D-9E1F-2A3B4C5D6E7F}\InprocServer32" "ThreadingModel" "Apartment"
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\QuizlabReader" "ExplorerCommandHandler" "{C7D9E4A1-5B2F-4C8D-9E1F-2A3B4C5D6E7F}"
  ${EndIf}

  ; --- Chrome Native Messaging host registration ---
  ; Chromium resolves the host by reading the path stored in the registry and
  ; then parsing that file as JSON. Every backslash in the executable path
  ; must be escaped as "\\" inside the JSON - a single "\" makes Chrome
  ; report "Specified native messaging host not found". Windows accepts
  ; forward slashes in file paths, so the JSON is written with forward
  ; slashes and backslash-escape issues never arise.
  ;
  ; The allowed origin below is the Chrome Web Store / pinned-key extension
  ; ID. It is deterministic (SHA-256 of the key pinned in
  ; extensions/quizlab-session-extension/manifest.json, see
  ; electron/features/native-messaging/nativeMessagingOrigin.ts). If the
  ; extension key ever rotates, this value MUST be updated together with it.
  ;
  ; NOTE: the app itself can (re)register this same HKCU key at runtime from
  ; Settings ("install extension"), pointing at its %AppData% copy with a
  ; proper UTF-8 manifest. Same key = last writer wins, and uninstall below
  ; removes the key regardless of which side wrote it last. The registry is
  ; therefore only updated here when the manifest file was written OK.
  ;
  ; The executable name below is intentionally literal: it must stay in sync
  ; with win.executableName in package.json ("Quizlab Reader" ->
  ; "Quizlab Reader.exe"). (${APP_EXECUTABLE_FILENAME} cannot be used here -
  ; electron-builder defines it with surrounding quotes for NSIS file
  ; commands, which would corrupt the JSON string.)
  ;
  ; $R0 is used as scratch (not $0): $0 carries the install mode
  ; ("currentUser"/"allUsers") for electron-builder's own logic.

  StrCpy $R0 "" ; $R0 = forward-slash $INSTDIR on success, "" on failure

  ; Convert every backslash in $INSTDIR to a forward slash.
  ; WordReplace's 4th parameter is the occurrence selector: "+" replaces ALL
  ; occurrences. (Anything else - e.g. "E" - is invalid and yields error
  ; code 3 instead of the converted path.)
  ${WordReplace} "$INSTDIR" "\" "/" "+" $R0

  ; Write the manifest. Quoted paths keep space/Unicode install locations safe.
  ClearErrors
  FileOpen $1 "$INSTDIR\resources\extensions\quizlab-session-extension\com.quizlab.reader.json" w
  ${If} ${Errors}
    DetailPrint "QuizLab Reader: could not write native messaging manifest, skipping Chrome registration"
    StrCpy $R0 ""
  ${Else}
    FileWrite $1 '{"name": "com.quizlab.reader", "description": "Quizlab Reader native messaging host", "path": "$R0/Quizlab Reader.exe", "type": "stdio", "allowed_origins": ["chrome-extension://follalbajmbjmkejipfikekdiodbkggp/"]}$\r$\n'
    ${If} ${Errors}
      DetailPrint "QuizLab Reader: failed to write native messaging manifest, skipping Chrome registration"
      StrCpy $R0 ""
    ${EndIf}
    FileClose $1
  ${EndIf}

  ${If} $R0 != ""
    WriteRegStr HKCU "Software\Google\Chrome\NativeMessagingHosts\com.quizlab.reader" "" "$INSTDIR\resources\extensions\quizlab-session-extension\com.quizlab.reader.json"
  ${EndIf}
!macroend

!macro customUnInstall
  ; --- Explorer context menu: remove the "QuizLab ile Aç" entry. ---
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\QuizlabReader"
  ; --- Windows 11 top-level menu: remove the COM extension registration. ---
  DeleteRegKey HKCU "Software\Classes\CLSID\{C7D9E4A1-5B2F-4C8D-9E1F-2A3B4C5D6E7F}"

  ; Remove the Chrome Native Messaging host registration. The value is
  ; deleted regardless of whether the installer or the app wrote it last
  ; (both use this exact HKCU key).
  DeleteRegKey HKCU "Software\Google\Chrome\NativeMessagingHosts\com.quizlab.reader"

  ; The installer-owned manifest copy lives under $INSTDIR and is removed
  ; with it; this explicit delete covers custom install locations.
  Delete "$INSTDIR\resources\extensions\quizlab-session-extension\com.quizlab.reader.json"

  ; Intentionally NOT deleting %AppData%\Quizlab Reader (settings, bridge
  ; info, extension copy): uninstall must never destroy user data
  ; (deleteAppDataOnUninstall=false). Those files are inert without the
  ; registry key above and are re-used by a later reinstall.
!macroend

!macro customInstallMode
  ; Explicit per-user mode, matching perMachine=false + allowElevation=false.
  StrCpy $0 "currentUser"
!macroend
