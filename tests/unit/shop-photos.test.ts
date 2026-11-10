import { describe, expect, it } from "vitest";
import { photosFor, variantForPhoto, variantFromParam, type ShopVariant } from "@/lib/shop/types";

const v = (id: string, name: string, imageKeys: string[] = []): ShopVariant => ({ id, name, priceCents: null, stock: null, hex: null, imageKeys });
const keys = ["shop/a.jpg", "shop/b.jpg", "shop/c.jpg", "shop/d.jpg"];
const product = (variants: ShopVariant[]) => ({ imageKeys: keys, images: keys.map((k) => `/img/${k}`), variants });

describe("photosFor", () => {
  it("shows every photo when nothing is tagged", () => {
    const p = product([v("y", "Yellow"), v("b", "Blue")]);
    expect(photosFor(p, "y")).toEqual({ images: p.images, picturedIn: null });
  });

  it("puts the option's photos first, then shared ones, and hides other options' photos", () => {
    // a: yellow, b: blue, c: shared, d: yellow and blue
    const p = product([v("y", "Yellow", ["shop/a.jpg", "shop/d.jpg"]), v("b", "Blue", ["shop/b.jpg", "shop/d.jpg"])]);
    expect(photosFor(p, "y").images).toEqual(["/img/shop/a.jpg", "/img/shop/d.jpg", "/img/shop/c.jpg"]);
    expect(photosFor(p, "b").images).toEqual(["/img/shop/b.jpg", "/img/shop/d.jpg", "/img/shop/c.jpg"]);
  });

  it("falls back to everything, shared first, for an option with no photos of its own", () => {
    const p = product([v("y", "Yellow", ["shop/a.jpg"]), v("p", "Pink")]);
    const r = photosFor(p, "p");
    expect(r.images[0]).toBe("/img/shop/b.jpg");
    expect(r.images).toHaveLength(4);
    expect(r.picturedIn).toBeNull();
  });

  it("names the option shown when the fallback photo is another option's", () => {
    const p = product([v("y", "Yellow", keys), v("p", "Pink")]);
    expect(photosFor(p, "p").picturedIn?.name).toBe("Yellow");
  });
});

describe("variantForPhoto and variantFromParam", () => {
  const p = product([v("y", "Banana Yellow", ["shop/a.jpg", "shop/d.jpg"]), v("b", "Blue", ["shop/d.jpg"])]);
  it("finds the one option a photo shows", () => {
    expect(variantForPhoto(p, "/img/shop/a.jpg")?.id).toBe("y");
    expect(variantForPhoto(p, "/img/shop/d.jpg")).toBeNull(); // group photo
    expect(variantForPhoto(p, "/img/shop/c.jpg")).toBeNull(); // shared
  });
  it("reads ?colour= by name or id", () => {
    expect(variantFromParam(p, "banana-yellow")?.id).toBe("y");
    expect(variantFromParam(p, "Banana Yellow")?.id).toBe("y");
    expect(variantFromParam(p, "b")?.id).toBe("b");
    expect(variantFromParam(p, "green")).toBeNull();
  });
});
