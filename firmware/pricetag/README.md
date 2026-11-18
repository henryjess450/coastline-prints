# Screen price tag

An ESP32 (ELEGOO ESP32 DevKit V1, or a Seeed XIAO ESP32S3) and a 1.5" 128x128
black-and-white OLED (GME128128-01-IIC: an SH1107 over I2C, address 0x3C) that
shows one product's tag at the stand. No Wi-Fi: the dashboard sends the tag
over USB, the board keeps it in flash and shows it whenever it has power, from
any USB charger.

## Wiring

The screen has four pins. Match them by the names printed on the screen board
(the order varies), and use 3V3, not 5V or VIN.

| OLED | ESP32 DevKit V1 | XIAO ESP32S3 |
| ---- | --------------- | ------------ |
| VCC  | 3V3             | 3V3          |
| GND  | GND             | GND          |
| SDA  | D21             | D4 (GPIO 5)  |
| SCL  | D22             | D5 (GPIO 6)  |

The firmware picks the pins for whichever board it's built for.

## Setting it up (once)

`bash scripts/pricetag/flash.sh` finds the board (a DevKit shows up as
`/dev/cu.usbserial-*`, a XIAO as `/dev/cu.usbmodem*`), builds `pricetag.ino`
with arduino-cli (plus Adafruit's SH110X library, which it installs; SSD1327
drivers only fill this screen with speckles), flashes it and checks it answers. On the XIAO keep the
default USB options: its board definition's `CDCOnBoot=cdc` means *disabled*.

## Changing the tag

Plug the board into the Mac, open **Admin > Price tags** in Chrome or Edge,
press **Connect screen**, then **Show on screen** on a product. Unplug it and
it keeps that tag. A DevKit restarts when the page connects; that's normal.
The picture comes from `/api/admin/price-tags/screen`
(`src/lib/receipt/price-tag-oled.tsx`): the product's drawing in white, then
its name and price, big. It's sent as 16 greys and the board lights anything
half bright or more.

## USB commands

115200 baud, one per line: `PING`, `TAG <name>` followed by 8192 bytes (4 bits
a pixel, left pixel in the high nibble), `TEST` (grey ramp), `CONTRAST <0-255>`,
`SCAN` (lists I2C addresses, also with SDA/SCL swapped), `CLEAR`.
