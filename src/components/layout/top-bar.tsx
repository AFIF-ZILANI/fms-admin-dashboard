import { Link } from "react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentPageTitle } from "@/components/layout/use-page-title";
import type { UseThemeProps } from "next-themes";

export function TopBar({ theme }: { theme: UseThemeProps }) {
  const title = useCurrentPageTitle();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label="theme toggle"
          onClick={() =>
            theme.setTheme(theme.theme === "dark" ? "light" : "dark")
          }
        >
          {theme.theme === "dark" ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
              />
            </svg>
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Alerts"
          nativeButton={false}
          render={<Link to="/alerts" />}
        >
          <Bell className="size-4" />
        </Button>
      </div>
    </header>
  );
}
