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

; Override electron-builder's default "is the app running?" check (see
; node_modules/app-builder-lib/templates/nsis/include/
; allowOnlyOneInstallerInstance.nsh, macro _CHECK_APP_RUNNING) to try a
; graceful close first.
;
; The stock check goes straight to `taskkill` (then `taskkill /f`) and gives
; up after ~3 seconds total, showing "my-stream-lab cannot be closed. Please
; close it manually..." if that's not enough. A forceful kill never gives the
; app a chance to run its own before-quit cleanup (src/main/index.ts closes
; the serial port and any background compile server there) — and Windows can
; take noticeably longer than 3 seconds to fully release a process that has
; a pending I/O request on a COM port, even after TerminateProcess.
;
; So: first ask the app to close itself normally (WM_CLOSE to its main
; window, matched by the exact title set in createWindow()), and give it a
; real window to exit cleanly — which releases the serial port properly and
; means the process is usually just gone by the time we'd otherwise resort
; to force-killing it. Only if that fails do we fall through to the same
; taskkill loop the stock check uses, with a longer retry budget as a
; backstop.
!ifndef BUILD_UNINSTALLER
  !include "getProcessInfo.nsh"
  Var msSelfPid

  !macro customCheckAppRunning
    ${GetProcessInfo} 0 $msSelfPid $1 $2 $3 $4
    ${if} $3 != "${APP_EXECUTABLE_FILENAME}"
      ${if} ${isUpdated}
        Sleep 300
      ${endIf}

      !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
      ${if} $R0 == 0
        ; Ask nicely first — this is what lets the app's own before-quit
        ; handler close the serial port before anything gets forceful.
        FindWindow $R2 "Chrome_WidgetWin_1" "MY STEAM LAB"
        ${if} $R2 != 0
          SendMessage $R2 0x0010 0 0 /TIMEOUT=500 ; WM_CLOSE

          StrCpy $R3 0
          ms_graceful_wait:
            IntOp $R3 $R3 + 1
            !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
            ${if} $R0 != 0
              Goto ms_after_graceful ; already gone — skip taskkill entirely
            ${endIf}
            ${if} $R3 < 10
              Sleep 500
              Goto ms_graceful_wait
            ${endIf}
        ${endIf}

        ${if} ${isUpdated}
          Sleep 1000
          Goto ms_doStopProcess
        ${endIf}
        MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK ms_doStopProcess
        Quit

        ms_doStopProcess:
        DetailPrint `Closing running "${PRODUCT_NAME}"...`

        !ifdef INSTALL_MODE_PER_ALL_USERS
          nsExec::Exec `taskkill /im "${APP_EXECUTABLE_FILENAME}" /fi "PID ne $msSelfPid"`
        !else
          nsExec::Exec `%SYSTEMROOT%\System32\cmd.exe /c taskkill /im "${APP_EXECUTABLE_FILENAME}" /fi "PID ne $msSelfPid" /fi "USERNAME eq %USERNAME%"`
        !endif
        Sleep 300

        StrCpy $R1 0

        ms_loop:
          IntOp $R1 $R1 + 1

          !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
          ${if} $R0 == 0
            Sleep 1000
            !ifdef INSTALL_MODE_PER_ALL_USERS
              nsExec::Exec `taskkill /f /im "${APP_EXECUTABLE_FILENAME}" /fi "PID ne $msSelfPid"`
            !else
              nsExec::Exec `%SYSTEMROOT%\System32\cmd.exe /c taskkill /f /im "${APP_EXECUTABLE_FILENAME}" /fi "PID ne $msSelfPid" /fi "USERNAME eq %USERNAME%"`
            !endif
            !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
            ${If} $R0 == 0
              DetailPrint `Waiting for "${PRODUCT_NAME}" to close (attempt $R1)...`
              Sleep 2000
            ${else}
              Goto ms_not_running
            ${endIf}
          ${else}
            Goto ms_not_running
          ${endIf}

          ; Stock check gives up after 1 retry (~3s total). A pending serial
          ; I/O can take longer than that to release even under a forced
          ; kill, so give this considerably more room — about 30s — before
          ; showing the "cannot be closed" prompt.
          ${if} $R1 > 12
            MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY ms_loop
            Quit
          ${else}
            Goto ms_loop
          ${endIf}
        ms_not_running:
        ms_after_graceful:
      ${endIf}
    ${endIf}
  !macroend
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
;
; IMPORTANT: when installing a new version over an existing one, electron-
; builder's installer runs the *previous* version's uninstaller silently
; (Uninstall.exe /S) as an automatic first step, before copying the new
; files. MessageBox is NOT suppressed by that silent flag on its own — it
; still pops up and blocks, waiting for a click nobody is watching for,
; which is exactly what made every upgrade look "stuck while uninstalling
; the older version." IfSilent skips the prompt (and safely defaults to
; keeping the data — never destroy anything during an unattended step) so
; only a user manually running the uninstaller from Control Panel/Settings
; ever sees it.
!macro customUnInstall
  IfSilent skip_data_delete

  MessageBox MB_YESNO|MB_ICONQUESTION "Do you also want to delete all MY STEAM LAB data from this computer?$\r$\n$\r$\nThis permanently deletes your saved settings and the downloaded Arduino/ESP32 compiler toolchain (used for Verify/Upload). This cannot be undone.$\r$\n$\r$\nChoose No to keep this data — for example if you plan to reinstall, or if you also use the Arduino IDE, which shares the same toolchain folder." IDNO skip_data_delete

    RMDir /r "$APPDATA\my-stream-lab"
    RMDir /r "$LOCALAPPDATA\Arduino15"

  skip_data_delete:
!macroend
