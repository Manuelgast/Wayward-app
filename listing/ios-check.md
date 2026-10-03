# iPhone configuration check (03-10, nothing uploaded)

Automatic check: `python3 app/scripts/check_ios.py` (repo root). Result 03-10 on branch monetization: 24 OK, 0 FAIL.
It checks Info.plist, the EN/NL tracking text, the privacy manifest, bundle id, version = Android (1.1.0 (5)),
the two native plugins, test ads on, the 6 product ids, Apple's EULA link, Codemagic never submits, and no keys in git.

## Looked at by hand
- Google Mobile Ads SDK 13.6.0 and UMP 3.1 (via @capacitor-community/admob 8.1.0) ship their own privacy manifests.
  The app's own manifest says "no tracking" for the app code itself; the tracking by the ad SDK is declared by Google's manifest
  and in App Privacy (listing/monetization.md: "Data used to track you: Yes"). Consistent.
- Order in store.js: consent screen (UMP) first, then the iOS tracking question (ATT), then the ad. Ads only after a tap. OK.
- Minimum iOS 15 fits StoreKit 2 (native-purchases) and the ad SDK. iPhone only, portrait.
- SKAdNetwork: only Google's own id. Enough for Google demand; the longer list of other ad buyers is optional (later).

## Still open (not code; needs Manuel or Apple)
1. Apple account type and Paid Apps agreement (T23, TL3): without these, purchases cannot be tested on iPhone.
2. In-App Purchase is on by default for the App ID com.waywardbooks.app; check once in the Developer portal when signing runs.
3. The privacy link in the shop (store-config.json `links.privacy`) is a claude.ai page. Apple needs a public URL that opens without login:
   check that it opens in a private browser window before submitting.
4. Codemagic signing needs the secret CERTIFICATE_PRIVATE_KEY (TL1). Not in this repo, and it must stay that way.
5. Before the store release: set `ads.testing` to false in store-config.json (only for the release build).
