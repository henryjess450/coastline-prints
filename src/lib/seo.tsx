import { pickup } from "@config/pickup";
import { legal, seo, site } from "@config/site";
import { uses } from "@/lib/uses";

/** A full URL on the live site, for canonical links and structured data. */
export const absolute = (path = "/") => `${seo.url}${path === "/" ? "" : path}`;

/** "Victoria, BC" */
export const place = `${seo.city}, ${seo.region}`;

/**
 * Structured data for search engines (schema.org JSON-LD). `<` is escaped so
 * text from config can never close the script tag.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

const DAY_IDS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hhmm = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;

/**
 * The business as Google's map listing reads it. A service-area business: city
 * and areas served, no street address (pickup details only go out after payment).
 */
export function localBusiness() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${absolute()}/#business`,
    name: site.name,
    description: `Custom 3D printing in ${seo.neighbourhood}, ${seo.region}. Upload an STL or 3MF file, see the price right away, and pick up your print downtown or have it shipped anywhere in Canada.`,
    foundingDate: seo.founded,
    url: absolute(),
    logo: absolute("/icon.svg"),
    image: absolute("/opengraph-image"),
    email: legal.contactEmail,
    priceRange: "$",
    currenciesAccepted: "CAD",
    paymentAccepted: "Credit card, Debit card, Apple Pay, Google Pay, Interac e-Transfer",
    address: { "@type": "PostalAddress", addressLocality: seo.city, addressRegion: seo.region, addressCountry: "CA" },
    areaServed: seo.areaServed.map((name) => (name === "Canada" ? { "@type": "Country", name } : { "@type": "Place", name })),
    // Pickup hours, the only hours anyone can come by.
    openingHoursSpecification: Object.entries(pickup.hours)
      .filter((e): e is [string, [number, number]] => e[1] != null)
      .map(([d, [open, close]]) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: DAY_IDS[Number(d)], opens: hhmm(open), closes: hhmm(close) })),
    sameAs: [seo.instagram],
    knowsAbout: ["3D printing", "FDM printing", "PLA", "PETG", "Carbon fibre PLA", "Multicolour 3D printing", "STL files", "3MF files"],
    makesOffer: uses.map((u) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: u.title, url: absolute(`/3d-printing/${u.slug}`) },
    })),
  };
}

export function website() {
  return { "@context": "https://schema.org", "@type": "WebSite", name: site.name, url: absolute(), publisher: { "@id": `${absolute()}/#business` } };
}

/** The "Home > Uses > Cosplay" trail shown under a search result. */
export function breadcrumbs(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: absolute(t.path) })),
  };
}

export function faqPage(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
