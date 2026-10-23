"use client";
import { useRef, useState } from "react";
import { formatBytes, productFiles, type ProductFileDto } from "@/lib/shop/files";
import { cn } from "@/lib/cn";

const accept = productFiles.extensions.map((e) => `.${e}`).join(",");

/**
 * The owner's own print files for a product (STL, 3MF...). Uploaded straight
 * away, separate from Save. Only admins can download them; shoppers never see them.
 */
export function ProductFiles({ productId, initial, onError }: { productId: string | null; initial: ProductFileDto[]; onError: (msg: string) => void }) {
  const [files, setFiles] = useState(initial);
  const [uploading, setUploading] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  if (!productId) return <p className="text-sm text-muted">Add the product first, then you can keep its print files here.</p>;

  async function upload(list: FileList | File[]) {
    const all = [...list];
    if (!all.length) return;
    setUploading(all.length === 1 ? all[0].name : `${all.length} files`);
    try {
      const form = new FormData();
      for (const f of all) form.append("file", f);
      const res = await fetch(`/api/shop/admin/products/${productId}/files`, { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { files?: ProductFileDto[]; error?: string };
      if (!res.ok || !body.files) return onError(body.error ?? "Couldn't upload the file.");
      setFiles((f) => [...body.files!, ...f]);
    } catch {
      onError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(null);
    }
  }

  async function remove(id: string) {
    setConfirming(null);
    const res = await fetch(`/api/shop/admin/files/${id}`, { method: "DELETE" });
    if (!res.ok) return onError("Couldn't delete the file.");
    setFiles((f) => f.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => picker.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void upload(e.dataTransfer.files);
        }}
        disabled={!!uploading}
        className={cn("flex w-full flex-col items-center gap-1 rounded-2xl border border-dashed px-4 py-6 text-sm transition-colors", over ? "border-accent bg-accent-soft" : "border-line hover:border-accent-line")}
      >
        <span className="font-medium">{uploading ? `Uploading ${uploading}…` : "Drop print files here, or tap to choose"}</span>
        <span className="text-xs text-muted">
          {productFiles.extensions.map((e) => e.toUpperCase()).join(", ")} · up to {productFiles.maxMb} MB each
        </span>
      </button>
      <input
        ref={picker}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void upload(e.target.files);
          e.target.value = "";
        }}
      />
      {files.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{f.fileName}</p>
                <p className="text-xs text-faint">
                  {formatBytes(f.sizeBytes)} · added {new Date(f.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a href={`/api/shop/admin/files/${f.id}`} className="rounded-full border border-line px-3 py-1 text-xs hover:border-accent-line">
                  Download
                </a>
                {confirming === f.id ? (
                  <button type="button" onClick={() => remove(f.id)} className="rounded-full bg-danger px-3 py-1 text-xs font-medium text-white">
                    Delete for good
                  </button>
                ) : (
                  <button type="button" onClick={() => setConfirming(f.id)} className="rounded-full border border-line px-3 py-1 text-xs hover:border-danger hover:text-danger">
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
