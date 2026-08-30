; ── Installation key gate ────────────────────────────────────────────────────
; Requires the correct key before the installer will proceed past the
; directory-selection page (i.e. before any files are copied). Wrong key (or
; blank) re-shows this same page — Install/Instfiles never runs without it.
;
; NOTE ON SECURITY: this is a UI speed bump, not real protection. The key
; below is stored in plaintext inside the generated installer .exe — anyone
; who runs it through a NSIS/7-Zip unpacker can read it directly. Fine for
; keeping casual users from installing by accident; not a substitute for
; real licensing/DRM if that's ever needed.
;
; Everything here is scoped to !ifndef BUILD_UNINSTALLER: NSIS compiles the
; installer and the embedded uninstaller as two separate passes from this
; same included file. The `Page custom` line that references these functions
; only exists in the installer branch (via customPageAfterChangeDir, which
; app-builder-lib's assistedInstaller.nsh only inserts when BUILD_UNINSTALLER
; is undefined) — leaving the functions unguarded meant the uninstaller-only
; pass defined them with nothing referencing them, and NSIS's
; warnings-as-errors setting turned that "unreferenced function" warning into
; a hard build failure.
!ifndef BUILD_UNINSTALLER
  !include nsDialogs.nsh
  !include LogicLib.nsh

  Var InstallKeyDialog
  Var InstallKeyInput
  Var InstallKeyValue

  !define INSTALL_KEY "Avyaan@Bunny@Champ@20022022"

  !macro customPageAfterChangeDir
    Page custom InstallKeyPageCreate InstallKeyPageLeave
  !macroend

  Function InstallKeyPageCreate
    nsDialogs::Create 1018
    Pop $InstallKeyDialog
    ${If} $InstallKeyDialog == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 24u "Enter the installation key to continue setup:"
    Pop $0

    ${NSD_CreatePassword} 0 30u 100% 12u ""
    Pop $InstallKeyInput

    nsDialogs::Show
  FunctionEnd

  Function InstallKeyPageLeave
    ${NSD_GetText} $InstallKeyInput $InstallKeyValue
    ${If} $InstallKeyValue != "${INSTALL_KEY}"
      MessageBox MB_OK|MB_ICONEXCLAMATION "Incorrect installation key. Please try again."
      Abort
    ${EndIf}
  FunctionEnd
!endif

; Custom uninstaller behavior for MY STEAM LAB.
;
; electron-builder's built-in `deleteAppDataOnUninstall` option removes app
; data silently with no prompt. We want an explicit Yes/No confirmation
; instead, so this hooks the `customUnInstall` macro (invoked automatically
; by app-builder-lib's uninstaller.nsh, see node_modules/app-builder-lib/
; templates/nsis/uninstaller.nsh) rather than enabling that flag.
;
; Two locations are covered:
;   - $APPDATA\my-stream-lab       — Electron's own userData dir (saved
;     projects/settings; matches app.getPath('userData') in src/main).
;   - $LOCALAPPDATA\Arduino15      — arduino-cli's data directory, where the
;     app downloads the ESP32 compiler toolchain (can be several hundred MB).
;     This is arduino-cli/Arduino IDE 2.x's standard shared default location,
;     not something private to this app — the prompt calls that out so users
;     who also use the Arduino IDE separately can choose to keep it.
!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you also want to delete all MY STEAM LAB data from this computer?$\r$\n$\r$\nThis permanently deletes your saved settings and the downloaded Arduino/ESP32 compiler toolchain (used for Verify/Upload). This cannot be undone.$\r$\n$\r$\nChoose No to keep this data — for example if you plan to reinstall, or if you also use the Arduino IDE, which shares the same toolchain folder." IDNO skip_data_delete

    RMDir /r "$APPDATA\my-stream-lab"
    RMDir /r "$LOCALAPPDATA\Arduino15"

  skip_data_delete:
!macroend
