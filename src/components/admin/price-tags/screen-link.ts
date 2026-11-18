"use client";

/*
 * Talks to the stand's screen price tag (firmware/pricetag) over USB with Web
 * Serial (Chrome or Edge on a Mac or PC). Lines in, lines out; a tag is
 * "TAG <name>\n" then the 8192 bytes from /api/admin/price-tags/screen.
 */

type Port = {
  open(o: { baudRate: number; bufferSize?: number }): Promise<void>;
  setSignals(s: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
};
type Serial = { requestPort(o?: { filters: { usbVendorId: number }[] }): Promise<Port>; getPorts(): Promise<Port[]> };
const serial = () => (typeof navigator !== "undefined" ? (navigator as unknown as { serial?: Serial }).serial : undefined);

export const screenSupported = () => !!serial();

/** USB makers of the boards we use: Espressif (XIAO S3's own USB), Silicon Labs CP2102 and WCH CH340 (DevKit V1). */
const BOARDS = [0x303a, 0x10c4, 0x1a86].map((usbVendorId) => ({ usbVendorId }));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ScreenLink {
  private port: Port;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private buf = "";
  private waiting: ((line: string) => void) | null = null;
  onClose: (() => void) | null = null;

  private constructor(port: Port) {
    this.port = port;
  }

  /** Asks Chrome for the board (it shows a picker the first time), opens it and says hello. */
  static async connect(ask: boolean): Promise<{ link: ScreenLink; status: string } | null> {
    const s = serial();
    if (!s) throw new Error("This browser can't reach USB. Use Chrome or Edge.");
    const known = await s.getPorts();
    const port = known[0] ?? (ask ? await s.requestPort({ filters: BOARDS }) : null);
    if (!port) return null;
    await port.open({ baudRate: 115200, bufferSize: 16384 });
    // A DevKit restarts when the port opens: let go of its reset lines and let it boot.
    await port.setSignals({ dataTerminalReady: false, requestToSend: false }).catch(() => {});
    const link = new ScreenLink(port);
    link.readLoop();
    let status = "";
    for (let i = 0; i < 4 && !status; i++) {
      if (i) await sleep(500);
      status = await link.ask("PING", 1200).catch(() => "");
    }
    if (!status.startsWith("PRICETAG")) {
      await link.close();
      throw new Error("That board isn't running the price tag firmware. Run scripts/pricetag/flash.sh first.");
    }
    return { link, status };
  }

  private async readLoop() {
    const dec = new TextDecoder();
    try {
      while (this.port.readable) {
        this.reader = this.port.readable.getReader();
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) break;
          this.buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = this.buf.indexOf("\n")) >= 0) {
            const line = this.buf.slice(0, nl).replace(/[^\x20-\x7e]/g, "").trim();
            this.buf = this.buf.slice(nl + 1);
            if (this.waiting && /^(PRICETAG|OK|ERR|SCAN)\b/.test(line)) {
              const w = this.waiting;
              this.waiting = null;
              w(line);
            }
          }
        }
        this.reader.releaseLock();
      }
    } catch {
      // Unplugged.
    }
    this.onClose?.();
  }

  private async write(bytes: Uint8Array) {
    const w = this.port.writable!.getWriter();
    try {
      await w.write(bytes);
    } finally {
      w.releaseLock();
    }
  }

  /** Sends a line (and optional bytes after it) and waits for the board's one-line answer. */
  async ask(line: string, timeoutMs = 4000, payload?: Uint8Array): Promise<string> {
    const answer = new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => {
        this.waiting = null;
        reject(new Error("The screen didn't answer. Unplug it and plug it back in."));
      }, timeoutMs);
      this.waiting = (l) => {
        clearTimeout(t);
        resolve(l);
      };
    });
    const head = new TextEncoder().encode(`${line.replace(/[\r\n]/g, " ")}\n`);
    const all = new Uint8Array(head.length + (payload?.length ?? 0));
    all.set(head);
    if (payload) all.set(payload, head.length);
    await this.write(all);
    return answer;
  }

  async sendTag(name: string, frame: Uint8Array) {
    if (frame.length !== 8192) throw new Error("The tag picture is the wrong size.");
    const r = await this.ask(`TAG ${name}`, 6000, frame);
    if (!r.startsWith("OK")) throw new Error(r.replace(/^ERR\s*/, "The screen said: "));
    return r;
  }

  /** Lets go of the port; `quiet` skips the unplugged callback. */
  async close(quiet = false) {
    if (quiet) this.onClose = null;
    try {
      await this.reader?.cancel();
    } catch {}
    try {
      await this.port.close();
    } catch {}
  }
}

/** "PRICETAG 1 oled=0x3C tag=Banana Lamp" -> what to show in the bar. */
export function describeScreen(status: string) {
  const oled = /oled=(\S+)/.exec(status)?.[1];
  const tag = /tag=(.*)$/.exec(status)?.[1];
  return {
    wired: !!oled && oled !== "none",
    showing: tag && tag !== "none" ? tag : null,
  };
}
