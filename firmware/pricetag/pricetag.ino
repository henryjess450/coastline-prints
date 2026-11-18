// LightLab screen price tag: an ESP32 DevKit V1 (or a XIAO ESP32S3) driving a 1.5" 128x128
// OLED (GME128128-01-IIC, SH1107 over I2C, black and white). No Wi-Fi: the
// dashboard (Admin > Price tags, in Chrome or Edge) sends the tag over USB,
// the board keeps it in flash and shows it every time it powers up.
//
// USB commands (115200, one per line):
//   PING             -> "PRICETAG 1 oled=0x3C tag=<name or none>"
//   TAG <name>       then exactly 8192 bytes (128x128, 4 bits a pixel, left pixel
//                    in the high nibble, rows top to bottom) -> "OK" or "ERR ..."
//   TEST             shows a test pattern, to check the wiring
//   CONTRAST <0-255> brightness, kept in flash
//   CLEAR            forgets the tag
//
// Wiring: OLED VCC -> 3V3, GND -> GND, and
//   ESP32 DevKit V1: SDA -> D21, SCL -> D22
//   XIAO ESP32S3:    SDA -> D4 (GPIO5), SCL -> D5 (GPIO6)
#include <Wire.h>
#include <Preferences.h>
#include <Adafruit_SH110X.h>

#if CONFIG_IDF_TARGET_ESP32S3
static const int SDA_PIN = 5, SCL_PIN = 6;
#define WIRING "SDA D4, SCL D5"
#else
static const int SDA_PIN = 21, SCL_PIN = 22;
#define WIRING "SDA D21, SCL D22"
#endif
static const size_t FRAME = 128 * 128 / 2;
static uint8_t frame[FRAME];
static uint8_t addr = 0;  // 0 = no screen found
static Preferences prefs;
static String tagName = "";

// The GME128128-01-IIC is an SH1107 (black and white), driven with Adafruit's
// SH110X library. Tags still arrive as 16 greys; anything half bright or more
// lights up. (SSD1327 commands only fill this screen with speckles.)
static Adafruit_SH1107* oled = nullptr;

static void oledInit() {
  if (!oled) oled = new Adafruit_SH1107(128, 128, &Wire, -1, 400000, 100000);
  if (!oled->begin(addr, true)) { addr = 0; return; }
  if (prefs.isKey("contrast")) oled->setContrast(prefs.getUChar("contrast"));
}

static void oledShow() {
  if (!addr || !oled) return;
  oled->clearDisplay();
  for (int y = 0; y < 128; y++)
    for (int x = 0; x < 128; x += 2) {
      uint8_t b = frame[y * 64 + x / 2];
      if ((b >> 4) >= 8) oled->drawPixel(x, y, SH110X_WHITE);
      if ((b & 15) >= 8) oled->drawPixel(x + 1, y, SH110X_WHITE);
    }
  oled->display();
}

static void testPattern() {
  for (int y = 0; y < 128; y++)
    for (int x = 0; x < 64; x++) {
      uint8_t g = (y < 8 || y > 119 || x == 0 || x == 63) ? 15 : (x * 2) / 8;
      frame[y * 64 + x] = (g << 4) | g;
    }
  oledShow();
}

static void loadTag() {
  size_t n = prefs.getBytes("tag", frame, FRAME);
  tagName = prefs.getString("name", "");
  if (n == FRAME) oledShow();
  else testPattern();
}

static uint8_t findOled() {
  for (uint8_t a : {0x3C, 0x3D}) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) return a;
  }
  return 0;
}

void setup() {
  Serial.setRxBufferSize(FRAME + 256);
  Serial.begin(115200);
  Serial.setTimeout(3000);
  prefs.begin("pricetag", false);
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);
  addr = findOled();
  if (addr) oledInit();
  loadTag();
}

static void reply(const String& s) { Serial.println(s); Serial.flush(); }

void loop() {
  if (!Serial.available()) { delay(5); return; }
  String line = Serial.readStringUntil('\n');
  line.trim();
  if (line.isEmpty()) return;
  if (!addr && (addr = findOled())) { oledInit(); loadTag(); }  // screen plugged in late

  if (line == "PING") {
    char a[8];
    snprintf(a, sizeof a, "0x%02X", addr);
    reply(String("PRICETAG 1 oled=") + (addr ? a : "none") + " tag=" + (tagName.length() ? tagName : "none"));
  } else if (line.startsWith("TAG")) {
    String name = line.substring(3);
    name.trim();
    size_t got = Serial.readBytes(frame, FRAME);
    if (got != FRAME) { reply("ERR short " + String(got)); loadTag(); return; }
    prefs.putBytes("tag", frame, FRAME);
    prefs.putString("name", name.substring(0, 60));
    tagName = name.substring(0, 60);
    oledShow();
    reply(addr ? "OK" : "OK saved, but no screen found (check " WIRING ")");
  } else if (line == "SCAN") {
    // Every I2C address on D4/D5, then again with the two wires swapped.
    String out = "SCAN";
    for (int swap = 0; swap < 2; swap++) {
      Wire.end();
      Wire.begin(swap ? SCL_PIN : SDA_PIN, swap ? SDA_PIN : SCL_PIN);
      Wire.setClock(100000);
      out += swap ? " swapped:" : " normal:";
      for (uint8_t a = 1; a < 127; a++) {
        Wire.beginTransmission(a);
        if (Wire.endTransmission() == 0) { char b[6]; snprintf(b, sizeof b, " %02X", a); out += b; }
      }
    }
    Wire.end();
    Wire.begin(SDA_PIN, SCL_PIN);
    Wire.setClock(400000);
    reply(out);
  } else if (line == "TEST") {
    testPattern();
    reply(addr ? "OK" : "ERR no screen");
  } else if (line.startsWith("CONTRAST")) {
    int v = constrain(line.substring(8).toInt(), 0, 255);
    prefs.putUChar("contrast", v);
    if (addr && oled) oled->setContrast(v);
    reply("OK");
  } else if (line == "CLEAR") {
    prefs.remove("tag");
    prefs.remove("name");
    tagName = "";
    testPattern();
    reply("OK");
  } else {
    reply("ERR unknown");
  }
}
