import { useState, type ReactNode } from "react";
import { PageTitleContext } from "@/components/layout/page-title-context";

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");
  return <PageTitleContext.Provider value={{ title, setTitle }}>{children}</PageTitleContext.Provider>;
}
