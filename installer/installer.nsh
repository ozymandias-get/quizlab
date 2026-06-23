; Quizlab Reader NSIS Installer Custom Script
; This file adds custom installer behavior

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
  WriteRegStr HKCU "Software\Google\Chrome\NativeMessagingHosts\com.quizlab.reader" "" "$INSTDIR\resources\extensions\quizlab-session-extension\com.quizlab.reader.json"
!macroend

!macro customUnInstall
  ; Clean up file associations
  ; DeleteRegKey HKCR "*\shell\QuizlabReader"

  ; Remove Chrome Native Messaging Host registration
  DeleteRegKey HKCU "Software\Google\Chrome\NativeMessagingHosts\com.quizlab.reader"
!macroend

!macro customInstallMode
  ; Set install mode - can be "currentUser" or "allUsers"
  StrCpy $0 "currentUser"
!macroend
