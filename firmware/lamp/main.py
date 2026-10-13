# The Coastline order lamp: an ESP32-C3 with a 12-LED WS2812 ring.
#
# Joins Wi-Fi, then keeps a request open to the site's /api/lamp. When an
# order is paid (or you press Play on the dashboard) the site answers with
# the animation to play. The LEDs are drawn on their own thread, so the idle
# glow keeps moving while the network waits.
#
# config.py is written by scripts/lamp/flash.sh and holds the Wi-Fi details
# and lamp key. It never goes in git.
import gc
import time
import _thread
import machine
import network
import neopixel

try:
    import requests
except ImportError:
    import urequests as requests

import anims
import config

VERSION = "1"
SERVER = getattr(config, "SERVER", "https://coastlineprints.ca").rstrip("/")
OFFSET = getattr(config, "OFFSET", 0)  # which physical LED is the bottom
REVERSE = getattr(config, "REVERSE", False)  # flip if animations go the wrong way round

ring = neopixel.NeoPixel(machine.Pin(config.LED_PIN, machine.Pin.OUT), anims.N)

state = {
    "mode": "connecting",  # connecting | trouble | ready
    "bright": getattr(config, "BRIGHTNESS", 40) / 100,
    "idle": "off",  # off | calm
    "run": True,
}
queue = []  # animation names waiting to play


def log(*args):
    print("[lamp]", *args)


def show(colors, level=1.0):
    b = state["bright"] * level
    for i in range(anims.N):
        c = colors[i]
        j = (OFFSET + (-i if REVERSE else i)) % anims.N
        ring[j] = (min(255, int(c[0] * b)), min(255, int(c[1] * b)), min(255, int(c[2] * b)))
    ring.write()


def clear():
    ring.fill((0, 0, 0))
    ring.write()


def play(name):
    fn, dur = anims.ANIMS.get(name, (None, 0))
    if not fn:
        log("unknown animation", name)
        return
    log("playing", name)
    start = time.ticks_ms()
    while state["run"]:
        t = time.ticks_diff(time.ticks_ms(), start) / 1000
        if t >= dur:
            break
        show(fn(t))
        time.sleep_ms(20)
    clear()


def render():
    """The LED thread: animations first, then status, then the idle glow (faded in and out)."""
    start = time.ticks_ms()
    last = start
    idle = 0.0  # idle glow level, 0 to 1
    dark = False
    while state["run"]:
        now = time.ticks_ms()
        t = time.ticks_diff(now, start) / 1000
        dt = time.ticks_diff(now, last) / 1000
        last = now
        mode = state["mode"]
        if mode == "connecting":
            show(anims.connecting(t))
            dark = False
        elif mode == "trouble":
            show(anims.trouble(t))
            dark = False
        else:
            want = 0.0 if queue or state["idle"] != "calm" else 1.0
            idle = min(want, idle + dt * 1.5) if want > idle else max(want, idle - dt * 1.5)
            if queue and idle == 0.0:
                play(queue[0])
                queue.pop(0)
                dark = True
                continue
            if idle > 0:
                show(anims.calm_sea(t), idle)
                dark = False
            elif not dark:
                clear()
                dark = True
        time.sleep_ms(25)
    clear()


def wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if wlan.isconnected():
        return wlan
    # ESP32-C3 Super Mini boards often fail to join at full power.
    try:
        wlan.config(txpower=getattr(config, "TX_POWER", 8.5))
    except Exception:
        pass
    log("joining Wi-Fi", config.WIFI_SSID)
    wlan.connect(config.WIFI_SSID, config.WIFI_PASSWORD)
    for _ in range(60):
        if wlan.isconnected():
            log("Wi-Fi connected", wlan.ifconfig()[0])
            return wlan
        time.sleep_ms(500)
    log("Wi-Fi failed. Check the name and password (the ESP32 only sees 2.4 GHz networks).")
    wlan.disconnect()
    return None


def poll(after, rssi):
    url = "%s/api/lamp?v=%s&rssi=%d" % (SERVER, VERSION, rssi)
    if after is not None:
        url += "&after=%d" % after
    r = requests.get(url, headers={"Authorization": "Bearer " + config.LAMP_KEY}, timeout=45)
    try:
        if r.status_code == 401:
            return 401, None
        if r.status_code != 200:
            return r.status_code, None
        return 200, r.json()
    finally:
        r.close()


def main():
    _thread.start_new_thread(render, ())
    after = None
    failing_since = None
    greeted = False
    while True:
        wlan = wifi()
        if not wlan:
            state["mode"] = "trouble"
            time.sleep(10)
            state["mode"] = "connecting"
            continue
        try:
            status, data = poll(after, wlan.status("rssi"))
        except Exception as e:
            status, data = 0, None
            log("can't reach", SERVER, repr(e))
        if status == 200:
            failing_since = None
            state["bright"] = data.get("brightness", 40) / 100
            state["idle"] = data.get("idle", "off")
            if state["mode"] != "ready":
                state["mode"] = "ready"
                if not greeted:
                    queue.append("hello")
                    greeted = True
                    log("Waiting for orders")
            for ev in data.get("events", []):
                queue.append(ev["anim"])
            after = data.get("last", after)
            # Don't ask again until the animations are done.
            while queue:
                time.sleep_ms(100)
        else:
            if status == 401:
                log("The site doesn't know this lamp key. Make a new one on the dashboard (Lamp) and re-run the flash script.")
            elif status:
                log("site answered", status)
            state["mode"] = "trouble"
            failing_since = failing_since or time.time()
            # Stuck for 10 minutes: start fresh.
            if time.time() - failing_since > 600:
                machine.reset()
            time.sleep(30 if status == 401 else 5)
        gc.collect()


try:
    main()
finally:
    # Ctrl-C (the flash script updating the code) stops the LED thread too.
    state["run"] = False
    time.sleep_ms(100)
    clear()
