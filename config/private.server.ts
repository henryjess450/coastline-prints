/**
 * Server-only settings. `server-only` makes the build fail if a client
 * component ever imports this, so the pickup address can't leak into
 * public page bundles.
 */
import "server-only";

// The real pickup address lives only in .env (PICKUP_ADDRESS), never in the code.
export const privateSite = {
  pickupAddress: process.env.PICKUP_ADDRESS || "Pickup address not set (add PICKUP_ADDRESS to .env)",
  ownerEmail: process.env.OWNER_EMAIL ?? "coastline.printz@gmail.com",
  /**
   * The return address on shipping labels, lines split with "|", e.g.
   * SHIP_FROM_ADDRESS="123 Main St|Victoria BC  V8W 1A1". The business name
   * is added above it. Empty means not set up yet.
   */
  returnAddress: (process.env.SHIP_FROM_ADDRESS ?? "").split("|").map((l) => l.trim()).filter(Boolean),
};
