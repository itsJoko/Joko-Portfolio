import type { Metadata } from "next";
import { CertificateShelf } from "@/components/certificates/CertificateShelf";
import { PageHeader } from "@/components/ui";
import { realCertificates } from "@/content/certificates";
import { getAllCertificates } from "@/lib/credly";

export const metadata: Metadata = { title: "Certificates" };

// Re-read Credly once a day, so a new badge shows up without a deploy.
export const revalidate = 86400;

export default async function CertificatesPage() {
  const certificates = await getAllCertificates(realCertificates);

  return (
    <>
      <PageHeader
        title="Certificates"
        lead="Certifications, courses and trainings. Open one to verify it."
        count={certificates.length || undefined}
      />

      {certificates.length ? (
        <CertificateShelf certificates={certificates} />
      ) : (
        <p className="about-text text-muted">Certificates are loading from Credly. Check back shortly.</p>
      )}
    </>
  );
}
