import type { Metadata } from "next";
import { GraphicsShowcase } from "@/components/graphics/GraphicsShowcase";
import { PageHeader } from "@/components/ui";
import { CATEGORIES, collections } from "@/content/graphics";

export const metadata: Metadata = { title: "Graphics" };

const pieces = collections.reduce((n, c) => n + c.count, 0);

export default function GraphicsPage() {
  return (
    <>
      <PageHeader title="Graphics" lead={`Brand identities, pubmats, posters and more: ${pieces} pieces in ${collections.length} collections.`} count={collections.length} />
      <GraphicsShowcase collections={collections} categories={CATEGORIES} />
    </>
  );
}
