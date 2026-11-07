"use client";
/**
 * Little touches that make the shops feel alive: an optional soft click
 * (off unless the shopper turns sound on) and a light buzz on phones that
 * allow it. Every one is safe to call anywhere;
 * none of them ever throws.
 */
import { useSyncExternalStore } from "react";

const SOUND_KEY = "ll-sound";
const listeners = new Set<() => void>();

function readSound() {
  try {
    return localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    return false;
  }
}

/** Sound on or off (off by default), kept in this browser. */
export function useSoundOn() {
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    readSound,
    () => false,
  );
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {}
  listeners.forEach((l) => l());
  if (on) play("click");
}

let ctx: AudioContext | null = null;

/**
 * A short sound made on the spot (no audio files): "click" is a light-switch
 * tick, "pop" a soft bubble for adding to the cart, "chime" two warm notes.
 */
export function play(kind: "click" | "pop" | "chime") {
  if (!readSound()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    const tone = (freq: number, start: number, length: number, volume: number, type: OscillatorType = "sine", slideTo?: number) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, now + start);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, now + start + length);
      g.gain.setValueAtTime(0.0001, now + start);
      g.gain.exponentialRampToValueAtTime(volume, now + start + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
      o.connect(g).connect(ctx!.destination);
      o.start(now + start);
      o.stop(now + start + length + 0.02);
    };
    if (kind === "click") {
      tone(2400, 0, 0.025, 0.12, "square", 1200);
      tone(900, 0.03, 0.03, 0.06, "square", 500);
    } else if (kind === "pop") {
      tone(420, 0, 0.12, 0.18, "sine", 880);
    } else {
      tone(660, 0, 0.35, 0.12);
      tone(990, 0.12, 0.5, 0.1);
    }
  } catch {}
}

/** A light buzz on phones that allow it (Android; iPhones don't let websites). */
export function buzz(ms = 12) {
  try {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) navigator.vibrate?.(ms);
  } catch {}
}

export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
