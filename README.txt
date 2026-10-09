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

wayward-1.1.2-7.aab / .apk  launch candidate, version 1.1.2 (versionCode 7), built 09-10-2026 14:15, signed with the upload key.
  Source: VTjY version 29 (RC5: 12 scenes in every book, slower timed moments) + the T28 candidate fix by the
    launch-chat (branch t28-candidate): library header fits 360/390/412 px with the shop on (settings and
    ad-privacy button reachable), the shop's price note shows the store's prices, feedback goes to studio.wayward01@gmail.com.
  Same store build as 1.1.1 (6) otherwise: live AdMob ads, shop on, 14 products.
  SHA-256 aab 9074e7a8871f408f291c77d35574f0cfafdf8b9ddbeb3a6826f9179b834a65ba
  SHA-256 apk 0875e72e6ee86ca312c7c5d73d0fb460652b29f60c46153dcc4fb3045900300a
  Tests (all pass): header-fit 18/18 (EN/NL x 360/390/412), store-e2e android and ios, smoke-4books, check_ios 24/24.
  Use this one only after Manuel's go on board item WL7 (or after the app-chat confirms the same fix in VTjY).

wayward-1.1.3-8.aab / .apk  launch build, version 1.1.3 (versionCode 8), built 09-10-2026 17:22, signed with the upload key.
  Same as 1.1.2 (7) (VTjY v29 RC5 + T28 fix), minus 48 pictures the app never loads (unused small variants and
  leftovers, list in app/pruned.txt on branch monetization). No change in what the reader sees or hears.
  Size: bundle 44.7 MB (was 51.4), download per phone 44.2-44.3 MB (bundletool get-size total).
  SHA-256 aab baf29c48fffde7c05c69aae42e61bd11f6002b15cf2817f3b108163509632b02
  SHA-256 apk eac825a97d3f8c609d78c5427e0fd7a395ef8bff80a7fee16e06251cb9640cec
  Tests (all pass): assets-walk (all 196 pages, no missing file), header-fit 18/18, store-e2e android and ios,
    smoke-4books, check_ios 24/24.
