// ============================================================
// PWA INSTALL PROMPT - APP INSTALLATION HANDLER
// Manages install prompt, installation, and app lifecycle
// ============================================================

class PWAInstallPrompt {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.isInstallable = false;
    this.installButton = null;
    this.promptElement = null;
    
    this.init();
  }

  /**
   * Initialize install prompt listener
   */
  init() {
    // Detect if app is already installed
    this.checkIfInstalled();
    
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => this.handleBeforeInstallPrompt(e));
    
    // Listen for app installed event
    window.addEventListener('appinstalled', () => this.handleAppInstalled());
    
    // Check for display mode
    this.checkDisplayMode();
    
    // Setup UI
    this.setupUI();
    
    console.log('✅ PWA Install Prompt initialized');
  }

  /**
   * Handle beforeinstallprompt event
   */
  handleBeforeInstallPrompt(event) {
    console.log('📲 Install prompt available');
    
    // Prevent default mini-infobar
    event.preventDefault();
    
    // Store the event for later use
    this.deferredPrompt = event;
    this.isInstallable = true;
    
    // Show install button/prompt
    this.showInstallPrompt();
  }

  /**
   * Handle app installation
   */
  handleAppInstalled() {
    console.log('🎉 App installed successfully!');
    
    this.isInstalled = true;
    this.isInstallable = false;
    this.deferredPrompt = null;
    
    // Hide install button
    this.hideInstallPrompt();
    
    // Show installed message
    this.showInstalledNotification();
  }

  /**
   * Check if app is installed
   */
  checkIfInstalled() {
    // Check if running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
      console.log('✅ App is running in standalone mode');
    }
    
    // Check if display mode is fullscreen (iOS)
    if (navigator.standalone === true) {
      this.isInstalled = true;
      console.log('✅ App is running in standalone mode (iOS)');
    }
  }

  /**
   * Check display mode changes
   */
  checkDisplayMode() {
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
      if (e.matches) {
        this.isInstalled = true;
        console.log('✅ Display mode changed to standalone');
      }
    });
  }

  /**
   * Show install prompt/button
   */
  showInstallPrompt() {
    // Find or create install button
    this.installButton = document.getElementById('install-app-button');
    
    if (this.installButton) {
      this.installButton.style.display = 'flex';
      this.installButton.addEventListener('click', () => this.promptInstall());
    }
    
    // Show inline prompt if available
    this.showInlinePrompt();
  }

  /**
   * Hide install prompt/button
   */
  hideInstallPrompt() {
    if (this.installButton) {
      this.installButton.style.display = 'none';
    }
    
    if (this.promptElement) {
      this.promptElement.style.display = 'none';
    }
  }

  /**
   * Prompt user to install app
   */
  async promptInstall() {
    if (!this.deferredPrompt) {
      console.warn('⚠️ Install prompt not available');
      return;
    }
    
    try {
      // Show the install prompt
      this.deferredPrompt.prompt();
      
      // Wait for user response
      const { outcome } = await this.deferredPrompt.userChoice;
      
      console.log(`User response: ${outcome}`);
      
      // Reset the deferred prompt
      this.deferredPrompt = null;
      
      if (outcome === 'accepted') {
        console.log('✅ User accepted install');
      } else {
        console.log('⚠️ User declined install');
      }
      
    } catch (error) {
      console.error('❌ Install prompt error:', error);
    }
  }

  /**
   * Show inline install prompt
   */
  showInlinePrompt() {
    if (this.isInstalled || !this.isInstallable) {
      return;
    }
    
    // Create prompt element
    const promptHTML = `
      <div id="install-prompt" class="install-prompt" style="
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
        color: white;
        padding: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        z-index: 999;
        border-radius: 12px 12px 0 0;
        box-shadow: 0 -4px 16px rgba(0,0,0,0.1);
        font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        animation: slideUp 0.3s ease-out;
      ">
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">
            📱 Install Team Chat
          </div>
          <div style="font-size: 14px; opacity: 0.9;">
            Get the app on your home screen for quick access
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button id="install-cancel" style="
            background: rgba(255,255,255,0.2);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
          ">Not Now</button>
          <button id="install-confirm" style="
            background: white;
            color: #6366F1;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
          ">Install</button>
        </div>
      </div>
      <style>
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      </style>
    `;
    
    // Add to body if not exists
    if (!document.getElementById('install-prompt')) {
      document.body.insertAdjacentHTML('beforeend', promptHTML);
      
      // Add event listeners
      document.getElementById('install-confirm')?.addEventListener('click', () => this.promptInstall());
      document.getElementById('install-cancel')?.addEventListener('click', () => this.hideInstallPrompt());
    }
  }

  /**
   * Show installed notification
   */
  showInstalledNotification() {
    const message = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #22C55E;
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
        font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
      ">
        🎉 App installed! You can use it offline now.
      </div>
      <style>
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', message);
    
    // Remove after 4 seconds
    setTimeout(() => {
      document.querySelector('[style*="slideIn"]')?.remove();
    }, 4000);
  }

  /**
   * Setup UI elements
   */
  setupUI() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/My-Personal-Website/works/chat/pwa/service-worker.js')
        .then((registration) => {
          console.log('✅ Service Worker registered');
          
          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60000);
        })
        .catch((error) => {
          console.warn('⚠️ Service Worker registration failed:', error);
        });
    }
  }

  /**
   * Get installation status
   */
  getStatus() {
    return {
      isInstalled: this.isInstalled,
      isInstallable: this.isInstallable,
      displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
    };
  }
}

// Initialize on document ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.pwaInstaller = new PWAInstallPrompt();
  });
} else {
  window.pwaInstaller = new PWAInstallPrompt();
}

console.log('✅ PWA Install Prompt Module Loaded');