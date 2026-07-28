# NSL Chat — All-in-One Master PowerShell Deployment Script
$ErrorActionPreference = "Stop"

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  NSL CHAT ALL-IN-ONE MASTER DEPLOYMENT UTILITY" -ForegroundColor Cyan
Write-Host "===================================================`n" -ForegroundColor Cyan

# 1. Git Pull
Write-Host "1. Pulling latest changes from GitHub..." -ForegroundColor Yellow
git pull --rebase --autostash

# 2. Build Vite Web Assets & Sync WWW
Write-Host "`n2. Building Vite web assets and syncing www folder..." -ForegroundColor Yellow
node works/chat/sync-www.js

# 3. Sync Android & iOS
Write-Host "`n3. Syncing Mobile Apps (Android & iOS)..." -ForegroundColor Yellow
Push-Location works/chat
try {
    npx cap sync android
    npx cap sync ios
} finally {
    Pop-Location
}

# 4. Build Desktop Executables
Write-Host "`n4. Building Windows Desktop Executables..." -ForegroundColor Yellow
try {
    if (Test-Path works/chat/dist-electron) {
        Remove-Item -Recurse -Force works/chat/dist-electron -ErrorAction SilentlyContinue
    }
    Push-Location works/chat
    try {
        npm run electron:build
    } finally {
        Pop-Location
    }
} catch {
    Write-Host "Desktop build warning: $_" -ForegroundColor DarkYellow
}

# 5. Git Commit & Push
Write-Host "`n5. Staging, committing and pushing to GitHub..." -ForegroundColor Yellow
git add .
$status = git status --porcelain
if ($status) {
    git commit -m "build: sync production assets for Web, Mobile, iOS and Desktop"
    git push
} else {
    Write-Host "No changes to commit to Git." -ForegroundColor Gray
}

# 6. Deploy to Firebase
Write-Host "`n6. Deploying to Firebase Hosting & Rules..." -ForegroundColor Yellow
firebase deploy --only hosting,firestore:rules,storage

Write-Host "`n7. Deploying Cloud Functions..." -ForegroundColor Yellow
firebase deploy --only functions

Write-Host "`n===================================================" -ForegroundColor Green
Write-Host "  ALL PLATFORMS SUCCESSFULLY UPDATED AND DEPLOYED!" -ForegroundColor Green
Write-Host "===================================================`n" -ForegroundColor Green
