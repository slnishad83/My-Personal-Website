(function () {
  let deferredInstallPrompt = null;
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

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

  function setHelp(message) {
    const help = document.querySelector("[data-install-help]");
    if (help) {
      help.textContent = message || "";
      help.style.display = message ? "block" : "none";
    }
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

  function updateInstallUi() {
    if (isStandalone) {
      setButtonsVisible(false);
      setHelp("");
      return;
    }

    setButtonsVisible(true);
    if (isIos) {
      setHelp("On iPhone or iPad, use Share, then Add to Home Screen.");
    }
  }

  async function installApp(event) {
    event.preventDefault();

    if (isStandalone) {
      notify("Team Chat is already installed on this device.");
      return;
    }

    if (deferredInstallPrompt) {
      const button = event.currentTarget;
      button.disabled = true;
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      button.disabled = false;

      if (choice.outcome === "accepted") {
        setButtonsVisible(false);
        setHelp("");
      }
      return;
    }

    if (isIos) {
      notify("Use Share, then Add to Home Screen to install Team Chat.");
      return;
    }

    notify("Use your browser menu and choose Install app or Add to desktop.");
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((error) => {
        console.log("Service Worker registration failed:", error);
      });
    });
  }

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
