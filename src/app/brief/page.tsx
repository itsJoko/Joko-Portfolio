import type { Metadata } from "next";
import { BriefView } from "@/components/brief/BriefView";
import { FEATURED_CERTS, realCertificates, type Certificate } from "@/content/certificates";
import { getAllCertificates } from "@/lib/credly";

export const metadata: Metadata = {
  title: "Brief",
  description: "Joko Comia in one minute: availability, work, skills and contact, for recruiters, hiring managers and freelance clients.",
};

// Certificates come from Credly; re-read once a day like the Certificates page.
export const revalidate = 86400;

export default async function BriefPage() {
  const all = await getAllCertificates(realCertificates);
  const featured = FEATURED_CERTS.map((t) => all.find((c) => c.title === t)).filter((c): c is Certificate => !!c);
  return <BriefView certificates={featured} certificateCount={all.length} />;
}
