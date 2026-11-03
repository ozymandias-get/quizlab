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
;   shell verb     = SystemFileAssociations\.pdf\shell\QuizlabReader
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

  ; --- Chrome extension bridge ---
  ; The session bridge is a loopback HTTP server plus an unpacked extension
  ; the user loads from Settings. It uses no native messaging host, so the
  ; installer no longer registers a Chrome NativeMessagingHosts key. Old
  ; installs that still carry the key are cleaned up by customUnInstall.
!macroend

!macro customUnInstall
  ; --- Explorer context menu: remove the "QuizLab ile Aç" entry. ---
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\QuizlabReader"
  ; --- Legacy IExplorerCommand COM extension (removed after v6.0.4). ---
  ; Installs up to v6.0.4 registered an in-proc COM shell extension under
  ; this CLSID to give the classic verb multi-select. It is no longer
  ; built or registered, so the key is deleted here purely to clean up
  ; existing machines: a leftover handler points at a DLL that is no
  ; longer shipped. New installs never create it.
  DeleteRegKey HKCU "Software\Classes\CLSID\{C7D9E4A1-5B2F-4C8D-9E1F-2A3B4C5D6E7F}"

  ; Remove the legacy Chrome Native Messaging host registration. The bridge
  ; no longer uses native messaging; this deletes keys written by older
  ; installers or older app versions.
  DeleteRegKey HKCU "Software\Google\Chrome\NativeMessagingHosts\com.quizlab.reader"

  ; The installer-owned manifest copy of older versions lives under $INSTDIR;
  ; this explicit delete covers custom install locations.
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
