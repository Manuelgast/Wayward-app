#!/usr/bin/env python3
"""Offline check of the iOS configuration (no Mac, no upload).

Run from the repo root:  python3 app/scripts/check_ios.py
Exits 1 when a check fails. Checks only files in this repo; it never talks to Apple.
"""
import os, re, sys, plistlib, json, subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
APP = os.path.join(ROOT, 'app')
IOS = os.path.join(APP, 'ios', 'App')
BUNDLE_ID = 'com.waywardbooks.app'
BOOKS = ['book_mountain', 'book_sea', 'book_stardust', 'book_ash']
PRODUCTS = set(BOOKS + [b + t for b in BOOKS for t in ('_b', '_c')] + ['pass_monthly', 'pass_lifetime'])  # price tiers _b/_c since web book v28 (W30 A)
GOOGLE_SKAN = 'cstr6suwn9.skadnetwork'

fails, notes = [], []
def check(ok, msg):
    (notes if ok else fails).append(('OK   ' if ok else 'FAIL ') + msg)

def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()

# Info.plist
with open(os.path.join(IOS, 'App', 'Info.plist'), 'rb') as f:
    info = plistlib.load(f)
cfg = json.loads(read('app/store-config.json'))
check(info.get('CFBundleIdentifier') == '$(PRODUCT_BUNDLE_IDENTIFIER)', 'Info.plist takes the bundle id from the project')
check(info.get('GADApplicationIdentifier') == cfg['ads']['ios']['appId'], 'AdMob iOS app id in Info.plist matches store-config.json')
check(bool(info.get('NSUserTrackingUsageDescription')), 'ATT text (NSUserTrackingUsageDescription) present')
check(set(info.get('CFBundleLocalizations', [])) >= {'en', 'nl'}, 'App declares English and Dutch')
check(info.get('ITSAppUsesNonExemptEncryption') is False, 'Export compliance: no non-exempt encryption')
skan = [d.get('SKAdNetworkIdentifier') for d in info.get('SKAdNetworkItems', [])]
check(GOOGLE_SKAN in skan, "Google's SKAdNetwork id present")
check(info.get('UISupportedInterfaceOrientations') == ['UIInterfaceOrientationPortrait'], 'Portrait only')

# Localized ATT text
for lang in ('en', 'nl'):
    s = read('app/ios/App/App/%s.lproj/InfoPlist.strings' % lang)
    m = re.search(r'"NSUserTrackingUsageDescription"\s*=\s*"([^"]+)";', s)
    check(bool(m and len(m.group(1)) > 20), 'ATT text in %s.lproj/InfoPlist.strings' % lang)

# Privacy manifest
with open(os.path.join(IOS, 'App', 'PrivacyInfo.xcprivacy'), 'rb') as f:
    pm = plistlib.load(f)
reasons = {a['NSPrivacyAccessedAPIType']: a['NSPrivacyAccessedAPITypeReasons'] for a in pm.get('NSPrivacyAccessedAPITypes', [])}
check('NSPrivacyAccessedAPICategoryUserDefaults' in reasons, 'Privacy manifest declares UserDefaults with a reason')
check(os.path.exists(os.path.join(APP, 'scripts', 'add_privacy_manifest.rb')), 'Privacy manifest is added to the target at build time')

# Xcode project
pbx = read('app/ios/App/App.xcodeproj/project.pbxproj')
check(set(re.findall(r'PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);', pbx)) == {BUNDLE_ID}, 'Bundle id is %s (Debug and Release)' % BUNDLE_ID)
targets = {float(x) for x in re.findall(r'IPHONEOS_DEPLOYMENT_TARGET = ([0-9.]+);', pbx)}
check(targets and min(targets) >= 15.0, 'Minimum iOS 15 (needed for StoreKit 2)')
gradle = read('app/android/app/build.gradle')
vn = re.search(r'versionName "([^"]+)"', gradle).group(1)
vc = re.search(r'versionCode (\d+)', gradle).group(1)
check(set(re.findall(r'MARKETING_VERSION = ([^;]+);', pbx)) == {vn}, 'iOS version %s equals Android' % vn)
check(set(re.findall(r'CURRENT_PROJECT_VERSION = ([^;]+);', pbx)) == {vc}, 'iOS build %s equals Android versionCode' % vc)

# Native plugins
spm = read('app/ios/App/CapApp-SPM/Package.swift')
for p in ('CapacitorCommunityAdmob', 'CapgoNativePurchases'):
    check(p in spm, '%s linked in the iOS package' % p)

# Store config
check(cfg['ads'].get('testing') is False, 'Ads live for the store release (testing false, real AdMob ids)')
check({p['id'] for p in cfg['products']} == PRODUCTS, '14 product ids as decided (4 books x 3 price tiers + 2 Pass)')
check(cfg['links'].get('termsIos', '').startswith('https://www.apple.com/legal/internet-services/itunes/dev/stdeula'), "Terms link is Apple's standard EULA")

# Codemagic never submits
cm = read('codemagic.yaml')
check('submit_to_testflight: false' in cm and 'submit_to_app_store: false' in cm, 'Codemagic does not submit to TestFlight or review')
check('ruby app/scripts/add_privacy_manifest.rb' in cm, 'Codemagic adds the privacy manifest')

# No secrets tracked in git
tracked = subprocess.run(['git', 'ls-files'], cwd=ROOT, capture_output=True, text=True).stdout.split()
bad = [t for t in tracked if re.search(r'\.(p12|p8|pem|jks|keystore|mobileprovision|cer)$', t, re.I)]
check(not bad, 'No certificates, keys or profiles in git' + (': ' + ', '.join(bad) if bad else ''))
hits = []
for t in tracked:
    if t.startswith(('web-src/', 'graphics/')) or not re.search(r'\.(json|ya?ml|plist|swift|gradle|properties|js|py|rb|md|txt|strings)$', t):
        continue
    try:
        if re.search(r'BEGIN (RSA |EC )?PRIVATE KEY|storePassword\s*[=:]\s*\S', read(t)):
            hits.append(t)
    except (UnicodeDecodeError, FileNotFoundError):
        pass
check(not hits, 'No private keys or passwords in text files' + (': ' + ', '.join(hits) if hits else ''))

print('\n'.join(notes + fails))
print('\n%d OK, %d FAIL' % (len(notes), len(fails)))
sys.exit(1 if fails else 0)
