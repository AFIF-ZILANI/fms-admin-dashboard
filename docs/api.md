# FMS API Reference

Full endpoint reference for the ZeroD Farms Management System backend. Written
for building the web admin dashboard and the employee mobile app against —
every field name, enum value, status code, and error condition below matches
the actual implementation (verified against source at doc-writing time), not
the original design docs where the two differ.

Companion docs: [`FEATURES.md`](./FEATURES.md) (what each role/page needs),
[`PROGRESS.md`](./PROGRESS.md) (build order, status, and the reasoning behind
every deliberate scope decision).

Base URL (dev): `http://localhost:5085`. Every route below is mounted under
`/api` (e.g. `/api/admins`) except `GET /health`.

---

## 1. Conventions — read this before building anything

### 1.1 Transport: format, compression, headers

- **Request bodies**: `Content-Type: application/json` only. No
  `multipart/form-data`, no file/binary upload endpoint exists anywhere in
  this API (the schema has an `Avatars` model with an `image_url` field, but
  no upload endpoint was built for it — there's currently no way to attach
  an avatar through this API at all).
- **Response bodies**: `Content-Type: application/json; charset=UTF-8`,
  **not compressed** — there's no gzip/brotli middleware in the stack
  (checked directly: no `compress()` middleware, no compression package
  installed). Don't send `Accept-Encoding` expecting a compressed body; you
  won't get one. For a mobile client on a slow connection, this means
  response size is exactly what you see below, uncompressed.
- **CORS**: allowed origins come from `ALLOWED_ORIGINS` (comma-separated
  env var); credentialed requests only work in production
  (`CORS_CREDENTIALS && !isDev`). In dev, origin is wide open (`*`) and
  credentials are off.
- **CSRF**: enabled in production only (skipped entirely in dev), validates
  the request's `Origin` header against `ALLOWED_ORIGINS`. Not relevant to
  local development against this API.
- **Security headers**: `secureHeaders()` sets a restrictive CSP
  (`default-src 'self'`, no inline scripts, `frame-ancestors: DENY`) —
  irrelevant to a same-origin API client but worth knowing if you ever
  render API responses in an iframe or embed a widget.

### 1.2 Response envelope

**Success:**

```json
{ "success": true, "message": "Admin created", "data": { ... } }
```

Paginated list responses add `meta`:

```json
{
  "success": true,
  "message": "Admins fetched successfully",
  "data": [ ... ],
  "meta": { "page": 1, "limit": 20, "total": 47, "totalPages": 3 }
}
```

**Error — RFC 7807 Problem Details**, on every application-level error:

```json
{
  "type": "https://api.bhaze.dev/errors/bad-request",
  "title": "Bad Request",
  "status": 400,
  "detail": "paid_amount cannot exceed the purchase total",
  "extensions": { "fields": { "quantity": "Quantity must be positive" } }
}
```

`extensions.fields` only appears on 400s from Zod validation failures — a
flat map of `field.path` → message, ready to attach to a form. Every other
error type has no `extensions`; read `detail` for the user-facing message.

**⚠️ One exception to the JSON contract**: a **429** (rate limit exceeded)
response body is **plain text**, not JSON, not RFC 7807-shaped — see §1.5.
Calling `response.json()` on a 429 will throw. Check `response.status`
before parsing the body, or catch the parse failure.

### 1.3 HTTP status codes actually used

| Status | When | Body shape |
|---|---|---|
| 200 | Every successful response except resource creation — list, get, update, and every action endpoint (`deactivate`, `reactivate`, `resolve`, `close`, `bind`, `relocate`, `dispose`, `scan`, `generate`, `/status`, etc.) | success envelope |
| 201 | The 31 endpoints that create a brand-new resource — see §1.4 for the exact list | success envelope |
| 400 | Zod validation failure, OR a business-rule rejection (a computed total exceeded, a cross-field mismatch), OR a client-supplied foreign id that doesn't reference an existing row (P2003 → mapped to 400, not 404 — see §1.7) | RFC 7807 |
| 404 | Resource not found by `:id`, OR (unrelated to any specific resource) hitting a URL that doesn't match any route at all | RFC 7807 |
| 409 | Duplicate unique field, invalid state transition, or a business-rule conflict (oversell, insufficient balance, already-in-that-state) | RFC 7807 |
| 429 | Rate limit exceeded (see §1.5) — **not RFC 7807**, plain text | plain text |
| 500 | Unhandled exception — shouldn't happen for any documented flow; report as a bug | RFC 7807 |
| 504 | Request exceeded `TIMEOUT_MS` (30s default) | RFC 7807 |

**Not currently used by anything**: 204 (no endpoint returns an empty body —
even `DELETE /api/item-organizations/:id` returns `200` with
`data: null`), 401/403 (no auth yet, §1.6), 422 (the `AppError.unprocessable`
factory exists in the codebase but nothing currently throws it).

### 1.4 Endpoints that return 201 (everything else returns 200)

`POST /api/admins`, `/api/employees`, `/api/suppliers`, `/api/customers`,
`/api/doctors`, `/api/houses`, `/api/items`, `/api/warehouses`,
`/api/organizations`, `/api/item-organizations`, `/api/stock-units`
(provision), `/api/assets`, `/api/batches`, `/api/batch-house-allocations`,
`/api/mortality-logs`, `/api/purchases`, `/api/consumptions`,
`/api/medications`, `/api/vaccinations`, `/api/environment-records`,
`/api/weight-records`, `/api/batch-feeding-programs`, `/api/sales`,
`/api/bird-sales`, `/api/expenses`, `/api/performance-score-entries`,
`/api/payroll-records/generate`, `/api/alerts`, `/api/payment-instruments`,
`/api/payments`, `/api/inventory-adjustments`. Every other `POST`
(deactivate/reactivate/resolve/close/bind/relocate/dispose/scan) mutates an
existing row rather than creating a new one, and returns 200.

### 1.5 Rate limiting & timeouts

Every route (`"*"`, including `/health`) is rate-limited: **120 requests per
60-second window per client IP** by default (`RATE_LIMIT_MAX`/
`RATE_LIMIT_WINDOW_MS`, both configurable). Standard rate-limit headers are
included on every response so a client can show "requests remaining"
proactively: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`
(draft-6 spec). On exceeding the limit: **`429`, `Content-Type: text/plain`,
body `"Too many requests, please try again later."`** — this is the one
place in the API that doesn't return JSON at all; handle it as a distinct
case in your HTTP client's error handling, not through the same
RFC7807-parsing path as everything else.

Every request also has a **30-second timeout** (`TIMEOUT_MS`); exceeding it
returns `504` in the normal RFC 7807 shape (this one *does* flow through the
standard error envelope). No endpoint in this API should legitimately take
anywhere near 30s — a 504 means something is actually stuck, not a
false-positive to silently retry through.

### 1.6 No auth yet — actor ids go in the request body

**Phase 15 (Auth) hasn't been built.** There is no login, no session, no
`Authorization` header, and CORS credentials are off in dev. Every endpoint
that needs to know "who did this" takes that as an explicit field in the
request body:

- `recorded_by_id`, `given_by_id`, `administered_by_id`, `measured_by_id`,
  `handled_by_id`, `changed_by_id` — a **required** `Profiles.id` (UUID).
  The web/mobile client must know which Admin/Employee is currently "logged
  in" (however that's tracked client-side for now) and pass it explicitly
  on every write.
- `StockUnit.bound_by_id` — same idea, but **optional**.

A bad (nonexistent) actor id doesn't 404 or 409 — see §1.7, it's a 400 like
any other bad foreign id. When Phase 15 lands, these fields will very likely
be dropped in favor of deriving the actor from a session — **don't build UI
that makes the user manually pick "who am I" from a dropdown as a permanent
pattern**; treat the current explicit-id requirement as a stopgap this doc
will be updated to reflect once Auth exists.

### 1.7 Bad foreign ids are 400, not 404

If a request body references another table's id that doesn't exist (a
`house_id` that was never created, a typo'd `item_id`, ...), the response is
**`400 Bad Request`** with `detail` naming the field — **not** a 404. This
is deliberate and consistent everywhere in the API (it's a single shared
error-mapping function, not per-endpoint logic): a 404 is reserved for "the
`:id` in the URL path doesn't exist"; a bad id *inside the body* is treated
as a validation problem. Example:

```json
{ "type": "...", "title": "Bad Request", "status": 400,
  "detail": "purchase_item_id does not reference an existing record" }
