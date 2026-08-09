# FMS — Features Specification

Full feature list for the ZeroD Farms Management System, by role and by page.
Grounded in the existing design docs (`docs/system-design-arc.md`,
`docs/batch-management-design.md`, `docs/inventory-tracking-design.md`,
`docs/employee-payroll-design.md`) and `prisma/schema.prisma` — the schema
was updated (§5) to close every gap this feature list surfaced, so it's the
current source of truth, not just a reference.

## 1. Roles & clients

| Role               | Client        | Schema role(s)                                      |
| ------------------ | ------------- | --------------------------------------------------- |
| Owner/Admin        | Web dashboard | `UserRole.ADMIN` (flat — no owner/admin tier split) |
| Employee — Manager | Mobile app    | `UserRole.EMPLOYEE` + `EmployeeRoleNames.MANAGER`   |
| Employee — Worker  | Mobile app    | `UserRole.EMPLOYEE` + `EmployeeRoleNames.WORKER`    |
| Employee — Intern  | Mobile app    | `UserRole.EMPLOYEE` + `EmployeeRoleNames.INTERN`    |

Suppliers, Customers, and Doctors have **no login/portal** — they are records
managed by Admins/Employees (purchase counterparties, sale counterparties,
treatment prescribers). Revisit if a self-service supplier/customer portal
becomes a real need.

Auth/permission enforcement is not yet built (schema-ready only, per
`system-design-arc.md` §7) — the role/permission breakdown below is the spec
for that layer, not a description of what exists today.

---

## 2. Admin Web Dashboard

15 pages: Analytics, Batches, Houses, Inventory, Suppliers, Customers, Sales,
Purchases, Payments, Finance, Employees, Admins, Alerts, Audit Log, Settings.

### 2.1 Analytics

The only read-only page — no state of its own, queries across every other
module.

- **Farm overview dashboard**: active batch count, total birds alive (sum of
  `BatchHouseBalance`), houses occupied vs empty, employee headcount,
  unresolved `Alerts` count by level.
- **Batch performance**: mortality rate (7-day / 30-day / cumulative) per
  batch, FCR (feed consumed ÷ weight gained), growth curve from
  `WeightRecords`, days-to-market vs `expected_selling_date`.
- **Financial dashboard**: revenue this month (`Sale` + `BirdSale`), expenses
  this month (`Expense`), gross profit/loss, cash position per
  `PaymentInstrument` (computed: incoming − outgoing), outstanding payables
  (`Purchase.due_amount` sum).
- **Batch P&L report**: per-batch revenue − direct expenses − allocated
  shared-period costs − `AssetDepreciation` share = profit. Feed cost per
  bird, cost per kg produced.
- **Trend charts**: mortality trend, feed consumption trend, average sale
  price per kg trend, expense breakdown by category and `cost_type`.
- **Bird-days shared-cost allocation** — **[gap, v2]**: formula not yet
  designed (flagged in `system-design-arc.md` §7); needed to distribute
  `SHARED_PERIOD` expenses across concurrently running batches by bird-days.
  Until it exists, shared-period costs show as unallocated in P&L.
- Export any report view to CSV.
- Global filters: date range, batch, house.

### 2.2 Batches

- **List view**: filter by `status` (RUNNING/CLOSED/SOLD), `breed`, `phase`;
  sort by starting date, days running, mortality rate.
- **Create batch**: `batch_code`, `breed`, `initial_chick_count`,
  `init_chicks_avg_wt`, `starting_date`, `expected_selling_date`, initial
  house (creates the `INITIAL` `BatchHouseAllocation` into the brooder house
  in the same transaction as the chick `PurchaseItem`).
- **Batch detail**, tabbed:
    - _Overview_ — phase, live bird count, houses currently occupied, age in
      days, running mortality %.
    - _House allocations_ — history of moves (`BatchHouseAllocation`); add a
      `TRANSFER` (brooder→grower) or `ADJUSTMENT` (correction) entry.
    - _Mortality_ — log entries (`count_died`, `cause_note`, `date`); cumulative
      mortality chart.
    - _Weight_ — log sample weigh-ins (`average_wt_grams`, `sample_size`, per
      house/date); growth curve.
    - _Feeding program_ — define `BatchFeedingProgram` (feed type per day
      range: PRE_STARTER→STARTER→GROWER→FINISHER); actual vs. planned
      consumption.
    - _Treatments_ — `Medications` / `Vaccinations` history, each linked to the
      `Consumption` row it drew from; add new entries.
    - _Environment_ — logged readings (temp/humidity/ammonia/CO2/pressure) per
      house per time-of-day; threshold flags feed into Alerts.
    - _Financials_ — direct expenses, chick/feed purchase cost, bird sales,
      depreciation share, computed P&L for this batch.
