@echo off
echo ===================================================
echo   NEXUS REDESIGN FINAL DEPLOYMENT UTILITY
echo ===================================================
echo.
echo 1. Staging changes...
git add .
echo.
echo 2. Committing cache-busting and theme corrections...
git commit -m "fix: apply cyber layout styles to active nsl-theme.css and cache-bust"
echo.
echo 3. Pushing changes to GitHub...
git push
echo.
echo 4. Deploying to Firebase...
firebase deploy
echo.
echo ===================================================
echo   Deployment completed! Press any key to exit.
echo ===================================================
pause
