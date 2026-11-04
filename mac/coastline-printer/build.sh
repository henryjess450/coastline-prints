#!/bin/bash
# Builds "Coastline Printer.app" (the market stand's print bridge as a native
# Mac app, App.swift), installs it in /Applications (so it can start at
# login) and puts a shortcut to it on the Desktop. Needs Xcode or its
# command line tools.  bash mac/coastline-printer/build.sh [destination folder]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DEST="${1:-/Applications}"
APP="$DEST/Coastline Printer.app"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Icon: the SVG at every size macOS wants, packed into an .icns.
mkdir -p "$WORK/AppIcon.iconset"
for s in 16 32 128 256 512; do
  for scale in 1 2; do
    px=$((s * scale)); suffix=""; if [ "$scale" = 2 ]; then suffix="@2x"; fi
    name="icon_${s}x${s}${suffix}.png"
    (cd "$ROOT" && node -e "require('sharp')(process.argv[1],{density:Math.max(72,${px}*72/1024*1.2)}).resize(${px},${px}).png().toFile(process.argv[2])" "$HERE/icon.svg" "$WORK/AppIcon.iconset/$name")
  done
done
iconutil -c icns "$WORK/AppIcon.iconset" -o "$WORK/AppIcon.icns"

swiftc -O -parse-as-library -target "$(uname -m)-apple-macos14.0" "$HERE/App.swift" -o "$WORK/Coastline Printer"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$WORK/Coastline Printer" "$APP/Contents/MacOS/Coastline Printer"
cp "$ROOT/public/print-bridge/print-bridge.mjs" "$APP/Contents/Resources/print-bridge.mjs"
cp "$WORK/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"
cat > "$APP/Contents/Info.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Coastline Printer</string>
  <key>CFBundleDisplayName</key><string>Coastline Printer</string>
  <key>CFBundleIdentifier</key><string>ca.coastlineprints.printer</string>
  <key>CFBundleExecutable</key><string>Coastline Printer</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>2.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSApplicationCategoryType</key><string>public.app-category.business</string>
</dict>
</plist>
EOF
# Ad-hoc sign so macOS runs it without complaint, and refresh the Finder icon.
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true
touch "$APP"
echo "Built $APP"

# The Desktop shortcut (replaces a copy of the app built there by older versions of this script).
if [ "$DEST" = "/Applications" ]; then
  DESK="$HOME/Desktop/Coastline Printer.app"
  if [ -d "$DESK" ] && [ ! -L "$DESK" ]; then rm -rf "$DESK"; fi
  ln -sfn "$APP" "$DESK"
  echo "Shortcut on the Desktop"
fi
