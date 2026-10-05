import "server-only";
import { LocalStorage } from "./local";

/**
 * Blob storage for uploaded files. Swap implementations via STORAGE_DRIVER
 * (an S3/R2 driver only needs to implement this interface).
 */
export interface FileStorage {
  put(key: string, data: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}

let instance: FileStorage | null = null;

export function getStorage(): FileStorage {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  switch (driver) {
    case "local":
      instance = new LocalStorage(process.env.STORAGE_DIR ?? "./storage");
      return instance;
    default:
      throw new Error(`Unknown STORAGE_DRIVER "${driver}"`);
  }
}
