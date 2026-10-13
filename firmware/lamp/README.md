# Order lamp

An ESP32-C3 and a 12-LED WS2812 ring that lights up when the site takes an order.
It runs MicroPython (`main.py`, `anims.py`) and keeps a request open to
`/api/lamp`; the dashboard's **Lamp** page plays animations and picks which one
each kind of sale gets.

## Wiring

| Ring | ESP32-C3 |
| ---- | -------- |
| 5V / VCC | 5V |
| GND | GND |
| DIN / IN | GPIO 10 (any free pin; avoid 2, 8 and 9, they're boot pins) |

Keep the brightness at 40% or below when it runs off a laptop's USB port: 12 LEDs
at full white draw about 0.7 A.

## Setting it up

1. Deploy the site so the dashboard has the Lamp page.
2. Plug the ESP32 into the Mac and run `bash scripts/lamp/flash.sh`.
3. It asks for the Wi-Fi (2.4 GHz only), the DIN pin, and a lamp key (make one on the Lamp page).
4. It flashes MicroPython, copies the code and watches the lamp come online.

Then it runs from any USB charger.

- `bash scripts/lamp/flash.sh --update` copies new code and keeps the Wi-Fi and key.
- `bash scripts/lamp/flash.sh --watch` shows what the lamp is saying.

## What the lights mean

- **Seafoam dot going round**: joining Wi-Fi or reaching the site.
- **One seafoam lap**: connected, waiting for orders.
- **Bottom LED breathing amber**: no Wi-Fi, or the site doesn't know the lamp key.

## Changing animations

They're in `anims.py` and copied line for line in `src/lib/lamp/animations.ts`
(the dashboard preview), so change both. Each one must start and end dark.
If the ring is mounted rotated or the animations go the wrong way round, change
`OFFSET` or `REVERSE` in the lamp's `config.py` (`mpremote edit :config.py`, or re-run the script).
