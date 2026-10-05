# Running Coastline Prints on a Windows PC

The site runs on your PC on port **3100** (only reachable from the PC itself).
**Caddy** (free) sits in front of it: it answers `https://comissions.henryjess.ca`
on ports 80/443, gets and renews the HTTPS certificate automatically, and passes
visitors through to the site. Your router forwards ports 80 and 443 to the PC.

HTTPS is required: Square's card form won't load without it, and Square only
sends webhooks to https addresses.

## 1. Install Node.js (once)

Download the **LTS** version (24.x) "Windows Installer (.msi)" from <https://nodejs.org>
and install with the default options. LTS matters: the database driver ships
ready-made for LTS versions.

## 2. Copy the site to the PC

1. Unzip `coastline-prints-windows.zip` to `C:\CoastlinePrints`.
2. Copy your `.env` file into `C:\CoastlinePrints` too. It isn't in the zip because it
   holds your Square and Gmail passwords, so move it by USB stick, not email or cloud.

## 3. Set up and start

1. Double-click `windows\1-setup.bat`. It installs, creates the database and builds
   the site (a few minutes). It should end with "Setup complete".
2. Double-click `windows\2-start.bat`. Leave that window open (minimise it).
   It restarts the site automatically if it ever crashes.
3. On the PC, open <http://localhost:3100>. You should see the site.

## 4. Put it online: port forwarding + Caddy (once)

**a. Give the PC a fixed address on your network.** In your router's settings, find
DHCP reservation (sometimes "static lease" or "address reservation") and reserve
the PC's current IP (run `ipconfig` in Command Prompt, look for IPv4 Address,
e.g. `192.168.1.50`).

**b. Forward the ports.** In the router's Port Forwarding section, add two rules to
that IP:

| Name | External port | Internal port | Protocol |
| --- | --- | --- | --- |
| Coastline HTTP | 80 | 80 | TCP |
| Coastline HTTPS | 443 | 443 | TCP |

Do **not** forward 3100.

**c. Point the domain at your home.** Find your public IP at <https://whatismyipaddress.com>.
Where you manage DNS for `henryjess.ca`, add an **A record**: name `comissions`, value
= that IP. Most home internet IPs change occasionally; if your registrar offers
Dynamic DNS, turn it on, otherwise update this record if the site goes offline.

**d. Install Caddy.** Download **Windows amd64** from <https://caddyserver.com/download>,
rename the file to `caddy.exe` and put it in `C:\CoastlinePrints\windows\`.
`windows\Caddyfile` is already set up for `comissions.henryjess.ca`.

**e. Start it.** With `2-start.bat` running, double-click `windows\4-start-caddy.bat`.
When Windows Firewall asks, click **Allow** (Private and Public). The first start
fetches the HTTPS certificate (takes up to a minute). Then visit
<https://comissions.henryjess.ca> from your phone **on mobile data** (Wi-Fi at home
sometimes can't reach your own public address).

If the certificate step fails, the window says why. Most often: the A record hasn't
updated yet (wait 10 minutes), the router rules aren't saved, or your internet
provider blocks ports 80/443 (call them, or ask about a business plan).

**Security basics, since the PC is exposed:** keep Windows Update on, use a strong
Windows password, and only forward 80 and 443. The site itself only accepts
connections from Caddy on the same PC.

## 5. Start automatically when the PC turns on

Create **two** tasks, one for the site and one for Caddy:

1. Open **Task Scheduler** → **Create Task…**
2. General: name `Coastline Prints`, tick **Run with highest privileges**.
3. Triggers → New → **At log on** (your user).
4. Actions → New → Program: `C:\CoastlinePrints\windows\2-start.bat`,
   Start in: `C:\CoastlinePrints`
5. Settings: untick **Stop the task if it runs longer than 3 days**.
6. Repeat for `Coastline Caddy` with `C:\CoastlinePrints\windows\4-start-caddy.bat`
   (Start in: `C:\CoastlinePrints\windows`).
7. Windows Settings → System → Power: set **Sleep** to **Never** (when plugged in).

## 6. Square webhook (once the site is online)

Your `.env` uses **Production** keys, so set this up on the **Production** side of the
Square Developer Console (see `SETUP.md` section 3):

- Name: `Coastline Prints payments`
- Notification URL: `https://comissions.henryjess.ca/api/webhooks/square`
- API version: `2026-09-16`
- Events: `payment.created`, `payment.updated`

Make sure the Signature Key in `.env` (`SQUARE_WEBHOOK_SIGNATURE_KEY`) is the one from
this **Production** subscription, then restart the site.

## Backups

Double-click `windows\3-backup.bat` (safe while the site is running). It copies the
database and uploaded files into `C:\CoastlinePrints\backups\<date>`. Copy that folder
somewhere else (USB stick or cloud drive) regularly. It contains customer details,
so keep it private.

## Updating to a new version

1. Close the `2-start.bat` window.
2. Unzip the new version over `C:\CoastlinePrints` (keep your `.env`, `coastline.db`,
   `storage` and `backups`. The zip never contains them, so they're safe).
3. Run `windows\1-setup.bat`, then `windows\2-start.bat`.

## If something goes wrong

- **Site down:** are both the `2-start.bat` and `4-start-caddy.bat` windows open? Check them for red error text.
- **Works at http://localhost:3100 but not online:** check the A record, the router rules, and the Caddy window.
- **Setup fails installing `better-sqlite3`:** you're probably on a non-LTS Node.js.
  Install the 24.x LTS and run setup again.
- **Emails not arriving:** check `GMAIL_APP_PASSWORD` in `.env`, then restart.
  Failed emails are retried automatically for about a day.
