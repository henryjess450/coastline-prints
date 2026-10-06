"use client";
import { Button } from "@/components/ui/Button";

export function RetryButton() {
  return (
    <Button size="lg" className="mt-10" onClick={() => window.location.reload()}>
      Try again
    </Button>
  );
}
