/**
 * "What we've printed" on the home page. Put photos in public/gallery/
 * (square-ish JPG or WebP, about 1200 px wide) and add one entry per photo.
 * The section stays hidden until there's at least one entry.
 *
 * Example:
 *   { src: "/gallery/dragon.jpg", alt: "Articulated dragon curled up on a desk", title: "Articulated dragon", material: "PLA", colour: "Silk PLA+ Silver" },
 */
export type GalleryItem = {
  src: string;
  /** Describes the photo for screen readers. */
  alt: string;
  title: string;
  material: string;
  colour: string;
};

export const gallery: GalleryItem[] = [];
