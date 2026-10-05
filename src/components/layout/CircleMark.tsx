import { useId } from "react";

/** The circle wave mark on its own. Pass a label to make it announce; otherwise it's decorative. */
export function CircleMark({ size = 36, label, className }: { size?: number; label?: string; className?: string }) {
  const id = `mark${useId().replace(/[^\w-]/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} {...(label ? { role: "img", "aria-labelledby": id } : { "aria-hidden": true })}>
      {label && <title id={id}>{label}</title>}
      <circle cx="16" cy="16" r="15" fill="#0e4471" />
      <path d="M5 17c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 6.6 0 2.2 2 2.2 2" stroke="#ffffff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M7 22.5c1.8-1.5 3.6-1.5 5.4 0s3.6 1.5 5.4 0 3.6-1.5 5.4 0" stroke="#86bbea" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="21.5" cy="10" r="3" fill="#e9c46a" />
    </svg>
  );
}
