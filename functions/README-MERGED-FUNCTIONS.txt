Merged Firebase Functions files

Use these files in:
Desktop/My/functions/

Replace:
- functions/index.js

Keep:
- functions/package.json is also included here, but your existing one is already OK.
- functions/package-lock.json can stay as it is.
- node_modules can stay as it is.

What was merged:
- Your existing getTurnCredentials function was kept.
- New sendIncomingCallNotification function was added.
- Uses Firebase Functions v2 style to match your existing project.

Deploy from Desktop/My:
firebase deploy --only functions
