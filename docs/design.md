# FMS Admin Dashboard — Design Guidelines

Design system for the ZeroD Farms Management System **Admin Web Dashboard**
(the 15-page operator console — Analytics, Batches, Houses, Inventory,
Suppliers, Customers, Sales, Purchases, Payments, Finance, Employees, Admins,
Alerts, Audit Log, Settings — see `docs/FEATURES.md` §2). Scope is the web
dashboard only; the Employee mobile app is a separate client and may adopt
its own layout patterns, but should share the brand color and tone defined
here.

This doc describes both what's already implemented (`src/index.css`,
`components.json`) and what's proposed but not yet applied — each is
labeled so nobody mistakes a recommendation for shipped state.

## 1. Principles

1. **Data first, chrome second.** Every page surfaces operational or
   financial numbers (mortality %, FCR, cash position, stock levels). Color
   and decoration exist to make that data faster to read, not to compete
   with it.
2. **Calm neutral base, color means something.** The base UI stays
   grayscale (current shadcn `neutral` theme). When color appears — brand
   accent, status, alert level — it's a signal, not decoration. Don't tint
   things "for interest."
3. **Never color-alone for status.** Mortality alerts, low-stock warnings,
   and payment states drive real decisions. Every status needs an icon or
   label alongside its color (colorblind-safe, screenshot/print-safe).
4. **One status vocabulary, everywhere.** `RUNNING/CLOSED/SOLD`,
   `ACTIVE/RETIRED/DISPOSED`, `ACTIVE/RESOLVED`, and Alert levels
   `INFO/WARNING/CRITICAL` (`docs/FEATURES.md` §2.13) must map to the same
   colors on every page — a CRITICAL alert badge and a CRITICAL row
   highlight use the same token.
5. **Dark mode is not an afterthought.** Admins run this at all hours in a
   farm office. Every token ships a light and dark value together.

## 2. Color system

### 2.1 Foundation (implemented — `src/index.css`)

Base color is shadcn `neutral`, OKLCH, zero chroma. Don't hand-roll grays —
use these tokens via Tailwind classes (`bg-background`, `text-foreground`,
`border-border`, etc.), never raw hex.

