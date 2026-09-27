#!/usr/bin/env bash
# iOS: TestFlight'a yeni derleme gönder (Kadıköy Tenis).
#   tools/release-ios.sh          -> sürüm aynı kalır, derleme numarası +1
#   tools/release-ios.sh 1.1      -> sürümü de değiştirir
#   UPLOAD=0 tools/release-ios.sh -> yalnız arşiv + dışa aktarma, yükleme yok
# Kimlikler: ~/private_keys/asc.env (API anahtarı), ~/private_keys/asc-tenis.env (ASC_APP_ID, ASC_GROUP_ID).
set -euo pipefail
cd "$(dirname "$0")/.."
NEW_VERSION="${1:-}"
UPLOAD="${UPLOAD:-1}"
source ~/private_keys/asc.env
export DEVELOPMENT_TEAM="${TEAM_ID}"
ARCHIVE="ios/build/KadikoyTenis.xcarchive"
EXPORT="ios/build/export"

# Endpoint'ler ve uygulama sırrı deploy edilmiş stack'ten gelir
tools/ios-config.sh

python3 - "$NEW_VERSION" "$UPLOAD" <<'PY'
import re, sys
yeni, upload = sys.argv[1], sys.argv[2]
p = "ios/project.yml"; s = open(p).read()
build = int(re.search(r'CURRENT_PROJECT_VERSION: "(\d+)"', s).group(1))
if upload == "1":
    build += 1                     # deneme arşivi (UPLOAD=0) numarayı tüketmez
s = re.sub(r'CURRENT_PROJECT_VERSION: "\d+"', f'CURRENT_PROJECT_VERSION: "{build}"', s)
if yeni:
    s = re.sub(r'MARKETING_VERSION: "[^"]+"', f'MARKETING_VERSION: "{yeni}"', s)
open(p, "w").write(s)
PY
read -r VERSION BUILD < <(python3 -c "
import re
s=open('ios/project.yml').read()
print(re.search(r'MARKETING_VERSION: \"([^\"]+)\"', s).group(1), re.search(r'CURRENT_PROJECT_VERSION: \"([^\"]+)\"', s).group(1))")
echo ">> Kadıköy Tenis sürüm $VERSION, derleme $BUILD"

(cd ios && xcodegen generate --quiet)
rm -rf "$ARCHIVE" "$EXPORT"
AUTH=(-allowProvisioningUpdates -authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
xcodebuild -project ios/KadikoyTenis.xcodeproj -scheme KadikoyTenis -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" DEVELOPMENT_TEAM="$TEAM_ID" "${AUTH[@]}" \
  archive > /tmp/release-tenis-archive.log 2>&1 \
  || { echo "!! arşiv başarısız:"; grep -E "error:|FAILED" /tmp/release-tenis-archive.log | tail -8; exit 1; }
echo ">> arşiv tamam"
xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportPath "$EXPORT" \
  -exportOptionsPlist ios/ExportOptions.plist "${AUTH[@]}" > /tmp/release-tenis-export.log 2>&1 \
  || { echo "!! dışa aktarma başarısız:"; grep -E "error" /tmp/release-tenis-export.log | tail -8; exit 1; }
IPA=$(ls "$EXPORT"/*.ipa | head -1)

# TestFlight derlemesi production APNs ortamıyla imzalanmalı
ENV=$(codesign -d --entitlements :- "$ARCHIVE/Products/Applications/KadikoyTenis.app" 2>/dev/null | grep -A1 aps-environment | tail -1 || true)
echo ">> arşiv aps-environment: $ENV (dışa aktarmada production'a çevrilir)"
echo ">> paket: $(basename "$IPA") ($(du -h "$IPA" | cut -f1))"

if [ "$UPLOAD" != "1" ]; then echo ">> UPLOAD=0: yükleme atlandı"; exit 0; fi
echo ">> yükleniyor"
xcrun altool --upload-app -f "$IPA" -t ios --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID" 2>&1 | grep -iE 'UPLOAD SUCCEEDED|ERROR' | head -3
echo ">> işlenmesi bekleniyor (birkaç dakika)"
~/.venvs/asc/bin/python tools/asc.py publish "$BUILD"
