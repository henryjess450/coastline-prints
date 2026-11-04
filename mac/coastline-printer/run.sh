#!/bin/bash
# Coastline Printer: the print bridge for the market stand, as a little Mac app.
# Opened by the app in a navy Terminal window. Checks everything, keeps the
# Mac awake, and prints whatever the register sends until the window closes.
# The bridge key lives in the login keychain, never in a file.

# COASTLINE_SERVER and COASTLINE_KEYCHAIN are only for testing against a local copy of the site.
SERVER="${COASTLINE_SERVER:-https://coastlineprints.ca}"
SERVICE="${COASTLINE_KEYCHAIN:-coastline-print-bridge}"
SUPPORT="$HOME/Library/Application Support/Coastline Printer"
BRIDGE="$SUPPORT/print-bridge.mjs"
mkdir -p "$SUPPORT"

# Colours from the logo: sun gold, wave blue, white on navy.
GOLD=$'\e[38;2;233;196;106m'; WAVE=$'\e[38;2;134;187;234m'; GOOD=$'\e[38;2;124;220;150m'
WARN=$'\e[38;2;255;190;120m'; DIM=$'\e[38;2;160;185;210m'; B=$'\e[1m'; R=$'\e[0m'
ok() { echo "  ${GOOD}✓${R} $1"; }
warn() { echo "  ${WARN}!${R} $1"; }
info() { echo "    ${DIM}$1${R}"; }
printf '\e]0;Coastline Printer\a'

clear
echo
echo "   ${GOLD}●${R}"
echo "  ${B}∿∿∿∿  Coastline Printer${R}"
echo "  ${WAVE}∿∿∿   ${R}${DIM}receipts for the LightLab stand${R}"
echo

if pgrep -f "Coastline Printer/print-bridge.mjs" >/dev/null; then
  warn "It's already running in another window."
  info "Close this one. Receipts are already printing."
  exit 0
fi

# ── Node ───────────────────────────────────────────────────────────────
NODE=""
for n in /opt/homebrew/bin/node /usr/local/bin/node "$(command -v node 2>/dev/null)"; do
  [ -x "$n" ] && NODE="$n" && break
done
if [ -z "$NODE" ]; then
  warn "Node isn't installed. Get the LTS version from nodejs.org, then open this again."
  open "https://nodejs.org/en/download"
  exit 1
fi
ok "Node $("$NODE" -v)"

# ── Bridge key (first time: paste it; it's saved in the keychain) ──────
KEY=$(security find-generic-password -s "$SERVICE" -w 2>/dev/null)
if [ -z "$KEY" ]; then
  echo
  echo "  ${B}First time setup${R}"
  info "On $SERVER/admin/receipts, click Make a bridge key and copy the key (it starts with pb_)."
  while true; do
    read -r -p "  Paste the key here: " KEY
    KEY="${KEY//[[:space:]]/}"
    KEY="${KEY##*BRIDGE_KEY=}"; KEY="${KEY%% *}"
    [[ "$KEY" == pb_* ]] && break
    warn "That doesn't look like a bridge key. It starts with pb_"
  done
  security add-generic-password -U -s "$SERVICE" -a bridge -w "$KEY"
  echo
fi
ok "Bridge key saved on this Mac"

# ── Internet (the hotspot) ─────────────────────────────────────────────
if curl -fsS -m 8 -o "$BRIDGE.new" "$SERVER/print-bridge/print-bridge.mjs" 2>/dev/null; then
  mv "$BRIDGE.new" "$BRIDGE"
  ok "Online, connected to coastlineprints.ca"
else
  rm -f "$BRIDGE.new"
  warn "Can't reach coastlineprints.ca. Turn on your phone's hotspot and join it."
  info "It keeps trying, and starts printing as soon as you're online."
  if [ ! -f "$BRIDGE" ]; then
    info "Waiting for the internet the first time..."
    until curl -fsS -m 8 -o "$BRIDGE" "$SERVER/print-bridge/print-bridge.mjs" 2>/dev/null; do sleep 5; done
    ok "Online now"
  fi
fi

# ── Ethernet adapter and Internet Sharing ──────────────────────────────
ETH=""
while IFS='|' read -r port dev; do
  ifconfig "$dev" 2>/dev/null | grep -q "status: active" && ETH="$dev" && break
done < <(networksetup -listallhardwareports | awk -F': ' '/^Hardware Port/{p=$2} /^Device/{if (p !~ /Wi-Fi|Bluetooth|Thunderbolt Bridge/) print p "|" $2}')
if [ -n "$ETH" ]; then
  ok "Ethernet adapter plugged in ($ETH)"
  # Internet Sharing makes bridge100 (192.168.2.1) and hands out addresses on it.
  if ifconfig bridge100 2>/dev/null | grep -q "inet "; then
    ok "Internet Sharing is on, so the printer gets an address"
  else
    warn "Internet Sharing is off, so the printer can't get an address from this Mac."
    info "Turn on Wi-Fi → your ethernet adapter in the window that just opened."
    open "x-apple.systempreferences:com.apple.Sharing-Settings.extension"
  fi
else
  info "No ethernet adapter plugged in. That's fine at home if the printer is on the home network."
fi

# ── Run ────────────────────────────────────────────────────────────────
echo
echo "  ${B}Looking for the printer...${R}  ${DIM}(leave this window open; close it to stop)${R}"
echo
# Keep the Mac awake (not the screen) while this window is open.
caffeinate -i -s -w $$ &

printed=0
BRIDGE_KEY="$KEY" SERVER="$SERVER" "$NODE" "$BRIDGE" 2>&1 | while IFS= read -r line; do
  msg="${line#* * }"            # after the bridge's "9:44:52 AM "
  at="${line%"$msg"}"
  case "$msg" in
    *"Found the printer"*) echo "  ${GOOD}✓${R} ${msg}. ${B}Ready to print!${R}"; afplay /System/Library/Sounds/Hero.aiff & ;;
    *"Can't find the printer"*) warn "Can't find the printer. Check it's switched on and the ethernet cable is in."; info "Plugged into this Mac? Internet Sharing must be on (System Settings → General → Sharing)." ;;
    Printing*) echo "  ${GOLD}🧾${R} ${msg#Printing }  ${DIM}${at}${R}" ;;
    Printed) printed=$((printed + 1)); echo "     ${GOOD}printed${R} ${DIM}(${printed} today)${R}"; afplay /System/Library/Sounds/Glass.aiff & ;;
    *"doesn't know this bridge key"*)
      security delete-generic-password -s "$SERVICE" >/dev/null 2>&1
      warn "The site doesn't know this key any more (a new one was made)."
      info "Close this window and open Coastline Printer again to paste the new key."
      afplay /System/Library/Sounds/Basso.aiff &
      pkill -f "Coastline Printer/print-bridge.mjs" ;;
    *"Can't reach"*) warn "Lost the internet. Is the hotspot still on? It keeps trying." ;;
    "Back online") ok "Back online" ;;
    "Print bridge"*) ;;
    *) info "$line" ;;
  esac
done

echo
info "Stopped. You can close this window."
