#!/usr/bin/env bash
# Turns a spare PC (Debian 13, no desktop) into the LightLab stand's print box.
# After this, nobody touches it: plug in power and the printer's ethernet cable,
# and it
#   - boots straight up (no login) and starts again after a power cut or crash
#   - gives the Star printer an address on its ethernet port (192.168.77.x)
#   - joins the Wi-Fi networks listed on Admin > Receipts (your phone's hotspot,
#     venues), keeping that list in step whenever it's online; or a phone
#     plugged in by USB with tethering on
#   - runs the print bridge, so receipts from the register print
#   - if it can't get online, opens its own "LightLab Stand Setup" Wi-Fi with a
#     page for adding a network from your phone
#   - updates the bridge from the site by itself
#
# Run once, at home, with the PC's ethernet plugged into your router:
#   wget -qO- https://coastlineprints.ca/print-bridge/setup-stand-pc.sh | sudo bash -s -- pb_YOURKEY
#
# Safe to run again. STAND-PC.md in the repo has the full guide.
set -euo pipefail

KEY="${1:-}"
SERVER="${SERVER:-https://coastlineprints.ca}"
SETUP_SSID="${SETUP_SSID:-LightLab Stand Setup}"
SETUP_PASSWORD="${SETUP_PASSWORD:-lightlab-stand}"
PRINTER_NET="${PRINTER_NET:-192.168.77}"

if [[ $EUID -ne 0 ]]; then echo "Run with sudo."; exit 1; fi
if [[ -z "$KEY" && -f /etc/print-bridge.env ]]; then KEY=$(sed -n 's/^BRIDGE_KEY=//p' /etc/print-bridge.env); fi
if [[ "$KEY" != pb_* ]]; then echo "Pass the bridge key from Admin > Receipts:  ... | sudo bash -s -- pb_..."; exit 1; fi
if (( ${#SETUP_PASSWORD} < 8 )); then echo "SETUP_PASSWORD needs 8+ characters."; exit 1; fi
step() { echo; echo "== $*"; }

# ── Packages ────────────────────────────────────────────────────────────────
step "Turning on Debian's firmware packages (Wi-Fi adapters need them)"
if [[ -f /etc/apt/sources.list.d/debian.sources ]]; then
  sed -i -E '/^Components:/{/non-free-firmware/! s/$/ non-free-firmware/}' /etc/apt/sources.list.d/debian.sources
fi
if [[ -f /etc/apt/sources.list ]]; then
  sed -i -E '/^deb(-src)? .*debian/{/non-free-firmware/! s/$/ non-free-firmware/}' /etc/apt/sources.list
fi

step "Installing Node, NetworkManager and friends"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nodejs network-manager iw wireless-regdb curl avahi-daemon usbmuxd unattended-upgrades >/dev/null
apt-get install -y -qq firmware-iwlwifi firmware-misc-nonfree firmware-realtek firmware-atheros >/dev/null \
  || echo "   (Couldn't install Wi-Fi firmware; Wi-Fi may not work until it does.)"
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if (( NODE_MAJOR < 18 )); then echo "Node $NODE_MAJOR is too old (need 18+). Use Debian 13."; exit 1; fi

# ── The bridge and its helpers ──────────────────────────────────────────────
step "Installing the print bridge"
mkdir -p /opt/print-bridge
for f in print-bridge.mjs stand-portal.mjs stand-watch.sh stand-wifi-sync.mjs; do
  curl -fsSL "$SERVER/print-bridge/$f" -o "/opt/print-bridge/$f"
done
chmod 755 /opt/print-bridge/stand-watch.sh
umask 077
printf 'BRIDGE_KEY=%s\nSERVER=%s\n' "$KEY" "$SERVER" > /etc/print-bridge.env
umask 022

# Keeps the bridge files current: downloads them, checks they parse, swaps them in.
cat > /usr/local/sbin/stand-update <<'EOF'
#!/usr/bin/env bash
set -u
. /etc/print-bridge.env
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
changed=()
for f in print-bridge.mjs stand-portal.mjs stand-watch.sh stand-wifi-sync.mjs; do
  curl -fsSL -m 60 "$SERVER/print-bridge/$f" -o "$tmp/$f" || continue
  case $f in *.mjs) node --check "$tmp/$f" || continue ;; *.sh) bash -n "$tmp/$f" || continue ;; esac
  cmp -s "$tmp/$f" "/opt/print-bridge/$f" && continue
  install -m 755 "$tmp/$f" "/opt/print-bridge/$f"
  changed+=("$f")
done
for f in "${changed[@]}"; do
  echo "Updated $f"
  case $f in
    print-bridge.mjs) systemctl restart print-bridge ;;
    stand-portal.mjs) systemctl restart stand-portal ;;
    stand-watch.sh) systemctl restart stand-watch ;;
  esac
done
EOF
chmod 755 /usr/local/sbin/stand-update

