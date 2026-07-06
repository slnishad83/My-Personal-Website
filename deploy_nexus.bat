@echo off
echo ===================================================
echo   NEXUS REDESIGN FINAL DEPLOYMENT UTILITY
echo ===================================================
echo.
echo 1. Staging changes...
git add .
echo.
echo 2. Committing layout and scrolling fixes...
git commit -m "fix: constrain grid rows to single layout row and restore messages area scrolling"
echo.
echo 3. Pushing changes to GitHub...
git push
echo.
echo 4. Deploying to Firebase (Hosting Only)...
firebase deploy --only hosting
echo.
echo ===================================================
echo   Deployment completed! Press any key to exit.
echo ===================================================
pause
