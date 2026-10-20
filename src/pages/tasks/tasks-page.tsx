import { SectionPage } from "@/components/layout/section-page";
import { AssignmentsTab } from "@/pages/tasks/assignments-tab";
import { CatalogTab } from "@/pages/tasks/catalog-tab";

export function TasksPage() {
  return (
    <SectionPage
      title="Tasks"
      sections={[
        {
          id: "assignments",
          label: "Assignments",
          content: <AssignmentsTab />,
        },
        { id: "catalog", label: "Task catalog", content: <CatalogTab /> },
      ]}
    />
  );
}
