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
};
