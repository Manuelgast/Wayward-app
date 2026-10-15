# Wayward app (Android + iOS)

Packaging of the Wayward web book (web-src/, copied from the prototype artifact) as a native app with Capacitor.

## Updating the app (one route, like ExamTwin)

`main` is the live app. Every update goes the same way:

1. Make the change on a new branch (web book in `web-src/`, native parts in `app/`). For a real update, raise `versionName` in `app/android/app/build.gradle` (e.g. 1.1.3 -> 1.2.0). Never touch `versionCode`: Codemagic sets it.
2. Run the tests below, open a pull request to `main`, and merge it after Manuel's yes.
3. Codemagic starts by itself on the merge (only when `web-src/`, `app/` or `codemagic.yaml` changed):
   - Android: signed App Bundle on the Google Play **internal testing** track (build number = latest in Play + 1).
   - iOS: signed build in **App Store Connect / TestFlight** for internal testers (build number = latest in TestFlight + 1).
4. Manuel checks the internal test on his phone, then makes it public himself: Play Console > Wayward > Test and release > Internal testing > Promote release > Production, and in App Store Connect: add the build to the new version > Submit for Review.

Local Android build (only as a fallback): `cd app && ./build.sh <versionCode> <versionName>` → dist/wayward-<name>-<code>.aab/.apk (signed with the upload key, which is not in this repo).

- Tests: `cd app/www && python3 -m http.server 8768`, then `node test/flow.js`, `test/swipe.js`, `test/p22.js`, `test/feedback.js`.
- Store texts and answers: listing/. Store images: graphics/ (capture-b2.js, mist-cap.js, extra-cap.js, frames-b2.py).