```

### 1.8 Pagination

Every list endpoint (`GET` without `/:id`) accepts:

| Param | Type | Default |
|---|---|---|
| `page` | int ≥ 1 | 1 |
| `limit` | int, 1–100 | 20 |

Plus whatever filters that resource documents below. All query params are
strings on the wire — booleans are the literal strings `"true"`/`"false"`,
not JSON booleans (e.g. `?is_active=true`). An out-of-range `limit`
(e.g. 500) is a **400** (Zod bounds it), not silently clamped.

### 1.9 Money fields are Prisma Decimal → JSON strings

Every money/quantity field backed by a Postgres `Decimal` column
(`amount`, `total`, `total_price`, `quantity`, `salary`, `balance`, ...)
serializes as a **JSON string**, not a number — e.g. `"total_amount": "4000"`,
`"unit_price": "15.5"`. Parse with a decimal-safe library client-side (or
`parseFloat` if you accept float rounding for display only); don't do money
math in JS floats when precision matters, same reasoning the backend follows
with `Prisma.Decimal` throughout.

Request bodies accept plain JSON numbers for these fields (Zod coerces) —
only responses come back as strings.

### 1.10 Append-only tables — no update endpoint, ever

These resources are **create + read only** by design (a correction is a new
offsetting row, never an edit) — there is no `PATCH`/`PUT` route for any of
them, and attempting to build one client-side has nothing to call:
`Purchase`/`PurchaseItem`, `Sale`/`SaleItem`, `BirdSale`, `Payment`,
`Expense`, `Consumption`, `MortalityLog`, `BatchHouseAllocation`,
`PerformanceScoreEntry`, `StockLedger`.

### 1.11 Soft-delete via `is_active` — never a real delete

No endpoint in this API ever hard-deletes a business record (the one literal
`DELETE` route, `/api/item-organizations/:id`, removes a join-table link,
not a business entity). Deactivation uses `POST /:id/deactivate` +
`POST /:id/reactivate` pairs. Two different `is_active` patterns exist —
**don't confuse them**:

- **`Profiles.is_active`** — Admins, Employees, Houses, Items,
  `PaymentInstrument`: deactivating means "this account/record is inactive."
- **The model's own `is_active`** — Suppliers, Customers: deactivating a
  Supplier/Customer flips *their own* `is_active` field, not
  `Profiles.is_active`. A deactivated Supplier's underlying Profile stays
  active — they're a person who exists, just not currently a live supplier
  relationship.

`Warehouses` and `Doctors` have no lifecycle endpoints at all (no
`is_active` field) — they're create + read (+ rename for Warehouses), full
stop.

### 1.12 `idempotency_key` — offline-write safety

These tables carry a unique `idempotency_key`, meant for the mobile app's
offline queue (write locally, sync when back online, retry-safe):
`BatchHouseAllocation`, `MortalityLog`, `Consumption`, `Medications`,
`Vaccinations`, `EnvironmentRecords`, `WeightRecords`,
`InventoryAdjustment`, `PerformanceScoreEntry`. It's an **optional** field
in every create request on these — omit it and the server generates one
(fine for the web dashboard, which writes synchronously); the mobile app's
offline queue should generate and persist one client-side *before* the
first send attempt, so a retried sync can't double-insert. **Sending a
reused `idempotency_key` doesn't error** — the field is simply a
`@unique` column, so a genuine duplicate submission would hit a 409 like
any other unique-constraint collision; a legitimate retry with the *same*
key against a row that already succeeded will still 409 today (there's no
"return the original row instead of erroring" upsert-on-idempotency-key
behavior built yet — treat a 409 that specifically names
`idempotency_key` as "this already went through," not a real failure).

### 1.13 Polymorphic references — not real foreign keys

A few fields reference "some record in some other table, type given
separately," and are **not** enforced by a Postgres FK — a bad value here
won't 400 like §1.7 describes, because the field isn't a foreign key at all,
just an untyped string the server trusts:

- `StockLedger.ref_type` + `ref_id`, `Payment.ref_type` + `ref_id` — e.g.
  `ref_type: "PURCHASE", ref_id: "<a Purchase.id>"`.
- `PaymentInstrument.owner_type` + `owner_id` — e.g.
  `owner_type: "SUPPLIER", owner_id: "<a Suppliers.id>"`.
- `Alerts.related_id` — no `related_type`; interpret using `Alerts.type`.

### 1.14 Enums quick reference

Every enum used in a request body, spelled exactly as the API expects
(case-sensitive):

| Enum | Values |
|---|---|
| `UserRole` | `ADMIN`, `EMPLOYEE`, `CUSTOMER`, `SUPPLIER`, `DOCTOR` |
| `EmployeeRoleNames` | `MANAGER`, `WORKER`, `INTERN` |
| `SupplierRoleNames` | `SALES_MAN`, `OWNER`, `DISTRIBUTOR`, `DEALER`, `WHOLESALER`, `RETAILER`, `MANUFACTURER`, `IMPORTER`, `REPRESENTATIVE` |
| `SupplierSupplyCategories` | `FEED`, `MEDICINE`, `CHICKS`, `HUSK`, `EQUIPMENT`, `UTILITIES`, `TRANSPORTATION`, `CLEANING_SUPPLIES`, `OFFICE_SUPPLIES`, `SOFTWARE`, `OTHER` |
| `HouseType` | `BROODER`, `GROWER`, `LAYER` |
| `Units` | `BIRD`, `KG`, `LITER`, `BAG`, `BOX`, `UNIT`, `SACHETS`, `BOTTLE`, `ML`, `L`, `G`, `PCS`, `VIAL`, `DOSE`, `OTHER` |
| `ResourceCategories` (`Item.category`) | `FEED`, `MEDICINE`, `VACCINE`, `SUPPLEMENT`, `BIOSECURITY`, `CHICKS`, `HUSK`, `EQUIPMENT`, `UTILITIES`, `SALARY`, `TRANSPORTATION`, `MAINTENANCE`, `CLEANING_SUPPLIES`, `OTHER` |
| `StockUnitStatus` (read-only, server-managed) | `UNASSIGNED`, `IN_STOCK`, `IN_USE`, `CONSUMED`, `DISPOSED` |
| `AssetStatus` | `ACTIVE`, `RETIRED`, `DISPOSED` |
| `OrganizationRole` | `MANUFACTURER`, `IMPORTER`, `MARKETER`, `DISTRIBUTOR` |
| `BatchStatus` (read-only except via `/close`) | `RUNNING`, `CLOSED`, `SOLD` |
| `Phase` | `BROODER`, `GROWER` |
| `BirdBreeds` | `CLASSIC`, `HIBREED`, `PAKISTHANI`, `KEDERNATH`, `FAOMI`, `TIGER` |
| `AllocationReason` (client-choosable) | `TRANSFER`, `ADJUSTMENT` — `INITIAL` is set internally only, on `Batches` create |
| `TimePeriods` | `MORNING`, `NOON`, `AFTERNOON`, `EVENING`, `NIGHT`, `MIDNIGHT`, `LATENIGHT` |
| `FeedType` | `PRE_STARTER`, `STARTER`, `GROWER`, `FINISHER`, `LAYER` |
| `BirdGrade` | `HIGH`, `LOW`, `CULL` |
| `CostType` | `DIRECT`, `SHARED_PERIOD`, `SHARED_CAPITAL` |
| `ExpenseCategory` | `LABOR`, `ELECTRICITY`, `WATER`, `RENT`, `TRANSPORT`, `FUEL`, `MAINTENANCE`, `VET_FEE`, `INTERNET`, `MISC` |
| `PaymentMethod` | `CASH`, `BANK_TRANSFER`, `MFS` |
| `MfsType` | `BKASH`, `NAGAD`, `ROCKET` |
| `PaymentType` (`Payment.direction`) | `INCOMING`, `OUTGOING` |
| `PaymentRefType` | `SALE`, `BIRD_SALE`, `PURCHASE`, `EXPENSE`, `PAYROLL` |
| `AuditAction` | `CREATE`, `UPDATE`, `DELETE` |
| `AlertTypes` | `EMPLOYEE`, `BATCH`, `FEED`, `MEDICINE`, `SYSTEM` |
| `AlertLevels` | `INFO`, `WARNING`, `CRITICAL` |
| `AlertStatus` | `ACTIVE`, `RESOLVED` |
| `AlertActionTypes` | `PAY`, `REASSIGN`, `MARK_RESOLVED` |
| `PerformanceCriterion` | see §12.1 — fixed point values, not freely assignable |

---

## 2. Admins

`Profiles(role=ADMIN)` + `Admins`. Flat permissions — every Admin has full
access, no owner/admin tier.

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/admins` | 200 | query: `is_active?` |
| GET | `/api/admins/:id` | 200 | — |
| POST | `/api/admins` | 201 | `{ name, mobile, email?, address? }` |
| PATCH | `/api/admins/:id` | 200 | any subset of the create fields |
| POST | `/api/admins/:id/deactivate` | 200 | — |
| POST | `/api/admins/:id/reactivate` | 200 | — |

