@echo off
REM NSL Chat — Build Android APK (debug)
cd /d "%~dp0"
echo Syncing Capacitor to Android...
call node sync-www.js
call node node_modules\@capacitor\cli\bin\capacitor sync android
echo Building debug APK...
cd android
call gradlew.bat assembleDebug
cd ..
echo.
echo === APK built: android\app\build\outputs\apk\debug\app-debug.apk ===
pause
