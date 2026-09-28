#!/usr/bin/env bash
# One-step Wayward Android build.
#   ./build.sh [versionCode] [versionName]
# 1. rebuilds www/ from ../web-src (refresh web-src first with the newest web version)
# 2. syncs it into the Android project
# 3. builds the signed release AAB (for Play) + a signed APK (for direct install/testing)
# The iOS project (ios/) gets the same version and web files; it is built and signed in the cloud (codemagic.yaml).
set -euo pipefail
cd "$(dirname "$0")"
export ANDROID_HOME=${ANDROID_HOME:-/opt/android-sdk}

if [ -n "${1:-}" ]; then
  sed -i -E "s/versionCode [0-9]+/versionCode $1/" android/app/build.gradle
fi
if [ -n "${2:-}" ]; then
  sed -i -E "s/versionName \"[^\"]+\"/versionName \"$2\"/" android/app/build.gradle
fi

# iOS carries the same version as Android (versionName -> MARKETING_VERSION, versionCode -> build number)
VC0=$(grep -oE 'versionCode [0-9]+' android/app/build.gradle | awk '{print $2}')
VN0=$(grep -oE 'versionName "[^"]+"' android/app/build.gradle | cut -d'"' -f2)
if [ -f ios/App/App.xcodeproj/project.pbxproj ]; then
  sed -i -E "s/MARKETING_VERSION = [^;]+;/MARKETING_VERSION = $VN0;/; s/CURRENT_PROJECT_VERSION = [^;]+;/CURRENT_PROJECT_VERSION = $VC0;/" ios/App/App.xcodeproj/project.pbxproj
fi

python3 scripts/build_www.py ../web-src
npx cap sync
(cd android && ./gradlew --no-daemon -q bundleRelease assembleRelease)

VC=$(grep -oE 'versionCode [0-9]+' android/app/build.gradle | awk '{print $2}')
VN=$(grep -oE 'versionName "[^"]+"' android/app/build.gradle | cut -d'"' -f2)
mkdir -p ../dist
rm -f ../dist/wayward-*.aab ../dist/wayward-*.apk
cp android/app/build/outputs/bundle/release/app-release.aab "../dist/wayward-$VN-$VC.aab"
cp android/app/build/outputs/apk/release/app-release.apk "../dist/wayward-$VN-$VC.apk"
ls -la ../dist
