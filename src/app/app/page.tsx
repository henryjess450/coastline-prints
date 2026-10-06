import type { Metadata } from "next";
import { GetTheApp } from "@/components/app/GetTheApp";

export const metadata: Metadata = {
  title: "Get the app",
  description: "Add Coastline Prints to your phone's home screen: start orders, check on them, and keep your gift cards and coupons one tap away.",
};

export default function AppPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
      <GetTheApp />
    </div>
  );
}
