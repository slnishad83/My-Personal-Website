# WhatsApp-Level Notifications, Calls, and Messaging Audit

## Scope

This audit covers message notifications, call notifications, ringing, vibration,
badges, notification actions, notification history, cross-tab behavior,
cross-device synchronization, and platform limits for the My Team Chat web/PWA
and Android app.

The implementation must use original My Team Chat branding and assets. It must
not copy WhatsApp visual design, code, sounds, or protected assets.

## Current Strengths

- Firebase Cloud Messaging is configured for web/PWA background notifications.
- The service worker supports message notifications, incoming call
  notifications, inline reply where browsers allow it, and Accept/Decline
  actions for calls.
- Android has a native Firebase messaging service with a high-priority incoming
  call channel, full-screen intent, ringtone, vibration, and Accept/Decline
  actions.
- Firestore offline persistence is enabled with multi-tab synchronization.
- Message delivery/read reconciliation runs on startup, focus, visibility
  change, and reconnect.
- `call-sync.js` persists incoming, outgoing, missed, dialled, and status call
  events through Firestore with an IndexedDB replay queue.

## Implemented In This Pass

- Added `notification-orchestrator.js` as a single client-side coordination
  layer for message and call notification behavior.
- Added duplicate suppression for repeated message/call events.
- Added local notification history for message, call, missed call, security,
  announcement, attachment, mention, reply, edit, delete, status, and broadcast
  notification categories.
- Added app badge synchronization using the Badging API where supported.
- Added foreground sound and vibration behavior for message alerts and incoming
  calls.
- Added cross-tab call coordination using `BroadcastChannel`, so answering or
  declining in one tab stops ringing in other tabs.
- Added APIs for app code to call:
  - `window.notifyTeamChatMessage(payload)`
  - `window.notifyTeamChatCall(payload)`
  - `window.NotificationOrchestrator.markRead(scope)`
  - `window.NotificationOrchestrator.callAnswered(callId)`
  - `window.NotificationOrchestrator.callDeclined(callId)`
  - `window.NotificationOrchestrator.callMissed(callId, payload)`
- Added preference handling for sounds, vibration, previews, group sounds, call
  sounds, and silent windows.
- Added reconnect and visibility hooks to resync badges and flush call queues.
- Included the coordinator in `index.html` and the PWA service worker cache.

## Platform Limits

- Browsers cannot guarantee background execution after a tab is fully closed or
  after the OS force-stops the browser/app.
- iOS limits web push, custom sounds, vibration, and lock-screen call UI more
  strictly than Android.
- Lock-screen Accept/Decline actions are available only where the browser or
  native shell exposes notification actions.
- Do Not Disturb, system silent mode, Bluetooth routing, LED indicators, and
  device volume remain controlled by the operating system.
- Native Windows, macOS, Linux, and iOS apps need platform shells or plugins for
  true OS-level call surfaces comparable to Android full-screen intents.

## Remaining Native Work For Full Parity

- Add iOS native push/call integration for CallKit-style incoming call UI.
- Add desktop native notification integration for Windows, macOS, and Linux if
  shipping Electron/Tauri/Capacitor desktop builds.
- Add native audio-route controls for Bluetooth, speaker, and earpiece beyond
  what WebRTC/browser APIs expose.
- Add backend fan-out rules to send call ringing, call-ended, missed-call, and
  notification-clear events to every eligible device token.
- Add Firestore security rules for `users/{uid}/callEvents` and notification
  metadata if not already present in the deployed backend.

## Verification Checklist

- New foreground message event plays a tone, vibrates where supported, records
  history, and updates badge count.
- New incoming call event starts ringtone/vibration and records call history.
- Accepting, declining, or missing a call stops local ringing and writes a call
  sync event when `call-sync.js` is available.
- Reopening or refocusing the app refreshes badge state.
- Reconnect flushes pending call sync queue.
- Background push behavior remains handled by the service worker and Android
  native messaging service.