| Token          | Light             | Dark               | Use                          |
| -------------- | ------------------ | ------------------- | ----------------------------- |
| `background`   | `oklch(1 0 0)`      | `oklch(0.145 0 0)`   | Page background                |
| `foreground`   | `oklch(0.145 0 0)`  | `oklch(0.985 0 0)`   | Body text                      |
| `card`         | `oklch(1 0 0)`      | `oklch(0.205 0 0)`   | Cards, panels                  |
| `muted`        | `oklch(0.97 0 0)`   | `oklch(0.269 0 0)`   | Subtle backgrounds, disabled   |
| `muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | Secondary text, captions      |
| `border` / `input` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | Dividers, field borders     |
| `primary`      | `oklch(0.205 0 0)`  | `oklch(0.922 0 0)`   | Default buttons, active nav (currently near-black/white "ink") |
| `destructive`  | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Destructive actions, CRITICAL |
| `radius`       | `0.625rem` base, scaled `sm→4xl` | same | Corners across all components |

Font: **Geist Variable** (`@fontsource-variable/geist`) via `--font-sans`.
Icons: **lucide-react**. Component style: shadcn **base-nova**, `cssVariables: true`.

### 2.2 Brand accent — proposed, not yet in `index.css`

There's currently no brand hue — `primary` is grayscale. For an
agriculture/poultry operations product, add a single green brand accent
alongside the neutral base, rather than replacing it wholesale:

| Token       | Light                    | Dark                      | Use                                                    |
| ----------- | ------------------------- | --------------------------- | ------------------------------------------------------- |
| `brand`     | `oklch(0.53 0.14 152)`     | `oklch(0.72 0.15 152)`       | Logo mark, marketing/login surfaces, key CTAs           |
| `brand-foreground` | `oklch(0.99 0 0)`  | `oklch(0.145 0 0)`         | Text/icons on `brand`                                    |

Guardrail: keep `primary` (buttons, active states) as the existing
grayscale ink for now — that's what makes a 15-page data console feel calm.
Reserve `brand` for the few places identity actually matters (login, sidebar
logo, empty-state illustration accents). Don't let `brand` leak into table
rows, badges, or charts — that's what semantic colors (2.3) are for.

### 2.3 Semantic / status colors — proposed

Maps directly to the domain vocabulary in `docs/FEATURES.md` (Alerts §2.13,
Batch/House/Item statuses). Add these next to the existing tokens in
`index.css`, following the same `--color-x` / `.dark` pattern:

| Semantic  | Maps to                                                          | Light                     | Dark                       |
| --------- | ------------------------------------------------------------------ | --------------------------- | ---------------------------- |
| `success` | `RUNNING`, `ACTIVE`, `RESOLVED`, positive cash position            | `oklch(0.6 0.14 152)`        | `oklch(0.7 0.15 152)`         |
| `info`    | `INFO` alert level, informational badges                          | `oklch(0.55 0.13 250)`       | `oklch(0.72 0.14 250)`         |
| `warning` | `WARNING` alert level, low-stock, nearing-expiration               | `oklch(0.75 0.15 80)`        | `oklch(0.8 0.15 85)`           |
| `critical`| `CRITICAL` alert level — alias to existing `destructive`, don't fork a second red | = `destructive` | = `destructive` |
| `neutral` | `CLOSED`, `SOLD`, `DISPOSED`, `RETIRED` — resolved/inactive, no action needed | = `muted-foreground` | = `muted-foreground` |

Guardrail: **critical reuses `destructive`** rather than a new red — one
red in the system, used for both "destructive action" and "critical alert,"
keeps the vocabulary small and the meaning unambiguous.

### 2.4 Charts / analytics (`chart-1`…`chart-5`, implemented)

Currently a grayscale ramp (`oklch(0.87→0.269 0 0)`). Fine for single-series
trend lines (mortality trend, feed trend) where grayscale + a single accent
line reads cleanly. The moment Analytics needs **categorical** comparison
(e.g. expense breakdown by category, §2.1 in FEATURES.md) grayscale stops
being enough — pull in the **dataviz** skill's categorical palette rather
than improvising hues by hand.

## 3. Typography

- Single family: Geist Variable, via `--font-sans` / `--font-heading`.
- Don't add a second display font "for headings" — Geist's variable weight
  axis already covers heading emphasis.
- Admin tables and dense data views default to `text-sm`; reserve base/`lg`
  sizes for page titles and empty states.
- **Tabular figures**: any numeric column (money, counts, weights, %) uses
  `font-variant-numeric: tabular-nums` so digits align vertically. This is
  a non-negotiable for a data console this dense — mismatched columns are
  the fastest way to make numbers feel untrustworthy.

## 4. Spacing & radius & layout

- Radius scale is already defined and derived from one base
  (`--radius: 0.625rem`, scaled `sm 0.6× → 4xl 2.6×`). Use the scale
  (`rounded-lg`, `rounded-xl`, …) — never an arbitrary `rounded-[7px]`.
- Layout spacing follows Tailwind's default 4px grid. No custom spacing
  scale needed for an admin console this size.
- **Sidebar**: fixed 240px, collapses to a 64px icon-only rail below a
  1024px viewport. Fixed left, no mega-menus — flat nav for an internal
  ops tool, not a 40-feature SaaS.
- **Content area**: max-width 1440px, centered with padding on ultrawide
  displays. Don't let tables stretch edge-to-edge on a 32" monitor.

## 5. Components

- **Buttons**: variants already cover the needed set (`default`, `outline`,
  `secondary`, `ghost`, `destructive`, `link`) — see
  `src/components/ui/button.tsx`. Don't add a `success`/`warning` button
  variant; those states belong on badges/banners, not on actions.
- **Status badges**: build once (`StatusBadge`, mapping status string →
  semantic token + icon), reuse across Batches/Houses/Inventory/Alerts —
  don't let each page invent its own badge coloring. Pill-shaped, small.
- **KPI card**: label (`muted-foreground`, 12px, uppercase tracking) →
  value (32px, tabular figures) → delta indicator (small, colored ↑/↓ vs
  previous period, using semantic tokens from §2.3, never raw green/red).
- **Data tables**: the primary surface across 12+ of the 15 pages. Row
  density over decoration — no zebra-striping with brand color, no heavy
  borders. Use `muted` backgrounds for hover/selected rows only. Sticky
  header, right-align numeric columns, sortable columns where the data
  supports it.
- **Charts**: minimal gridlines, no 3D or gradient fills, one accent color
  per chart max, tooltips on hover — see §2.4 for which palette to draw
  from (grayscale ramp for single-series, dataviz skill for categorical).
- **Alerts feed / toasts**: `info` / `warning` / `critical` map 1:1 to the
  Alert `level` enum — this is the one place all three semantic colors
  appear together, so the mapping in §2.3 has to be exact.
- **Empty states**: every list/table needs one — icon + one line of text +
  action button. Never ship a blank table with no explanation.
- **Loading states**: skeleton screens for tables and cards, not spinners —
  spinners give no sense of the layout that's about to appear.

## 6. Guardrails (do / don't)

- **Do** consume color only through CSS variable tokens (`bg-success`,
  `text-warning`, …). **Don't** hardcode hex/rgb/oklch literals in
  component files — if a color is needed twice, it belongs in `index.css`.
- **Do** pair every status color with an icon or text label. **Don't** rely
  on a colored dot or row tint alone.
- **Do** keep one color per meaning (`critical` = `destructive`, always).
  **Don't** introduce a second "red" or a page-specific status palette.
- **Do** ship light + dark values together for any new token. **Don't** add
  a color to `:root` without its `.dark` counterpart in the same change.
- **Do** hold WCAG AA contrast: body text ≥ 4.5:1, large text/icons ≥ 3:1
  against its background. **Don't** place `muted-foreground` text on
  `muted` backgrounds without checking contrast first (both are close in
  lightness).
- **Do** use the existing radius/spacing scale. **Don't** hand-tune a
  one-off corner radius or margin for a single component.
- **Do** require confirmation before a `destructive` action fires.
  **Don't** color a primary action `destructive` just to make it "stand
  out" — that token means irreversible/dangerous, nothing else.

## 7. Accessibility checklist

- [ ] Every interactive element has a visible `focus-visible` ring
      (already handled by `buttonVariants`'s `focus-visible:ring-ring/50` —
      keep that pattern for any new interactive component).
- [ ] Status conveyed by icon/text, not color alone (§6).
- [ ] Text/background pairs meet AA contrast in both themes.
- [ ] Icon-only buttons have an accessible label (`aria-label`).

## 8. Where this lives

| What | File |
| ---- | ---- |
| Color tokens, theme, base styles | `src/index.css` |
| shadcn config (style, base color, aliases) | `components.json` |
| Button variants (reference pattern for new components) | `src/components/ui/button.tsx` |
| `cn()` class merge helper | `src/lib/utils.ts` |
| Feature/page inventory this system serves | `docs/FEATURES.md` |
