import type { Metadata } from "next";
import { IslandPiece } from "@/components/playground/IslandPiece";

export const metadata: Metadata = { title: "Playground" };

export default function PlaygroundPage() {
  return (
    <>
      <h1 className="font-display text-[clamp(3rem,8vw,6rem)] font-semibold leading-[0.95] tracking-[-0.03em]">Playground</h1>
      <p className="mt-6 max-w-prose leading-relaxed text-muted">Small interactive things to play with.</p>

      <section aria-labelledby="island" className="mt-10">
        {/* The island's title card shows its name; the heading stays for screen readers and the outline. */}
        <h2 id="island" className="sr-only">
          Studio island
        </h2>
        <div className="mt-6">
          <IslandPiece />
        </div>
      </section>
    </>
  );
}
