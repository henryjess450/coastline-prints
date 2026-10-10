"use client";
import { useActionState, useState } from "react";
import { archiveOrderAction, deleteOrderAction, type ActionState } from "@/app/admin/actions";
import { cn } from "@/lib/cn";

/**
 * Archive an order (tuck it away from the boards; undoable), and, once it's
 * archived, delete it for good by typing its number.
 */
export function OrderHousekeeping({ orderId, orderNumber, archived }: { orderId: string; orderNumber: string; archived: boolean }) {
  const [state, del, pending] = useActionState<ActionState, FormData>(deleteOrderAction, {});
  const [typed, setTyped] = useState("");
  return (
    <div className="space-y-4 text-sm">
      <form action={archiveOrderAction} className="flex flex-wrap items-center justify-between gap-3">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="archive" value={archived ? "0" : "1"} />
        <p className="text-muted">{archived ? "Archived: hidden from Today, the board and the lists. The customer still sees it." : "Done with it? Archive it to clear it off your boards. You can bring it back."}</p>
        <button type="submit" className="rounded-full border border-line px-4 py-2 font-medium hover:border-accent-line">
          {archived ? "Bring it back" : "Archive"}
        </button>
      </form>
      {archived && (
        <form action={del} className="space-y-2 rounded-2xl border border-danger/40 bg-danger/5 p-4">
          <p className="font-semibold text-danger">Delete for good</p>
          <p className="text-muted">Removes the order, its items and its history. This can&apos;t be undone. The payment record and any points it earned stay. Type {orderNumber} to confirm.</p>
          <input type="hidden" name="orderId" value={orderId} />
          <div className="flex flex-wrap gap-2">
            <input name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" placeholder={orderNumber} aria-label="Type the order number to confirm" className="h-10 w-48 rounded-xl border border-line bg-surface px-3 font-mono outline-none focus:border-danger" />
            <button type="submit" disabled={pending || typed.trim().toUpperCase() !== orderNumber} className={cn("rounded-full bg-danger px-4 py-2 font-semibold text-white disabled:opacity-40")}>
              {pending ? "Deleting…" : "Delete order"}
            </button>
          </div>
          {state.error && <p className="text-danger">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
