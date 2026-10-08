import { notFound } from "next/navigation";
import { EtransferPreview } from "./EtransferPreview";

export const metadata = { title: "e-Transfer preview", robots: { index: false } };

/** DEV ONLY: the "send your e-Transfer" waiting screen with sample details. 404 in production. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      <EtransferPreview />
    </div>
  );
}
