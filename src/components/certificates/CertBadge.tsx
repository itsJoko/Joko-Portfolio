import type { Certificate } from "@/content/certificates";

// Short issuer names for the top line of the badge.
const ISSUERS: [RegExp, string][] = [
  [/ibm/i, "IBM"],
  [/cisco/i, "Cisco"],
  [/aws|amazon/i, "AWS"],
  [/certiport|pearson/i, "Certiport"],
  [/iitp|topcit/i, "IITP"],
  [/google/i, "Google"],
  [/meta/i, "Meta"],
];

// Hand-picked initials where the automatic ones would be unclear or repeat.
const INITIALS: Record<string, string> = {
  "TOPCIT, Level 3": "T3",
  "IT Specialist - Artificial Intelligence": "AI",
  "User Experience Design Fundamentals": "UX",
  "Introduction to Modern AI": "MA",
  "Planning a Machine Learning Project": "ML",
  "AI Fundamentals with IBM SkillsBuild": "AF",
  "Artificial Intelligence Fundamentals": "IF",
  "Fundamentals of Sustainability and Technology": "ST",
};
const FILLER = /^(a|an|and|the|of|to|with|for|in|on|basics|essentials|fundamentals|introduction|intro|level|\d+)$/i;

export function issuerShort(issuer: string) {
  return ISSUERS.find(([re]) => re.test(issuer))?.[1] ?? issuer.split(/[\s,-]+/)[0];
}

export function initialsOf(title: string) {
  if (INITIALS[title]) return INITIALS[title];
  const words = title.split(/[\s,\-:]+/).filter((w) => w && !FILLER.test(w));
  return (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? title).slice(0, 2)).toUpperCase();
}

/** 0–11 from "YYYY-MM-DD", or null when only the year is known. */
function monthOf(c: Certificate) {
  const m = c.date?.match(/^\d{4}-(\d{2})/);
  return m ? Number(m[1]) - 1 : null;
}

/**
 * A certificate drawn as a type-specimen card in the brand: issuer at the top, initials set
 * large in Funnel Display, the JC fold in the corner, and a ruler of the year's twelve months
 * with a tall tick in the section hue at the month it was earned. Every issuer looks like part
 * of one set; the real badge is one click away on the verify link.
 */
export function CertBadge({ c, size = "md" }: { c: Certificate; size?: "sm" | "md" | "lg" }) {
  const month = monthOf(c);
  return (
    <span aria-hidden className={`cert-spec cert-spec-${size}`}>
      <span className="cert-spec-fold" />
      <span className="cert-spec-inner">
        <span className="cert-spec-issuer">{issuerShort(c.issuer)}</span>
        <span className="cert-spec-initials">{initialsOf(c.title)}</span>
        <span className="cert-spec-ruler">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className={i === month ? "is-month" : i % 3 === 0 ? "is-quarter" : undefined} />
          ))}
        </span>
      </span>
    </span>
  );
}
