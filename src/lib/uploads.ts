import type { Upload } from "@/generated/prisma/client";
import type { MeshWarning } from "@/lib/stl/inspect";
import type { ColorInfo } from "@/lib/model/parse";
import type { SupportProfile } from "@/lib/model/supports";

/** What the client is allowed to see about an upload (no storage paths). */
export type UploadDto = {
  id: string;
  name: string;
  sizeBytes: number;
  format: string;
  triangleCount: number;
  volumeMm3: number;
  surfaceAreaMm2: number;
  size: { x: number; y: number; z: number };
  boundaryEdges: number;
  nonManifoldEdges: number;
  warnings: MeshWarning[];
  /** 3MF only: the project's filaments and which the model uses. */
  colorInfo: ColorInfo | null;
  /** Overhangs needing support, for each way up. */
  supportInfo: SupportProfile | null;
};

export function toUploadDto(u: Upload): UploadDto {
  return {
    id: u.id,
    name: u.safeName,
    sizeBytes: u.sizeBytes,
    format: u.format,
    triangleCount: u.triangleCount,
    volumeMm3: u.volumeMm3,
    surfaceAreaMm2: u.surfaceAreaMm2,
    size: { x: u.bboxX, y: u.bboxY, z: u.bboxZ },
    boundaryEdges: u.boundaryEdges,
    nonManifoldEdges: u.nonManifold,
    warnings: JSON.parse(u.warnings) as MeshWarning[],
    colorInfo: u.colorInfo ? (JSON.parse(u.colorInfo) as ColorInfo) : null,
    supportInfo: u.supportInfo ? (JSON.parse(u.supportInfo) as SupportProfile) : null,
  };
}