`:id` is `Admins.id`, not `Profiles.id`. Response nests the profile:
`{ id, profile_id, created_at, updated_at, profile: { id, name, mobile, email, address, role, is_active, ... } }`.

**Errors**: `GET /:id`, `PATCH /:id`, both deactivate/reactivate → **404**
if `:id` doesn't exist. `POST`/`PATCH` → **409** on duplicate `mobile` or
`email` (`detail` names the field, e.g. `"mobile already in use"`). `PATCH`
with an empty body (no fields changed) → **400**
`"No update fields provided"`.

---

## 3. Employees

`Profiles(role=EMPLOYEE)` + `Employees`. Same shape as Admins plus role/pay
fields.

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/employees` | 200 | query: `role?`, `is_active?` |
| GET | `/api/employees/:id` | 200 | — |
| POST | `/api/employees` | 201 | `{ name, mobile, email?, address?, role, salary, joining_date? }` |
| PATCH | `/api/employees/:id` | 200 | `{ name?, mobile?, email?, address?, role?, salary?, rating? }` |
| POST | `/api/employees/:id/deactivate` | 200 | — |
| POST | `/api/employees/:id/reactivate` | 200 | — |

`role` is `EmployeeRoleNames`. `salary` is the baseline used by payroll
(§12) — changing it here only affects *future* `PayrollRecord.generate`
calls, past records stay locked. `rating` (0–5) is update-only, not settable
on create. Response nests `profile` the same way Admins does.

**Errors**: same shape as Admins — **404** on unknown `:id` (get/patch/
deactivate/reactivate), **409** on duplicate `mobile`/`email`, **400** on an
empty `PATCH` body.

---

## 4. Suppliers, Customers, Doctors

### 4.1 Suppliers

`Profiles(role=SUPPLIER)` + `Suppliers`. **Deactivate/reactivate toggle
`Suppliers.is_active` directly, not `Profiles.is_active`** (§1.11).

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/suppliers` | 200 | query: `role?`, `supplies?` (single category, array-contains match), `is_active?` |
| GET | `/api/suppliers/:id` | 200 | — |
| POST | `/api/suppliers` | 201 | `{ name, mobile, email?, address?, role, supplies: [SupplierSupplyCategories, ...] (min 1), company? }` |
| PATCH | `/api/suppliers/:id` | 200 | any subset of create fields |
| POST | `/api/suppliers/:id/deactivate` | 200 | — |
| POST | `/api/suppliers/:id/reactivate` | 200 | — |

`role` here is `SupplierRoleNames` (their role at the supplying company —
sales rep, distributor, etc.), unrelated to `EmployeeRoleNames`. `supplies`
with zero entries → **400** at the validator level, before it ever reaches
the database.

**Errors**: **404** unknown `:id`; **409** duplicate `mobile`/`email`;
**400** empty `PATCH` body or empty `supplies` array on create.

### 4.2 Customers

`Profiles(role=CUSTOMER)` + `Customers`. Same `is_active`-is-its-own pattern
as Suppliers.

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/customers` | 200 | query: `is_active?` |
| GET | `/api/customers/:id` | 200 | — |
| POST | `/api/customers` | 201 | `{ name, mobile, email?, address?, company? }` |
| PATCH | `/api/customers/:id` | 200 | `{ name?, mobile?, email?, address?, company?, rating? }` |
| POST | `/api/customers/:id/deactivate` | 200 | — |
| POST | `/api/customers/:id/reactivate` | 200 | — |

**Errors**: **404** unknown `:id`; **409** duplicate `mobile`/`email`;
**400** empty `PATCH` body.

### 4.3 Doctors

`Profiles(role=DOCTOR)` + `Doctors`. **Reduced scope on purpose** — no
FEATURES.md page of their own, no `is_active` field, referenced only via
`doctor_id` on Medications/Vaccinations. Create + list + get only: **no
`PATCH`, no deactivate/reactivate routes exist for this resource at all.**

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/doctors` | 200 | — (pagination only) |
| GET | `/api/doctors/:id` | 200 | — |
| POST | `/api/doctors` | 201 | `{ name, mobile, email?, address?, specialty?, position?, degrees?: string[], institution? }` |

**Errors**: **404** unknown `:id` on get; **409** duplicate `mobile`/`email`
on create.

---

## 5. Houses

