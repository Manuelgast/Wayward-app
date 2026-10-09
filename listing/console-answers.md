# Wayward – Play Console answers (launch 1.1.2, 4 books, shop + rewarded ads)

Updated 09-10-2026 (launch-chat). Supersedes the v1.0.0 answers (free, no ads, no IAP).
Status per section: SAVED = in Play Console now; WL5 = waits for Manuel's yes (board item WL5).

## Store listing (SAVED)
- Default language English (United Kingdom) en-GB; translation Dutch nl-NL.
- en-GB: title `Wayward: Choose Your Path` · short `Illustrated adventure books where every choice turns the page. 75 endings.` · full = launch-4books/full-en.txt
- nl-NL: title `Wayward: Kies je eigen pad` · short `Geïllustreerde avonturenboeken waarin jij bepaalt wat er gebeurt. 75 eindes.` · full = launch-4books/full-nl.txt
- Graphics (Manuel uploads, files in Documents\Wayward-store): icon 512 (graphics/store-icon-512 = outputs store/icon-512.png), feature graphic 1024x500,
  phone screenshots store/en/phone-2..7 now; phone-1 (library) and phone-8 (shop) after the T28 header fix.
- Category Games > Adventure (SAVED). Contact email studio.wayward01@gmail.com (WL5: the button is "Save and publish"). No website, no phone.

## App content
- Privacy policy: https://claude.ai/artifact/HCNZWpqhHH49A9dEmQw7t6 (SAVED). Page content = listing/privacy/wayward-privacy-v2.html (publish over HCNZ before submitting: WL5).
- Ads: Yes, the app contains ads (SAVED).
- Advertising ID: Yes; purposes Analytics, Advertising or marketing, Fraud prevention (SAVED).
- Government apps: No. Financial features: none. Health: none (all SAVED).
- App access / sign-in details (WL5): "All or some functionality is restricted". Instructions, no username/password:
  > Wayward has no login. Every book can be read free up to its free endings; after that a book is unlocked by an in-app purchase.
  > To review all content: redeem this promo code in the Play Store app (profile > Payments & subscriptions > Redeem code): <CODE>.
  > It grants the Wayward Pass (lifetime), which unlocks all four books. Then open Wayward; if needed tap Restore purchases in the shop (bag icon).
  > Rewarded ads only play after tapping "Watch an ad" in the shop.
- Target audience (WL5, after app access): 13–15, 16–17, 18+. Not designed for children; store listing does not target children.
- Content rating / IARC (WL5: starts with accepting the IARC terms). Email studio.wayward01@gmail.com. Category: Game.
  Checked against all 4 books' EN text (09-10):
  - Violence: none (peril only: falls, fire, a volcano; nobody is hurt on the page).
  - Fear: mild, fantasy (dark caves, eyes in the dark, a drowned lighthouse, eerie music) → mild scary elements, no horror/gore.
  - Sexuality: none (two kisses on the cheek / head as thanks).
  - Language: none.
  - Controlled substances: references only — an adult character smokes a pipe (Book III), beer and rum are mentioned (Book IV). Not shown in a positive way, not usable by the player.
  - Crude humour: none. Gambling: none (no real or simulated gambling, no loot boxes).
  - User interaction / UGC: no. Shares location with other users: no. Unrestricted internet: no.
  - Digital purchases: yes (in-app purchases: books, Wayward Pass).
  - Expected: PEGI 7 or 12 (substance references can lift PEGI), ESRB Everyone/Teen; review the result before saving.
- Data safety (concept SAVED; final save after target audience):
  collected AND shared (AdMob): approximate location, app interactions, crash logs, diagnostics, device or other IDs — purposes advertising, analytics, fraud prevention;
  collected only: purchase history (app functionality); encrypted in transit: yes; no accounts; deletion request: no (nothing stored server-side by us).

## Products (SAVED as inactive drafts; activating = WL5)
- book_mountain, book_sea, book_stardust, book_ash: base 1.65 EUR excl. VAT (NL €1.99)
- book_*_b ("from 6 endings"): base 1.23 (NL €1.49) · book_*_c ("from 12 endings"): base 0.82 (NL €0.99)
- pass_lifetime: base 16.53 (NL €19.99) · subscription pass_monthly, base plan `monthly`: base 4.13 (NL €4.99)
- Purchase option id `buy` on every one-time product. Promo code for the reviewer: 1 × pass_lifetime (WL5).

## Release
- Play App Signing: Google-managed key; upload key = wayward-upload-key.jks.
- Internal testing track is active (1.1.0 (5), 30-09). Flow for the launch: 1.1.2 (7) to internal testing → phone test (testlijst-interne-test.md) → Promote release → Production → Send for review (Manuel's click).
- Release notes: see launch-4books/release-notes.txt.
