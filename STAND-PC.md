# Stand PC: the hands-off print box

A spare PC (the black Lenovo ThinkCentre Tiny) replaces the Mac at markets. Once set up, nobody touches it: plug in power, and it prints receipts.

```
 phone hotspot / venue Wi-Fi ──► USB Wi-Fi adapter ─┐
                                                    PC (Debian, print bridge) ──ethernet──► Star TSP654II
 iPad register ──► coastlineprints.ca ◄── bridge long-polls ┘
```

- The register queues the receipt on coastlineprints.ca; the bridge on the PC fetches it and sends it to the printer on port 9100. So the PC and the iPad only need internet, not the same network.
- The PC joins a saved Wi-Fi (your phone's hotspot or a venue's). A phone plugged in by USB with tethering on works too, with no setup.
- If it can't get online for 90 s, it opens its own Wi-Fi, **LightLab Stand Setup** (password `lightlab-stand`). Join it from your phone, and a page pops up where you add the venue's Wi-Fi and see whether the printer is found. Nobody needs a keyboard or a screen on the PC.
- The printer gets an address from the PC on the ethernet port (`192.168.77.10`–`.20`). The PC also listens on Star's fallback subnet (`192.168.192.x`), so a printer with a static address there is found too.

## What runs on it

| Piece | What it does |
| --- | --- |
| `print-bridge.service` | `public/print-bridge/print-bridge.mjs`, the same bridge the Mac and Pi run. Restarts 5 s after any crash and once a day. |
| `stand-watch.service` | `stand-watch.sh`: joins saved Wi-Fi, opens the setup hotspot when it can't, reconnects if the site is unreachable for 10 min. |
| `stand-portal.service` | `stand-portal.mjs`: the setup page, only on the setup hotspot (10.42.0.1). |
| `stand-update.timer` | Every 4 h and 3 min after boot: downloads the three files above from the site, checks they parse, swaps them in, restarts what changed. Pushing a bridge change to main updates every stand PC. |
| Watchdog | The PC's hardware watchdog reboots it if Linux freezes; kernel panic reboots after 10 s; sleep is disabled; the disk repairs itself after a power cut (`fsck.repair=yes`) instead of stopping at a maintenance prompt. |
| Updates | Debian security updates install by themselves (no automatic reboots; they take effect at the next power-up). |

The installer is `public/print-bridge/setup-stand-pc.sh`. It is safe to run again; it keeps saved Wi-Fi and the bridge key.

## What you need

- The PC, its power brick, and the printer's ethernet cable.
- **A USB Wi-Fi adapter that can run a hotspot on Linux.** The PC has no Wi-Fi. Get a MediaTek one: **Alfa AWUS036ACM** (MT7612U) or **Alfa AWUS036AXML** (MT7921AU). Both work out of the box on Debian. Avoid Realtek-based dongles (often no hotspot mode, or need extra drivers).
- A USB stick (2 GB or more) for the installer, and for setup only: a monitor, a USB keyboard, and an ethernet cable to your home router.

## Setup (once, at home, about 30 minutes)

### 1. BIOS (power on, tap **F1**)

- **Power → After Power Loss → Power On.** This is what makes it start by itself when the stand's power comes on.
- If there's a **Keyboardless operation** option, turn it on, so it doesn't stop at a "no keyboard" error.
- Save and exit (F10).

This wipes Windows 10 (out of support since October 2025). Copy off anything you want to keep first.

### 2. Make the installer USB (on the Mac)

1. Download the Debian 13 "netinst" ISO for **amd64** from debian.org (the big download button on the front page).
2. Flash it to the USB stick with balenaEtcher (or Raspberry Pi Imager → "Use custom").

### 3. Install Debian

Plug the PC's ethernet into your router, plug in the USB stick, power on, tap **F12**, pick the USB stick.

- Choose **Install** (not Graphical install, either works).
- Language English, location Canada, keyboard American English.
- Hostname `lightlab-stand`, domain blank.
- **Root password: leave it blank** (press Enter twice). That gives your user `sudo`.
- Full name and username: `stand`. Pick a password and keep it somewhere safe.
- Partitioning: **Guided - use entire disk** → **All files in one partition** → Finish → Yes.
- Package mirror: Canada, deb.debian.org.
- **Software selection: untick "Debian desktop environment" and "GNOME". Tick "SSH server" and "standard system utilities".**
- Install GRUB to the main disk: Yes, pick the disk (not the USB stick).
- Remove the USB stick when it says the install is complete, and let it restart.

### 4. Run the setup command

1. On the PC, log in as `stand` and run `ip -br a`. Note the address on the ethernet line (like `10.0.0.73`).
2. On the Mac, open **Admin > Receipts**, make a bridge key, and copy the **Stand PC** command.
3. On the Mac: `ssh stand@10.0.0.73` (use the address from step 1), then paste the command. Copying beats typing a 35-character key.
4. It asks for Wi-Fi names and passwords. Add your phone's hotspot (iPhone: turn on **Maximize Compatibility**) and any venue Wi-Fi you already know. Leave the name blank to finish. Add more later from your phone (below).
5. When it says Done: **unplug the PC from the router**, then `sudo reboot`. From now on its ethernet port hands out addresses for the printer, so never plug it into a router again.
6. Unplug the monitor and keyboard. They're not needed again.

### 5. Test it at home

1. Plug the printer's ethernet into the PC, plug in the USB Wi-Fi adapter, turn on your phone's hotspot, power on the PC and the printer.
2. Within about 2 minutes **Admin > Receipts** says the bridge is online and the printer is found. Print a test receipt.
3. Turn the hotspot off. After about 2 minutes **LightLab Stand Setup** appears in your phone's Wi-Fi list. Join it (password `lightlab-stand`); the setup page opens. Then turn the hotspot back on: within ~5 minutes the PC goes back to it.
4. Pull the PC's power plug mid-way and plug it back in: it should come back on and be online again in about 2 minutes.

## At a market (the checklist)

1. Plug in the printer and the PC (printer cable into the PC, Wi-Fi adapter in a USB port).
2. Turn on your phone's hotspot, or nothing if the venue's Wi-Fi is already saved.
3. Open the register on the iPad. Admin > Receipts shows the bridge online in about 2 minutes.
4. New venue Wi-Fi? Wait 2 minutes, join **LightLab Stand Setup** on your phone, pick the venue's network, type the password, **Save and join**. Your phone drops off; that's normal.
5. No Wi-Fi at all? Plug your phone into the PC by USB and turn on Personal Hotspot / USB tethering. (iPhone: tap **Trust** the first time.)
6. To shut down: press the PC's power button once (it shuts down cleanly), or just pull the plug; it handles that too.

Venue Wi-Fi that needs a sign-in page (accept terms in a browser) won't work: the PC can't click through. Use your phone's hotspot there.

## Fixing things

From the Mac, on the same Wi-Fi as the PC (e.g. both on your hotspot): `ssh stand@lightlab-stand.local`

```bash
journalctl -u print-bridge -u stand-watch -f   # what it's doing
sudo systemctl restart print-bridge            # restart the bridge
nmcli con show                                 # saved Wi-Fi
sudo nmcli dev wifi connect "Name" password "Pass"  # add Wi-Fi by hand
sudo stand-update                              # pull the latest bridge now
```

New bridge key (if you made one on Admin > Receipts): re-run the setup command with the new key; it replaces the old one and keeps the Wi-Fi.

On the setup hotspot, the PC is also at `ssh stand@10.42.0.1`.
