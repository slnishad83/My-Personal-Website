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
        .register("sw.js?v=117", { scope: "./" })
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
    if (isStandaloneApp()) {
      setButtonsVisible(false);
      setHelp("");
      return;
    }

    setButtonsVisible(true);
    setHelp(isIos ? getManualInstallMessage() : "");
  }

  async function installApp(event) {
    event.preventDefault();

    if (isStandaloneApp()) {
      notify("Team Chat is already installed on this device.");
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
