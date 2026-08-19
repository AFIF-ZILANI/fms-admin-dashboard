import { Outlet } from "react-router";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { PageTitleProvider } from "@/components/layout/page-title";
import { useTheme } from "next-themes";

export function AppShell() {
  const theme = useTheme();
  return (
    <PageTitleProvider>
      <div className="min-h-svh bg-background">
        <Sidebar theme={theme} />
        <div className="pl-16 lg:pl-60">
          <TopBar theme={theme} />
          <main className="mx-auto max-w-360 px-6 py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </PageTitleProvider>
  );
}
