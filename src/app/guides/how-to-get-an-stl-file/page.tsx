import type { Metadata } from "next";
import Link from "next/link";
import { uploads } from "@config/site";
import { GuidePage } from "@/components/guides/GuidePage";
import { findGuide } from "@/lib/guides";

const guide = findGuide("how-to-get-an-stl-file");
export const metadata: Metadata = { title: guide.title, description: guide.description, alternates: { canonical: `/guides/${guide.slug}` } };

export default function StlGuide() {
  return (
    <GuidePage
      guide={guide}
      answer={
        <p>
          Download one for free from a model site like Printables, MakerWorld or Thingiverse (our <Link href="/library">Find a model</Link> page searches several at once), or make your own in a free program like
          Tinkercad and export it as STL. Then upload it here to see the price.
        </p>
      }
    >
      <h2>What an STL file is</h2>
      <p>
        An STL file describes the shape of a 3D object as a mesh of tiny triangles. It has no colour, just shape. A 3MF file is similar but can also carry colours, which is how multicolour prints work. We take both, up to{" "}
        {uploads.maxFileMb} MB each.
      </p>

      <h2>1. Find a model someone already made</h2>
      <p>Millions of models are free to download. Good places to look:</p>
      <ul>
        <li>
          <strong>Printables</strong> and <strong>MakerWorld</strong>: huge libraries, mostly free, with photos of real prints.
        </li>
        <li>
          <strong>Thingiverse</strong>: the oldest library, especially good for replacement parts and practical things.
        </li>
        <li>
          <strong>MyMiniFactory</strong> and <strong>Cults3D</strong>: lots of figures, tabletop miniatures and cosplay, some paid.
        </li>
      </ul>
      <p>
        Our <Link href="/library">Find a model</Link> page searches these in one go. Download the STL or 3MF, then upload it on the <Link href="/order">order page</Link>.
      </p>
      <p>Check the licence. Most free models allow printing for personal use. Selling prints of someone else&apos;s model usually needs their permission.</p>

      <h2>2. Personalise a model</h2>
      <p>
        Many models on MakerWorld and Printables are customisable: type a name or change a size on the model page, then download your version. This is the easiest way to make{" "}
        <Link href="/3d-printing/gifts">name keychains, tags and gifts</Link>.
      </p>

      <h2>3. Make your own</h2>
      <ul>
        <li>
          <strong>Tinkercad</strong> (free, in your browser): build shapes from blocks. Good for simple parts and first-timers.
        </li>
        <li>
          <strong>Onshape</strong> or <strong>Fusion</strong> (free for hobby use): proper CAD for parts that need exact measurements.
        </li>
        <li>
          <strong>Blender</strong> (free): best for sculpted, organic shapes like characters.
        </li>
      </ul>
      <p>When you&apos;re done, export as STL or 3MF in millimetres.</p>

      <h2>Before you upload</h2>
      <ul>
        <li>Measure the real thing it needs to fit, and compare with the size shown in the 3D preview.</li>
        <li>If the model shows up tiny, it was made in inches. Press &ldquo;Modelled in inches?&rdquo; and it&apos;s fixed.</li>
        <li>The site checks every file for holes and other mesh problems and tells you if it finds any.</li>
      </ul>
    </GuidePage>
  );
}
