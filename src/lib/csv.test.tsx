// Run with `bun test src/lib` -- no web test runner is set up, bun's built-in one needs none.
import { expect, test } from "bun:test";
import { csvFileName, nodeText, toCsv } from "./csv";

function Badge({ label }: { label: string }) {
  return <span aria-label={label} />;
}

test("nodeText reads nested text, component labels, and spaces sibling elements", () => {
  expect(nodeText("Plain")).toBe("Plain");
  expect(nodeText(42)).toBe("42");
  expect(nodeText(null)).toBe("");
  expect(
    nodeText(
      <div>
        <span>Morning reading</span>
        <span>Environment</span>
      </div>
    )
  ).toBe("Morning reading Environment");
  expect(nodeText(<span>{12} kg</span>)).toBe("12 kg");
  expect(nodeText(<Badge label="Overdue" />)).toBe("Overdue");
  const hidden = false as boolean;
  expect(nodeText(<span>{hidden && "hidden"}</span>)).toBe("");
});

test("toCsv quotes what needs it and defuses formulas", () => {
  expect(toCsv(["Name", "Note"], [["Karim, Mia", 'said "hi"']])).toBe('Name,Note\r\n"Karim, Mia","said ""hi"""');
  expect(toCsv(["A"], [["=HYPERLINK(1)"], ["-5"], ["1,234.5"], [-3], ["+8801712345678"], ["+cmd|calc"]])).toBe(
    'A\r\n\'=HYPERLINK(1)\r\n-5\r\n"1,234.5"\r\n-3\r\n+8801712345678\r\n\'+cmd|calc'
  );
});

test("csvFileName slugs the page title and dates the file", () => {
  expect(csvFileName("Inventory · Stock ledger", new Date("2026-10-20T08:00:00Z"))).toBe(
    "inventory-stock-ledger-2026-10-20.csv"
  );
  expect(csvFileName("", new Date("2026-10-20T08:00:00Z"))).toBe("export-2026-10-20.csv");
});