step "Services: bridge, Wi-Fi watcher, setup page, updates"
cat > /etc/systemd/system/print-bridge.service <<EOF
[Unit]
Description=Receipt printer bridge
After=network.target
StartLimitIntervalSec=0

[Service]
EnvironmentFile=/etc/print-bridge.env
Environment=JOBS_DIR=/var/lib/print-bridge/jobs
StateDirectory=print-bridge
ExecStart=$(command -v node) /opt/print-bridge/print-bridge.mjs
Restart=always
RestartSec=5
# A fresh start once a day, in case it ever wedges quietly.
RuntimeMaxSec=1d
DynamicUser=yes

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/stand-watch.service <<EOF
[Unit]
Description=Keeps the stand online; opens the setup hotspot when it can't be
After=NetworkManager.service
Wants=NetworkManager.service
StartLimitIntervalSec=0

[Service]
Environment="SETUP_CON=stand-setup"
ExecStart=/opt/print-bridge/stand-watch.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/stand-portal.service <<EOF
[Unit]
Description=Stand setup page (on the setup hotspot)
After=network.target
StartLimitIntervalSec=0

[Service]
Environment="SETUP_CON=stand-setup"
ExecStart=$(command -v node) /opt/print-bridge/stand-portal.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/stand-update.service <<'EOF'
[Unit]
Description=Update the print bridge from the site
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/stand-update
EOF

cat > /etc/systemd/system/stand-update.timer <<'EOF'
[Unit]
Description=Update the print bridge every few hours

[Timer]
OnBootSec=3min
OnUnitActiveSec=4h
RandomizedDelaySec=5min

[Install]
WantedBy=timers.target
EOF

# ── Never stuck, never asleep ───────────────────────────────────────────────
step "Watchdog, power-cut safety, no sleep"
mkdir -p /etc/systemd/system.conf.d /etc/systemd/journald.conf.d /etc/sysctl.d /etc/modprobe.d
# The PC's hardware watchdog reboots it if the system ever freezes.
cat > /etc/systemd/system.conf.d/stand-watchdog.conf <<'EOF'
[Manager]
RuntimeWatchdogSec=30s
RebootWatchdogSec=2min
EOF
cat > /etc/sysctl.d/90-stand.conf <<'EOF'
kernel.panic = 10
kernel.panic_on_oops = 1
EOF
cat > /etc/systemd/journald.conf.d/stand.conf <<'EOF'
[Journal]
SystemMaxUse=100M
EOF
systemctl mask -q sleep.target suspend.target hibernate.target hybrid-sleep.target
# Boot without waiting at the menu, and repair the disk by itself after a power cut
# (otherwise a dirty disk can stop at a maintenance prompt that needs a keyboard).
if [[ -f /etc/default/grub ]]; then
  sed -i -E 's/^GRUB_TIMEOUT=.*/GRUB_TIMEOUT=1/' /etc/default/grub
  grep -q 'fsck.repair=yes' /etc/default/grub || sed -i -E 's/^(GRUB_CMDLINE_LINUX_DEFAULT="[^"]*)"/\1 fsck.repair=yes"/' /etc/default/grub
  update-grub >/dev/null 2>&1 || true
fi
timedatectl set-timezone America/Vancouver || true
hostnamectl set-hostname lightlab-stand || true
grep -q lightlab-stand /etc/hosts || echo "127.0.1.1 lightlab-stand" >> /etc/hosts
echo 'options cfg80211 ieee80211_regdom=CA' > /etc/modprobe.d/stand-wifi.conf
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

# ── Networks ────────────────────────────────────────────────────────────────
step "Wi-Fi settings"
mkdir -p /etc/NetworkManager/conf.d /etc/NetworkManager/dnsmasq-shared.d
cat > /etc/NetworkManager/conf.d/stand.conf <<'EOF'
[connection]
# Power saving makes USB Wi-Fi drop out.
wifi.powersave=2
[device]
wifi.scan-rand-mac-address=no
EOF
# On the setup hotspot, every web address opens the setup page (phones pop it up by themselves).
cat > /etc/NetworkManager/dnsmasq-shared.d/stand-setup.conf <<'EOF'
address=/#/10.42.0.1
EOF

# Wi-Fi the Debian installer may have set up outside NetworkManager: carry it over.
declare -a OLD_WIFI=()
if [[ -f /etc/network/interfaces ]]; then
  ssid=$(sed -n 's/^\s*wpa-ssid\s\+//p' /etc/network/interfaces | head -1 | tr -d '"')
  psk=$(sed -n 's/^\s*wpa-psk\s\+//p' /etc/network/interfaces | head -1 | tr -d '"')
  [[ -n "$ssid" ]] && OLD_WIFI=("$ssid" "$psk")
fi

add_wifi() { # name password
  local con="wifi-$1"
  nmcli con delete "$con" >/dev/null 2>&1 || true
  if [[ -n "$2" ]]; then
    nmcli con add type wifi con-name "$con" ssid "$1" wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$2" \
      connection.autoconnect yes connection.autoconnect-retries 0 ipv6.method auto >/dev/null
  else
    nmcli con add type wifi con-name "$con" ssid "$1" connection.autoconnect yes connection.autoconnect-retries 0 >/dev/null
  fi
}

