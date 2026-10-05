# Coastline Prints

Custom 3D printing commissions: customers upload STL files, size them in a live 3D
viewer, pick material, colour and a pickup time, see the exact price, and pay with
Square. The order is only created once the payment succeeds; the customer gets a
receipt and the owner gets a new-order email.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Framer Motion,
three.js (React Three Fiber), Prisma 7 + SQLite, Square Web Payments, Nodemailer (Gmail).

## Run it with Docker (recommended)

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
git clone https://github.com/henryjess450/coastline-prints.git
cd coastline-prints
cp .env.example .env        # then fill in your values
docker compose up -d --build
```

On Windows, instead of `cp`, run this to create `.env` by answering a few questions:

```powershell
powershell -ExecutionPolicy Bypass -File windows\new-env.ps1
```

- Site on the PC: <http://localhost:3100>
- Public site (after DNS + port forwarding, see below): <https://coastlineprints.ca>
- Logs: `docker compose logs -f app`
- Stop: `docker compose down` (your data is kept)
- Update to the latest code: `git pull` then `docker compose up -d --build`
- Backup: `docker compose exec app npm run backup` (files appear in `./backups`)

The `caddy` service answers on ports 80/443 and gets the HTTPS certificate
automatically. For that to work the domain's A record must point at your public IP
and your router must forward TCP 80 and 443 to the PC. Edit `docker/Caddyfile` to
change the domain.

## Admin dashboard

Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env`, restart, then go to `/admin`.
Orders, status pipeline (moving an order to "Ready for pickup" emails the customer),
printer queues, STL downloads with 3D preview, and pricing/colour settings.
Customers check progress at `/status` with their order number and email.

## Configuration

| What | Where |
| --- | --- |
| Passwords, keys, pickup address, emails | `.env` (copy from `.env.example`, never commit it) |
| Prices, markup, minimum order | `config/pricing.ts` |
| Materials and colours | `config/materials.ts` |
| Printers and build volumes | `config/printers.ts` |
| Pickup hours and closed days | `config/pickup.ts` |
| Business name, legal page values | `config/site.ts` |

Account setup (Gmail App Password, Square keys and webhook): see [SETUP.md](SETUP.md).
Running without Docker on Windows: see [WINDOWS.md](WINDOWS.md).

## Development

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev          # http://localhost:3000
npm test             # unit + integration tests (uses a separate test database)
```

Without Gmail settings, development emails are written to `storage/email-previews/`
instead of being sent. Preview templates at `/api/dev/emails?template=customer-receipt`.

### Square sandbox testing

Set `SQUARE_ENVIRONMENT="sandbox"` with sandbox keys. Test card `4111 1111 1111 1111`,
any future expiry, CVV `111`. With sandbox keys in `.env`, `npm test` also runs a real
end-to-end sandbox charge.
