(function () {
  let deferredInstallPrompt = null;
  let serviceWorkerReadyPromise = null;
  const INSTALL_RELOAD_KEY = "teamChatInstallReloaded";
  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform || "";
  const isIos =
    /iphone|ipad|ipod/i.test(userAgent) ||
    (platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isSafari =
    /^((?!chrome|android|crios|fxios|edg|opr).)*safari/i.test(userAgent);
  const isEdge = /edg/i.test(userAgent);
  const isFirefox = /firefox|fxios/i.test(userAgent);
  const isAndroid = /android/i.test(userAgent);
  const supportsAndroidIntent = /chrome|crios|edg|opr|samsungbrowser/i.test(
    userAgent,
  );
  const isNativeApp =
    window.Capacitor?.isNativePlatform?.() === true ||
    Boolean(window.Capacitor?.Plugins?.App);
  const APK_URL = new URL("my-team-chat.apk", window.location.href).href;
  const ANDROID_APP_INTENT =
    "intent://open#Intent;" +
    "scheme=myteamchat;" +
    "package=com.nishad.myteamchat;" +
    `S.browser_fallback_url=${encodeURIComponent(APK_URL)};` +
    "end";
  const WEB_APP_LABEL = isIos ? "Add App to Home Screen" : "Install Web App";

  function isStandaloneApp() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function getInstallButtons() {
    return Array.from(
      document.querySelectorAll("[data-install-app], #installAppBtn"),
    );
  }

  function setButtonsVisible(isVisible) {
    getInstallButtons().forEach((button) => {
      button.style.display = isVisible ? "" : "none";
      button.disabled = false;
    });
  }

  function setButtonsBusy(isBusy) {
    getInstallButtons().forEach((button) => {
      button.disabled = isBusy;
      button.setAttribute("aria-busy", isBusy ? "true" : "false");
    });
  }

  function setButtonLabels(label) {
    getInstallButtons().forEach((button) => {
      const labelElement = button.querySelector(".install-app-label");
      if (labelElement) {
        labelElement.textContent = label;
      } else {
        const icon = button.querySelector(".login-install-icon");
        button.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            node.textContent = ` ${label}`;
          }
        });
        if (!icon && !button.textContent.trim()) button.textContent = label;
      }
      const description = isAndroid
        ? "Open My Team Chat if installed, otherwise download the Android APK"
        : "Install My Team Chat on this device";
      button.title = description;
      button.setAttribute("aria-label", description);
    });
  }

  function setHelp(message) {
    const help = document.querySelector("[data-install-help]");
    if (help) {
      help.textContent = message || "";
      help.style.display = message ? "block" : "none";
    }
  }

  function prepareServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return Promise.resolve(null);
    }

    if (!serviceWorkerReadyPromise) {
      serviceWorkerReadyPromise = navigator.serviceWorker
        .register("sw.js?v=156", { scope: "./" })
        .then((registration) => {
          registration.update?.().catch(() => {});
          return navigator.serviceWorker.ready;
        })
        .catch((error) => {
          console.log("Service Worker registration failed:", error);
          return null;
        });
    }

    return serviceWorkerReadyPromise;
  }

  function notify(message, isError) {
    if (typeof window.showToast === "function") {
      window.showToast(message, isError ? "error" : "success");
      return;
    }

    const success = document.getElementById("authSuccess");
    const error = document.getElementById("authError");
    const target = isError ? error : success;
    const other = isError ? success : error;

    if (other) other.style.display = "none";
    if (target) {
      target.textContent = message;
      target.style.display = "block";
      return;
    }

    window.alert(message);
  }

  function getManualInstallMessage() {
    if (isIos) {
      return "On iPhone or iPad, tap Share, then Add to Home Screen.";
    }

    if (isEdge) {
      return "Open the Edge menu, choose Apps, then Install this site as an app.";
    }

    if (isFirefox) {
      return "Firefox does not support one-tap web app install here. Add Team Chat from your browser menu or use Chrome or Edge for the app install prompt.";
    }

    if (isSafari) {
      return "Open Safari Share, then choose Add to Dock or Add to Home Screen.";
    }

    return "Open your browser menu and choose Install app, Add to desktop, or Add to Home Screen.";
  }

  function updateInstallUi() {
    if (isStandaloneApp() || isNativeApp) {
      setButtonsVisible(false);
      setHelp("");
      return;
    }

    if (isAndroid) {
      setButtonLabels("Open or Download App");
      setButtonsVisible(true);
      setHelp(
        "Already installed? This opens the Android app. Otherwise, it downloads the APK for installation.",
      );
      return;
    }

    setButtonLabels(deferredInstallPrompt ? "Install App" : WEB_APP_LABEL);
    setButtonsVisible(true);
    setHelp(deferredInstallPrompt ? "Install Team Chat on this device." : getManualInstallMessage());
  }

  function openInstalledAppOrDownloadApk() {
    setButtonsBusy(true);
    setHelp("Opening the installed app, or downloading the APK if it is not installed...");
    if (supportsAndroidIntent) {
      window.setTimeout(() => setButtonsBusy(false), 1800);
      window.location.href = ANDROID_APP_INTENT;
      return;
    }

    let appOpened = false;
    const markAppOpened = () => {
      if (document.visibilityState === "hidden") appOpened = true;
    };
    document.addEventListener("visibilitychange", markAppOpened, { once: true });

    const launcher = document.createElement("iframe");
    launcher.hidden = true;
    launcher.src = "myteamchat://open";
    document.body.appendChild(launcher);

    window.setTimeout(() => {
      launcher.remove();
      setButtonsBusy(false);
      if (!appOpened) window.location.href = APK_URL;
    }, 1600);
  }

  async function installApp(event) {
    event.preventDefault();

    if (isStandaloneApp() || isNativeApp) {
      notify("Team Chat is already installed on this device.");
      return;
    }

    if (isAndroid) {
      openInstalledAppOrDownloadApk();
      return;
    }

    if (deferredInstallPrompt) {
      setButtonsBusy(true);
      try {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;

        if (choice.outcome === "accepted") {
          setButtonsVisible(false);
          setHelp("");
        }
      } finally {
        setButtonsBusy(false);
      }
      return;
    }

    await prepareServiceWorker();
    if (
      !navigator.serviceWorker?.controller &&
      !sessionStorage.getItem(INSTALL_RELOAD_KEY)
    ) {
      sessionStorage.setItem(INSTALL_RELOAD_KEY, "1");
      setHelp("Preparing app install. The page will refresh once.");
      window.location.reload();
      return;
    }

    setHelp(getManualInstallMessage());
    notify(getManualInstallMessage());
  }

  window.addEventListener("load", prepareServiceWorker);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallUi();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    setButtonsVisible(false);
    setHelp("");
    notify("Team Chat installed successfully.");
  });

  document.addEventListener("DOMContentLoaded", () => {
    getInstallButtons().forEach((button) => {
      button.addEventListener("click", installApp);
    });
    updateInstallUi();
  });
})();
