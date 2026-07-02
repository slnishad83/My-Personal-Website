# Team Chat — Cross-Platform Reliability Fixes

## Files to deploy

| File | Action |
|------|--------|
| `cross-platform-v2.css` | **Add** to the repo |
| `manifest.json` | **Replace** existing file |

---

## Step 1 — Add the stylesheet to `index.html`

Find the **last** `<link rel="stylesheet">` in `<head>` and add the new file directly after it:

```html
<!-- ADD after the last existing stylesheet link: -->
<link rel="stylesheet" href="cross-platform-v2.css?v=1" />
```

The current last stylesheet is:
```html
<link rel="stylesheet" href="calls-ui.css?v=8" />
```

So the final order becomes:
```html
<link rel="stylesheet" href="calls-ui.css?v=8" />
<link rel="stylesheet" href="cross-platform-v2.css?v=1" />
```

---

## Step 2 — Replace `manifest.json`

Replace the existing file. **What changed:**

- **Icons**: split `"purpose": "any maskable"` into two separate entries per icon — one `"any"` entry and one `"maskable"` entry. Browsers treat the combined value as invalid in some implementations; split entries guarantee correct adaptive icons on Android and correct home-screen icons on iOS.
- **`"id"`, `"start_url"`, `"scope"`**: changed from relative `"./"` / `"./index.html"` to absolute paths `/works/chat/`. Relative scope caused Android Chrome to reject PWA install prompts on some devices.
- Added `"shortcuts"` for long-press quick access on Android.
- Extended `"display_override"` with `"browser"` fallback so devices that don't support `standalone` still install.

---

## What `cross-platform-v2.css` fixes

### Dynamic viewport height (`dvh`)
`100vh` clips content behind the mobile browser address bar on Safari iOS and Chrome Android. All height-constrained containers are upgraded to `100dvh` inside `@supports` (older browsers keep `100vh`).

### Safe-area insets — applied everywhere
The existing CSS defined `--safe-bottom` and `--safe-top` variables but didn't apply them consistently. The new file applies `env(safe-area-inset-*)` to every edge that touches device chrome:
- Headers (notch / Dynamic Island — top inset)
- Input bar, tabs, bottom nav (home indicator — bottom inset)
- Call controls (bottom inset + extra clearance)
- Sidebar left / chat right edges (landscape iPhone insets)
- Modals (top + bottom)
- PWA standalone mode (extra nudge above env() value)

### Responsive layout — all breakpoints

| Range | Behaviour |
|---|---|
| ≤ 759 px (mobile) | Full-screen card, sidebar slides over chat |
| ≤ 479 px (small phone) | Tab icons only, smaller avatars, compact input |
| 760–1023 px (tablet) | Full-screen, 300 px fixed sidebar |
| 1024–1439 px (laptop) | Card mode, slightly smaller |
| ≥ 1440 px (desktop) | Full card up to 1560 px |
| Landscape, height < 500 px | Compressed headers, scrollable modals |

### Touch targets — 44 px minimum
All interactive elements (icon buttons, tab buttons, send, emoji, attach, voice, list menus, call controls) are guaranteed `min-width: 44px; min-height: 44px`. Visually smaller controls use `::after` to extend the hit area without changing the visual layout.

### iOS Safari input zoom prevention
iOS zooms the viewport when an input has `font-size < 16px`. Fix applies `font-size: max(16px, 1em)` to all inputs on touch devices (`hover: none` + `pointer: coarse`), covering all iOS and Android browsers.

### Material Symbols variable font — iOS fix
Safari on iOS ≤ 16 sometimes fails to render variable icon fonts if axes aren't all declared. Fix:
- Adds all four variation axes explicitly: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`
- Adds `font-display: block` to prevent flash of invisible text
- Hides icons (`color: transparent`) until the font loads, then restores colour
- Adds `'Material Icons'` as fallback family

### Backdrop-filter cross-browser
`-webkit-backdrop-filter` is required for Samsung Internet. A `@supports not` block provides solid background fallbacks for Firefox and older browsers.

### Dark mode — complete coverage (`body.dark`)
The existing `ui-audit.css` covered the main list/sidebar/modal elements but was missing:

- Message bubble colours (`--sent` / `--received` dark values)
- Input area background and placeholder colour
- SVG icon buttons in headers (fixed with `filter: brightness(1.9) saturate(0)`)
- Toast notifications and offline banners
- Loading / splash screen
- Recording UI
- View-once toggle
- Scroll-to-bottom button
- App lock screen
- Voice note player and waveform
- Theme toggle options
- Notification preference cards
- Format bar (bold / italic toolbar)
- PWA install banner
- Emoji picker backgrounds
- Attachment sheet

Also adds `@media (prefers-color-scheme: dark)` as a **safety net** for when the OS is dark but JS hasn't yet applied `body.dark` (e.g. before Firebase auth resolves on first load).

### PWA installed mode (`display-mode: standalone`)
- Removes desktop card look (border-radius, shadow, margin)
- Forces true full-screen dimensions
- Adds extra top-padding nudge to sidebar header so content never sits behind the iOS translucent status bar
- Android PWA: adds 32 px top padding for the status bar

### Focus visibility — keyboard / switch-access
`2px solid #00a884` outline on all `:focus-visible` elements. Mouse/touch users see no ring. Meets WCAG 2.4.7 / 2.4.11.

### Reduced motion
`@media (prefers-reduced-motion: reduce)` disables all CSS animations and transitions.

### Forced colours / high contrast (Windows)
`@media (forced-colors: active)` restores borders on bubbles, list items, and modals in Windows High Contrast mode.

### Cross-browser patches
- Samsung Internet (older): flex `gap` polyfill via `@supports not (gap: 8px)`
- `overscroll-behavior: contain` prevents scroll chaining on all scrollers
- `touch-action: manipulation` removes the 300 ms tap delay on older Android / Samsung browsers
- Momentum scrolling (`-webkit-overflow-scrolling: touch`) on all scroll areas

---

## Push notifications — iOS caveat (no code change needed)

iOS Safari does **not** support Web Push in browser mode. Push only works when the app is installed as a PWA (added to home screen) on iOS 16.4+. This is an Apple platform restriction. The existing app.js already gates push permission correctly.

If you want to prompt iOS users to install before requesting push permission, check `navigator.standalone` or `window.matchMedia('(display-mode: standalone)').matches` in `app.js`.

---

## Testing checklist after deploying

- [ ] Chrome Android — light + dark, portrait + landscape, browser + installed PWA
- [ ] Safari iOS 15, 16, 17 — light + dark, browser + installed PWA
- [ ] Chrome desktop — light + dark, 1280 px + 1920 px
- [ ] Firefox desktop — light + dark (verify backdrop-filter fallback solid backgrounds)
- [ ] Edge desktop — light + dark
- [ ] Samsung Internet — light + dark (verify icon font renders, gap polyfill)
- [ ] 320 px viewport (Galaxy Fold closed) — no horizontal scroll
- [ ] Landscape iPhone SE / iPhone 12 mini — nothing clipped by notch or home bar
- [ ] Keyboard-only navigation — tab through all controls, focus ring visible on every element
- [ ] Windows High Contrast mode — bubbles and list items have visible borders

---

*Generated by Replit Agent — July 2026*