`Houses` — no linked Profile, simplest resource in the API.

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/houses` | 200 | query: `type?`, `is_active?` |
| GET | `/api/houses/:id` | 200 | — |
| POST | `/api/houses` | 201 | `{ name, type, number, capacity? }` |
| PATCH | `/api/houses/:id` | 200 | any subset of create fields |
| POST | `/api/houses/:id/deactivate` | 200 | — |
| POST | `/api/houses/:id/reactivate` | 200 | — |

`capacity` (int, optional) has no enforcement yet — it's descriptive only,
no over-allocation check runs against it currently. There's no unique
constraint on `Houses` at all, so **create cannot 409** — the only errors on
this resource are **404** (unknown `:id`) and **400** (validation, or an
empty `PATCH` body).

---

## 6. Inventory

### 6.1 Items — the catalog

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/items` | 200 | query: `category?`, `is_active?` |
| GET | `/api/items/:id` | 200 | — |
| POST | `/api/items` | 201 | `{ name, category, unit, reorder_level?, preferred_reorder_qty?, lead_time_days?, supplier_ids?: uuid[] }` |
| PATCH | `/api/items/:id` | 200 | any subset of create fields |
| POST | `/api/items/:id/deactivate` | 200 | — |
| POST | `/api/items/:id/reactivate` | 200 | — |

**Don't send `normalized_key`** — it's computed server-side from `name`
(lowercased, trimmed, whitespace-collapsed) specifically to catch
"Amoxicillin" vs "amoxicillin" duplicates; the field isn't even accepted in
the request schema. Renaming an item recomputes it. `supplier_ids`
connects/replaces the item's m2m link to `Suppliers` (full replace on
update, not additive).

**Errors**: **404** unknown `:id`; **409** on create/update if the computed
`normalized_key` collides with an existing item (`detail`:
`"normalized_key already in use"`); **400** if any id in `supplier_ids`
doesn't reference a real Supplier (§1.7), or an empty `PATCH` body.

### 6.2 Warehouses

Deliberately minimal — no delete, no deactivate (§1.11). Just a named
location.

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/warehouses` | 200 | — |
| GET | `/api/warehouses/:id` | 200 | — |
| POST | `/api/warehouses` | 201 | `{ name }` |
| PATCH | `/api/warehouses/:id` | 200 | `{ name }` (rename only) |

**Errors**: **404** unknown `:id`; **400** empty `PATCH` body. No unique
constraint on `name` → create can never 409.

### 6.3 Organizations + Item↔Organization links

Recall-tracing: which manufacturer/importer/distributor an item's lot came
from. Same server-computed `normalized_key` pattern as Items.

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/organizations` | 200 | — |
| GET | `/api/organizations/:id` | 200 | includes `itemLinks: [{ item, role }, ...]` |
| POST | `/api/organizations` | 201 | `{ label_name }` |
| PATCH | `/api/organizations/:id` | 200 | `{ label_name }` |
| POST | `/api/item-organizations` | 201 | `{ item_id, organization_id, role: OrganizationRole }` |
| DELETE | `/api/item-organizations/:id` | 200 | — (removes the link row, not the Item or Organization) |

**Errors**: `/organizations` → **404** unknown `:id`; **409** duplicate
`normalized_key`; **400** empty `PATCH`. `/item-organizations` create →
**400** bad `item_id`/`organization_id` (§1.7); **409** if
`(item_id, organization_id, role)` already exists (linking the same trio
twice). `DELETE` → **404** if the link `:id` doesn't exist.

### 6.4 StockUnit — the QR-code-per-unit lifecycle

Coded tracking for medicine/vaccine/equipment (feed and other bulk items use
the aggregate `StockLedger`, §6.6, instead). Status only ever moves forward:
`UNASSIGNED → IN_STOCK → IN_USE → CONSUMED` (or `→ DISPOSED` from almost any
state). **The client never sets `status` directly** — it's a side effect of
which action endpoint you call.

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/stock-units` | 200 | query: `status?`, `house_id?` |
| GET | `/api/stock-units/:id` | 200 | — |
| GET | `/api/stock-units/code/:code` | 200 | look up by the printed code — this is the QR-scan endpoint |
| POST | `/api/stock-units` | 201 | `{ count: int 1-500 }` — provisions that many blank codes, `status: UNASSIGNED` |
| POST | `/api/stock-units/:id/bind` | 200 | `{ purchase_item_id, initial_quantity?, bound_by_id? }` |
| POST | `/api/stock-units/:id/relocate` | 200 | `{ house_id }` |
| POST | `/api/stock-units/:id/dispose` | 200 | — |

`initial_quantity` on bind is the depleting amount (e.g. 1000 mL in a
bottle) — omit it for non-depleting equipment; `remaining_quantity` mirrors
it and only moves via `Consumption` (§9.1), never a direct PATCH here.
Provisioning returns an **array** of the newly created units (each with its
own `code` and `id`) — that's what you print as QR labels. `count` outside
1–500 → **400** before any codes are generated.

**Errors**: **404** unknown `:id`/`:code` on any of the `GET`/action
routes. `bind` → **409** if the unit's current status isn't `UNASSIGNED`
(`detail`: `"StockUnit is already <status, lowercased>"`); **400** if
`purchase_item_id` or `bound_by_id` doesn't reference a real row (§1.7).
`relocate` → **400** if `house_id` doesn't exist. `dispose` → **409** if
already `DISPOSED`.

### 6.5 Assets

Equipment tracking, 1:1 with a `StockUnit` (`stock_unit_id` unique — binding
a second Asset to the same unit 409s).

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/assets` | 200 | query: `status?` |
| GET | `/api/assets/:id` | 200 | includes `stock_unit` |
| POST | `/api/assets` | 201 | `{ stock_unit_id, name, purchase_cost, purchase_date, useful_life_batches }` |
| PATCH | `/api/assets/:id/status` | 200 | `{ status: AssetStatus }` |

`useful_life_batches` feeds `AssetDepreciation`'s formula (§11.2) — set it
thoughtfully, it can't be corrected after the fact for already-computed
depreciation rows (those stay locked).

**Errors**: **404** unknown `:id`. Create → **400** if `stock_unit_id`
doesn't reference a real `StockUnit` (§1.7); **409** if that `StockUnit`
already has an Asset (`stock_unit_id` is unique).

### 6.6 StockLedger — read-only

Aggregate balance ledger for non-coded items (feed, etc.). **No POST route
exists at all** — entries are written internally by `Consumption` (§9.1) and
`InventoryAdjustment` (§6.7) as a side effect, never posted directly.

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/stock-ledger` | 200 | query: `item_id?`, `direction?` (`IN`/`OUT`), `reason?` (`StockReason`) |

Current balance for an item = sum of `IN` minus sum of `OUT` — there's no
single "current balance" field anywhere, compute it client-side from this
list if needed (or use `GET /api/alerts/scan`, §13, which does this
server-side for reorder-level checking). **No errors beyond generic 400
validation** — this endpoint can't 404 or 409, it's a pure filtered list.

### 6.7 Inventory Adjustments

Manual stock corrections — the one client-writable path into `StockLedger`
(via a paired entry the server creates automatically in the same
transaction).

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/inventory-adjustments` | 200 | query: `item_id?` |
| POST | `/api/inventory-adjustments` | 201 | `{ item_id, warehouse_id? or house_id? (at least one), quantity_before, quantity_after, reason: string, note?, recorded_by_id, idempotency_key? }` |

`adjustment_quantity` (= `quantity_after - quantity_before`) is computed
server-side. The paired `StockLedger` entry's direction follows the sign
automatically.

