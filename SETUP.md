# Coastline Prints: account setup

All of these go in `toylab-commissions/.env`. Never paste them into chat, email or git.
Restart the site after changing `.env`.

## 1. Gmail (sending order emails)

Emails are sent from the Gmail account in `GMAIL_USER` using an **App Password**
(a separate 16-character password just for this website, not your normal password).

1. Sign in to Google as **coastline.printz@gmail.com**.
2. Go to <https://myaccount.google.com/security> and turn on **2-Step Verification**
   (App Passwords only appear once this is on).
3. Go to <https://myaccount.google.com/apppasswords>.
4. App name: `Coastline Prints website` → **Create**.
5. Copy the 16-character password Google shows (you only see it once).
6. In `.env`:
   ```
   GMAIL_USER="coastline.printz@gmail.com"
   GMAIL_APP_PASSWORD="abcd efgh ijkl mnop"
   ```
7. Restart the site. Queued emails send within a minute.

If the password ever leaks, delete it on the same App Passwords page and make a new one.
Gmail allows about 500 emails a day, which is plenty for this shop.

## 2. Square

Developer Console: <https://developer.squareup.com/apps> → **Open** your app.
The **Sandbox / Production** switch at the top of the console decides which set of
keys you're looking at. Use **Sandbox** while testing (no real money moves).

| `.env` setting | Where to find it |
| --- | --- |
| `SQUARE_ENVIRONMENT` | `sandbox` for testing, `production` when live |
| `SQUARE_APPLICATION_ID` | **Credentials** → Application ID (sandbox ones start with `sandbox-sq0idb-`) |
| `SQUARE_ACCESS_TOKEN` | **Credentials** → Access token → Show |
| `SQUARE_LOCATION_ID` | **Locations** → copy the location's ID |

Sandbox test cards (any future expiry, any postal code):
`4111 1111 1111 1111` CVV `111` (approved). Declines: `4000 0000 0000 0002`.

## 3. Square webhook (backup that creates orders if the customer closes the tab)

Needs the site to be online at a public **https** address, so do this when you deploy.
Create one subscription in Sandbox and another in Production (each has its own key).

1. In the console: left menu **Webhooks** → **Subscriptions** → **Add subscription**.
2. **Name**: `Coastline Prints payments`
3. **Notification URL**: `https://YOUR-DOMAIN/api/webhooks/square`
4. **API version**: `2026-09-16` (the version this site's Square library uses)
5. **Events**: tick `payment.created` and `payment.updated`
6. **Save**, then click the subscription name → **Endpoint Details** → **Signature Key** → **Show** → copy.
7. In `.env` (the URL must match what you typed in step 3 exactly):
   ```
   SQUARE_WEBHOOK_SIGNATURE_KEY="the key you copied"
   SQUARE_WEBHOOK_URL="https://YOUR-DOMAIN/api/webhooks/square"
   ```

## 4. Pickup schedule

Edit `config/pickup.ts`: open hours per weekday, the earliest pickup (days after ordering)
and `closedDates` for days you're away (`"2026-12-25"`).

## 5. Shipping (Canada Post)

Shipping works with no setup: bubble mailers (Lettermail, no tracking) and flat rate
boxes (tracked) cost the same anywhere in Canada. Prices, the $2 packing fee, padding and
mailer size are in `config/shipping.ts`. Set `enabled: false` there to go back to pickup only.

Optional: **tracked bubble mailers** (prints too thick for Lettermail, up to 5 cm, or customers who
want tracking on a mailer) are priced live by distance, so they need Canada Post API keys. The same
keys make the tax on postage live:

1. Sign up for a free Canada Post business account, then join the Developer Program
   (canadapost-postescanada.ca → Business → Developers) to get an API username and password.
2. Add to `.env` (never commit it):
   ```
   CANADA_POST_USERNAME="..."
   CANADA_POST_PASSWORD="..."
   CANADA_POST_FROM_POSTAL="A1A 1A1"   # the postal code you mail from; never shown on the site
   ```
3. Restart. Until all three are set, the tracked-mailer option is simply hidden.

Shipping prices include the tax Canada Post charges on postage (GST in BC; never PST). With the keys
set, the rate is read live from Canada Post twice a day, so a GST change (or a move to HST) follows
through on its own. Without keys it uses the `tax` fallback in `config/shipping.ts` (5% GST).
The packing fee isn't taxed.

Street address suggestions at checkout come from Photon (photon.komoot.io, OpenStreetMap data).
No key needed; only the typed text is sent, from the server.

## 6. Interac e-Transfer payments (optional)

Customers can pay by e-Transfer (with a discount, set in `config/payments.ts`). Checkout gives them
a code like `PAY-7K4QX` to put in the e-Transfer message, then waits. The site reads the deposit
email Interac sends you and confirms the order on its own, usually within a minute.

1. In Scotiabank, turn on **Autodeposit** for the address customers will send to (e.g. sales@henryjess.ca).
   Autodeposit is what makes the money land without a security question.
2. Make sure Interac's emails reach a mailbox the site can read. Here they're forwarded to hello@henryjess.ca (Titan).
3. Add to `.env` (or run `windows\update-env.ps1` to add the empty settings, then fill them in):
   ```
   ETRANSFER_EMAIL="sales@henryjess.ca"        # shown to customers: where to send it
   ETRANSFER_IMAP_HOST="imap.titan.email"
   ETRANSFER_IMAP_PORT="993"
   ETRANSFER_IMAP_USER="hello@henryjess.ca"    # the mailbox the Interac emails land in
   ETRANSFER_IMAP_PASSWORD="..."               # that mailbox's password
   ```
4. Restart (`docker compose up -d --build`). The e-Transfer option appears at checkout.
5. Send yourself a $1 e-Transfer with any message, then check what the site reads:
   ```
   docker compose exec app npx tsx --conditions=react-server scripts/etransfer-check.mts
   ```
   Each Interac email shows the amount, sender, message, and whether it's "signed by Interac".
   If it says "not read as a deposit" or "signed by Interac: NO", send Claude that output.

Only emails with a valid Interac signature (DKIM) confirm orders on their own. Anything doubtful
(no signature, short payment, unknown code, more than one possible order) shows up under
**Admin → e-Transfers** for you to confirm after checking your bank. Waiting orders can also be
marked received by hand there. Unpaid e-Transfer orders cancel after 2 hours.
