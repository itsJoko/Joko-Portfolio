import type { Metadata } from "next";
import { HashTarget } from "@/components/projects/HashTarget";
import { ProjectGrid } from "@/components/projects/ProjectGrid";
import { PageHeader } from "@/components/ui";
import { projects } from "@/content/projects";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <>
      <HashTarget />
      <PageHeader title="Projects" lead="Everything I've designed and built. Open one for my role and what came of it." count={projects.length} />
      <ProjectGrid projects={projects} />
    </>
  );
}