**Errors**: **400** if `quantity_after == quantity_before` (no-op
correction rejected, `detail`: `"quantity_after must differ from
quantity_before"`); **400** if `item_id`/`warehouse_id`/`house_id`/
`recorded_by_id` don't reference real rows (§1.7); **400** if neither
`warehouse_id` nor `house_id` is given (validator-level, before hitting the
database).

---

## 7. Batches

The core physical/financial unit of the farm. `Batches`,
`BatchHouseAllocation`, `BatchHouseBalance`, `MortalityLog`. This is where
money-adjacent balance math lives — read `PROGRESS.md`'s Phase 6 entry if
something here surprises you.

### 7.1 Batches

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/batches` | 200 | query: `status?`, `breed?`, `phase?` |
| GET | `/api/batches/:id` | 200 | includes `houseBalances: [{ house_id, quantity, house }]` |
| POST | `/api/batches` | 201 | see below |
| PATCH | `/api/batches/:id` | 200 | `{ batch_code?, breed?, phase?, expected_selling_date? }` |
| POST | `/api/batches/:id/close` | 200 | `{ status: "CLOSED" \| "SOLD", force?: boolean }` |

**Create body**: `{ batch_code, breed, starting_date?, expected_selling_date, initial_chick_count, init_chicks_avg_wt, house_id, recorded_by_id }`.
This single call creates the `Batches` row **and** an `INITIAL`
`BatchHouseAllocation` **and** the starting `BatchHouseBalance` in one
transaction — "chicks arrive" is one atomic event, not three separate calls.

**Close**: requires every `BatchHouseBalance` row for this batch to sum to
zero (all birds accounted for via sales/mortality/transfers out) —
otherwise **409** with the exact remaining count in the message (e.g.
`"Batch still has 700 live birds allocated -- pass force:true to close
anyway"`). Pass `force: true` to close anyway (birds get written off, no
reconciliation). Closing also **fires the `AssetDepreciation` trigger**
(§11.2) for every `ACTIVE` Asset whose `StockUnit` this batch consumed —
automatic, no separate call, and the whole thing (status update + every
depreciation row) is one transaction. Closing is one-way: no endpoint
reopens a batch.

**Errors**: **404** unknown `:id`. Create → **409** duplicate `batch_code`;
**400** if `house_id`/`recorded_by_id` don't exist (§1.7). `PATCH` → **409**
if the batch isn't currently `RUNNING` (`detail`: `"Cannot edit a batch
that isn't RUNNING"`); **400** empty body. `close` → **409** if not
`RUNNING`, or (without `force`) if balances haven't reconciled to zero.

### 7.2 Batch House Allocations — transfers & corrections

One algorithm covers both `TRANSFER` (moving birds between houses) and
`ADJUSTMENT` (a headcount correction): **decrements `from_house_id`'s
balance if set, increments `to_house_id`'s if set** — set only one for a
one-directional correction, both for a real transfer.

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/batch-house-allocations` | 200 | query: `batch_id?` |
| POST | `/api/batch-house-allocations` | 201 | `{ batch_id, from_house_id?, to_house_id? (at least one), quantity: positive int, reason: "TRANSFER" \| "ADJUSTMENT", recorded_by_id, idempotency_key? }` |

**Errors**: **400** if neither `from_house_id` nor `to_house_id` is given
(validator-level); **404** if `batch_id` doesn't exist (this one *is* a 404,
not a 400 — it's checked explicitly inside the service before the
transaction, not via the generic FK-violation path); **409** if the batch
isn't `RUNNING`; **409** if `from_house_id` doesn't have enough birds for
the requested `quantity` (`detail`: `"Insufficient birds in source house
for this move"` — the transaction rolls back cleanly on this, no partial
write, verified in tests); **400** if `from_house_id`/`to_house_id` don't
reference real Houses (§1.7).

### 7.3 Batch House Balances — read-only

The live "how many birds of batch X are in house Y" cache. Never written
directly — only `Batches.create`, `BatchHouseAllocation.create`, and
`MortalityLog.create` (and `BirdSale.create`, §10.2) touch it, always inside
their own transaction.

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/batch-house-balances` | 200 | query: `batch_id?`, `house_id?` |

Good endpoint for an occupancy-grid view (all batches × all houses at once).
**No errors beyond generic 400 validation** — pure filtered list, can't 404
or 409.

### 7.4 Mortality Log

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/mortality-logs` | 200 | query: `batch_id?`, `house_id?` |
| POST | `/api/mortality-logs` | 201 | `{ batch_id, house_id, count_died: positive int, cause_note?, date, recorded_by_id, idempotency_key? }` |

Decrements the batch-house balance in the same transaction as the log row.

**Errors**: **409** if `count_died` exceeds that house's current live
balance for the batch (`detail`: `"Mortality count exceeds live birds in
this house"` — nothing written on rejection, verified via rollback test);
**400** if `batch_id`/`house_id`/`recorded_by_id` don't reference real rows
(§1.7).

---

## 8. Purchases

`Purchase` + `PurchaseItem`. **Append-only** (§1.10) — create, list, get,
never update.

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/purchases` | 200 | query: `supplier_id?` |
| GET | `/api/purchases/:id` | 200 | includes `items: [{ ..., item }]`, `supplier` |
| POST | `/api/purchases` | 201 | see below |
| GET | `/api/purchase-items` | 200 | query: `item_id?`, `batch_id?` — cross-purchase lot lookup |

**Create body**:
```
{
  supplier_id?, invoice_no?, purchase_date, paid_amount? (default 0), recorded_by_id,
  items: [{ item_id, batch_id?, quantity, unit, unit_price, mfg_date?, expiration_date? }, ...] (min 1)
}
```
`total_price` per line and `total_amount` for the purchase are computed
server-side (`quantity × unit_price`, summed) — don't send them, they're not
accepted by the request schema at all. `due_amount = total_amount -
paid_amount`. Set `batch_id` on a line item when the purchase funds a
specific batch (chicks) — this is how `Batches`/`PurchaseItem` link
financially.

**Errors**: **404** unknown `:id` on get. Create → **400** if `paid_amount`
exceeds the computed `total_amount` (`detail`: `"paid_amount cannot exceed
the purchase total"` — this check runs *before* any database write, so
nothing is created); **400** if any line's `item_id`/`batch_id` or the
top-level `supplier_id`/`recorded_by_id` don't reference real rows (§1.7);
**400** if `items` is empty (validator-level).
`GET /purchase-items` has no errors beyond generic validation.

**Note**: `Purchase.due_amount` is a locked snapshot at creation — recording
a `Payment` (§15.2) against a purchase later does **not** update it. Compute
"how much is actually still owed" via
`GET /api/payments/total-paid?ref_type=PURCHASE&ref_id=<purchase.id>`
(§15.2) and subtract from `due_amount` client-side.

---

## 9. Treatment & Monitoring

### 9.1 Consumption — the stock-draw event

Two behaviors depending on whether `stock_unit_id` is set — **this is the
most important branch in the whole API to understand correctly**:

- **Coded draw** (`stock_unit_id` set — medicine/vaccine/equipment):
  decrements `StockUnit.remaining_quantity`; flips status
  `IN_STOCK → IN_USE`, or `→ CONSUMED` at exactly zero. Equipment
  (`remaining_quantity` was never set) just flips to `IN_USE` once,
  non-depleting.
