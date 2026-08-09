import { useContext, useEffect } from "react";
import { PageTitleContext } from "@/components/layout/page-title-context";

/** Call once per page component to set the top bar title — dynamic pages (e.g. a house's name) can't be derived from the static nav config. */
export function usePageTitle(title: string) {
  const ctx = useContext(PageTitleContext);
  useEffect(() => {
    ctx?.setTitle(title);
  }, [ctx, title]);
}

export function useCurrentPageTitle() {
  return useContext(PageTitleContext)?.title ?? "";
}
