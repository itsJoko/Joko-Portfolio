import { realCertificates } from "@/content/certificates";
import { experience } from "@/content/experience";
import { stack } from "@/content/stack";
import { getAllCertificates } from "@/lib/credly";
import { ProfileTabs } from "./ProfileTabs";

/**
 * The Overview's short look at the Profile pages, only what a recruiter scans for: where and as what,
 * how recently, what's verified, and the main tools. Fetched here on the server (Credly is refreshed
 * daily), shown by the client tabs.
 */
export async function ExperiencePreview() {
  const roles = experience.map((e) => ({ short: e.short, role: e.role, kind: e.kind, when: `${e.start} – ${e.end || "Present"}` }));
  const certs = (await getAllCertificates(realCertificates)).slice(0, 6).map(({ title, issuer, year, href, image }) => ({ title, issuer, year, href, image }));
  const tools = stack
    .map((g) => ({ label: g.label, names: g.items.filter((i) => i.featured).map((i) => i.name) }))
    .filter((g) => g.names.length > 0);

  return <ProfileTabs roles={roles} certs={certs} tools={tools} />;
}
