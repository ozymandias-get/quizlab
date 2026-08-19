; Quizlab Reader NSIS Installer Custom Script
; This file adds custom installer behavior

!include "WordFunc.nsh"

!macro customHeader
  !system "echo 'Custom header loaded'"
!macroend

!macro preInit
  ; Pre-initialization code
  SetRegView 64
!macroend

!macro customInit
  ; Custom initialization
!macroend

!macro customInstall
  ; Create file associations for PDF (optional, commented out)
  ; WriteRegStr HKCR ".pdf\OpenWithProgIds" "QuizlabReader.pdf" ""

  ; Add to Windows context menu (optional)
  ; WriteRegStr HKCR "*\shell\QuizlabReader" "" "Open with Quizlab Reader"
  ; WriteRegStr HKCR "*\shell\QuizlabReader\command" "" '"$INSTDIR\Quizlab Reader.exe" "%1"'

  ; Register Chrome Native Messaging Host
  ;
  ; Chromium resolves the host by reading the path stored in the registry and
  ; then parsing that file as JSON. Every backslash in the executable path
  ; must be escaped as "\\" inside the JSON — a single "\" makes Chrome
  ; report "Specified native messaging host not found". Windows accepts
  ; forward slashes in file paths, so we write the JSON with forward slashes
  ; and never run into backslash-escape inconsistencies.
  ;
  ; NOTE: The extension connects to the app over the localhost HTTP bridge
  ; (not the stdio native-messaging protocol); this registration only keeps
  ; the host discoverable so Chrome does not fail host lookup.

  ; Convert $INSTDIR backslashes to forward slashes (all occurrences)
  ${WordReplace} "$INSTDIR" "\" "/" "E" $0

  FileOpen $1 "$INSTDIR\resources\extensions\quizlab-session-extension\com.quizlab.reader.json" w
  FileWrite $1 "{$\"name$\": $\"com.quizlab.reader$\", $\"description$\": $\"Quizlab Reader native messaging host$\", $\"path$\": $\"$0/Quizlab Reader.exe$\", $\"type$\": $\"stdio$\", $\"allowed_origins$\": [$\"chrome-extension://follalbajmbjmkejipfikekdiodbkggp/$\"]}"
  FileClose $1

  WriteRegStr HKCU "Software\Google\Chrome\NativeMessagingHosts\com.quizlab.reader" "" "$INSTDIR\resources\extensions\quizlab-session-extension\com.quizlab.reader.json"
!macroend

!macro customUnInstall
  ; Clean up file associations
  ; DeleteRegKey HKCR "*\shell\QuizlabReader"

  ; Remove Chrome Native Messaging Host registration
  Delete "$INSTDIR\resources\extensions\quizlab-session-extension\com.quizlab.reader.json"
  DeleteRegKey HKCU "Software\Google\Chrome\NativeMessagingHosts\com.quizlab.reader"
!macroend

!macro customInstallMode
  ; Set install mode - can be "currentUser" or "allUsers"
  StrCpy $0 "currentUser"
!macroend