- **Close batch** (manual admin action, confirmed in brainstorming):
  validates bird count is reconciled (sold + died = initial, or an explicit
  override reason), sets `status → CLOSED/SOLD` and `actual_end_date`, and
  fires `AssetDepreciation` computation for every `Asset` used by this batch
  in the same transaction.
- **Batches nearing expected selling date** — a filtered list, surfaces on
  the dashboard/Alerts too.

### 2.3 Houses

- CRUD `Houses` (`name`, `type`, `number`).
- **House detail**: current occupant batch(es) via `BatchHouseBalance`,
  allocation history, mortality history, environment reading history for
  that house.
- Mark a house available/cleaned after a batch vacates it (status is
  implicit — empty when `BatchHouseBalance.quantity = 0` for all batches).
- Over-allocation warning: `Houses.capacity` (optional) lets the UI flag a
  transfer that would push a house's bird count past its limit.

### 2.4 Inventory

- **Item catalog**: add/edit `Item` (`name`, `category`, `unit`,
  `reorder_level`, `preferred_reorder_qty`, `lead_time_days`); dedup enforced
  by `normalized_key`; deactivate (never hard-delete, per `is_active`).
- **Low-stock view**: items where current stock (aggregate `StockLedger`
  balance, or `StockUnit` count for coded items) is below `reorder_level` —
  feeds an Alert.
- **Coded units** (`StockUnit` — medicine, vaccine, equipment):
    - Provision a batch of blank codes (prints QR + text, `status UNASSIGNED`).
    - Bind a code to a `PurchaseItem` lot (scan or manual entry) →
      `status IN_STOCK` — also reachable from the mobile app (§3.3), since
      deliveries often get received in the field, not at a desk.
    - Unit detail: remaining quantity, current location (`house_id`), status,
      who bound it and when, full consumption history.
    - Relocate a unit to a different house.
    - Mark disposed/expired (`DISPOSED`).
- **Assets** (equipment): list, purchase cost, useful life in batches,
  status (ACTIVE/RETIRED/DISPOSED), per-batch `AssetDepreciation` history,
  assign to a batch/house.
- **Stock ledger** (aggregate items — feed at warehouse level): IN/OUT
  movement log filtered by item/date/reason; record an opening balance.
- **Inventory adjustments**: correction entries (`quantity_before/after`,
  `reason`, `note`) — audited.
- **Warehouses**: CRUD storage locations.
- **Organizations**: manufacturer/importer/distributor per item, for recall
  tracing — link an `Item` to an `Organization` with a role.
- **Consumption log**: cross-reference of everything drawn (feed, medicine,
  equipment) by batch/house/date, regardless of which page it was entered
  from.

### 2.5 Suppliers

- CRUD `Suppliers` (profile info, `SupplierRoleNames`, `supplies` categories,
  company, active flag).
- Detail: purchase history, total outstanding due, items supplied, rating.
- Deactivate (soft delete — purchases stay intact).

### 2.6 Customers _(added — not in your original list)_

`Sale` and `BirdSale` both reference `Customers`, so this needs its own page
symmetric to Suppliers.

- CRUD `Customers` (profile, company, rating, active flag).
- Detail: sales history (`Sale` + `BirdSale`), outstanding receivables,
  rating.

### 2.7 Sales

- **Regular sale** (non-bird items — e.g. surplus feed, culls, manure):
  create `Sale`, add `SaleItem` lines, link customer, total auto-computed.
- **Bird sale**: create `BirdSale` tied to a batch — grade
  (HIGH/LOW/CULL), male/female/total bird count, weight fields
  (`dholta_in_g`, `total_katha`, `avg_wt_per_katha_kg`, `total_weight`,
  `net_weight`, `avg_weight_g` — regional units, kept as-is per
  `full-schema-analysis.md`), price per kg, total amount. Decrements
  `BatchHouseBalance` for the batch/house sold from, same transaction as
  mortality/allocation.
