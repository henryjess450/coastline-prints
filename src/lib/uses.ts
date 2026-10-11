import type { MaterialId } from "@config/materials";

/**
 * The /3d-printing/<slug> pages: one per thing people come to get printed.
 * Each is written for what someone would type into Google ("3d print
 * replacement part", "cosplay 3d printing victoria"). Keep the copy plain and
 * true; no promises about painting or design work we don't do.
 */
export type Use = {
  slug: string;
  /** Short name for links and cards. */
  name: string;
  /** Search result title, before " in Victoria, BC". */
  title: string;
  /** Use this title as is (pages that aren't about Victoria). */
  absoluteTitle?: string;
  /** Search result description (about 150 characters). */
  description: string;
  h1: string;
  intro: string[];
  /** Heading over `examples`. Defaults to "What people print". */
  examplesHeading?: string;
  examples: string[];
  material?: { id: MaterialId; why: string };
  /** An extra list after the examples, for long-tail searches ("gifts for dad"). */
  ideas?: { heading: string; items: string[] };
  tips: string[];
  /** Starting search on the Find a model page. */
  search: string;
};

export const uses: Use[] = [
  {
    slug: "replacement-parts",
    name: "Replacement parts",
    title: "3D printed replacement and spare parts",
    description: "Order 3D printed replacement parts in Victoria: snapped clips, lost knobs, cracked brackets. Upload the file, see the price, ready in 2 to 5 days.",
    h1: "3D printed replacement parts",
    intro: [
      "A lot of small plastic spare parts can't be bought on their own anymore. The good news: someone has usually already modelled it. Search the part name or the appliance's model number on the Find a model page and you'll often find a file ready to print.",
      "Upload the file, check the size against the broken part, and you'll see the price before you pay.",
    ],
    examples: ["Battery covers and remote backs", "Dishwasher rack wheels and clips", "Knobs and dials", "Shelf pins and brackets", "Vacuum and blender attachments", "Car interior clips and trim pieces", "Missing toy and model kit parts", "Spare parts for your 3D printer"],
    material: { id: "PETG", why: "PETG is tougher than PLA, bends a little before it breaks, and handles more heat, so it holds up in a car or near an appliance." },
    tips: [
      "Measure the old part with a ruler or calipers and match the size in the 3D preview before you order.",
      "If the fit is critical, order one first. Once it fits, you can reorder it from your account.",
      "Not for parts where a failure could hurt someone, like brakes, car seats, or anything holding weight overhead.",
    ],
    search: "replacement part",
  },
  {
    slug: "cosplay-props",
    name: "Cosplay and props",
    title: "Cosplay 3D printing: armour, helmets and props",
    description: "Cosplay 3D printing service in Victoria, BC: 3D printed helmets, armour, masks and props in PLA, ready to sand and paint. Instant price online.",
    h1: "Cosplay 3D printing for armour, helmets and props",
    intro: [
      "Most costume and prop files are made to be printed in sections and glued together. Upload every part at once and the whole build is priced in one order.",
      "Prints come straight off the printer, with supports removed. Sanding, filling and painting are up to you, which is half the fun.",
    ],
    examples: ["3D printed helmets and masks", "Armour plates, gauntlets and pauldrons", "Blasters and prop weapons (non-functional replicas only)", "Badges, emblems and buckles", "Crowns, horns, ears and wings", "Display stands"],
    material: { id: "PLA", why: "PLA is light, stiff and easy to sand and prime. Pick a light grey or white-ish colour if you're painting it." },
    tips: [
      "Layer lines show on curved surfaces. Filler primer and sanding hide them.",
      "A finer quality setting means smoother curves but a longer print. You can compare the prices in the order screen.",
      "Wearing it near your face for hours? Consider PETG, which is less brittle if it gets knocked.",
    ],
    search: "cosplay helmet",
  },
  {
    slug: "tabletop-terrain",
    name: "Tabletop and terrain",
    title: "3D printed terrain for D&D and Warhammer",
    description: "3D printed tabletop terrain in Victoria, BC: D&D dungeon tiles, Warhammer ruins, scatter and dice towers in PLA. See the price, pick up in 2 to 5 days.",
    h1: "3D printed tabletop terrain and game pieces",
    intro: [
      "Buildings, ruins, walls, trees, dungeon tiles and dice towers are where filament printing shines: strong, cheap per piece and easy to paint.",
      "An honest note on small miniatures: these are filament printers, not resin. 28 mm figures come out fine for the table but softer in fine detail like faces. Bigger monsters, vehicles and display pieces look great.",
    ],
    examples: ["Buildings, ruins and walls", "Dungeon tiles and scatter terrain", "Dice towers and trays", "Card and token organisers", "Large monsters and vehicles", "Bases and movement trays"],
    ideas: {
      heading: "Popular with local players",
      items: ["D&D dungeon tiles, doors and furniture", "Warhammer 40k ruins and barricades", "Age of Sigmar and fantasy buildings", "Board game inserts and organisers", "Terrain tiles and modular boards", "Objective markers and tokens"],
    },
    material: { id: "PLA", why: "PLA holds detail best and takes primer and acrylic paint well. Matte colours hide layer lines." },
    tips: [
      "Order a whole table's worth at once. The order fee is charged once per order, not per piece.",
      "Set the quantity on each file to print several copies of the same tile or tree.",
      "Many terrain files are free on Thingiverse, Printables and MakerWorld. Search them on the Find a model page.",
    ],
    search: "terrain",
  },
  {
    slug: "gifts",
    name: "Gifts",
    title: "3D printed gifts and custom name keychains",
    description: "3D printed gifts made in Victoria, BC: custom name keychains, planters, figures and desk toys in silk and rainbow PLA. Or email a gift card.",
    h1: "3D printed gifts and custom name keychains",
    intro: [
      "Find a model they'd like, pick a colour that suits them, and it's ready in a few days. Silk and rainbow spools make even simple shapes look special.",
      "Not sure what to print? A gift card lets them choose, and it can be emailed today or on a day you pick.",
    ],
    examples: ["Name keychains and tags", "Planters and pots", "Articulated dragons and fidget toys", "Phone and headphone stands", "Ornaments and figurines", "Desk organisers"],
    ideas: {
      heading: "Gift ideas",
      items: [
        "For dad: phone and headphone stands, cable tidies, car gadgets",
        "For mom: planters, vases, jewellery dishes",
        "For kids: articulated dragons, fidget toys, name keychains for backpacks",
        "For teachers: name plates, pen holders, bookmarks",
        "For friends: figures from their favourite game or show",
        "For the holidays: ornaments and custom name tags",
      ],
    },
    material: { id: "PLA", why: "PLA has the most colours, including silk, wood and rainbow. Tap a colour on the home page to see it on a sample print." },
    tips: [
      "For a custom name keychain, use a customisable model on MakerWorld or Printables: type the name, download the file, upload it here.",
      "Book a pickup time when you order, so the gift is in hand when you need it.",
      "Gift cards never expire and work on any order.",
      "Shopping for Christmas? See the Christmas gifts page for order-by dates.",
    ],
    search: "gift",
  },
  {
    slug: "prototypes-small-batch",
    name: "Prototypes and small batches",
    title: "3D printing prototype and small batch service",
    description: "Prototype 3D printing service in Victoria, BC: enclosures, jigs and product parts, from one prototype to a small batch of 50. Instant price online.",
    h1: "Prototype and small batch 3D printing",
    intro: [
      "Designing something? Upload the STL or 3MF from your CAD program and the price comes back in seconds. Change the size or material and watch it update, so you can decide before you commit.",
      "When the design works, order up to 50 copies of each part. The order fee is charged once, so each part costs less the more you order.",
    ],
    examples: ["Electronics enclosures", "Jigs, fixtures and drill guides", "Mounting brackets", "Product samples for a market or shop", "Cable management and clips", "Replacement parts for your own products"],
    material: { id: "PLA-CF", why: "PLA-CF is stiffer than plain PLA with a clean matte finish, good for brackets and enclosures. Pick PETG if the part needs to flex or handle heat." },
    tips: [
      "Export your model in millimetres. If it shows up tiny, it was probably in inches, and there's a button to fix it.",
      "3MF files from Bambu Studio, Orca Slicer or PrusaSlicer keep painted colours for multicolour parts.",
      "Holes usually print slightly small. Leave about 0.2 mm of extra clearance where parts fit together.",
    ],
    search: "enclosure",
  },
  {
    slug: "online-canada",
    name: "Shipping across Canada",
    title: "Online 3D printing service across Canada",
    absoluteTitle: "Online 3D Printing Service in Canada · Coastline Prints",
    description: "Online 3D printing in Canada: upload an STL or 3MF, get an instant quote, and have it printed in BC and shipped anywhere in Canada by Canada Post.",
    h1: "Online 3D printing, shipped anywhere in Canada",
    examplesHeading: "How shipping works",
    intro: [
      "Upload your STL or 3MF file, pick a material and colour, and the price shows up in seconds. No emailing back and forth for a quote. Pay online, and your print is made in Victoria, BC and mailed to you.",
      "Everything stays in Canada: printed here, shipped by Canada Post, priced in Canadian dollars. No customs, no border fees.",
    ],
    examples: [
      "Small, flat prints go by Lettermail in a padded mailer",
      "Anything bigger, or if you want tracking, goes in a Canada Post flat rate box",
      "Shipping is priced at checkout before you pay",
      "Multiple parts are packed together to keep shipping down",
    ],
    tips: [
      "Put all your parts in one order. You pay one order fee, and they ship in one package.",
      "Most prints are ready in 2 to 5 days, then it's Canada Post's delivery time.",
      "Your address is saved to your account, so next time checkout fills it in.",
    ],
    search: "",
  },
];

export const findUse = (slug: string) => uses.find((u) => u.slug === slug);
