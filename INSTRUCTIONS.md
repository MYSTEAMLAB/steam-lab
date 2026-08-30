# StreamLab Project Setup & Instructions

Welcome to the StreamLab project! This is a powerful Electron-Vite desktop application built with React, TypeScript, and TailwindCSS. It provides a visual block-based programming interface (powered by Blockly) alongside a dynamic Hardware Canvas to seamlessly interact with microcontrollers like Arduino Uno, Arduino Mega, and ESP32.

## Prerequisites

Before running the project from the source code, please ensure you have the following installed on your system:
1. **Node.js** (v18 or higher recommended) - Download from https://nodejs.org/
2. **Python & C++ Build Tools** - Since this project uses the `serialport` package which relies on native C++ bindings, you must have Windows Build Tools installed. If you don't have them, you can install them via the Node installer or by running `npm install --global windows-build-tools` in an administrative terminal.

## How to Run the App Locally

1. **Extract the ZIP file** to a folder of your choice.
2. Open a terminal (Command Prompt or PowerShell) and navigate into the extracted project folder:
   ```bash
   cd streamlab-project
   ```
3. **Install the dependencies:**
   ```bash
   npm install
   ```
4. **Start the development server:**
   ```bash
   npm run dev
   ```
   This will immediately launch the Electron app in development mode with Hot-Module Replacement (HMR) enabled.

## How to Build the Executable (.exe)

If you want to package the application into a standalone installer for Windows so others can install it without needing Node.js:

1. Open a terminal in the project directory.
2. Run the packaging command:
   ```bash
   npm run package
   ```
3. Once the build process successfully completes, you will find the generated `.exe` installer file inside the `dist` folder:
   ```
   streamlab-project/dist/my-stream-lab Setup 1.0.0.exe
   ```

## Updating the Arduino Toolchain (PowerShell)

The app downloads its own Arduino CLI, the ESP32 core, and a handful of libraries
(OneWire, DallasTemperature, Adafruit GFX Library, Adafruit SSD1306) the first
time you compile — this is the "Hardware Deployment Engine" prompt on first
launch. If you'd rather provision or refresh that toolchain ahead of time (e.g.
setting up several machines, or picking up newer core/library versions), run
this in PowerShell instead of going through the app's UI:

```powershell
$compilerDir = "$env:APPDATA\my-stream-lab\compiler"
$cli = Join-Path $compilerDir "arduino-cli.exe"

New-Item -ItemType Directory -Force -Path $compilerDir | Out-Null

if (-not (Test-Path $cli)) {
    Write-Host "Downloading Arduino CLI..." -ForegroundColor Cyan
    $zip = Join-Path $compilerDir "arduino-cli.zip"
    Invoke-WebRequest -Uri "https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_64bit.zip" -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $compilerDir -Force
    Remove-Item $zip
}

Push-Location $compilerDir
try {
    # --overwrite makes this safe to re-run: no duplicate board-manager URLs pile up
    & $cli config init --overwrite
    & $cli config add board_manager.additional_urls "https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json"

    & $cli core update-index
    & $cli core install esp32:esp32
    & $cli core upgrade esp32:esp32

    & $cli lib update-index
    & $cli lib install "OneWire" "DallasTemperature" "Adafruit GFX Library" "Adafruit SSD1306"
    & $cli lib upgrade
}
finally {
    Pop-Location
}

Write-Host "Toolchain up to date." -ForegroundColor Green
```

It's safe to re-run any time — it upgrades the core and every installed library
to their latest version rather than just checking they exist, so it doubles as
an update command. BluetoothSerial, Update.h, WiFi.h and HTTPClient.h don't need
a separate library install; they ship with the `esp32:esp32` core itself.

If you're setting the project up from source rather than the packaged `.exe`,
also sync the app's own npm dependencies:

```powershell
cd "path\to\streamlab-project"
npm install
npm update
```

## Project Structure Overview

- `src/main/` - The Electron main process code. This handles the heavy lifting: Arduino CLI execution, toolchain installation, serial port communication, and window management.
- `src/renderer/` - The React frontend code. This handles all the UI, including the Interactive Hardware Canvas, the Blockly workspace, and the code editor.
- `src/shared/` - Shared types, board configurations, and wiring logic that are used by both the main and renderer processes.
- `tests/` - Comprehensive unit tests for the hardware generator logic.

## Troubleshooting

- **`serialport` installation errors:** If `npm install` fails on the `serialport` package or `@serialport/bindings-cpp`, ensure your Visual Studio C++ Build Tools and Python are correctly installed and added to your system PATH.
- **Missing Arduino CLI / Toolchain:** The app downloads `arduino-cli.exe` itself into `%APPDATA%\my-stream-lab\compiler`. The CLI then keeps its own board cores and libraries in its default data directory, `%LOCALAPPDATA%\Arduino15` — not under `my-stream-lab`, since that path comes from arduino-cli's own defaults, not this app. Ensure your internet connection is active on the first run and that your firewall is not blocking the downloads. See "Updating the Arduino Toolchain" above to provision or refresh it manually instead.
- **Blank Screen on Startup:** Check your terminal where you ran `npm run dev` for any compilation errors.

Enjoy building and experimenting with StreamLab!
