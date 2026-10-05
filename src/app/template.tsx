import { PageTransition } from "@/components/layout/PageTransition";

// Remounts on every top-level route change, so each page gets the soft entrance.
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
