@echo off
REM NSL Chat — Build Electron Windows Installer
cd /d "%~dp0"
echo Building Electron for Windows...
call node node_modules\electron-builder\cli.js --config electron-builder.yml --win
echo.
echo === Installer in dist-electron\ ===
pause
