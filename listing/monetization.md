# Wayward 1.1: shop and ads, store paperwork (TL2)

Status 29-09: prepared, nothing submitted. Fill in when the Play account is back (D2) and TL3 (Apple Paid Apps, AdMob, Google tax) is done.
Sources checked 29-09: AdMob Play data disclosure (developers.google.com/admob/android/privacy/play-data-disclosure),
AdMob App Store data disclosure (developers.google.com/admob/ios/privacy/data-disclosure).

## 1. Products (ids must match store-config.json and shop.js)

| id | Play type | App Store type | Price (EUR) | EN name | NL name |
|---|---|---|---|---|---|
| book_sea | One-time product | Non-Consumable | 2.00 | Book II: The Drowned Lighthouse | Boek II: De Verdronken Vuurtoren |
| book_stardust | One-time product | Non-Consumable | 2.00 | Book III: Station Nine | Boek III: Station Negen |
| book_ash | One-time product | Non-Consumable | 2.00 | Book IV: Ash & Orchid | Boek IV: As & Orchidee |
| pass_monthly | Subscription, base plan `monthly`, auto-renewing, 1 month | Auto-Renewable Subscription, group "Wayward Pass", 1 month | 5.00 / month | Wayward Pass (monthly) | Wayward Pass (maand) |
| pass_lifetime | One-time product | Non-Consumable | 20.00 | Wayward Pass (lifetime) | Wayward Pass (levenslang) |

Titles of books II-IV: working titles from the Wayward chat; confirm before creating the products (names can be edited later, ids cannot).
Apple price points: pick 1.99 / 4.99 / 19.99 if a round EUR point is not offered.

Descriptions (max 55 chars on Apple, 80 on Play):
- book_*: EN "Unlock the whole book, every ending, forever." / NL "Het hele boek met alle eindes, voorgoed van jou."
- pass_monthly: EN "Every book and every ending while the Pass runs." / NL "Alle boeken en alle eindes zolang de Pass loopt."
- pass_lifetime: EN "Every book and every ending, now and later. Once." / NL "Alle boeken en eindes, nu en later. Eén keer betalen."

Apple review screenshot per product: a screenshot of the shop sheet (needed once the shop UI from T11 exists).

## 2. Requirements for the paywall (T11, Wayward chat), otherwise review rejects it

1. Pass monthly: show price and period ("€5 per month"), "Renews automatically until you cancel" and how to cancel (Android: Play Store > Payments & subscriptions; iPhone: Settings > your name > Subscriptions). `WaywardBilling.manage()` opens that screen.
2. In the shop sheet: working links to Privacy Policy and Terms of Use. Terms on iPhone: Apple's standard EULA https://www.apple.com/legal/internet-services/itunes/dev/stdeula/ (Apple guideline 3.1.2).
3. A visible "Restore purchases" button (Apple requires it for non-consumables and subscriptions): `WaywardBilling.restore()`.
4. Rewarded ads only after the reader taps a button that says it is an ad; never an ad on start-up or mid-page.
5. Settings: a button "Privacy choices for ads" / "Privacykeuzes advertenties" that calls `WaywardAds.privacyOptions()` (required in the EU once Google's consent form applies).
6. Only call something "free" if it stays free; say plainly what the daily free pages/endings are and what an ad adds.

## 3. Google Play Console

- App content > Ads: **Yes, my app contains ads.**
- App content > Advertising ID: **Yes** (AdMob). Uses: Advertising or marketing, Analytics, Fraud prevention, security, and compliance.
- Foreground service declaration: **not needed**. The merged manifest has android.permission.FOREGROUND_SERVICE (WorkManager inside AdMob) but no foregroundServiceType, so Play asks no FGS questions.
- Target audience stays 13+ (not designed for children), so no Families ads requirements.
- Data safety (replaces the "no data" answers in console-answers.md):
  - Does your app collect or share required user data types? **Yes.** Encrypted in transit? **Yes.** Can users request deletion? **No** (no accounts; AdMob data sits at Google); explain in the privacy policy (reset/delete advertising ID in Android settings).
  - Location > Approximate location (from IP): collected + shared; not ephemeral; required; Advertising or marketing, Analytics, Fraud prevention.
  - App activity > App interactions: collected + shared; required; Advertising or marketing, Analytics.
  - App info and performance > Diagnostics (and Crash logs): collected + shared; required; Analytics, Fraud prevention.
  - Device or other IDs: collected + shared; optional (reader can delete/reset the ad ID); Advertising or marketing, Analytics, Fraud prevention.
  - Financial info > Purchase history: collected, not shared; required for purchases; App functionality. (Conservative: the purchase goes through the Play Billing library; Wayward itself keeps only an on-device unlock.)
- Store listing will then show "Contains ads" and "In-app purchases" automatically.

## 4. App Store Connect

- App Privacy (replaces "Data Not Collected"): Data used to track you: **Yes** (Device ID via IDFA, only after the ATT prompt).
  - Location > Coarse Location: Third-Party Advertising, Analytics. Not linked. Not tracking.
  - Identifiers > Device ID: Third-Party Advertising, Analytics. Linked. Tracking.
  - Usage Data > Product Interaction: Third-Party Advertising, Analytics. Linked. Tracking.
  - Usage Data > Advertising Data: Third-Party Advertising, Analytics. Linked. Tracking.
  - Diagnostics > Crash Data: Analytics, Third-Party Advertising. Not linked. Not tracking.
  - Diagnostics > Performance Data: Analytics, Third-Party Advertising. Linked. Tracking.
  - Purchases: not collected by Wayward (StoreKit handles it at Apple; no own server).
- In-App Purchases and Subscriptions: create the 5 products above, each with EN + NL display name/description, review screenshot and review note "Unlocks book content inside the app. Every book starts with free endings; the rest opens with a purchase or an optional ad."
- App description: add "Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" and the privacy URL (required for auto-renewing subscriptions).
- Age rating: where the questionnaire asks about advertising or in-app purchases, answer Yes; the rest stays as in appstore.md.
- Paid Apps agreement must be Active (TL3) before products can be tested or sold.

## 5. In the build (monetization branch)

- Done: store.js bridge, plugins, test ad ids, UMP consent, ATT prompt text EN + NL (InfoPlist.strings, commit fcaadd9), app localized en + nl.
- After TL3 AdMob: create app "Wayward" (Android + iOS) and one rewarded ad unit each; put the ids in store-config.json, set testing false. app-ads.txt needs a developer website; skip it for the launch (ads still serve, AdMob only shows a warning).
- After T11: build www with shop.js, run test/store-bridge.js and the flow tests, install on Manuel's phone with Google's test ads.
- Privacy policy: listing/privacy/wayward-privacy-v2.html, publish over the current one when 1.1 is submitted, not earlier.