- **Aggregate draw** (no `stock_unit_id` — feed, etc.): no `StockUnit`
  touched at all; writes a `StockLedger` `OUT` entry instead.

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/consumptions` | 200 | query: `batch_id?`, `house_id?`, `item_id?` |
| POST | `/api/consumptions` | 201 | `{ batch_id?, house_id, item_id, stock_unit_id?, quantity, date, note?, recorded_by_id, idempotency_key? }` |

**Errors** (coded-draw path only, when `stock_unit_id` is set): **404** if
that `StockUnit` doesn't exist; **409** if its status isn't `IN_STOCK` or
`IN_USE` (`detail`: `"StockUnit is <status>, cannot draw from it"`); **409**
if `quantity` exceeds `remaining_quantity` (`detail`: `"Consumption
quantity exceeds remaining stock in this unit"`). **Both paths**: **400** if
`batch_id`/`house_id`/`item_id`/`recorded_by_id` don't reference real rows
(§1.7).

### 9.2 Medications / Vaccinations

Nearly identical shape; `dosage` is free-text on Medications, an integer
count on Vaccinations. Both optionally link back to the `Consumption` row
the dose was drawn from.

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/medications` | 200 | query: `batch_id?` |
| POST | `/api/medications` | 201 | `{ batch_id, consumption_id?, medicine_name, dosage: string, cause?, period?, administered_by_id, doctor_id?, remarks?, date?, idempotency_key? }` |
| GET | `/api/vaccinations` | 200 | query: `batch_id?` |
| POST | `/api/vaccinations` | 201 | `{ batch_id, consumption_id?, vaccine_name, dosage: positive int, cause?, period?, administered_by_id, doctor_id?, remarks?, date?, idempotency_key? }` |

**Errors** (both resources): **400** if `batch_id`/`consumption_id`/
`administered_by_id`/`doctor_id` don't reference real rows (§1.7). No
409s possible — no unique constraints on either table.

### 9.3 Environment Records

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/environment-records` | 200 | query: `batch_id?`, `house_id?` |
| POST | `/api/environment-records` | 201 | `{ batch_id, house_id, temperature_c, humidity_percent, ammonia_ppm, co2_ppm, air_pressure_hpa, time_period: TimePeriods, recorded_by_id, idempotency_key? }` |

**Errors**: **400** if `batch_id`/`house_id`/`recorded_by_id` don't
reference real rows (§1.7). No 409s — no unique constraint.

### 9.4 Weight Records

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/weight-records` | 200 | query: `batch_id?`, `house_id?` |
| POST | `/api/weight-records` | 201 | `{ batch_id?, house_id, average_wt_grams, sample_size: positive int, date, measured_by_id, idempotency_key? }` |

`(batch_id, house_id, date)` is unique — a second sample logged for the same
batch+house+day 409s instead of silently overwriting. If retrying a failed
submission, don't just resend the same date; surface the 409 as "already
logged today" in the UI.

**Errors**: **409** duplicate `(batch_id, house_id, date)`; **400** if
`batch_id`/`house_id`/`measured_by_id` don't reference real rows (§1.7).

### 9.5 Batch Feeding Program

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/batch-feeding-programs` | 200 | query: `batch_id?` |
| POST | `/api/batch-feeding-programs` | 201 | `{ batch_id, feed_type: FeedType, item_id, start_day: int ≥0, end_day?: int ≥0 }` |
| PATCH | `/api/batch-feeding-programs/:id` | 200 | `{ end_day: int ≥0 }` — the **only** editable field |

No actor field on this one (no `recorded_by_id`) — it's a planning record,
not a field-execution log.

**Errors**: **404** unknown `:id` on `PATCH`; **400** if `batch_id`/
`item_id` don't reference real rows on create (§1.7). No 409s — no unique
constraint.

---

## 10. Sales

`Sale`/`SaleItem` (non-bird items) + `BirdSale`. Both **append-only**
(§1.10).

### 10.1 Sale (regular items — feed surplus, culls, manure, etc.)

Exact mirror of Purchases' money-math pattern.

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/sales` | 200 | query: `customer_id?` |
| GET | `/api/sales/:id` | 200 | includes `items`, `customer` |
| POST | `/api/sales` | 201 | `{ customer_id?, sale_date, paid_amount? (default 0), recorded_by_id, items: [{ item_id, quantity, unit, unit_price }, ...] (min 1) }` |

`total`/line `total_price`/`due_amount` computed server-side, same as
Purchases.

**Errors**: **404** unknown `:id`. Create → **400** if `paid_amount`
exceeds the computed total (nothing written); **400** if `customer_id` or
any line's `item_id` don't reference real rows (§1.7); **400** if `items`
is empty.

### 10.2 BirdSale

The batch's actual product sale — **decrements `BatchHouseBalance`**, one
of only three things allowed to (with `MortalityLog` and
`BatchHouseAllocation`).

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/bird-sales` | 200 | query: `batch_id?`, `customer_id?` |
| GET | `/api/bird-sales/:id` | 200 | — |
| POST | `/api/bird-sales` | 201 | see below |

**Create body**:
```
{
  batch_id, house_id, customer_id?, sale_date, grade: BirdGrade,
  male_count?, female_count?, birds_count,
  dholta_in_g, total_katha, avg_wt_per_katha_kg?,
  total_weight, net_weight, avg_weight_g?,
  price_per_kg, paid_amount? (default 0), recorded_by_id
}
```
**Only `total_amount` (`= net_weight × price_per_kg`) and `due_amount` are
server-computed.** Every regional field (`dholta_in_g`, `total_katha`,
`avg_wt_per_katha_kg`, `avg_weight_g`) is stored exactly as sent — the API
deliberately doesn't try to derive them from each other (unit-conversion
ambiguity the team didn't have full context on; see `PROGRESS.md` Phase 9).

**Errors**: **404** unknown `:id` on get. Create → **400** if `male_count`
+ `female_count` are both given and don't sum to `birds_count`
(validator-level, before any database call); **400** if the computed
`total_amount` is less than `paid_amount`; **409** if `birds_count` exceeds
the house's live balance for that batch (`detail`: `"Sale quantity exceeds
live birds in this house"` — nothing written on rejection); **400** if
`batch_id`/`house_id`/`customer_id`/`recorded_by_id` don't reference real
rows (§1.7).

---

## 11. Finance

### 11.1 Expense

Append-only (§1.10).

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/expenses` | 200 | query: `batch_id?`, `category?`, `cost_type?` |
| GET | `/api/expenses/:id` | 200 | — |
| POST | `/api/expenses` | 201 | `{ batch_id?, category: ExpenseCategory, cost_type: CostType, amount, date, remarks?, recorded_by_id }` |

`cost_type = SHARED_PERIOD` expenses currently show as **unallocated** in
batch P&L (§14.3) — the bird-days formula that would distribute them across
concurrent batches is still v2, not built. Don't build UI that implies
shared costs are already split across batches; they aren't yet.

**Errors**: **404** unknown `:id`. Create → **400** if `batch_id`/
`recorded_by_id` don't reference real rows (§1.7). No 409s — no unique
constraint on this table.

### 11.2 Asset Depreciation — read-only

Never posted directly. Rows are written automatically by
`POST /api/batches/:id/close` (§7.1) for every `ACTIVE` Asset whose
`StockUnit` the closing batch consumed (via `Consumption`,
`amount = purchase_cost / useful_life_batches`).

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/asset-depreciations` | 200 | query: `asset_id?`, `batch_id?` |

**No errors beyond generic 400 validation** — pure filtered list, no POST
route exists for it at all.

