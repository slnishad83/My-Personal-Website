@echo off
echo ===================================================
echo   NEXUS REDESIGN FINAL DEPLOYMENT UTILITY
echo ===================================================
echo.
echo 1. Staging changes...
git add .
echo.
echo 2. Committing layout and column collision fixes...
git commit -m "fix: resolve column collision on mobile-install-card and restore scrolling/input layouts"
echo.
echo 3. Pushing changes to GitHub...
git push
echo.
echo 4. Deploying to Firebase (Hosting Only)...
node works\chat\node_modules\firebase-tools\lib\bin\firebase.js deploy --only hosting
echo.
echo ===================================================
echo   Deployment completed! Press any key to exit.
echo ===================================================
pause