- Sales list/history: filter by batch, customer, date, grade.
- Link to Analytics for price-trend and grade-distribution views.
- **Receivables tracking**: `paid_amount` / `due_amount` on both `Sale` and
  `BirdSale` (symmetric to `Purchase`) so a partially-paid sale is trackable,
  not just assumed fully paid.

### 2.8 Purchases

- **Create purchase**: supplier, invoice number, purchase date, line items
  (`PurchaseItem`: item, quantity, unit, unit price → total auto-computed),
  mfg/expiration dates for perishables. Chick purchases set `batch_id`
  directly on the line item.
- Tracks `paid_amount` / `due_amount`; partial payments link via `Payment`
  (`ref_type = PURCHASE`).
- Purchase history: filter by supplier, item, date, batch.
- After saving a purchase containing coded items (medicine/vaccine/
  equipment), prompt to bind `StockUnit` codes to the new `PurchaseItem` lot
  right there — avoids a second trip to Inventory.
- Reorder suggestions surface here too, sourced from `Item.reorder_level` +
  `lead_time_days`.

### 2.9 Payments

- **Record payment**: amount, direction (INCOMING/OUTGOING), what it's for
  (`ref_type`: SALE/BIRD_SALE/PURCHASE/EXPENSE + `ref_id`), from/to
  `PaymentInstrument`, external transaction ref, handler, note.
- **Payment instruments**: CRUD cash/bank/MFS accounts (`type`, `label`,
  bank/account/mobile details, `mfs_type`), activate/deactivate.
- **Instrument balances**: computed view — incoming minus outgoing per
  instrument, all-time and by period.
- Payment history: filter by direction, ref type, instrument, date.
- Outstanding dues dashboard: unpaid `Purchase.due_amount` and unpaid
  `Sale`/`BirdSale.due_amount`.
- **Payroll payout**: `PaymentRefType.PAYROLL` links a `Payment` row back to
  the `PayrollRecord` it pays out, closing the Employees → Payroll →
  Payments loop the same way sales/purchases/expenses already work.

### 2.10 Finance

- **Expense entry**: category (LABOR/ELECTRICITY/WATER/RENT/TRANSPORT/FUEL/
  MAINTENANCE/VET_FEE/INTERNET/MISC), `cost_type` (DIRECT/SHARED_PERIOD/
  SHARED_CAPITAL), amount, date, batch (if direct), remarks.
- Expense list: filter by category, cost type, batch, date.
- Shared-period allocation queue: expenses awaiting bird-days distribution
  (blocked on the v2 formula, §2.1).
- Depreciation ledger: `AssetDepreciation` rows computed at batch close,
  browsable by asset or batch.
- Per-batch P&L calculation lives here (the numbers); trend/comparison views
  of it live in Analytics.

### 2.11 Employees

- CRUD `Employees` (profile, `EmployeeRoleNames`, baseline `salary`,
  `joining_date`, `rating`); deactivate via `Profiles.is_active`.
- **Detail**: performance score history (`PerformanceScoreEntry` — criterion,
  points, reason, given by, date), running month-to-date score sum, payroll
  history.
- **Score entry**: pick a `PerformanceCriterion` (positive: attendance,
  early problem report, suggestion implemented, zero negligent loss,
  accurate data entry, biosecurity followed, helped coworker, extra task,
  team target hit, conflict resolved / negative: falsified record, negligent
  loss, biosecurity violation, concealed problem, missed critical task,
  equipment damage, conduct issue, team supervision failure, unexcused
  absence, pattern lateness), required reason text, points snapshot from the
  criterion's fixed value at entry time.
- **Monthly payroll run**: for each employee, sum the month's points, clamp
  to **[-10%, +20%]**, apply to baseline salary, write a locked
  `PayrollRecord` (`baseline_salary`, `score_sum`, `adjustment_percent`,
  `final_salary`) — one per employee per month, immutable once created.
  Payout then recorded as a `Payment` (`ref_type = PAYROLL`, §2.9).

### 2.12 Admins

- CRUD Admin accounts (`Profiles role=ADMIN` + `Admins` record).
- Flat permissions — every Admin has full access (confirmed in
  brainstorming; no owner/admin tier).
- Deactivate an admin account; view that admin's action history via Audit
  Log.

### 2.13 Alerts _(added — not in your original list)_

