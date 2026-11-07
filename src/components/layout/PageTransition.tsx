"use client";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

/** Each page fades and rises in a little when you navigate to it. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  // LightLab cross-fades its pages with a view transition instead (app/lightlab/layout.tsx).
  if (usePathname().startsWith("/lightlab")) return <>{children}</>;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}
