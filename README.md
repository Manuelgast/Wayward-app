# Wayward app (Android + iOS)

Packaging of the Wayward web book (web-src/, copied from the prototype artifact) as a native app with Capacitor.

- Android: `cd app && ./build.sh <versionCode> <versionName>` → dist/wayward-<name>-<code>.aab/.apk (signed with the upload key, which is not in this repo).
- iOS: built and signed in the cloud by Codemagic (codemagic.yaml, workflow `ios-appstore`); same version as Android.
- Tests: `cd app/www && python3 -m http.server 8768`, then `node test/flow.js`, `test/swipe.js`, `test/p22.js`, `test/feedback.js`.
- Store texts and answers: listing/. Store images: graphics/ (capture-b2.js, mist-cap.js, extra-cap.js, frames-b2.py).
