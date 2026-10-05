"use client";
import type { WorkerRequest, WorkerResponse } from "@/workers/stl.worker";
import type { UploadDto } from "@/lib/uploads";

let worker: Worker | null = null;
const pending = new Map<string, (r: WorkerResponse) => void>();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("../../workers/stl.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      pending.get(e.data.id)?.(e.data);
      pending.delete(e.data.id);
    };
  }
  return worker;
}

/** Parse in the worker. The buffer is copied so the original can still be uploaded. */
export function parseInWorker(id: string, buffer: ArrayBuffer): Promise<WorkerResponse> {
  return new Promise((resolve) => {
    pending.set(id, resolve);
    const copy = buffer.slice(0);
    const msg: WorkerRequest = { id, buffer: copy };
    getWorker().postMessage(msg, [copy]);
  });
}

/** XHR (not fetch) so we get real upload progress events. */
export function uploadStl(file: File, onProgress: (fraction: number) => void): Promise<UploadDto> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("X-Filename", encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let body: { upload?: UploadDto; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // fall through to the generic error
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.upload) resolve(body.upload);
      else reject(new Error(body.error ?? "Upload failed. Please try again."));
    };
    xhr.onerror = () => reject(new Error("Network error while uploading. Check your connection and retry."));
    xhr.send(file);
  });
}
