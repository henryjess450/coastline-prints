#!/usr/bin/env bash
# Sets up a Raspberry Pi (Raspberry Pi OS Bookworm, Lite is fine) as the
# print bridge for the Star receipt printer:
#   - the printer plugs into the Pi's ethernet port; the Pi hands it an address
#   - the Pi joins your phone's hotspot (and any other Wi-Fi you add)
#   - the bridge starts on boot and prints whatever the register sends
#
#   curl -fsSL https://coastlineprints.ca/print-bridge/setup-pi.sh | sudo bash -s -- pb_YOURKEY
#
# Run it again any time to update the bridge or add another Wi-Fi network.
set -euo pipefail

KEY="${1:-}"
SERVER="${SERVER:-https://coastlineprints.ca}"
if [[ "$KEY" != pb_* ]]; then echo "Pass the bridge key from Admin > Receipts: ... | sudo bash -s -- pb_..."; exit 1; fi
if [[ $EUID -ne 0 ]]; then echo "Run with sudo."; exit 1; fi

echo "== Installing Node and the DHCP helper"
apt-get update -qq
apt-get install -y -qq nodejs dnsmasq-base curl >/dev/null
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if (( NODE_MAJOR < 18 )); then echo "Node $NODE_MAJOR is too old (need 18+). Use Raspberry Pi OS Bookworm or newer."; exit 1; fi

echo "== Installing the bridge"
mkdir -p /opt/print-bridge
curl -fsSL "$SERVER/print-bridge/print-bridge.mjs" -o /opt/print-bridge/print-bridge.mjs
umask 077
printf 'BRIDGE_KEY=%s\nSERVER=%s\n' "$KEY" "$SERVER" > /etc/print-bridge.env
umask 022

cat > /etc/systemd/system/print-bridge.service <<EOF
[Unit]
Description=Receipt printer bridge
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=/etc/print-bridge.env
ExecStart=$(command -v node) /opt/print-bridge/print-bridge.mjs
Restart=always
RestartSec=5
DynamicUser=yes

[Install]
WantedBy=multi-user.target
EOF

echo "== Ethernet port for the printer"
ETH=$(nmcli -t -f DEVICE,TYPE device | awk -F: '$2=="ethernet"{print $1; exit}')
if [[ -z "$ETH" ]]; then
  echo "No ethernet port found. On a Pi Zero, plug in the USB ethernet adapter and run this again."
else
  nmcli con delete printer-lan >/dev/null 2>&1 || true
  # "shared": the Pi runs a tiny DHCP server on this port, so the printer gets an address by itself.
  nmcli con add type ethernet ifname "$ETH" con-name printer-lan ipv4.method shared ipv6.method disabled connection.autoconnect yes >/dev/null
  nmcli con up printer-lan >/dev/null 2>&1 || true
  echo "   $ETH is ready for the printer."
fi

echo "== Wi-Fi"
echo "   Add your hotspot (iPhone: turn on Maximize Compatibility). Leave the name blank to finish."
while true; do
  read -r -p "   Wi-Fi name: " SSID </dev/tty || break
  [[ -z "$SSID" ]] && break
  read -r -s -p "   Password: " PSK </dev/tty; echo
  nmcli con delete "wifi-$SSID" >/dev/null 2>&1 || true
  nmcli con add type wifi ifname wlan0 con-name "wifi-$SSID" ssid "$SSID" wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$PSK" connection.autoconnect yes >/dev/null
  echo "   Saved $SSID."
done

systemctl daemon-reload
systemctl enable --now print-bridge >/dev/null
systemctl restart print-bridge
echo
echo "Done. The bridge starts on boot. Check Admin > Receipts: it should say online within a minute."
echo "Logs: journalctl -u print-bridge -f"
