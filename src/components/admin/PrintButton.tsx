"use client";
import { useFormStatus } from "react-dom";
import { toast } from "@/components/ui/Toast";

/** A small form button for the print server actions; confirms with a toast. */
export function PrintButton({
  action,
  name,
  value,
  className,
  children,
  label,
}: {
  action: (form: FormData) => Promise<void>;
  name: string;
  value: string;
  className?: string;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <form
      action={async (form) => {
        await action(form);
        toast("Sent to the printer");
      }}
    >
      <input type="hidden" name={name} value={value} />
      <Submit className={className} label={label}>
        {children}
      </Submit>
    </form>
  );
}

function Submit({ className, label, children }: { className?: string; label?: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-label={label} className={className}>
      {pending ? "Sending…" : children}
    </button>
  );
}
