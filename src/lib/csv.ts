import { isValidElement, type ReactNode } from "react";

/**
 * The plain text a rendered cell shows, for export. Walks children; a component with no children
 * gives up the prop that holds its visible text (StatusBadge's `label`, for one). Sibling elements
 * are space-separated so "Name" + "subtitle" doesn't read as "Namesubtitle".
 * ponytail: a heuristic over the element tree -- a column whose text lives somewhere else (a hook,
 * a computed child) sets `exportValue` on the column instead.
 */
export function nodeText(node: ReactNode): string {
  return walk(node).replace(/\s+/g, " ").trim();
}

function walk(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number" || typeof node === "bigint") return String(node);
  if (Array.isArray(node)) return node.map((child) => (isValidElement(child) ? ` ${walk(child)} ` : walk(child))).join("");
  if (isValidElement(node)) {
    const props = node.props as Record<string, unknown>;
    if (props.children !== undefined) return walk(props.children as ReactNode);
    for (const key of ["label", "text", "value", "title"]) {
      const v = props[key];
      if (typeof v === "string" || typeof v === "number") return String(v);
    }
  }
  return "";
}

/** One CSV field: quoted when it has to be, and a text cell that a spreadsheet would run as a formula
 * (=, +, -, @ at the start) gets a leading apostrophe. Numbers and phone numbers (-5, +880 1712-345678)
 * carry no formula and are left alone. */
function field(value: string | number): string {
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s) && !/^[+-]?\d[\d\s,.()-]*$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map((r) => r.map(field).join(",")).join("\r\n");
}

/** "Inventory · Stock ledger" -> "inventory-stock-ledger-2026-10-20.csv" */
export function csvFileName(title: string, now = new Date()): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "export"}-${now.toISOString().slice(0, 10)}.csv`;
}

export function downloadCsv(fileName: string, csv: string) {
  // The BOM makes Excel read the file as UTF-8, so Bangla names survive.
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
