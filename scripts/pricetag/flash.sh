#!/usr/bin/env bash
# Puts the screen price-tag firmware on an ESP32 DevKit V1 or a XIAO ESP32S3 (firmware/pricetag),
# then checks it answers. Only needed once (or after changing the firmware):
# after that, tags go on from the dashboard, Admin > Price tags > Connect screen.
#
#   bash scripts/pricetag/flash.sh
#
# Needs arduino-cli (brew install arduino-cli) and a USB cable that carries data.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

bold=$'\e[1m'; red=$'\e[31m'; off=$'\e[0m'
say() { printf '%s\n' "${bold}==> $*${off}"; }
die() { printf '%s\n' "${red}${bold}Stopped:${off} $*" >&2; exit 1; }

command -v arduino-cli >/dev/null || die "arduino-cli isn't installed. Run: brew install arduino-cli"
if ! arduino-cli core list 2>/dev/null | grep -q '^esp32:esp32'; then
  say "Installing the ESP32 board support (one time, a few minutes)"
  arduino-cli core update-index --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
  arduino-cli core install esp32:esp32 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
fi

# DevKit V1 shows up through its USB chip (CP2102 or CH340); the XIAO S3 as its own USB modem.
if ! arduino-cli lib list 2>/dev/null | grep -q '^Adafruit SH110X'; then
  say "Installing Adafruit's SH110X screen library"
  arduino-cli lib install "Adafruit SH110X"
fi

PORT="${PRICETAG_PORT:-$(ls /dev/cu.usbserial-* /dev/cu.SLAB_USBtoUART /dev/cu.wchusbserial* /dev/cu.usbmodem* 2>/dev/null | head -1 || true)}"
[ -n "$PORT" ] || die "No board found. Plug it in with a data cable (some cables only charge)."
case "$PORT" in
  */cu.usbmodem*) FQBN="esp32:esp32:XIAO_ESP32S3"; WIRING="SDA->D4, SCL->D5" ;;  # keep its default USB options: they leave USB serial on
  *)              FQBN="esp32:esp32:esp32doit-devkit-v1"; WIRING="SDA->D21, SCL->D22" ;;
esac

say "Building and flashing on $PORT"
arduino-cli compile --fqbn "$FQBN" --upload -p "$PORT" "$ROOT/firmware/pricetag"

say "Checking it answers"
sleep 2
# Opening the port restarts a DevKit, and a port can hang on open: give the
# whole check 15 seconds at most.
answer="$(PORT="$PORT" perl -e 'alarm 15; exec @ARGV' bash -c '
  exec 3<>"$PORT"
  stty 115200 raw -echo clocal <&3 2>/dev/null
  sleep 2
  for _ in 1 2 3; do
    printf "PING\n" >&3
    while read -r -t 2 line <&3; do
      line="$(printf %s "$line" | LC_ALL=C tr -cd "[:print:]")"
      case "$line" in PRICETAG*) echo "$line"; exit 0 ;; esac
    done
  done
' 2>/dev/null || true)"
case "$answer" in
  *oled=none*) say "Flashed, but no screen found: $answer"; echo "    Wiring: VCC->3V3, GND->GND, $WIRING." ;;
  PRICETAG*)   say "Ready: $answer"; echo "    Now open Admin > Price tags in Chrome and press Connect screen." ;;
  *)           say "Flashed. It didn't answer the check, but unplugging and replugging usually sorts that." ;;
esac
