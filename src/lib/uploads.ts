import type { Upload } from "@/generated/prisma/client";
import type { MeshWarning } from "@/lib/stl/inspect";

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
  };
}
