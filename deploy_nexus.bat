@echo off
echo ===================================================
echo   NEXUS REDESIGN FINAL DEPLOYMENT UTILITY
echo ===================================================
echo.
echo 1. Staging changes...
git add .
echo.
echo 2. Committing layout height and bubble fixes...
git commit -m "fix: constrain chat-main height, style message bubbles, and bump cache-buster"
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
