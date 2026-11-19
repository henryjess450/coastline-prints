"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { lockedOn } from "@/lib/pos/lock";
import { markStaff, staffOn } from "@/lib/pos/staff";

/** On an iPad locked to staff mode (or a locked register), any admin page other than the register sends it back to the register. */
export function StaffGuard() {
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    const on = staffOn() || lockedOn();
    markStaff(on);
    if (on && path !== "/admin/pos") router.replace("/admin/pos");
  }, [path, router]);
  return null;
}
