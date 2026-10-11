import { notFound } from "next/navigation";
import { GiftReveal } from "@/components/gifts/GiftReveal";
import { designOf } from "@/lib/giftcards/designs";

export const metadata = { title: "Gift reveal preview", robots: { index: false } };

/** DEV ONLY: the recipient's "open your gift" page with sample details. ?design=holiday|coastline. 404 in production. */
export default async function Page({ searchParams }: { searchParams: Promise<{ design?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const design = designOf((await searchParams).design ?? "holiday");
  return (
    <GiftReveal
      orderHref="/order"
      gift={{ design, amount: "$55.00", number: "1234 5678 1234 5678", pin: "CP12345", recipientFirst: "Jordan", buyerName: "Sam Rivera", message: "Merry Christmas! Print something awesome." }}
    />
  );
}
