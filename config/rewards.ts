/**
 * Coastline Rewards. Points are earned on print orders when they're picked
 * up, and traded for prizes on /rewards. Prizes become one-use coupons (or a
 * gift card) saved to the customer's account.
 */
export const POINTS_PER_DOLLAR = 2;
/** Days a prize coupon can be used for. */
export const PRIZE_DAYS = 180;

export type Prize = {
  id: string;
  points: number;
  title: string;
  blurb: string;
  /** "coupon": dollars off, locked to the account. "order-fee": dollars off equal to the current order fee. "gift-card": a gift card they can give away. */
  kind: "coupon" | "order-fee" | "gift-card";
  valueCents?: number;
};

export const prizes: Prize[] = [
  { id: "five-off", points: 200, kind: "coupon", valueCents: 500, title: "$5 off", blurb: "Five dollars off your next order." },
  { id: "free-fee", points: 300, kind: "order-fee", title: "Skip the order fee", blurb: "We cover the order fee on your next order." },
  { id: "fifteen-off", points: 500, kind: "coupon", valueCents: 1500, title: "$15 off", blurb: "Fifteen dollars off your next order." },
  { id: "gift-ten", points: 700, kind: "gift-card", valueCents: 1000, title: "$10 gift card", blurb: "A gift card to give a friend. Share the number and PIN." },
  { id: "thirty-off", points: 900, kind: "coupon", valueCents: 3000, title: "$30 off", blurb: "Thirty dollars off a bigger print." },
  { id: "sixty-off", points: 1500, kind: "coupon", valueCents: 6000, title: "$60 off", blurb: "Sixty dollars off. Go big." },
];

/**
 * Invite a friend. Every account has one invite code to share. The friend
 * gets money off their first order; the person who invited them gets points
 * as soon as that order is paid.
 */
export const invite = {
  /** Off the friend's first order (prints only, like any coupon). */
  friendCents: 500,
  /** For the person who shared the code, once their friend orders. */
  points: 200,
};
