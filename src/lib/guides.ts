/**
 * Plain-answer guides under /guides. Each one opens with a one-sentence
 * answer, which is what search engines and AI assistants quote.
 * Bump `updated` when a guide changes.
 */
export type Guide = { slug: string; title: string; description: string; published: string; updated: string };

export const guides: Guide[] = [
  {
    slug: "3d-printing-cost",
    title: "How much does 3D printing cost? Prices in Victoria, BC",
    description: "3D printing cost per gram and per hour in Victoria, BC, with example prices by size from our live rates, a free cost calculator, and ways to pay less.",
    published: "2026-10-11",
    updated: "2026-10-11",
  },
  {
    slug: "pla-vs-petg-vs-pla-cf",
    title: "PLA vs PETG vs PLA-CF: strength, heat resistance and which to pick",
    description: "PLA vs PETG vs carbon fibre PLA compared: strength, heat resistance, flexibility, finish and price, plus where ABS fits, and which to choose for your print.",
    published: "2026-10-11",
    updated: "2026-10-11",
  },
  {
    slug: "how-to-get-an-stl-file",
    title: "How to get an STL file to 3D print",
    description: "Where to find free STL and 3MF files, how to make your own with free software, and how to check the file before you order a print.",
    published: "2026-10-11",
    updated: "2026-10-11",
  },
  {
    slug: "where-to-get-something-3d-printed-victoria",
    title: "Where to get something 3D printed in Victoria, BC",
    description: "Your options for getting something 3D printed in Victoria: online print shops, libraries and campus makerspaces, and online networks. What each costs and how fast.",
    published: "2026-10-11",
    updated: "2026-10-11",
  },
];

export const findGuide = (slug: string) => guides.find((g) => g.slug === slug)!;
