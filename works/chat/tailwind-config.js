'use strict';
if (typeof tailwind !== 'undefined') {
  tailwind.config = {
    darkMode: "class",
    theme: {
      extend: {
        colors: {
          primary: "var(--primary)", "on-primary": "var(--on-primary)",
          "primary-container": "var(--primary-container)", "on-primary-container": "var(--on-primary-container)",
          secondary: "var(--secondary)", "on-secondary": "var(--on-secondary)",
          "secondary-container": "var(--secondary-container)", "on-secondary-container": "var(--on-secondary-container)",
          tertiary: "var(--tertiary)", "on-tertiary": "var(--on-tertiary)",
          "tertiary-container": "var(--tertiary-container)", "on-tertiary-container": "var(--on-tertiary-container)",
          background: "var(--background)", "on-background": "var(--on-background)",
          surface: "var(--surface)", "on-surface": "var(--on-surface)",
          "surface-variant": "var(--surface-variant)", "on-surface-variant": "var(--on-surface-variant)",
          "surface-dim": "var(--surface-dim)", "surface-bright": "var(--surface-bright)",
          "surface-container-lowest": "var(--surface-container-lowest)", "surface-container-low": "var(--surface-container-low)",
          "surface-container": "var(--surface-container)", "surface-container-high": "var(--surface-container-high)",
          "surface-container-highest": "var(--surface-container-highest)",
          outline: "var(--outline)", "outline-variant": "var(--outline-variant)",
          "inverse-surface": "var(--inverse-surface)", "inverse-on-surface": "var(--inverse-on-surface)", "inverse-primary": "var(--inverse-primary)",
          error: "var(--error)", "on-error": "var(--on-error)", "error-container": "var(--error-container)", "on-error-container": "var(--on-error-container)"
        },
        borderRadius: { DEFAULT: "0.5rem", lg: "0.5rem", xl: "1rem", full: "9999px" }
      }
    }
  };
}
