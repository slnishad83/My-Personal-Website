@echo off
echo ===================================================
echo   NEXUS REDESIGN GIT REPAIR & DEPLOYMENT UTILITY
echo ===================================================
echo.
echo 1. Resetting local commits to remote origin/main...
git reset --mixed origin/main
echo.
echo 2. Staging all visual changes (excluding ignored works.zip)...
git add .
echo.
echo 3. Creating a clean commit...
git commit -m "visual: redesign home page and chat system layouts for all viewports"
echo.
echo 4. Merging latest remote changes from GitHub...
git pull --no-rebase
echo.
echo 5. Resolving style conflicts (keeping our updated cyber theme)...
git add works/chat/premium-chat-theme.css
git add works/chat/www/premium-chat-theme.css
echo.
echo 6. Completing the merge commit...
git commit -m "merge: resolve merge conflicts by keeping cyber theme styles"
echo.
echo 7. Pushing clean history to GitHub...
git push
echo.
echo 8. Deploying to Firebase...
firebase deploy
echo.
echo ===================================================
echo   Repair and deployment completed! Press any key to exit.
echo ===================================================
pause
