@echo off
echo ===================================================
echo   NEXUS FRONTEND ONLY DEPLOYMENT UTILITY
echo ===================================================
echo.
echo Running firebase deploy --only hosting...
node works\chat\node_modules\firebase-tools\lib\bin\firebase.js deploy --only hosting
echo.
echo ===================================================
echo   Deployment completed! Press any key to exit.
echo ===================================================
pause
