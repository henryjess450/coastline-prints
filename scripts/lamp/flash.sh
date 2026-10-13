#!/usr/bin/env bash
# Sets up the Coastline order lamp (ESP32-C3 + 12-LED WS2812 ring) from this Mac:
# installs MicroPython on the ESP32, copies the lamp code, gives it the Wi-Fi
# details and lamp key, then watches it join Wi-Fi and wait for orders.
#
#   bash scripts/lamp/flash.sh             first time (wipes the ESP32)
#   bash scripts/lamp/flash.sh --update    copy new lamp code only, keep its settings
#   bash scripts/lamp/flash.sh --watch     just show what the lamp is saying
#
# Needs: a USB cable that carries data, and the lamp key from the dashboard (Lamp).
# Wiring: ring 5V -> ESP32 5V, GND -> GND, DIN -> a GPIO pin (asked below, 10 by default).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FW_SRC="$ROOT/firmware/lamp"
CACHE="$HOME/.cache/coastline-lamp"
VENV="$CACHE/venv"
MP_BIN="ESP32_GENERIC_C3-20260406-v1.28.0.bin"
SITE="${LAMP_SITE:-https://coastlineprints.ca}"
MODE="${1:-}"

navy=$'\e[38;2;134;187;234m'; bold=$'\e[1m'; dim=$'\e[2m'; red=$'\e[31m'; off=$'\e[0m'
say()  { printf '%s\n' "${navy}${bold}==>${off} ${bold}$*${off}"; }
note() { printf '    %s\n' "${dim}$*${off}"; }
die()  { printf '%s\n' "${red}${bold}Stopped:${off} $*" >&2; exit 1; }

# ── 1. Tools (a private Python env, about 15 MB) ───────────────────────────
PY=""
for p in /opt/homebrew/bin/python3.13 /opt/homebrew/bin/python3.12 /opt/homebrew/bin/python3.11 /opt/homebrew/bin/python3 python3; do
  if command -v "$p" >/dev/null 2>&1; then PY="$(command -v "$p")"; break; fi
done
[ -n "$PY" ] || die "Python 3 isn't installed. Run: brew install python"
mkdir -p "$CACHE"
if [ ! -x "$VENV/bin/mpremote" ] || [ ! -x "$VENV/bin/esptool" ]; then
  say "Installing the flashing tools (esptool, mpremote)"
  "$PY" -m venv "$VENV"
  "$VENV/bin/pip" install --quiet --disable-pip-version-check esptool mpremote pyserial
fi
ESPTOOL="$VENV/bin/esptool"
MPREMOTE="$VENV/bin/mpremote"

# ── 2. Find the ESP32 ──────────────────────────────────────────────────────
find_port() {
  ls /dev/cu.usbmodem* /dev/cu.usbserial* /dev/cu.wchusbserial* /dev/cu.SLAB_USBtoUART* 2>/dev/null || true
}
PORT=""
for try in $(seq 1 60); do
  ports=()
  while IFS= read -r line; do [ -n "$line" ] && ports+=("$line"); done < <(find_port)
  if [ "${#ports[@]}" -eq 1 ]; then PORT="${ports[0]}"; break; fi
  if [ "${#ports[@]}" -gt 1 ]; then
    say "More than one USB serial device is plugged in:"
    select p in "${ports[@]}"; do PORT="$p"; break; done
    break
  fi
  [ "$try" -eq 1 ] && say "Plug the ESP32 into this Mac (waiting up to a minute)..." && note "No luck? Try another cable: many USB-C cables only charge."
  sleep 1
done
[ -n "$PORT" ] || die "Couldn't find the ESP32. Hold BOOT, tap RESET (or replug while holding BOOT), then run this again."
note "ESP32 on $PORT"

# Prints what the lamp says until it's waiting for orders (or 90 seconds pass).
watch_lamp() {
  say "Watching the lamp (Ctrl-C to stop)"
  "$VENV/bin/python" - "$PORT" "${1:-90}" <<'PYEOF'
import sys, time, glob, serial
port, limit = sys.argv[1], float(sys.argv[2])
end = time.time() + limit
s = None
while time.time() < end:
    if s is None:
        try:
            s = serial.Serial(port, 115200, timeout=0.5)
        except Exception:
            time.sleep(0.5)
            continue
    try:
        line = s.readline().decode("utf-8", "replace").rstrip()
    except Exception:
        s = None  # the ESP32's USB port blinks out when it restarts
        continue
    if not line:
        continue
    print("    " + line)
    if "Waiting for orders" in line:
        print("\n\033[1mThe lamp is online and waiting for orders.\033[0m Try Play on the dashboard (Lamp).")
        sys.exit(0)
    if "Wi-Fi failed" in line:
        print("\n\033[31mIt couldn't join Wi-Fi.\033[0m The ESP32-C3 only sees 2.4 GHz networks. Run the script again to re-enter the Wi-Fi details.")
        sys.exit(1)
    if "doesn't know this lamp key" in line:
        print("\n\033[31mThe site didn't accept the lamp key.\033[0m Make a new key on the dashboard and run the script again.")
        sys.exit(1)
sys.exit(0 if limit > 300 else 2)
PYEOF
}

