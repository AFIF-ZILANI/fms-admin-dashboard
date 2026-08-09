import { createContext } from "react";

export const PageTitleContext = createContext<{ title: string; setTitle: (t: string) => void } | null>(null);