---

## 12. Payroll

### 12.1 Performance Score Entries

Fixed point value **per criterion**, looked up server-side — the client
cannot set `points` for a normal criterion (sending one is silently
ignored; the server snapshots the fixed value regardless). `OTHER` is the
one escape hatch: client supplies `points`, validator bounds it to ±1–5
(excluding 0).

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/performance-score-entries` | 200 | query: `employee_id?` |
| POST | `/api/performance-score-entries` | 201 | `{ employee_id, given_by_id, criterion: PerformanceCriterion, points? (OTHER only), reason, date?, idempotency_key? }` |

Fixed point table (send `criterion`, never `points`, for any of these):

| Criterion | Points | | Criterion | Points |
|---|---|---|---|---|
| `ATTENDANCE_PERFECT` | +3 | | `FALSIFIED_RECORD` | -5 |
| `EARLY_PROBLEM_REPORT` | +3 | | `NEGLIGENT_LOSS` | -5 |
| `SUGGESTION_IMPLEMENTED` | +3 | | `BIOSECURITY_VIOLATION` | -4 |
| `TEAM_TARGET_HIT` | +3 | | `CONCEALED_PROBLEM` | -4 |
| `ZERO_NEGLIGENT_LOSS` | +2 | | `MISSED_CRITICAL_TASK` | -3 |
| `ACCURATE_DATA_ENTRY` | +2 | | `EQUIPMENT_DAMAGE` | -3 |
| `BIOSECURITY_FOLLOWED` | +2 | | `CONDUCT_ISSUE` | -3 |
| `HELPED_COWORKER` | +2 | | `TEAM_SUPERVISION_FAILURE` | -3 |
| `EXTRA_TASK_COMPLETED` | +2 | | `UNEXCUSED_ABSENCE` | -2 |
| `CONFLICT_RESOLVED` | +2 | | `PATTERN_LATENESS` | -2 |
| `OTHER` | client sends ±1 to ±5 (not 0) | | | |

**Errors**: **400** if `criterion: "OTHER"` and `points` is missing, `0`, or
outside ±5 (validator-level, before any database call); **400** if
`employee_id`/`given_by_id` don't reference real rows (§1.7). No 409s — no
unique constraint on this table.

### 12.2 Payroll Records

Manual, admin-triggered month-end action (there's no cron). Locked snapshot
per `(employee_id, month)` — regenerating throws 409, and there's no update
endpoint; if the baseline salary or a criterion's points change later, past
months' `PayrollRecord`s stay exactly as computed.

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/payroll-records` | 200 | query: `employee_id?` |
| POST | `/api/payroll-records/generate` | 201 | `{ employee_id, month }` |

`month` can be any date within the target month (normalized server-side to
the 1st). Sums that month's `PerformanceScoreEntry.points` for the
employee, clamps to **[-10, +20]** as `adjustment_percent`, applies to the
employee's *current* `Employees.salary` as `baseline_salary`, computes
`final_salary = baseline_salary × (1 + adjustment_percent / 100)`.

