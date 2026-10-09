# Wayward – Play Console answers (launch 1.1.2, 4 books, shop + rewarded ads)

Updated 09-10-2026 (launch-chat). Supersedes the v1.0.0 answers (free, no ads, no IAP).
Status per section: SAVED = in Play Console now; WL5 = waits for Manuel's yes (board item WL5).

## Store listing (SAVED)
- Default language English (United Kingdom) en-GB; translation Dutch nl-NL.
- en-GB: title `Wayward: Choose Your Path` · short `Illustrated adventure books where every choice turns the page. 75 endings.` · full = launch-4books/full-en.txt
- nl-NL: title `Wayward: Kies je eigen pad` · short `Geïllustreerde avonturenboeken waarin jij bepaalt wat er gebeurt. 75 eindes.` · full = launch-4books/full-nl.txt
- Graphics (Manuel uploads, files in Documents\Wayward-store): icon 512 (graphics/store-icon-512 = outputs store/icon-512.png), feature graphic 1024x500,
  phone screenshots store/en/phone-2..7 now; phone-1 (library) and phone-8 (shop) after the T28 header fix.
- Category Games > Adventure (SAVED). Contact email studio.wayward01@gmail.com (SAVED 09-10 20:20; "Save and publish" opens a second confirm dialog "Publish change on Google Play?" that must also be confirmed). No website, no phone.
- Developer account: name "Gast Studio" (SAVED 09-10, was MBTIcomics). Public developer email → studio.wayward01@gmail.com: code sent 09-10, Manuel enters it (Verify + Save changes).

## App content
- Privacy policy: https://claude.ai/artifact/HCNZWpqhHH49A9dEmQw7t6 (SAVED). Page content = listing/privacy/wayward-privacy-v2.html (publish over HCNZ before submitting: WL5).
- Ads: Yes, the app contains ads (SAVED).
- Advertising ID: Yes; purposes Analytics, Advertising or marketing, Fraud prevention (SAVED).
- Government apps: No. Financial features: none. Health: none (all SAVED).
- App access / sign-in details (SAVED 09-10): "Yes, part of the app is restricted" (payments). One entry "Reviewer access (promo code, no login)", no username/password,
  "full access incl. paid content" ticked, partner-device testing switched off (keeps the single-use code for the human reviewer).
  Code = 1 of the 5 codes of promotion "Google review - Wayward Pass lifetime" (ID 131422090, valid 9 Oct 2026 21:00 – 8 Oct 2027).
  Codes are single-use: before each later update review, put a fresh code from that promotion in the instructions.
  Instructions text:
  > Wayward has no login. Every book can be read free up to its free endings; after that a book is unlocked by an in-app purchase.
  > To review all content: redeem this promo code in the Play Store app (profile > Payments & subscriptions > Redeem code): <CODE>.
  > It grants the Wayward Pass (lifetime), which unlocks all four books. Then open Wayward; if needed tap Restore purchases in the shop (bag icon).
  > Rewarded ads only play after tapping "Watch an ad" in the shop.
- Target audience (SAVED 09-10): 13–15, 16–17, 18+ (under 9 is blocked by the ESRB 10+ rating; Console skipped the appeal-to-children step).
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
- Data safety (SAVED 09-10, final; all 11 dashboard setup tasks complete):
  collected AND shared (AdMob): approximate location, app interactions, crash logs, diagnostics, device or other IDs — purposes advertising, analytics, fraud prevention;
  collected only: purchase history (app functionality); encrypted in transit: yes; no accounts; deletion request: no (nothing stored server-side by us).

## Products (ACTIVE since 09-10: 13 one-time products with purchase option `buy` + pass_monthly base plan)
- book_mountain, book_sea, book_stardust, book_ash: base 1.65 EUR excl. VAT (NL €1.99)
- book_*_b ("from 6 endings"): base 1.23 (NL €1.49) · book_*_c ("from 12 endings"): base 0.82 (NL €0.99)
- pass_lifetime: base 16.53 (NL €19.99) · subscription pass_monthly, base plan `monthly`: base 4.13 (NL €4.99)
- Purchase option id `buy` on every one-time product. Promo code for the reviewer: 1 × pass_lifetime (WL5).

## Release
- Play App Signing: Google-managed key; upload key = wayward-upload-key.jks.
- Internal testing track: 1.1.2 (7) uploaded by Manuel 09-10 (51 MB). 1.1.3 (8) = same content, 44.7 MB (unused pictures left out at build time).
- Production is unlocked (old MBTIcomics account: no 12-tester closed-test rule). Flow: final AAB to internal testing → phone test (testlijst-interne-test.md)
  → Promote release → Production (countries, release notes) → Send for review in Publishing overview (Manuel's click). Plan: submit Mon 12 Oct, live ~Fri 16 Oct.
  Suggested: Managed publishing on, so the approved app only goes live when Manuel presses Publish (needs his yes).
- Release notes: see launch-4books/release-notes.txt.
