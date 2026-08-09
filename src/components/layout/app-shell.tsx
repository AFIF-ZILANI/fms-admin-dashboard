import { Outlet } from "react-router";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { PageTitleProvider } from "@/components/layout/page-title";

export function AppShell() {
  return (
    <PageTitleProvider>
      <div className="min-h-svh bg-background">
        <Sidebar />
        <div className="pl-16 lg:pl-60">
          <TopBar />
          <main className="mx-auto max-w-[1440px] px-6 py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </PageTitleProvider>
  );
}
