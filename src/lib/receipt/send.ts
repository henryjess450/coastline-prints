import "server-only";
import net from "node:net";

/** Sends raw bytes to a network printer (port 9100) and waits for the socket to finish. */
export function sendToPrinter(bytes: Buffer, host: string, port = 9100, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    let settled = false;
    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };
    socket.setTimeout(timeoutMs, () => done(new Error(`Printer at ${host}:${port} timed out (is it on and connected?)`)));
    socket.on("error", (err) => done(new Error(`Can't reach the printer at ${host}:${port}: ${err.message}`)));
    // Star printers reply with a status message; read it so the connection can close.
    socket.on("data", () => {});
    socket.on("connect", () => socket.end(bytes));
    socket.on("close", (hadError) => (hadError ? undefined : done()));
  });
}