The `Alerts` model exists in the schema but nothing currently reads or
writes it — this page (plus the triggers behind it) is what makes it real.

- Feed of alerts: type (EMPLOYEE/BATCH/FEED/MEDICINE/SYSTEM), level
  (INFO/WARNING/CRITICAL), status (ACTIVE/RESOLVED).
- **Auto-generated triggers** (system-side, not manual entry):
    - `Item` stock below `reorder_level` → FEED/MEDICINE alert.
    - Batch daily mortality rate exceeds a threshold → BATCH CRITICAL.
    - `StockUnit`/`PurchaseItem` nearing `expiration_date` → MEDICINE WARNING.
    - Payroll run due / overdue → EMPLOYEE INFO.
    - Employee negative-performance pattern (repeated negative
      `PerformanceScoreEntry`) → EMPLOYEE WARNING.
- Manual resolve, with optional `action_type` (PAY/REASSIGN/MARK_RESOLVED)
  tied to the `related_id` record.
- Unresolved-critical badge count surfaces on the dashboard header.

### 2.14 Audit Log _(added — not in your original list)_

`AuditLog` exists for exactly this — needs a viewer or it's a dead table.

- Filterable table: `table_name`, `record_id`, `action`
  (CREATE/UPDATE/DELETE), `changed_by`, timestamp.
- Before/after JSON diff view per entry.
- Search by record ID, actor, date range, table.
- Population is an application-layer discipline (Prisma middleware
  recommended in `system-design-arc.md` §6) — this page is the read side,
  not the write mechanism.

### 2.15 Settings _(added — not in your original list)_

Configuration data that isn't itself a transactional record:

- **Warehouses** CRUD (also reachable from Inventory — same data).
- **Payment instruments** CRUD (also reachable from Payments).
- **Organizations** CRUD (manufacturer/importer/distributor/marketer).
- **StockUnit code provisioning**: batch-print blank QR codes ahead of need.
- System-wide config placeholders (farm name, default currency, etc.) as
  they come up — nothing speculative added now.

---

## 3. Employee Mobile App

The "Field App" referenced but deferred in `system-design-arc.md` — this
section now defines its feature set in full, per your call in brainstorming.
Offline-sync _implementation_ mechanics (queue internals, conflict
resolution) stay a separate later doc; what follows is what screens/actions
exist and who can use them.

### 3.1 Common to all Employees (Worker, Intern, Manager)

- **Login** by mobile number (`Profiles.mobile`, unique).
- **Home**: today's assigned houses/batches, unresolved alerts relevant to
  them, quick-action shortcuts.
- **QR scan**: camera scan of a `StockUnit` code → resolves to bind/consume
  flow, skips manual code entry.
- **Batch/house info** (read-only): current phase, live bird count, house
  occupancy.
- **Own performance history** (read-only): their `PerformanceScoreEntry`
  list and running month-to-date score — visibility, not editability.
- **Offline-first capture**: every write queues locally first, syncs on
  reconnect. Every table an Employee can write to from the mobile app
  (`Consumption`, `MortalityLog`, `BatchHouseAllocation`,
  `PerformanceScoreEntry`, `WeightRecords`, `EnvironmentRecords`,
  `Medications`, `Vaccinations`, `InventoryAdjustment`) carries a
  client-generated `idempotency_key`, same pattern as `StockLedger` — a
  flaky connection retrying a queued sync can't double-insert.

### 3.2 Worker (adds on top of §3.1)

Daily execution — the bulk of day-to-day data entry:

- Log mortality (`MortalityLog`: batch, house, count died, cause note,
  date).
- Log consumption (`Consumption`: scan a `StockUnit` or select an item,
  quantity, batch/house, note) — feed allocation, medicine dose drawn.
- Log weight samples (`WeightRecords`: average weight, sample size, house,
  date).
- Log environment readings (`EnvironmentRecords`: temperature, humidity,
  ammonia, CO2, air pressure, time-of-day, per house).
- Administer & log treatments (`Medications` / `Vaccinations`: medicine/
  vaccine name, dosage, cause, remarks, linked doctor if applicable) — links
  back to the `Consumption` draw it came from.

### 3.3 Manager (adds on top of §3.2 — Workers report to Managers)

Supervisory + structural actions:

- Record house-to-house transfers and corrections
  (`BatchHouseAllocation` — `TRANSFER` / `ADJUSTMENT`).
