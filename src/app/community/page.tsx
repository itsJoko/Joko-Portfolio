import type { Metadata } from "next";
import { CommunityStudio } from "@/components/community/CommunityStudio";

export const metadata: Metadata = {
  title: "Community",
  description: "Design by committee: everyone online votes every 15 seconds on the next decision for one shared poster.",
};

export default function CommunityPage() {
  return <CommunityStudio />;
}
