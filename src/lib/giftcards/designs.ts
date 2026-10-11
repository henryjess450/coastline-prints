/**
 * Gift card designs. Every card works everywhere on the site, whatever it
 * looks like: Coastline prints, the Coastline shop and LightLab | Victoria.
 */
export const GIFT_DESIGNS = ["coastline", "holiday"] as const;
export type GiftDesign = (typeof GIFT_DESIGNS)[number];

export const giftDesigns: Record<GiftDesign, { label: string; blurb: string }> = {
  coastline: { label: "Coastline Prints", blurb: "Navy, all year round" },
  holiday: { label: "Holiday", blurb: "Red and gold, wrapped as a present they open on the site" },
};

/** What every gift card can be spent on. */
export const GIFT_WORKS_ON = "custom prints, the Coastline shop and LightLab | Victoria lamps";

export const designOf = (d: string | null | undefined): GiftDesign => ((GIFT_DESIGNS as readonly string[]).includes(d ?? "") ? (d as GiftDesign) : "coastline");

/** The holiday design is offered from October 1 to January 6 (shop days, "YYYY-MM-DD"). */
export const holidaySeason = (today: string) => today.slice(5) >= "10-01" || today.slice(5) <= "01-06";
