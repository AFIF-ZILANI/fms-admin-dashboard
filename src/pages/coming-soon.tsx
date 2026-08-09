import { Construction } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { usePageTitle } from "@/components/layout/use-page-title";

export function ComingSoon({ title }: { title: string }) {
  usePageTitle(title);
  return (
    <EmptyState icon={Construction} title={`${title} is on the build roadmap`} description="Not built yet — see docs/PRD.md §7 for the build order." />
  );
}