**Errors**: **404** if `employee_id` doesn't reference a real Employee
(checked explicitly, not via the generic FK path — same reasoning as
`BatchHouseAllocation`'s `batch_id` check in §7.2); **409** if a
`PayrollRecord` already exists for that `(employee_id, month)`.

---

## 13. Alerts

Built as an **on-demand reconciliation scan**, not live hooks on every
write — see `PROGRESS.md` Phase 13 for why. `POST /api/alerts/scan` is
meant to be called periodically (there's no cron yet, so: on dashboard load,
on a timer, or manually) — call it, don't expect alerts to appear the
instant a triggering condition becomes true elsewhere in the API.

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/alerts` | 200 | query: `type?`, `level?`, `status?` |
| GET | `/api/alerts/:id` | 200 | — |
| POST | `/api/alerts` | 201 | `{ title, description?, type: AlertTypes, level: AlertLevels, related_id?, action_type? }` — manual alert |
| POST | `/api/alerts/:id/resolve` | 200 | — |
| POST | `/api/alerts/scan` | 200 | — runs all 5 checks below, returns the current `ACTIVE` list |

Scan checks (each dedupes against an existing `ACTIVE` alert for the same
`(type, related_id)` — re-running the scan doesn't spam duplicates; resolve
one to let the next scan re-raise it if still true):

1. **Low stock** — `StockLedger` balance (`IN − OUT`) below `Item.reorder_level` → `FEED` or `MEDICINE` alert (by item category), `WARNING`.
2. **Mortality spike** — 24h deaths ÷ current live balance > 1% for a `RUNNING` batch → `BATCH`, `CRITICAL`.
3. **Expiring stock** — `PurchaseItem.expiration_date` within 30 days → `MEDICINE`, `WARNING`.
4. **Payroll due** — an active employee missing last month's `PayrollRecord`, checked from the 5th of the month onward → `EMPLOYEE`, `INFO`.
5. **Negative performance pattern** — net `PerformanceScoreEntry` points this month ≤ -5 → `EMPLOYEE`, `WARNING`.

**Errors**: **404** unknown `:id` on get/resolve; **409** if resolving an
alert whose `status` is already `RESOLVED`. `create`/`scan` have no error
paths beyond generic validation — `related_id` isn't a real FK (§1.13), so
an unresolvable one is silently accepted, not rejected.

---

## 14. Audit Log & Analytics

### 14.1 Audit Log — read side only

`AuditLog` exists in the schema, but **nothing writes to it yet** —
population needs Phase 15 (Auth) to know who's making a change. Expect this
to return an **empty list** until Auth lands; the endpoint is built and
ready, just unpopulated. Don't build UI that assumes audit history exists
for anything created through this API today. **No POST/PATCH/DELETE route
exists for this resource at all.**

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/audit-logs` | 200 | query: `table_name?`, `record_id?`, `changed_by_id?`, `action?`, `from?`, `to?` (dates) |
| GET | `/api/audit-logs/:id` | 200 | full `before_data`/`after_data` JSON diff |

**Errors**: **404** unknown `:id`. List has no error paths beyond generic
validation.

### 14.2 Analytics — farm overview

```
GET /api/analytics/overview   → 200, no query params, no error paths
```
Returns:
```json
{
  "active_batch_count": 4,
  "total_birds_alive": 8340,
  "houses_occupied": 5,
  "houses_empty": 2,
  "employee_headcount": 12,
  "unresolved_alerts_by_level": { "WARNING": 2, "CRITICAL": 1 }
}
```
`total_birds_alive` is scoped to `RUNNING` batches only — a force-closed
batch (`close` with `force: true` while birds remained) can still hold a
nonzero `BatchHouseBalance`, and that's intentionally excluded here.
`unresolved_alerts_by_level` only includes levels that actually have at
least one `ACTIVE` alert — a level with zero is simply absent from the
object, not present with value `0`.

### 14.3 Analytics — batch performance & P&L

```
GET /api/analytics/batches/:id/performance   → 200, or 404 if :id doesn't exist
```
```json
{
  "batch_id": "...", "live_count": 680, "initial_chick_count": 1000,
  "cumulative_died": 20, "cumulative_mortality_rate": 0.02,
  "age_days": 14, "expected_selling_date": "...", "actual_end_date": null,
  "latest_average_weight_grams": "500", "latest_weight_date": "..."
}
```
`cumulative_mortality_rate` is a plain float fraction (0.02 = 2%), not a
percentage or a string. `latest_average_weight_grams`/`latest_weight_date`
are both `null` if no `WeightRecords` exist for the batch yet. **No FCR
field** — feed is logged in whatever `Unit` the item uses (`BAG`, `KG`,
...), and turning that into a true feed-conversion ratio needs a per-unit
weight table this system doesn't have. Don't compute one client-side either
without that same missing conversion table — an FCR built on an unstated
unit assumption is worse than none.

```
GET /api/analytics/batches/:id/pnl   → 200, or 404 if :id doesn't exist
```
```json
{
  "batch_id": "...", "revenue": "118000", "purchase_cost": "15000",
  "direct_expenses": "2000", "depreciation_share": "4000",
  "shared_period_expenses_unallocated": "1500", "profit": "97000"
}
```
`revenue` = sum of `BirdSale.total_amount` for the batch (`Sale`/`SaleItem`
revenue is **not** included — those aren't batch-linked at all).
`purchase_cost` = sum of `PurchaseItem.total_price` linked to the batch
(chicks, and anything else explicitly tagged with this `batch_id`).
`profit = revenue − purchase_cost − direct_expenses − depreciation_share`.
`shared_period_expenses_unallocated` is reported but **not** subtracted
into `profit` — it's shown so the UI can flag "there's N in shared costs
not yet allocated to this batch," not silently baked into the number.

### 14.4 Analytics — financial dashboard

```
GET /api/analytics/financial?month=2026-08-01   → 200, no error paths (month is optional and any invalid date just 400s at validation)
```
`month` optional, defaults to the current month; any date within the target
month works (normalized server-side).
```json
{
  "month": "2026-08",
  "revenue": "118000", "expenses": "2000", "gross_profit": "116000",
  "outstanding_payables": "45000",
  "cash_position": "70000",
  "cash_by_instrument": [
    { "instrument_id": "...", "label": "Farm Bank", "balance": "70000" }
  ]
}
```
`revenue`/`expenses` are scoped to the given month (`Sale.sale_date` /
`BirdSale.sale_date` / `Expense.date` within it). `outstanding_payables` is
**all-time**, not month-scoped (sum of every `Purchase.due_amount`, across
every purchase regardless of date). `cash_position` sums every *active*
`PaymentInstrument`'s balance (incoming minus outgoing, all-time,
deactivated instruments excluded) — same computation as §15.1's
per-instrument balance endpoint, just totaled. `cash_by_instrument` is only
active instruments too.

---

## 15. Payments

### 15.1 Payment Instruments

Full CRUD + deactivate/reactivate (own `is_active`, §1.11).
`owner_type`/`owner_id` is a polymorphic reference (§1.13) — e.g. the farm's
own bank account has `owner_type: "ADMIN"`, a supplier's account has
`owner_type: "SUPPLIER", owner_id: <Suppliers.id>`.

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/payment-instruments` | 200 | query: `owner_type?`, `owner_id?`, `is_active?` |
| GET | `/api/payment-instruments/:id` | 200 | — |
| GET | `/api/payment-instruments/:id/balance` | 200 | `{ instrument_id, incoming, outgoing, balance }` — computed, not stored |
| POST | `/api/payment-instruments` | 201 | `{ owner_type, owner_id, type: PaymentMethod, label, bank_name?, account_no?, mobile_no?, mfs_type? }` |
| PATCH | `/api/payment-instruments/:id` | 200 | `{ type?, label?, bank_name?, account_no?, mobile_no?, mfs_type? }` (`owner_type`/`owner_id` not editable — not accepted by the update schema) |
| POST | `/api/payment-instruments/:id/deactivate` | 200 | — |
| POST | `/api/payment-instruments/:id/reactivate` | 200 | — |

**Errors**: **404** unknown `:id` on get/balance/patch/deactivate/
reactivate; **400** empty `PATCH` body. `owner_id` isn't validated against
any table (§1.13) — create can never 400/409 on a bad owner reference, and
`owner_type`/`owner_id` aren't unique either, so create has essentially no
business-rule error path at all beyond generic field validation.

### 15.2 Payments

Append-only (§1.10).

| Method | Path | Status | Body / Query |
|---|---|---|---|
| GET | `/api/payments` | 200 | query: `ref_type?`, `ref_id?`, `direction?`, `instrument_id?` (matches either from/to) |
| GET | `/api/payments/total-paid` | 200 | query (**required**): `ref_type`, `ref_id` → `{ ref_type, ref_id, total_paid }` |
| GET | `/api/payments/:id` | 200 | — |
| POST | `/api/payments` | 201 | `{ amount, payment_date, direction: PaymentType, ref_type: PaymentRefType, ref_id, from_instrument_id, to_instrument_id?, transaction_ref?, handled_by_id?, note? }` |

`from_instrument_id` must reference a real `PaymentInstrument`;
`to_instrument_id` is optional (e.g. an outgoing payment to a supplier whose
exact receiving account isn't tracked). `ref_type`/`ref_id` are polymorphic
(§1.13, like `StockLedger`) — not validated against the target table, so
pointing `ref_id` at a nonexistent Purchase/Sale/etc. **won't error at
all**, it'll just create an orphaned Payment that `total-paid` will
still happily sum. **This is the read-time substitute for a mutable
`due_amount`** (§1.10, §8 note) — use `total-paid` to compute "how much of
this Purchase/Sale/BirdSale/Expense/Payroll is actually paid off" rather
than trusting any `due_amount` field to update itself.

**Errors**: **404** unknown `:id`. `total-paid` → **400** if `ref_type` or
`ref_id` is missing from the query string (both required, not optional,
unlike most list filters). Create → **400** if `from_instrument_id`,
`to_instrument_id`, or `handled_by_id` don't reference real rows (§1.7). No
409s on this resource.

---

## 16. Building the mobile app — role/permission notes

`FEATURES.md` §3 has the full breakdown; the load-bearing points for
implementation:

- **Intern**: read-only + environment readings + weight-sample assist. Don't
  expose `POST /api/mortality-logs`, `/api/consumptions`,
  `/api/medications`, `/api/vaccinations` in an Intern's UI at all — nothing
  server-side blocks it today (no Auth/permissions yet, §1.6), but the
  intended role boundary is enforced client-side until Phase 15 exists.
- **Worker**: adds mortality/consumption/treatment logging (all of §7.4,
  §9.1–9.2) on top of Intern.
- **Manager**: adds `BatchHouseAllocation` (§7.2), `BatchFeedingProgram`
  (§9.5), `PerformanceScoreEntry` (§12.1, scoring Workers/Interns), and the
  two Manager-specific writes: `StockUnit.bind`/`relocate` (§6.4, receiving
  deliveries in the field) and `InventoryAdjustment` (§6.7, reporting a
  discrepancy found in the field).
- **Every mobile write should generate `idempotency_key` client-side before
  the first send attempt** (§1.12) — the whole point is surviving a flaky
  connection retrying a queued write without double-inserting.
- Purchases, Sales, Payments, Finance, and Admin/Employee management stay
  web-dashboard-only — don't build mobile UI for any endpoint in §2, §3,
  §8, §10, §11, or §15.
- **Handle the 429 plain-text response** (§1.5) explicitly in the mobile
  HTTP client's error path — a flaky-connection retry storm hitting the
  rate limit is exactly the scenario this app's offline queue is built to
  survive, and a client that assumes every error body is JSON will crash on
  it.
