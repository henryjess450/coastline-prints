# The order lamp's animations, in Coastline colours.
#
# Each animation is a function of t (seconds since it started) and v (the
# sale in dollars, only Payment uses it) that returns
# 12 (r, g, b) colours, one per LED. LED 0 is the bottom of the ring and
# height(i) counts up both sides to the top (LED 6). Every animation starts
# and ends dark, so they chain and repeat without a flash.
#
# Keep in step with src/lib/lamp/animations.ts, which draws the same
# animations on the dashboard so you can preview them.
import math

N = 12

OFF = (0, 0, 0)
DEEP = (11, 34, 58)  # --sea-4
NAVY = (14, 68, 113)  # brand blue
SEA = (42, 95, 143)  # --sea-foam
WAKE = (134, 187, 234)  # --sea-wake
FOAM = (79, 179, 169)  # --seafoam
WHITE = (255, 255, 255)
LAMP = (255, 236, 190)  # warm lighthouse light
SAND = (233, 196, 106)  # the sun on the account page
CORAL = (231, 111, 81)


def clamp(x, lo=0.0, hi=1.0):
    return lo if x < lo else hi if x > hi else x


def ease(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def mix(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)


def add(a, b, t=1.0):
    return (a[0] + b[0] * t, a[1] + b[1] * t, a[2] + b[2] * t)


def scale(a, t):
    return (a[0] * t, a[1] * t, a[2] * t)


def height(i):
    """0 at the bottom LED, 6 at the top, counting up both sides."""
    return min(i, N - i)


def around(i, p):
    """How many LEDs apart LED i and position p are, going the short way round."""
    k = (i - p) % N
    return min(k, N - k)


def env(t, d, fade=0.8):
    """Fades in at the start and out at the end of a d-second animation."""
    return ease(t / fade) * ease((d - t) / fade)


def hash01(n):
    """A fixed 'random' number from 0 to 1 for n (same on the dashboard)."""
    return ((n * 2654435761) & 0xFFFFFFFF) / 4294967296


# ── Tide: a custom print order ───────────────────────────────────────────
# The sea rises up both sides of the ring, a white crest of foam laps the
# ring twice, then the tide goes back out.
def tide(t, v=0):
    out = []
    for i in range(N):
        d = height(i)
        body = mix(NAVY, SEA, d / 6)
        if t < 1.6:
            lvl = ease(t / 1.6) * 7
            c = scale(body, clamp(lvl - d))
            c = mix(c, WAKE, clamp(1 - abs(lvl - 1 - d)) * 0.7 * (1 - (t / 1.6) ** 2))
        elif t < 4.6:
            u = t - 1.6
            amp = ease(u / 0.4) * ease((3 - u) / 0.4)
            k = around(i, u / 3 * 24)
            c = mix(body, FOAM, clamp(1 - k / 3) * 0.5 * amp)
            c = mix(c, WHITE, clamp(1 - k / 1.4) ** 2 * amp)
        else:
            lvl = 7 * (1 - ease((t - 4.6) / 1.4))
            c = scale(body, clamp(lvl - d))
        out.append(c)
    return out


# ── Ripple: a Coastline shop order ───────────────────────────────────────
# A drop lands at the bottom and three ripples run up both sides, splashing
# where they meet at the top.
RIPPLES = ((0.15, 1.0), (1.35, 0.6), (2.55, 0.35))


def ripple(t, v=0):
    bg = ease(t / 0.5) * ease((4.5 - t) / 1.2) * 0.45
    out = []
    for i in range(N):
        d = height(i)
        c = scale(NAVY, bg)
        if i == 0:
            c = add(c, WHITE, clamp(1 - abs(t - 0.12) / 0.12))
        for t0, s in RIPPLES:
            f = (t - t0) * 5
            if f < 0 or f > 9:
                continue
            c = add(c, WAKE, clamp(1 - abs(d - f) / 1.1) * s)
            if d < f:
                c = add(c, FOAM, clamp(1 - (f - d) / 2.5) * s * 0.5)
            if i == N // 2:
                c = add(c, WHITE, clamp(1 - abs(f - 6.5)) * s)
        out.append(c)
    return out


# ── Lighthouse: a LightLab order ─────────────────────────────────────────
# A warm beam sweeps round three times over a dark sea, with a fainter beam
# opposite, like a real lighthouse lens.
def lighthouse(t, v=0):
    e = env(t, 6.5)
    p = t / 6.5 * 36
    out = []
    for i in range(N):
        beam = clamp(1 - around(i, p) / 2.2) ** 2 + 0.3 * clamp(1 - around(i, p + 6) / 2.2) ** 2
        out.append(add(scale(mix(DEEP, NAVY, 0.6), e), LAMP, beam * e))
    return out


# ── Sunset: a gift card ──────────────────────────────────────────────────
# The sun rises and fills the ring with gold, sets through coral into navy
# from the top down, then the sea goes dark and two stars come out.
def sunset(t, v=0):
    out = []
    for i in range(N):
        d = height(i)
        if t < 2:
            c = scale(SAND, clamp(ease(t / 2) * 7 - d))
        elif t < 5:
            k = clamp((t - 2) / 3 * 1.8 - (6 - d) / 6 * 0.8)
            c = mix(SAND, CORAL, k * 2) if k < 0.5 else mix(CORAL, NAVY, k * 2 - 1)
        else:
            c = scale(NAVY, clamp(7 * (1 - ease((t - 5) / 2)) - d))
            if i == 5 or i == 8:
                c = add(c, WHITE, math.sin(math.pi * (t - 5) / 2) ** 2 * 0.6)
        out.append(c)
    return out


# ── Treasure: a big order (plays after the usual one) ────────────────────
# Gold glints over the sea, each LED at its own pace.
def treasure(t, v=0):
    e = env(t, 4.0, 0.5)
    out = []
    for i in range(N):
        s = math.sin(2 * math.pi * (t * (0.8 + 1.4 * hash01(i + 1)) + hash01(i + 50)))
        tw = s ** 6 if s > 0 else 0.0
        c = add(scale(NAVY, 0.5 * e), SAND, tw * e)
        out.append(add(c, WHITE, clamp((tw - 0.8) / 0.2) * 0.6 * e))
    return out


# ── Swell: spare, for the dashboard ──────────────────────────────────────
# Rolling bands of sea go round the ring, with pale crests.
def swell(t, v=0):
    e = env(t, 6.0)
    out = []
    for i in range(N):
        v = 0.5 + 0.5 * math.sin(2 * math.pi * (i / N * 2 - t * 0.6))
        c = mix(mix(DEEP, SEA, v), WAKE, clamp((v - 0.85) / 0.15))
        out.append(scale(c, e))
    return out


# ── Payment: counts what a sale made ─────────────────────────────────────
# A green pulse, then one LED per dollar lights up round the ring ($1 = 1
# LED, $5 = 5). Past $12 it keeps going round in a new colour each lap:
# green, then gold, then pale blue, then white (so $30 = a gold ring with
# 6 blue). It holds so you can count, then fades. v is the dollars.
GREEN = (60, 210, 110)
LAPS = (GREEN, SAND, WAKE, WHITE)
MAX_DOLLARS = 48


def payment_steps(v):
    n = max(1, min(MAX_DOLLARS, int(v)))
    return n, min(0.15, 3.0 / n)


def payment_seconds(v):
    n, step = payment_steps(v)
    return 1.3 + n * step + 3.1


def payment(t, v=1):
    n, step = payment_steps(v)
    d = payment_seconds(v)
    if t < 1.2:
        return [scale(GREEN, math.sin(math.pi * t / 1.2) ** 2) for i in range(N)]
    fade = ease((d - t) / 0.6)
    out = []
    for i in range(N):
        c = OFF
        k = i + 1  # the dollar that lands on this LED, then every 12 after
        while k <= n:
            tk = 1.3 + (k - 1) * step
            if t < tk:
                break
            c = mix(LAPS[(k - 1) // N], WHITE, clamp(1 - (t - tk) / 0.25) * 0.6)
            k += N
        out.append(scale(c, fade))
    return out


# ── Bubbles: spare ───────────────────────────────────────────────────────
# Seafoam bubbles rise up alternate sides and pop white at the top.
def bubbles(t, v=0):
    bg = env(t, 5.2, 0.5) * 0.35
    out = []
    for i in range(N):
        d = height(i)
        c = scale(NAVY, bg)
        for j in range(8):
            h = (t - j * 0.45) / 1.4 * 6.5
            if h < -1 or h > 7:
                continue
            if i == 0 or i == N // 2 or (i < N // 2) == (j % 2 == 0):
                c = add(c, FOAM, clamp(1 - abs(d - h) / 0.8) * clamp(h / 0.8) * 0.8)
            if i == N // 2:
                c = add(c, WHITE, clamp(1 - abs(h - 6.3) / 0.5) * 0.8)
        out.append(c)
    return out


# ── Starlight: spare ─────────────────────────────────────────────────────
# A night sky: stars fade in and out, and a shooting star goes over the top.
def starlight(t, v=0):
    e = env(t, 6.0)
    out = []
    for i in range(N):
        start = hash01(i + 7) * 3.8
        dur = 1.2 + hash01(i + 30)
        c = add(scale(DEEP, e), WHITE, math.sin(math.pi * clamp((t - start) / dur)) ** 2 * 0.55)
        if 2.6 <= t <= 3.9:
            p = 2.5 + (t - 2.6) / 0.8 * 7  # from LED 2.5 over the top and on
            behind = (p - i) % N  # tail behind the head, soft edge just ahead of it
            glow = (1 - behind / 3) ** 2 if behind < 3 else clamp(1 - (N - behind) / 0.6)
            c = add(c, WHITE, glow * clamp((t - 2.6) / 0.15) * clamp((3.9 - t) / 0.5))
        out.append(c)
    return out


ANIMS = {
    "tide": (tide, 6.0),
    "ripple": (ripple, 4.5),
    "lighthouse": (lighthouse, 6.5),
    "sunset": (sunset, 7.0),
    "treasure": (treasure, 4.0),
    "swell": (swell, 6.0),
    "payment": (payment, payment_seconds),
    "bubbles": (bubbles, 5.2),
    "starlight": (starlight, 6.0),
}


# ── Always-on looks (not one-shot) ───────────────────────────────────────
def calm_sea(t):
    """Idle glow when the dashboard's 'Between orders' is Calm sea. Loops forever."""
    return [scale(mix(DEEP, NAVY, 0.5 + 0.5 * math.sin(2 * math.pi * (i / N - t / 8))), 0.5) for i in range(N)]


def connecting(t):
    """A seafoam dot going round: joining Wi-Fi or reaching the site."""
    p = t * 8
    return [scale(FOAM, clamp(1 - around(i, p) / 1.5) * 0.6) for i in range(N)]


def trouble(t):
    """The bottom LED breathes amber: wrong lamp key or the site can't be reached."""
    b = 0.5 - 0.5 * math.cos(2 * math.pi * t / 2.5)
    return [scale((255, 140, 0), b * 0.5) if i == 0 else OFF for i in range(N)]


def hello(t, v=0):
    """One seafoam lap when the lamp first reaches the site."""
    p = t / 1.2 * 12
    e = env(t, 1.2, 0.2)
    return [scale(FOAM, clamp(1 - around(i, p) / 2) * e) for i in range(N)]


ANIMS["hello"] = (hello, 1.2)
