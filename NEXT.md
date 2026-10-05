# Coastline Prints: what's next

Paste this whole file into a new Claude Code chat opened in `LightLabProduction/Claude`.

## Context for the new chat

- Project: `toylab-commissions/` (Next.js 16 App Router, Tailwind 4, Framer Motion, React Three Fiber,
  Prisma 7 + SQLite, Square, Gmail). Public repo: github.com/henryjess450/coastline-prints.
- Live at https://coastlineprints.ca, running in Docker on the owner's Windows PC
  (`C:\coastline-prints`, update with `git pull` then `docker compose up -d --build`).
- Read `AGENTS.md`, `README.md` and the project memory before changing anything.
- Design rules: brand navy `#0e4471`, solid colours only (no gradients), pill buttons with the
  lift + squash animation, no em dashes anywhere, plain specific copy (nothing vague or
  AI-sounding), hand-drawn wordmark in `public/brand/`, circle wave mark stays.
- Never commit `.env`, the database, or the pickup address. `.env` has LIVE Square keys:
  never run real checkouts locally. Dev mode previews emails and receipts instead of sending.

## 1. Rework the home page (owner's priority)

Goals: show what Coastline Prints makes, make starting an order feel effortless, keep it honest.

- **Hero:** replace the stacked-blocks illustration with a live, slowly rotating 3D print
  (React Three Fiber, a sample STL in the brand navy) that "prints in" layer by layer on load.
  Keep the headline short and concrete. Primary button: Start an order. Secondary: Find a model.
- **Drop zone on the home page:** drag an STL anywhere on the hero to jump straight into the
  order flow with that file already loaded.
- **"What we've printed" gallery:** a grid of real photos of past prints (owner to supply),
  with material and colour under each. Hover lifts the card.
- **How it works:** turn the 4 steps into a short scroll-driven sequence (upload, size, pay,
  pick up) with a small animated illustration for each.
- **Live price example:** a tiny interactive slider ("make it bigger") that updates a real
  price from the pricing engine, instead of the static example table.
- **Materials:** swatch row per material using the real colour list; tap a swatch to see it
  on a small 3D sample.
- **Pickup info:** pickup hours and "ready in 2 to 5 days" in one clear strip (no address).
- **Gift cards:** a section mentioning gift cards and coupons exist (owner decides wording).
- **Footer:** add the circle mark, and hand-lettered "Questions or concerns?" from
  `public/brand/lettering/`.

## 2. More little animations (site-wide)

All must respect `prefers-reduced-motion`.

- Page transitions: soft fade/slide between routes.
- Buttons: the squash on click already exists; add a tiny ripple or "press" sound-free bounce
  on success states (Apply code, Save, Pay).
- Number tickers: the total already tweens; do the same for quantity, dimensions and the
  admin dashboard counts.
- Upload: file cards fly into the list; progress ring fills with a wave pattern.
- 3D viewer: gentle idle bob when not interacting; camera eases when switching files.
- Checkout: pickup day chips stagger in; selected time slot pops; code chips wobble when
  added and shake when rejected.
- Confirmation: confetti exists; add the circle mark's waves animating once.
- Status page: the timeline draws in (exists); add a pulsing dot for the current step.
- Admin: status pill morphs between steps; toast notifications slide in for saved/printed.
- Scroll reveals on the home page sections (staggered, short distance, fast).
- Hover states on cards, swatches and gallery items (lift + shadow, 150 to 200 ms).

## 3. Refine and polish (Phase 6 leftovers)

- Mobile pass on every page (checkout and admin especially) at 375 px wide.
- Accessibility pass: keyboard through the whole order flow, focus rings, screen reader
  labels on the 3D viewer and code box, colour contrast in both themes.
- Social share image (Open Graph) and better page titles/descriptions for search.
- End-to-end test of the full order flow (Playwright) using Square sandbox keys.
- Repeat customers: owner still has to choose a perk (e.g. 10% off every 5th order, or a
  thank-you coupon emailed after pickup). Build it once decided.
- Emails: use the hand lettering and circle mark in the email header.
- Automatic nightly backup inside Docker, copied to a second drive.
- Dynamic DNS so the site survives the home IP changing.
- Content Security Policy header.
- Confirm the Square webhook is set up on the Production side and that a real $1 order
  works end to end (then refund it).

## Suggested order

1. Home page rework (with scroll reveals and hero animation).
2. Site-wide micro-animations.
3. Mobile and accessibility pass.
4. The remaining polish items.
