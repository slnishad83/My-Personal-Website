@echo off
echo ===================================================
echo   NEXUS FRONTEND ONLY DEPLOYMENT UTILITY
echo ===================================================
echo.
echo Running firebase deploy --only hosting...
firebase deploy --only hosting
echo.
echo ===================================================
echo   Deployment completed! Press any key to exit.
echo ===================================================
pause
