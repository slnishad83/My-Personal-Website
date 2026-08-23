@echo off
REM NSL Chat — Build Web + Sync + Deploy (Firebase)
REM Just double-click this file. No popups.
cd /d "%~dp0"
echo [1/3] Building web assets...
call node sync-www.js
echo [2/3] Syncing Capacitor...
call node node_modules\@capacitor\cli\bin\capacitor sync android
call node node_modules\@capacitor\cli\bin\capacitor sync ios
echo [3/3] Deploying to Firebase...
call "%AppData%\npm\firebase.cmd" deploy --only hosting,firestore:rules,firestore:indexes
echo.
echo === DONE ===
pause
