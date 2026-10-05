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
