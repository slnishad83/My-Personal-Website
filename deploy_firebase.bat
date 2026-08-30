@echo off
echo ===================================================
echo   NEXUS REDESIGN FIREBASE DEPLOYMENT UTILITY
echo ===================================================
echo.
echo Running firebase deploy...
node works\chat\node_modules\firebase-tools\lib\bin\firebase.js deploy
echo.
echo ===================================================
pause