- Define/edit a batch's feeding program (`BatchFeedingProgram`).
- **Score employees**: give `PerformanceScoreEntry` to Workers/Interns under
  them (pick criterion, required reason) — `given_by_id` is any Profile, so
  this is a Manager capability by policy, not schema restriction.
- Flag low stock / request reorder — contributes to an Alert rather than
  writing directly to Purchases (finance stays Admin's domain).
- **Receive & bind incoming stock**: scan a blank/incoming `StockUnit` code
  and bind it to the `PurchaseItem` lot it arrived on (`bound_by_id`) —
  deliveries land at the farm gate, not at an office desk, so this needs to
  work from the field even though the `Purchase` record itself is Admin's.
- **Report a stock discrepancy**: write an `InventoryAdjustment`
  (`quantity_before/after`, reason, note) when what's physically on the
  shelf doesn't match the ledger — `recorded_by_id` accepts any Profile, and
  catching this in the field beats waiting for an Admin to notice later.

### 3.4 Intern (subset of §3.1 — entry-level, supervised)

Deliberately the most restricted, since mortality/consumption/treatment
entries carry financial and accountability weight an unsupervised new hire
shouldn't own yet:

- Log environment readings.
- Assist with weight sampling.
- **Cannot** log mortality, consumption, or treatments independently.
- **Cannot** score anyone.
- Everything else is read-only (§3.1).

### 3.5 Permission matrix

| Action                                 | Intern | Worker | Manager | Admin |
| -------------------------------------- | ------ | ------ | ------- | ----- |
| View batch/house info                  | ✅     | ✅     | ✅      | ✅    |
| Log environment readings               | ✅     | ✅     | ✅      | ✅    |
| Log weight samples                     | assist | ✅     | ✅      | ✅    |
| Log mortality                          | ❌     | ✅     | ✅      | ✅    |
| Log consumption                        | ❌     | ✅     | ✅      | ✅    |
| Administer/log treatment               | ❌     | ✅     | ✅      | ✅    |
| House transfer / adjustment            | ❌     | ❌     | ✅      | ✅    |
| Manage feeding program                 | ❌     | ❌     | ✅      | ✅    |
| Score other employees                  | ❌     | ❌     | ✅      | ✅    |
| Receive & bind incoming stock          | ❌     | ❌     | ✅      | ✅    |
| Report inventory discrepancy           | ❌     | ❌     | ✅      | ✅    |
| View own performance history           | ✅     | ✅     | ✅      | ✅    |
| Purchases / Sales / Payments / Finance | ❌     | ❌     | ❌      | ✅    |
| Close a batch                          | ❌     | ❌     | ❌      | ✅    |
| Manage Admins/Employees accounts       | ❌     | ❌     | ❌      | ✅    |

---

## 4. Cross-cutting

- **Accountability**: every entry-level table names its actor
  (`recorded_by_id` / `given_by_id` / `administered_by_id` / `bound_by_id`).
  Append-only tables (`Consumption`, `MortalityLog`, `BatchHouseAllocation`,
  `PerformanceScoreEntry`, `StockLedger`, `Purchase`/`PurchaseItem`, sales,
  payments) are never edited at the application layer — a correction is a
  new offsetting row, not a mutation.
- **Soft-delete only**: `is_active` flags on `Profiles`/`Item`/`Customers`/
  `Suppliers` — nothing with history attached gets hard-deleted.
- **Audit trail**: `AuditLog` covers the mutable tables (Item, Batches,
  Employees, StockUnit status/location); a Prisma middleware writing it
  automatically is the recommended mechanism over scattered manual calls.

## 5. Open items (tracked, not blocking this doc)

The schema now supports every feature listed above (`idempotency_key` on all
offline-writable tables, `PaymentRefType.PAYROLL`, `Sale`/`BirdSale`
receivables, `Houses.capacity`). What's left is application logic, not data
model:

- Bird-days shared-cost allocation formula — v2, needs real overlapping-batch
  data to validate against.
- Auth/role enforcement layer — schema and this permission matrix are ready;
  no middleware/guard code exists yet.
- Field App offline-sync _implementation_ (queue internals, conflict
  handling, retry logic against `idempotency_key`) — feature list is now
  defined (§3); the sync mechanism itself is still a separate design
  conversation.
