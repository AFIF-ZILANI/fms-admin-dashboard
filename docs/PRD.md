# ZeroD Farms Management System — Admin Web Dashboard PRD

**Status:** Build-ready blueprint · **Scope:** Admin Web Dashboard only (15 pages)
**Companion docs:** `docs/FEATURES.md` (functional spec this PRD is built on), `docs/design.md`
(design system this PRD applies), `docs/api.md` (endpoints this PRD wires up),
`server/prisma/schema.prisma` (data model this PRD's fields are drawn from).

This document is the single source of truth for building every page. Each page section
below is meant to be picked up and built directly — layout, fields, actions, states, and
the endpoints it talks to are all specified. Where a page's behavior depends on a
non-obvious rule from the backend design docs, that rule is called out inline so the
person building the page doesn't have to go dig for it.

---

## 1. Product Overview

### 1.1 What this is

A farm operations console for a commercial poultry (broiler) operation: batches of birds
moving through houses, feed/medicine/equipment inventory, purchases from suppliers, sales
to customers, cash movement across payment instruments, employee performance and payroll,
and the alerts/audit trail that keep all of it accountable. One farm, one operator profile
class in v1 — every page ships full CRUD with no permission gating, because the schema
supports multi-user roles but the enforcement layer doesn't exist yet (see §5).

### 1.2 Personas

| Persona | Who | Uses |
| --- | --- | --- |
| Owner/Admin | The farm operator — the only user of this dashboard in v1 | All 15 pages, full access |
| Employee (Manager/Worker/Intern) | Field staff | **Not** this dashboard — a separate Employee Mobile App (`docs/FEATURES.md` §3), out of scope here |

Suppliers, Customers, and Doctors are records managed *by* the Admin — they have no login
and no page of their own beyond the CRUD pages listed below.

### 1.3 Scope boundary

This PRD covers the **Admin Web Dashboard** and nothing else. The Employee Mobile App has
its own confirmed feature set (`docs/FEATURES.md` §3 — Login, Home, QR Scan, daily logging
forms, offline-first sync) and gets its own PRD when that build starts. Don't pull mobile
screens into this document or this build pass.

---

## 2. Global App Shell

Every one of the 15 pages renders inside the same shell. Build the shell once, first,
before any individual page.

**Sidebar** — fixed left, 240px wide; collapses to a 64px icon-only rail below a 1024px
viewport. Flat single level, no mega-menus, no nested flyouts — this is an internal ops
tool, not a 40-feature SaaS. Order (matches the build roadmap in §7):

```
Analytics
Batches
Houses
Inventory
Suppliers
Customers
Sales
Purchases
Payments
Finance
Employees
Admins
─────────────
Alerts            (badge: unresolved-critical count)
Audit Log
Settings
```

Alerts, Audit Log, and Settings are visually separated (divider) from the operational
pages above — they're cross-cutting/system pages, not domain modules.

**Top bar** — page title (left), page-specific global filters when the page has them
(date range / batch / house — Analytics and several list pages), Alerts bell with an
unresolved-critical badge count (right, links to Alerts page), avatar/profile menu
(placeholder — no auth session to back it yet, see §5).

**Content area** — max-width 1440px, centered, padded on ultrawide displays. Don't let
tables stretch edge-to-edge on a large monitor.

---

## 3. Design Language (applied throughout — full spec in `docs/design.md`)

Restated here only as a quick reference; `docs/design.md` is the source of truth for
values.

- **Color**: grayscale `neutral` base (shadcn), single `brand` green accent reserved for
  login/logo/empty-state illustrations only — never in tables/badges/charts. Status uses
  five semantic tokens: `success`, `info`, `warning`, `critical` (alias of `destructive`),
  `neutral` (resolved/inactive states).
  - **Layout note (v1 CSS gap):** the `brand` and semantic tokens (§2.2–2.3 of
    `docs/design.md`) are *proposed*, not yet in `src/index.css`. Adding them is a
    prerequisite for any page that renders a `StatusBadge` — do it once, before Batches
    (the first status-bearing page in the build order).
- **Typography**: Geist Variable only. Dense tables at `text-sm`. Every numeric column
  (money, counts, weights, %) uses `tabular-nums` — non-negotiable, mismatched digit
  columns read as untrustworthy on a data console this dense.
- **Components to build once, reuse everywhere:**
  - `StatusBadge` — status string → semantic token + icon. Every status-bearing page
    below (Batches, Houses, Inventory/StockUnit, Purchases, Sales, Alerts, Admins/
    Employees `is_active`) uses this same component. Build it before any of those pages.
  - `KPICard` — label (muted, uppercase, 12px) → value (32px, tabular) → delta indicator
    (colored ↑/↓, semantic tokens only). Used on Analytics and as summary strips on
    Batches/Inventory/Finance detail pages.
  - `DataTable` — sticky header, right-aligned numeric columns, sortable where the data
    supports it, `muted` background for hover/selected rows only, no zebra striping.
    This is the primary surface on 12 of the 15 pages — build it early and generically.
  - Empty state (icon + one line + action button) and skeleton loading (never spinners)
    on every list/table without exception.
- **Destructive actions** (deactivate, dispose, close batch) always confirm before firing.

---

## 4. Cross-Cutting Data Rules (affect page behavior, not just look)

These apply across every page and are called out per-page below only where they change
what the UI must do.

- **Soft-delete only.** `Item`, `Suppliers`, `Customers`, `Profiles` (Admins/Employees)
  never get a hard delete — every "remove" action is a Deactivate button that flips
  `is_active`, with a matching Reactivate. No page has a destructive delete for these.
- **Append-only history, not editable rows.** `Consumption`, `MortalityLog`,
  `BatchHouseAllocation`, `PerformanceScoreEntry`, `StockLedger`, `Purchase`/
  `PurchaseItem`, `Sale`/`BirdSale`, `Payment` are never edited in place — the UI for
  these is always "add a new entry," never a row-level Edit button. A correction is a new
  offsetting entry, visible in the same feed.
- **No auth yet.** Every create/update action needs an explicit actor picker (or a
  hardcoded "current admin" stand-in) in the request body — there's no session to infer
  it from. Flag this plainly in any form that writes `recorded_by_id` / `given_by_id` /
  `administered_by_id` / `bound_by_id` / `changed_by_id`.
- **Money fields serialize as strings** (Prisma `Decimal` → JSON string over the wire).
  Parse before formatting/summing client-side; don't treat them as numbers straight off
  the API response.

---

## 5. V1 Boundaries (state once, don't repeat per page)

Builders should not scope-creep these into the current pass:

- **No auth/permission enforcement.** Schema and the permission matrix
  (`docs/FEATURES.md` §3.5) are ready; no middleware exists. Every page ships full access
  for now — build the permission-gating hooks as no-ops you can wire up later, don't skip
  building them at all.
- **Bird-days shared-cost allocation is unbuilt (v2).** The Finance page's shared-period
  queue and the Analytics P&L numbers show these costs as **unallocated** — don't invent
  a formula in the frontend.
- **FCR (feed conversion ratio) is not computed** — no feed-to-weight unit conversion
  table exists. Don't add an FCR tile until the backend has it.
- **No avatar upload endpoint** despite `Avatars.image_url` existing on the schema —
  Admin/Employee profile forms get a URL field, not a file picker, for now.
- **Alerts are pull-based** (`POST /api/alerts/scan`), not real-time push. The Alerts
  page polls or offers a manual "Scan now," it doesn't subscribe to a socket.
- **Audit Log will render empty.** The read endpoint exists; nothing writes to it yet
  (no Prisma middleware in place). Build the page against real API shape, expect a real
  empty state, don't fake data.

---

## 6. Pages

Each page follows the same template: **Purpose · Layout · Sub-pages · Fields ·
Actions · Status/Badges · Empty/Loading · Endpoints · Notes.**

### 6.1 Analytics

**Purpose.** The one read-only page — no records of its own, aggregates every other
module. Landing page after login.

**Layout.** Top bar carries the global filter row (date range, batch, house — applies
to every section below it). Body is a vertical stack of five sections, each its own card
or card-group:

1. **Farm overview** — `KPICard` row: active batch count, total birds alive, houses
   occupied/empty, employee headcount, unresolved alerts by level.
2. **Batch performance** — table or card grid, one row per active batch: mortality rate
   (7d/30d/cumulative), FCR *(deferred, §5)*, growth curve (sparkline from
   `WeightRecords`), days-to-market vs. `expected_selling_date`.
3. **Financial dashboard** — `KPICard` row: revenue MTD (`Sale` + `BirdSale`), expenses
   MTD (`Expense`), gross profit/loss, cash position per `PaymentInstrument`, outstanding
   payables sum.
4. **Batch P&L report** — table, one row per batch: revenue − direct expenses − shared
   costs *(shows "unallocated," §5)* − depreciation share = profit; feed cost/bird, cost/
   kg.
5. **Trend charts** — mortality trend, feed consumption trend, avg sale price/kg trend,
   expense breakdown by category. Single-series lines use the grayscale chart ramp
   (`chart-1`…`chart-5`); the categorical expense-breakdown chart needs the **dataviz**
   skill's categorical palette, not grayscale (`docs/design.md` §2.4).

**Actions.** "Export CSV" per section. Global filter bar applies to all five sections at
once (no per-section filter overrides in v1).

**Status/Badges.** None — this page is charts/numbers, not status rows.

**Empty/Loading.** Skeleton `KPICard`s and skeleton chart placeholders on first load; a
farm with zero batches shows an empty state on sections 2 and 4 only (1/3/5 still render
with zeroes).

**Endpoints.** `GET /api/analytics/overview`, `/batches/:id/performance`,
`/batches/:id/pnl`, `/financial?month=`.

**Notes.** Nothing here writes data — if a form appears on this page, it's on the wrong
page.

---

### 6.2 Batches

**Purpose.** The operational core — every bird's lifecycle from chick purchase to sale
or death runs through a batch.

**Layout — List view.** `DataTable`: `batch_code`, breed, phase, status badge, days
running, current bird count, mortality %. Filter bar: status (RUNNING/CLOSED/SOLD),
breed, phase. Sort by starting date, days running, mortality rate. Row click → detail.
"+ Create batch" button top-right opens a form (modal or dedicated route — modal
preferred, this form is short).

**Layout — Detail view.** Header strip: `batch_code`, status badge, age in days, live
bird count, "Close batch" button (top-right, disabled until reconciliation checks pass —
see Notes). Below the header, an 8-tab layout:

| Tab | Content |
| --- | --- |
| Overview | Phase, live bird count, houses currently occupied, age, running mortality % — summary `KPICard` row |
| House Allocations | History table of `BatchHouseAllocation` (from/to house, quantity, reason, date); "+ Transfer" and "+ Adjustment" buttons |
| Mortality | Log table (`count_died`, cause note, date, recorded by); cumulative mortality line chart above the table; "+ Log mortality" |
| Weight | Sample weigh-in table (avg weight, sample size, house, date); growth curve chart; "+ Log weight" |
| Feeding Program | `BatchFeedingProgram` table: feed type per day range (PRE_STARTER→STARTER→GROWER→FINISHER); actual vs. planned consumption chart; "+ Add program row" |
| Treatments | `Medications`/`Vaccinations` combined history table, each row linked to its source `Consumption` entry; "+ Log treatment" |
| Environment | Readings table (temp/humidity/ammonia/CO2/pressure) filterable by house and time-of-day; "+ Log reading" |
| Financials | Direct expenses, chick/feed purchase cost, bird sales, depreciation share, computed P&L — read-only summary, links out to Finance/Sales for detail |

**Create batch form fields.** `batch_code`, breed, `initial_chick_count`,
`init_chicks_avg_wt`, `starting_date`, `expected_selling_date`, initial house picker.
Submitting this creates the `INITIAL` `BatchHouseAllocation` and the chick
`PurchaseItem` together in one transaction — the form should feel like one step, not two.

**Status/Badges.** `status` (RUNNING = success, CLOSED = neutral, SOLD = neutral) via
`StatusBadge`, shown in the list, the detail header, and anywhere a batch is referenced
elsewhere (Houses, Sales, Finance).

**Empty/Loading.** List: empty state "No batches yet — create your first batch." Detail
tabs: each tab has its own empty state (e.g., Mortality tab with zero entries shows
"No mortality recorded" — a genuinely good state to be empty in, don't make it look like
an error).

**Endpoints.** `GET/POST /api/batches`, `GET/PATCH /api/batches/:id`,
`POST /api/batches/:id/close`, `GET/POST /api/batch-house-allocations`,
`GET /api/batch-house-balances`, `GET/POST /api/mortality-logs`,
`GET/POST /api/weight-records`, `GET/POST /api/batch-feeding-programs`,
`GET/POST /api/consumptions`, `GET/POST /api/medications`, `/vaccinations`,
`GET/POST /api/environment-records`.

**Notes.**
- `BatchHouseBalance` (the cached live-count) only ever updates from three places:
  a `BatchHouseAllocation`, a `MortalityLog`, or a `BirdSale` insert — all three run in
  the same transaction as the balance update on the backend. The frontend never writes
  to balance directly; it's always a derived read.
- "Close batch" validates bird-count reconciliation (sold + died = initial, or an
  explicit override reason) — the button's confirm dialog needs a reason field for the
  override path, not just a plain confirm.

---

### 6.3 Houses

**Purpose.** Physical housing units batches occupy; simple CRUD + occupancy view.

**Layout — List.** `DataTable`: name, type, number, capacity, occupancy status (derived:
empty when `BatchHouseBalance.quantity = 0` across all batches), current batch(es) if
occupied. "+ Add house" opens a short form.

**Layout — Detail.** Header: name/type/number, capacity, occupancy badge. Body: current
occupant batch(es) via `BatchHouseBalance`, tabbed or stacked history sections —
allocation history, mortality history, environment reading history, all scoped to this
house.

**Fields.** `name`, `type` (enum), `number`, `capacity` (optional).

**Actions.** Create/Edit house. Deactivate (soft delete). "Mark cleaned/available" is
implicit — no explicit status field to set, it's derived from balance = 0, so no button
needed beyond a visual "Empty" badge.

**Status/Badges.** Occupancy: Occupied (info) / Empty (neutral). Over-capacity: if a
pending transfer would push a house's count past `capacity`, show a `warning` inline on
the transfer form, not a passive badge.

**Empty/Loading.** "No houses set up yet — add your first house."

**Endpoints.** `GET/POST /api/houses`, `GET/PATCH /api/houses/:id`,
`POST /:id/deactivate`, `/reactivate`.

**Notes.** Houses page is intentionally simple — most of the interesting behavior
(allocations, transfers) is initiated from the Batches page, not here. This page is the
house-centric *view* of that same data.

---

### 6.4 Inventory

**Purpose.** Everything the farm consumes or owns — feed, medicine, equipment — across
two tracking models: coded per-unit (QR-tagged bottles/equipment) and aggregate ledger
(bulk feed). Nine sub-sections under one Inventory nav item.

**Layout.** Sub-nav (tabs or a secondary sidebar) across the top of the page:

| Sub-page | Layout | Fields / Content |
| --- | --- | --- |
| **Item Catalog** | `DataTable` + "+ Add item" | `name`, category, unit, `reorder_level`, `preferred_reorder_qty`, `lead_time_days`, active toggle. Dedup guard on `normalized_key` — form should warn on a likely-duplicate name before submit. |
| **Low-Stock** | Filtered `DataTable`, no create action | Items where current stock < `reorder_level`, sourced from aggregate `StockLedger` balance or `StockUnit` count. Feeds an Alert automatically. |
| **Coded Units** | List + detail drawer | List: code, item, status badge, house, remaining qty. Detail: full consumption history, bound-by/when, "Relocate" and "Mark disposed" actions. "+ Provision blank codes" (batch-prints a run of `UNASSIGNED` codes). "Bind code" flow (scan or manual entry) attaches a code to a `PurchaseItem` lot. |
| **Assets** | `DataTable` + detail | Equipment: name, purchase cost, useful life (batches), status badge, per-batch depreciation history, assign-to-batch/house action. |
| **Stock Ledger** | Read-only `DataTable` | IN/OUT movement log, filter by item/date/reason. "Record opening balance" is the only write action here. |
| **Adjustments** | `DataTable` + "+ New adjustment" | Correction entries: `quantity_before/after`, reason, note — always audited, never edits history. |
| **Warehouses** | Simple `DataTable` + form | CRUD storage locations (name only). |
| **Organizations** | `DataTable` + form | Manufacturer/importer/distributor per item, for recall tracing; link an Item to an Organization with a role. |
| **Consumption Log** | Read-only `DataTable` | Cross-reference of everything drawn (feed, medicine, equipment) by batch/house/date/item, regardless of source page. |

**Status/Badges.** `StockUnit.status` is the important one — 5-state lifecycle,
`StatusBadge` mapping:

```
UNASSIGNED → info      (printed, unbound)
IN_STOCK   → success   (bound, in storage)
IN_USE     → info      (opened/depleting, or equipment in active use)
CONSUMED   → neutral   (remaining_quantity hit 0 — medicine/vaccine only)
DISPOSED   → neutral   (reachable from almost any state)
```

Equipment (`Asset`) never reaches `CONSUMED` — quantity=1 marks `IN_USE` and it stays
there until `DISPOSED`.

**Empty/Loading.** Each sub-page has its own empty state; Low-Stock's empty state is a
*good* state ("Nothing below reorder level right now") — style it positively, not like a
generic "no data" placeholder.

**Endpoints.** `GET/POST /api/items`, `/:id`, `/:id/deactivate`, `/reactivate`;
`GET/POST /api/warehouses`, `/:id`; `GET/POST /api/organizations`,
`POST /api/item-organizations`; `GET/POST /api/stock-units`, `/:id`,
`GET /code/:code`, `POST /:id/bind`, `/relocate`, `/dispose`; `GET/POST /api/assets`,
`PATCH /:id/status`; `GET /api/stock-ledger`; `GET/POST /api/inventory-adjustments`.

**Notes.**
- Only medicine/vaccine/equipment get per-unit QR codes — feed/bulk items always stay on
  the aggregate Stock Ledger. Don't build a "generate code" option on bulk-category
  items.
- House location on a `StockUnit` is a manual field, not auto-synced to
  `BatchHouseAllocation` — the Relocate action is the only thing that changes it.
- Code type is QR with human-readable text printed underneath (error-correction
  tolerates dirty/torn farm labels; text is the fallback until a scanning app exists).

---

### 6.5 Suppliers

**Purpose.** Purchase counterparties — no login, records only.

**Layout — List.** `DataTable`: company/name, roles, supply categories, active toggle,
outstanding due (computed). "+ Add supplier."

**Layout — Detail.** Profile header + tabs or stacked sections: purchase history
(`DataTable` of `Purchase` rows), total outstanding due (`KPICard`), items supplied,
rating.

**Fields.** Profile info, `SupplierRoleNames`, `supplies` (category multi-select),
company, active flag, rating.

**Actions.** Create/Edit, Deactivate/Reactivate (soft delete — purchase history stays
intact and visible even when inactive).

**Status/Badges.** Active/Inactive via `StatusBadge` (success/neutral).

**Endpoints.** `GET/POST /api/suppliers`, `GET/PATCH /:id`, `POST /:id/deactivate`,
`/reactivate`.

---

### 6.6 Customers

**Purpose.** Sale counterparties, symmetric to Suppliers — added during spec review
because both `Sale` and `BirdSale` reference `Customers` and it needs its own page.

**Layout.** Identical shape to Suppliers: list + detail. Detail shows sales history
(`Sale` + `BirdSale` combined feed), outstanding receivables (`KPICard`), rating.

**Fields.** Profile, company, rating, active flag.

**Endpoints.** `GET/POST /api/customers`, `GET/PATCH /:id`, `POST /:id/deactivate`,
`/reactivate`.

---

### 6.7 Sales

**Purpose.** Two distinct sale types share one page: regular item sales (surplus feed,
culls, manure) and bird sales (the primary revenue event).

**Layout — List/History.** `DataTable` combining both types (a type column
distinguishes them): customer, date, amount, paid/due, grade (bird sales only). Filter
by batch, customer, date, grade. Two create buttons top-right: "+ Regular Sale" and
"+ Bird Sale" (separate forms, different shape).

**Regular Sale form.** Customer picker, sale date, line items (`SaleItem`: item,
quantity, unit, unit price → total auto-computed live as rows are added).

**Bird Sale form.** Batch picker (drives house/available-bird-count context), grade
(HIGH/LOW/CULL), male/female/total bird count, weight fields (`dholta_in_g`,
`total_katha`, `avg_wt_per_katha_kg`, `total_weight`, `net_weight`, `avg_weight_g` —
regional units, kept as-is, don't "clean up" the field names), customer, price/kg, total
amount (computed). Submitting decrements `BatchHouseBalance` in the same transaction as
the mortality/allocation writes — no separate step needed.

**Receivables.** Both sale types carry `paid_amount`/`due_amount` — the list and detail
views need a due-amount column/badge so a partially-paid sale is visible at a glance, not
assumed fully paid.

**Status/Badges.** Payment status derived from paid vs. due: Paid (success), Partial
(warning), Unpaid (destructive/critical) — not a stored enum, computed client-side from
the two amount fields.

**Endpoints.** `GET/POST /api/sales`, `GET /:id`; `GET/POST /api/bird-sales`, `GET /:id`.

**Notes.** Link out to Analytics for price-trend/grade-distribution views — don't
duplicate those charts on this page.

---

### 6.8 Purchases

**Purpose.** Everything the farm buys — feed, medicine, equipment, chicks — one
purchase record with multiple line items.

**Layout — History.** `DataTable`: supplier, invoice no., date, total, paid/due. Filter
by supplier, item, date, batch. "+ Create purchase" opens the form.

**Create Purchase form.** Supplier picker, invoice number, purchase date, line items
(`PurchaseItem`: item, quantity, unit, unit price → total auto-computed), mfg/expiration
dates for perishables. Chick purchases set `batch_id` directly on the relevant line item
(only visible/relevant when the item category is chicks).

**Post-save flow.** If the purchase contains coded items (medicine/vaccine/equipment),
show an inline prompt right after save: "Bind stock unit codes for this delivery?" →
opens the Coded Units bind flow pre-filled with this purchase's lot, so the operator
doesn't make a second trip to Inventory.

**Reorder suggestions.** A panel or banner on this page (not a separate page) surfaces
items below `reorder_level` + `lead_time_days`, since Purchases is where that signal
gets acted on.

**Status/Badges.** Payment status same pattern as Sales (computed from paid/due).

**Endpoints.** `GET/POST /api/purchases`, `GET /:id`, `GET /api/purchase-items`.

---

### 6.9 Payments

**Purpose.** Cash movement across every ref type (sales, purchases, expenses, payroll)
and every instrument (cash/bank/MFS).

**Layout.** Sub-sections, tabbed or stacked:

| Sub-page | Content |
| --- | --- |
| Record Payment | Form: amount, direction (INCOMING/OUTGOING), what it's for (`ref_type`: SALE/BIRD_SALE/PURCHASE/EXPENSE/PAYROLL + a searchable `ref_id` picker scoped to that type), from/to instrument, external transaction ref, handler, note. |
| Payment Instruments | `DataTable` + CRUD form: type, label, bank/account/mobile details, `mfs_type`, active toggle. |
| Instrument Balances | Read-only `KPICard` grid, one per instrument: incoming − outgoing, all-time and by period (period selector). |
| Payment History | `DataTable`, filter by direction, ref type, instrument, date. |
| Outstanding Dues | Two `DataTable`s side by side or tabbed: unpaid `Purchase.due_amount`, unpaid `Sale`/`BirdSale.due_amount`. |
| Payroll Payout | A filtered view of Payment History where `ref_type = PAYROLL`, linking each row back to its `PayrollRecord` — closes the Employees → Payroll → Payments loop. |

**Status/Badges.** Direction: Incoming (success), Outgoing (neutral, not warning — it's
routine, not a problem). Instrument active/inactive via standard `StatusBadge`.

**Endpoints.** `GET/POST /api/payment-instruments`, `GET/PATCH /:id`, `GET /:id/balance`,
`POST /:id/deactivate`, `/reactivate`; `GET/POST /api/payments`, `GET /:id`,
`GET /api/payments/total-paid`.

---

### 6.10 Finance

**Purpose.** Expense tracking and the profitability calculations that feed Analytics.

**Layout.** Sub-sections:

| Sub-page | Content |
| --- | --- |
| Expense Entry/List | Form: category (LABOR/ELECTRICITY/WATER/RENT/TRANSPORT/FUEL/MAINTENANCE/VET_FEE/INTERNET/MISC), `cost_type` (DIRECT/SHARED_PERIOD/SHARED_CAPITAL), amount, date, batch (only if DIRECT), remarks. `DataTable` below, filter by category/cost type/batch/date. |
| Shared-Period Allocation Queue | Read-only list of expenses with `cost_type = SHARED_PERIOD` awaiting bird-days distribution. Ship this as a visibly "blocked" queue — a banner explaining the v2 formula isn't built yet (§5), not a broken-looking empty feature. |
| Depreciation Ledger | Read-only `DataTable` of `AssetDepreciation`, browsable by asset or batch. |
| Per-Batch P&L | The calculation itself lives here (numbers, not trend charts — those are Analytics' job). |

**Status/Badges.** `cost_type` as a small tag/badge (not full `StatusBadge` — it's a
category, not a lifecycle state) — DIRECT / SHARED_PERIOD / SHARED_CAPITAL.

**Endpoints.** `GET/POST /api/expenses`, `GET /:id`; `GET /api/asset-depreciations`.

---

### 6.11 Employees

**Purpose.** Staff profiles, performance scoring, and the monthly payroll run.

**Layout — List.** `DataTable`: name, role (Manager/Worker/Intern), baseline salary,
rating, joining date, active toggle. "+ Add employee."

**Layout — Detail.** Profile header. Tabs or stacked sections: performance score
history (`PerformanceScoreEntry` feed — criterion, points, reason, given by, date),
running month-to-date score sum (`KPICard`), payroll history (`PayrollRecord` feed).

**Score Entry form** (from the detail page). Criterion picker (fixed list — positive:
attendance, early problem report, suggestion implemented, zero negligent loss, accurate
data entry, biosecurity followed, helped coworker, extra task, team target hit, conflict
resolved; negative: falsified record, negligent loss, biosecurity violation, concealed
problem, missed critical task, equipment damage, conduct issue, team supervision
failure, unexcused absence, pattern lateness; plus an `OTHER` escape hatch, rater enters
±1 to ±5). Points are a **snapshot from the criterion's fixed value at entry time** —
the form shows the point value read-only once a criterion is picked, it's not editable
per-entry (except `OTHER`). Required reason text field.

**Monthly Payroll Run** (own view, likely a dedicated action/modal from the Employees
list, run once per month across all employees). For each employee: sum the month's
points, clamp to **[-10%, +20%]**, apply to baseline salary, write a locked
`PayrollRecord`. Show the computed table (employee, score sum, adjustment %, final
salary) for review *before* confirming the run — this writes immutable records, so a
preview step matters. After confirming, each record is payable via the Payments page
(Payroll Payout, §6.9).

**Status/Badges.** Active/Inactive. Score sum sign (positive → success tint, negative →
warning tint, on the running MTD `KPICard`).

**Endpoints.** `GET/POST /api/employees`, `GET/PATCH /:id`, `POST /:id/deactivate`,
`/reactivate`; `GET/POST /api/performance-score-entries`; `GET /api/payroll-records`,
`POST /api/payroll-records/generate`.

**Notes.** `PayrollRecord` is a locked snapshot per (employee, month) — the UI must
never offer an edit action on a past record, even if baseline salary changes later.
The floor (-10%) is easier to hit than the ceiling (+20%) by design — don't "balance"
the clamp visually, the asymmetry is intentional.

---

### 6.12 Admins

**Purpose.** Admin account management. Flat permissions — every admin has full access,
no owner/admin tier.

**Layout.** `DataTable` (name, email, mobile, active toggle) + detail view (profile +
"view action history" link into Audit Log filtered to this admin). "+ Add admin."

**Fields.** Profile info (`Profiles role=ADMIN` + `Admins` record).

**Actions.** Create/Edit, Deactivate (soft delete only — never remove an admin's history
by deleting the account).

**Endpoints.** `GET/POST /api/admins`, `GET/PATCH /:id`, `POST /:id/deactivate`,
`/reactivate`.

---

### 6.13 Alerts

**Purpose.** Surfaces everything the system flags automatically — makes the `Alerts`
model (which nothing currently reads/writes) real.

**Layout.** Single feed page: filter bar (type: EMPLOYEE/BATCH/FEED/MEDICINE/SYSTEM;
level: INFO/WARNING/CRITICAL; status: ACTIVE/RESOLVED). List of alert cards/rows below,
newest first. "Scan now" button (manual trigger for the pull-based scan, §5) top-right.

**Auto-generated triggers** (documented here so the UI copy on each alert card can
reference its source):
- Item stock below `reorder_level` → FEED/MEDICINE alert.
- Batch daily mortality rate exceeds threshold → BATCH CRITICAL.
- StockUnit/PurchaseItem nearing `expiration_date` → MEDICINE WARNING.
- Payroll run due/overdue → EMPLOYEE INFO.
- Employee negative-performance pattern → EMPLOYEE WARNING.

**Actions.** Resolve (with optional `action_type`: PAY/REASSIGN/MARK_RESOLVED, tied to
the alert's `related_id` record — resolving from here can deep-link into the relevant
page, e.g. PAY jumps to Payments pre-filled).

**Status/Badges.** Level maps directly to the three-color semantic vocabulary — this is
the one place `info`/`warning`/`critical` all appear together, so the mapping must be
pixel-exact with `docs/design.md` §2.3. Status: Active (the level color) / Resolved
(neutral).

**Empty/Loading.** "No active alerts — everything's within normal range" (a good empty
state, style it as reassuring, not blank).

**Endpoints.** `GET/POST /api/alerts`, `GET /:id`, `POST /:id/resolve`,
`POST /api/alerts/scan`.

---

### 6.14 Audit Log

**Purpose.** Read side of the mutable-table change history — makes `AuditLog` (which
nothing currently populates) inspectable once the write side exists.

**Layout.** Single filterable `DataTable`: `table_name`, `record_id`, action
(CREATE/UPDATE/DELETE), changed by, timestamp. Row click expands or opens a drawer with
a before/after JSON diff view (side-by-side or inline diff highlighting).

**Filters.** Record ID, actor, date range, table name.

**Status/Badges.** Action type as a small tag (CREATE = success, UPDATE = info, DELETE =
destructive).

**Empty/Loading.** Expect this to render genuinely empty until the write-side Prisma
middleware ships (§5) — build against the real (empty) API response, don't mock data
into it.

**Endpoints.** `GET /api/audit-logs`, `GET /:id`.

---

### 6.15 Settings

**Purpose.** Configuration data that isn't itself a transactional record — some of it
duplicates entry points already reachable from domain pages, which is intentional
(Settings is the "everything config" catch-all, not the only path).

**Layout.** Sectioned single page or sub-tabs:

| Section | Content |
| --- | --- |
| Warehouses | Same CRUD as Inventory's Warehouses sub-page (shared data/component). |
| Payment Instruments | Same CRUD as Payments' Instruments sub-page (shared data/component). |
| Organizations | Same CRUD as Inventory's Organizations sub-page (shared data/component). |
| StockUnit Code Provisioning | Batch-print blank QR codes ahead of need — same action as Inventory's Coded Units "+ Provision" button, surfaced here too for convenience. |
| System Config | Placeholders as they come up: farm name, default currency, etc. Nothing speculative — don't pre-build fields for settings that don't exist yet. |

**Notes.** Build each shared section as one component reused between its Settings
appearance and its domain-page appearance — don't fork the CRUD form twice.

---

## 7. Suggested Build Order

Build in dependency order, not spec order:

1. **Shell + design tokens** — sidebar, top bar, `StatusBadge`, `KPICard`, `DataTable`,
   empty/loading states, plus the missing `brand`/semantic CSS tokens (§3). Everything
   else depends on this.
2. **Foundational data** — Houses, Suppliers, Customers, Inventory (Item Catalog +
   Warehouses + Organizations first; Coded Units and the rest of Inventory can follow).
   Nothing else can be created without these existing.
3. **Batches core** — the operational center; unlocks Mortality, Weight, Feeding
   Program, Treatments, Environment tabs.
4. **The financial loop** — Purchases → Sales → Payments, in that order (Purchases
   feeds Inventory's coded-unit binding; Sales needs Batches; Payments needs both).
5. **Finance + Analytics** — both read/aggregate the modules above, build last among the
   "real" pages so there's data to show.
6. **Employees/Payroll** — independent of the above, can be built any time after the
   shell; sequenced here because it's lower-urgency for a farm's day-to-day loop.
7. **Alerts, Audit Log, Settings** — cross-cutting, can slot in whenever; Audit Log is
   the only one gated on backend work (the write-side middleware) landing first to be
   meaningfully testable.

## 8. Open Items (deferred, tracked, not blocking this build)

- Auth/role enforcement layer — schema and permission matrix ready, no middleware yet.
- Bird-days shared-cost allocation formula (v2) — needs real overlapping-batch data to
  validate against.
- Employee Mobile App — feature set defined (`docs/FEATURES.md` §3), offline-sync
  implementation and UI design are a separate PRD.
- FCR calculation — needs a feed-to-weight unit conversion table that doesn't exist yet.
- Audit Log write-side (Prisma middleware) — the page above is read-only and ready; the
  populate mechanism is separate backend work.