if [ "$MODE" = "--watch" ]; then
  "$MPREMOTE" connect "$PORT" reset >/dev/null 2>&1 || true
  watch_lamp 3600 || true
  exit 0
fi

copy_code() {
  # Stops whatever is running (Ctrl-C), copies the files, restarts.
  "$MPREMOTE" connect "$PORT" fs cp "$FW_SRC/anims.py" :anims.py + fs cp "$FW_SRC/main.py" :main.py "$@"
}

if [ "$MODE" = "--update" ]; then
  say "Copying the new lamp code"
  copy_code
  "$MPREMOTE" connect "$PORT" reset >/dev/null 2>&1 || true
  watch_lamp 90 || true
  exit 0
fi

# ── 3. Questions ───────────────────────────────────────────────────────────
current_ssid() {
  ipconfig getsummary en0 2>/dev/null | awk -F ' SSID : ' '/ SSID : /{print $2; exit}' ||
    networksetup -getairportnetwork en0 2>/dev/null | sed -n 's/^Current Wi-Fi Network: //p'
}
echo
say "A few questions"
guess="$(current_ssid || true)"
case "$guess" in *redacted*) guess="";; esac  # newer macOS hides it
read -r -p "    Wi-Fi name${guess:+ [$guess]}: " SSID
SSID="${SSID:-$guess}"
[ -n "$SSID" ] || die "The Wi-Fi name is needed."
read -r -s -p "    Wi-Fi password: " WIFI_PASS; echo
read -r -p "    Which GPIO pin is the ring's DIN wire on? [10]: " PIN
PIN="${PIN:-10}"
[[ "$PIN" =~ ^[0-9]+$ ]] || die "The pin should be a number, like 10."
case "$PIN" in 2|8|9) note "Heads up: GPIO $PIN is a boot pin on the C3. If the ESP32 won't start, move DIN to 10 or 4.";; esac
echo
note "Opening $SITE/admin/lamp. Tap 'Make a lamp key', copy it, and paste it here."
open "$SITE/admin/lamp" 2>/dev/null || true
read -r -p "    Lamp key: " KEY
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
[[ "$KEY" =~ ^lamp_[A-Za-z0-9_-]{20,64}$ ]] || die "That doesn't look like a lamp key (it starts with lamp_)."

# ── 4. MicroPython ─────────────────────────────────────────────────────────
if [ ! -s "$CACHE/$MP_BIN" ]; then
  say "Downloading MicroPython for the ESP32-C3"
  curl -fL --progress-bar -o "$CACHE/$MP_BIN.part" "https://micropython.org/resources/firmware/$MP_BIN"
  mv "$CACHE/$MP_BIN.part" "$CACHE/$MP_BIN"
fi
say "Wiping the ESP32 and installing MicroPython (about 30 seconds)"
"$ESPTOOL" --chip esp32c3 --port "$PORT" erase_flash
"$ESPTOOL" --chip esp32c3 --port "$PORT" --baud 460800 write_flash 0x0 "$CACHE/$MP_BIN"

# The ESP32 restarts and its USB port comes back.
sleep 2
for _ in $(seq 1 20); do [ -e "$PORT" ] && break; sleep 0.5; done
sleep 2

# ── 5. Lamp code + settings ────────────────────────────────────────────────
CFG="$(mktemp "$CACHE/config.XXXXXX")"
chmod 600 "$CFG"
trap 'rm -f "$CFG"' EXIT
SSID="$SSID" WIFI_PASS="$WIFI_PASS" PIN="$PIN" KEY="$KEY" SITE="$SITE" "$PY" - >"$CFG" <<'PYEOF'
import os
e = os.environ
print("# Written by scripts/lamp/flash.sh. Re-run it to change these.")
print("WIFI_SSID = %r" % e["SSID"])
print("WIFI_PASSWORD = %r" % e["WIFI_PASS"])
print("LED_PIN = %d" % int(e["PIN"]))
print("LAMP_KEY = %r" % e["KEY"])
print("SERVER = %r" % e["SITE"])
print("BRIGHTNESS = 40  # until the site sends the dashboard's setting")
print("OFFSET = 0  # which LED is the bottom of the ring")
print("REVERSE = False  # True if animations go round the wrong way")
PYEOF

say "Copying the lamp code and settings"
ok=""
for _ in 1 2 3; do
  if copy_code + fs cp "$CFG" :config.py; then ok=1; break; fi
  sleep 2
done
[ -n "$ok" ] || die "Couldn't copy the files. Unplug the ESP32, plug it back in, and run: bash scripts/lamp/flash.sh --update"
rm -f "$CFG"
"$MPREMOTE" connect "$PORT" reset >/dev/null 2>&1 || true

# ── 6. Watch it come online ────────────────────────────────────────────────
if watch_lamp 90; then
  echo
  note "You can unplug it from the Mac and power it from any USB charger now."
else
  note "Didn't see it come online yet. Watch it with: bash scripts/lamp/flash.sh --watch"
fi
