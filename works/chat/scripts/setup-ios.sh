#!/bin/bash
# NSL Chat — iOS Build Setup Script
# Run this on macOS with Xcode installed
# Usage: bash scripts/setup-ios.sh

set -e

echo "=== NSL Chat — iOS Build Setup ==="
echo ""

# Check for macOS
if [[ "$(uname)" != "Darwin" ]]; then
  echo "ERROR: This script must be run on macOS"
  exit 1
fi

# Check for Xcode
if ! command -v xcodebuild &> /dev/null; then
  echo "ERROR: Xcode is not installed. Install from App Store."
  exit 1
fi

echo "Xcode: $(xcodebuild -version | head -1)"

# Check for CocoaPods
if ! command -v pod &> /dev/null; then
  echo "Installing CocoaPods..."
  sudo gem install cocoapods
fi

# Navigate to project root
cd "$(dirname "$0")/.."
echo "Project root: $(pwd)"

# Install npm dependencies (includes @capacitor/ios)
echo ""
echo "Installing npm dependencies..."
npm install

# Sync web assets
echo ""
echo "Syncing web assets..."
if [ -f sync-www.js ]; then
  node sync-www.js
fi

# Add iOS platform if not present
if [ ! -d ios/App/App.xcworkspace ]; then
  echo ""
  echo "Adding iOS platform..."
  npx cap add ios
fi

# Sync Capacitor
echo ""
echo "Syncing Capacitor (ios)..."
npx cap sync ios

# Copy CallKit plugin files into the right place
echo ""
echo "Setting up CallKit plugin..."
CALLKIT_DIR="ios/App/App/CallKit"
if [ -d "$CALLKIT_DIR" ]; then
  echo "CallKit files found at $CALLKIT_DIR"
  echo "  - IncomingCallPlugin.swift"
  echo "  - CallKitPlugin.m"
else
  echo "WARNING: CallKit directory not found at $CALLKIT_DIR"
  echo "Make sure IncomingCallPlugin.swift and CallKitPlugin.m are present."
fi

# Copy bridging header
if [ -f "ios/App/App/Bridging-Header.h" ]; then
  echo "Bridging header: present"
fi

# Copy AppDelegate
if [ -f "ios/App/App/AppDelegate.swift" ]; then
  echo "AppDelegate.swift: present"
fi

# Install pods
echo ""
echo "Installing CocoaPods..."
cd ios/App
pod install --repo-update
cd ../..

# Verify workspace
if [ -f ios/App/App.xcworkspace/contents.xcworkspacedata ]; then
  echo ""
  echo "Xcode workspace: ios/App/App.xcworkspace"
  echo ""
  echo "=== Setup Complete ==="
  echo ""
  echo "To open in Xcode:"
  echo "  open ios/App/App.xcworkspace"
  echo ""
  echo "To build for device:"
  echo "  cd ios/App && xcodebuild -scheme App -configuration Release -sdk iphoneos"
  echo ""
  echo "To build for simulator:"
  echo "  cd ios/App && xcodebuild -scheme App -configuration Debug -sdk iphonesimulator"
  echo ""
  echo "To archive for App Store:"
  echo "  cd ios/App && xcodebuild -scheme App -configuration Release -archivePath build/App.xcarchive archive"
  echo ""
else
  echo ""
  echo "ERROR: Xcode workspace not found. Check the output above for errors."
  exit 1
fi
