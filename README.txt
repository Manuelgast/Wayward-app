Wayward builds for Google Play (upload the .aab in Play Console; the .apk is for direct install on a test phone).
wayward-1.1.0-5.aab  launch candidate 1 (VTjY v10): Book I + II, shop, Google test ads, signed with the upload key.

wayward-1.1.1-6.aab / .apk  release candidate 2, version 1.1.1 (versionCode 6), built 09-10-2026, signed with the upload key.
  Source: web book VTjY version 28 (its RC4: Books I-IV, silver endings, price tiers per book).
  Store build: live AdMob ads (testing false, real ids), shop on, 14 products:
    book_mountain, book_sea, book_stardust, book_ash (EUR 2), each also _b (EUR 1.49, from 6 endings) and
    _c (EUR 0.99, from 12 endings), pass_monthly (subscription, base plan monthly), pass_lifetime.
    The 8 _b/_c products must exist in Play Console (one-time, non-consumable) before this goes to readers.
  SHA-256 aab 3d8555bc5a2cb4f93ba21a045ca441de4bb40f53a34506833917b3da057bb44d
  SHA-256 apk c0c0c5d8893e21b4572b682e5b4f14850083b34548ba16d58533bde74b27ccb3
  Tests (all pass): store-bridge 13/13, store-e2e android 11/11 and ios 11/11, feedback EN+NL,
    check_ios 24/24, smoke-4books 40/40 (all 4 books from the library in EN and NL: open, turn a page,
    make a choice, 0 page errors; price tier bought through the store bridge).
  Code: branch monetization, commit f4583b7.
