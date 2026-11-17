#!/usr/bin/env bash
# Keeps the LightLab stand PC online (installed by setup-stand-pc.sh, run by systemd).
#
# Every 15 s:
#   - online (saved Wi-Fi or a phone on USB): every 10 min, copies the Wi-Fi
#     list from Admin > Receipts (stand-wifi-sync.mjs). If the site stays
#     unreachable for 10 min, reconnects the Wi-Fi.
#   - offline for 90 s: looks for a saved Wi-Fi in range and joins it; if there
#     is none, opens the setup hotspot so a phone can add one.
#   - hotspot open for 3 min with nobody on it: closes it and tries saved Wi-Fi
#     again (your phone's hotspot may have come on meanwhile).
# Writes what it sees to /run/stand/status for the setup page.
set -u
SETUP_CON="${SETUP_CON:-stand-setup}"
GRACE=90
AP_IDLE=180
STATE=/run/stand
mkdir -p "$STATE"
SERVER=$(sed -n 's/^SERVER=//p' /etc/print-bridge.env 2>/dev/null)
SERVER="${SERVER:-https://coastlineprints.ca}"

wifi_dev() { nmcli -t -f DEVICE,TYPE device 2>/dev/null | awk -F: '$2=="wifi"{print $1; exit}'; }
ap_up() { nmcli -t -f NAME con show --active 2>/dev/null | grep -qxF "$SETUP_CON"; }
uplink() { ip -4 route show default 2>/dev/null | grep -q .; }
uplink_name() { nmcli -t -f NAME,DEVICE con show --active 2>/dev/null | grep -vE "^($SETUP_CON|printer-lan|lo):" | head -1 | cut -d: -f1; }
status() { printf '%s\n' "$@" > "$STATE/status.tmp" && mv "$STATE/status.tmp" "$STATE/status"; }

# Saved Wi-Fi: "connection name<TAB>network name", one per line.
saved_wifi() {
  nmcli -t -f NAME,TYPE con show 2>/dev/null | awk -F: '$2=="802-11-wireless"{print $1}' | while read -r n; do
    [[ "$n" == "$SETUP_CON" ]] && continue
    printf '%s\t%s\n' "$n" "$(nmcli -g 802-11-wireless.ssid con show "$n" 2>/dev/null)"
  done
}

offline=0
ap_since=0
bad=0
last_check=0
last_sync=0
no_dev_said=0
ap_failed=0

while sleep 15; do
  now=$(date +%s)
  dev=$(wifi_dev)

  # ── Setup hotspot is open ──
  if ap_up; then
    if uplink; then
      echo "Online another way (USB phone?); closing the setup hotspot"
      nmcli con down "$SETUP_CON" >/dev/null 2>&1
      continue
    fi
    seen=$(stat -c %Y "$STATE/portal-seen" 2>/dev/null || echo 0)
    clients=$(iw dev "$dev" station dump 2>/dev/null | grep -c '^Station')
    status "state=setup" "since=$ap_since" "clients=$clients"
    if (( clients == 0 && now - seen > 60 && now - ap_since > AP_IDLE )); then
      echo "Nobody on the setup hotspot; trying saved Wi-Fi again"
      nmcli con down "$SETUP_CON" >/dev/null 2>&1
      offline=0
    fi
    continue
  fi

  # ── Online ──
  if uplink; then
    offline=0
    name=$(uplink_name)
    if (( now - last_check >= 60 )); then
      last_check=$now
      if curl -fsSI -m 10 -o /dev/null "$SERVER/print-bridge/print-bridge.mjs"; then bad=0; else bad=$((bad + 1)); fi
      if (( bad == 0 && now - last_sync >= 600 )); then
        node /opt/print-bridge/stand-wifi-sync.mjs && last_sync=$now
      fi
      status "state=online" "via=$name" "site=$([[ $bad == 0 ]] && echo ok || echo unreachable)" "checked=$now"
      # 10 min connected but can't reach the site: reconnect the Wi-Fi (a stuck link, or a venue
      # Wi-Fi that wants a sign-in page, which this can't do).
      if (( bad >= 10 )) && [[ -n "$dev" ]] && nmcli -t -f DEVICE,STATE device | grep -qx "$dev:connected"; then
        echo "Can't reach $SERVER for 10 minutes over $name; reconnecting the Wi-Fi"
        nmcli device disconnect "$dev" >/dev/null 2>&1; sleep 3; nmcli device connect "$dev" >/dev/null 2>&1
        bad=0
      fi
    fi
    continue
  fi

  # ── Offline ──
  if [[ -z "$dev" ]]; then
    (( no_dev_said )) || echo "No Wi-Fi found (or plug in a phone with USB tethering on)."
    no_dev_said=1
    status "state=offline" "reason=no-wifi-adapter"
    continue
  fi
  no_dev_said=0
  offline=$((offline + 15))
  status "state=offline" "for=$offline"
  (( offline < GRACE )) && continue
  offline=0

  # NetworkManager joins saved Wi-Fi by itself; this is the backstop.
  nmcli -t -f SSID,SIGNAL,SECURITY device wifi list ifname "$dev" --rescan yes > "$STATE/scan.tmp" 2>/dev/null && mv "$STATE/scan.tmp" "$STATE/scan"
  joined=0
  while IFS=$'\t' read -r con ssid; do
    [[ -z "$ssid" ]] && continue
    if cut -d: -f1 "$STATE/scan" 2>/dev/null | grep -qxF "$ssid"; then
      echo "Joining $ssid"
      if timeout 45 nmcli con up "$con" ifname "$dev" >/dev/null 2>&1; then joined=1; break; fi
      echo "Couldn't join $ssid (wrong password?)"
    fi
  done < <(saved_wifi)
  (( joined )) && continue

  echo "No saved Wi-Fi in range; opening the setup hotspot"
  if nmcli con up "$SETUP_CON" ifname "$dev" >/dev/null 2>&1; then
    ap_since=$(date +%s); ap_failed=0
  else
    (( ap_failed++ )) || echo "This Wi-Fi adapter can't run the setup hotspot. Add Wi-Fi with: sudo nmcli dev wifi connect NAME password PASS"
  fi
done
