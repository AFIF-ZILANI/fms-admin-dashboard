import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { usePageTitle } from "@/components/layout/use-page-title";

export type PageSection = { id: string; label: string; content: ReactNode };

/** A page whose sections are chosen in the sidebar (?tab=), not by an in-page tab row. First section is the default. */
export function SectionPage({ title, sections }: { title: string; sections: PageSection[] }) {
  const [params] = useSearchParams();
  const active = sections.find((s) => s.id === params.get("tab")) ?? sections[0]!;
  usePageTitle(`${title} · ${active.label}`);

  return (
    <section key={active.id} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
      {active.content}
    </section>
  );
}
