import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FileStorage } from "./index";

export class LocalStorage implements FileStorage {
  private root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    // Keys are generated server-side, but never allow escaping the root.
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, data: Uint8Array) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  }

  async get(key: string) {
    return new Uint8Array(await readFile(this.resolve(key)));
  }

  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }
}