systemctl enable --now NetworkManager >/dev/null
sleep 2
if (( ${#OLD_WIFI[@]} )); then add_wifi "${OLD_WIFI[0]}" "${OLD_WIFI[1]}"; echo "   Kept ${OLD_WIFI[0]} from the installer."; fi

# The setup hotspot: off until the watcher needs it.
nmcli con delete stand-setup >/dev/null 2>&1 || true
nmcli con add type wifi con-name stand-setup ssid "$SETUP_SSID" \
  802-11-wireless.mode ap 802-11-wireless.band bg \
  wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$SETUP_PASSWORD" wifi-sec.proto rsn wifi-sec.pairwise ccmp wifi-sec.group ccmp \
  ipv4.method shared ipv4.addresses 10.42.0.1/24 ipv6.method disabled connection.autoconnect no >/dev/null

step "Wi-Fi list from Admin > Receipts"
if node /opt/print-bridge/stand-wifi-sync.mjs; then
  n=$(grep -c . /run/stand/wifi-synced 2>/dev/null || true)
  echo "   Saved ${n:-0} network(s): $(paste -sd, /run/stand/wifi-synced 2>/dev/null)"
  [[ "${n:-0}" == 0 ]] && echo "   The list is empty. Add your hotspot on Admin > Receipts; the PC picks it up while it's still plugged into the router (within 10 min) or at the next run of this command."
else
  echo "   Couldn't fetch the list. Check the bridge key."
fi

step "Wi-Fi adapter"
WIFI=$(nmcli -t -f DEVICE,TYPE device | awk -F: '$2=="wifi"{print $1; exit}')
if [[ -z "$WIFI" ]]; then
  echo "   No Wi-Fi found. Check the BIOS hasn't turned the wireless off, or plug in a USB Wi-Fi adapter."
elif iw list 2>/dev/null | sed -n '/Supported interface modes/,/Band\|valid interface/p' | grep -q '\* AP$'; then
  echo "   $WIFI can join Wi-Fi and run the setup hotspot. Good."
else
  echo "   $WIFI can join Wi-Fi but can't run a hotspot, so the setup page won't appear."
  echo "   It still joins your listed Wi-Fi; it just can't offer the setup page."
fi

# The printer port: the PC's own ethernet (not a phone or adapter on USB).
ETH=""
for d in $(nmcli -t -f DEVICE,TYPE device | awk -F: '$2=="ethernet"{print $1}'); do
  [[ "$(readlink -f "/sys/class/net/$d/device" 2>/dev/null)" == *usb* ]] && continue
  ETH=$d; break
done

systemctl daemon-reload
systemctl enable -q print-bridge stand-watch stand-portal stand-update.timer avahi-daemon
systemctl restart print-bridge stand-portal stand-watch
systemctl start stand-update.timer

step "Ethernet port for the printer"
if [[ -z "$ETH" ]]; then
  echo "   No built-in ethernet port found. The printer needs one."
else
  # Hand the port to NetworkManager (the installer gave it to ifupdown for internet during install).
  if [[ -f /etc/network/interfaces ]]; then
    cp -n /etc/network/interfaces /etc/network/interfaces.before-stand
    printf 'auto lo\niface lo inet loopback\nsource /etc/network/interfaces.d/*\n' > /etc/network/interfaces
  fi
  nmcli con delete printer-lan >/dev/null 2>&1 || true
  # "shared": the PC runs a tiny DHCP server on this port, so the printer gets an address by itself.
  # It never routes anything out of this port.
  nmcli con add type ethernet ifname "$ETH" con-name printer-lan ipv4.method shared \
    ipv4.addresses "$PRINTER_NET.1/24" ipv4.never-default yes ipv6.method disabled \
    connection.autoconnect yes connection.autoconnect-priority 100 >/dev/null
  nmcli con modify printer-lan ipv4.shared-dhcp-range "$PRINTER_NET.10,$PRINTER_NET.20" >/dev/null 2>&1 || true
  # Also reach a printer sitting on Star's fallback address (no DHCP answer, or set by hand).
  nmcli con modify printer-lan +ipv4.addresses 192.168.192.1/24 >/dev/null 2>&1 || true
  echo "   $ETH is the printer port ($PRINTER_NET.x)."
fi

echo
echo "Done. Next:"
echo "  1. Unplug this PC from your router (from now on its ethernet port belongs to the printer;"
echo "     never plug it into a router again, it would hand out addresses there)."
echo "  2. Restart it (sudo reboot), then plug the printer's cable in."
echo "     The printer port only switches over after the restart."
echo "  3. Admin > Receipts should say the bridge is online within a couple of minutes."
echo "Change its Wi-Fi on Admin > Receipts. If none of them is in range, join \"$SETUP_SSID\" (password $SETUP_PASSWORD) on your phone."
echo "Logs: journalctl -u print-bridge -u stand-watch -f"
