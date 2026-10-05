import { statusInfo } from "@/lib/orders/status";
import { cn } from "@/lib/cn";

const tone: Record<string, string> = {
  PAID: "bg-sand/20 text-sand",
  QUEUED: "bg-accent-soft text-accent-text",
  PRINTING: "bg-accent text-accent-ink",
  POST_PROCESSING: "bg-seafoam/20 text-seafoam",
  READY_FOR_PICKUP: "bg-success/20 text-success",
  PICKED_UP: "bg-surface-strong text-muted",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", tone[status] ?? tone.PICKED_UP, className)}>{statusInfo(status).label}</span>;
}
