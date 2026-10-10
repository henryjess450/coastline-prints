import { describe, expect, it } from "vitest";
import { BOARD, nextStep } from "@/lib/orders/next-step";
import { ORDER_STATUSES } from "@/lib/orders/status";

describe("next step", () => {
  it("walks a pickup order through every step, asking twice before emailing", () => {
    const path: string[] = [];
    let s: string = "PAID";
    for (let n = nextStep(s, "PICKUP"); n; n = nextStep(s, "PICKUP")) {
      path.push(n.label);
      expect(n.emails).toBe(n.to === "READY_FOR_PICKUP");
      s = n.to;
    }
    expect(path).toEqual(["Files look good", "Start printing", "Done printing", "Ready for pickup", "Picked up"]);
    expect(s).toBe("PICKED_UP");
  });

  it("says shipped and delivered for shipped orders, with tracking only when tracked", () => {
    expect(nextStep("POST_PROCESSING", "SHIP", true)).toMatchObject({ label: "Mark shipped", tracking: true, emails: true });
    expect(nextStep("POST_PROCESSING", "SHIP", false)).toMatchObject({ tracking: false });
    expect(nextStep("READY_FOR_PICKUP", "SHIP")?.label).toBe("Delivered");
  });

  it("puts every status in exactly one board column", () => {
    for (const s of ORDER_STATUSES) expect(BOARD.filter((c) => (c.statuses as readonly string[]).includes(s.id))).toHaveLength(1);
  });
});
