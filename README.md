<div align="center">

<img src="public/logo-light.svg" height="56" alt="ZFarms" />

# ZFarms Admin Dashboard

**The operator console of the ZeroD Farms Management System: flocks, stock, money and people in one place.**

[**dashboard.zfarms.zerod.bd**](https://dashboard.zfarms.zerod.bd)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![TanStack Query](https://img.shields.io/badge/TanStack%20Query-5-FF4154?logo=reactquery&logoColor=white)
![Deployed on Vercel](https://img.shields.io/badge/deploy-Vercel-000000?logo=vercel)

</div>

---

The dashboard is where the farm's owner and admins run the business: buy and sell, track every bottle of medicine, follow each batch from chick to sale, close the month's payroll, and read the numbers. Field staff use the [ZFarm mobile app](https://github.com/AFIF-ZILANI/fms-exe-mobile) instead. Both talk to the same [API](https://github.com/AFIF-ZILANI/fms-backend).

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Conventions](#conventions)
- [Deployment](#deployment)
- [Documentation](#documentation)

## Features

| Area | What you can do |
| --- | --- |
| **Analytics** | Farm-wide KPIs and trends: mortality, feed and FCR, stock, spend, sales and payroll cost |
| **Batches** | Place a batch across houses and follow it tab by tab: houses, mortality, weight, feeding program, treatments, vaccine schedule, environment, consumption, financials |
| **Houses** | Occupancy, turnaround phase, what stock each house holds |
| **Inventory** | Item catalog with unit conversions, stock ledger, low stock, consumption log (by quantity or by QR code), adjustments, warehouses, organizations, assets and depreciation, stock analytics |
| **QR-coded units** | Provision and print labels (A4 sheets), bind them to purchase lots, follow each bottle's location and status, reprint |
| **Purchases** | Record deliveries with per-line discounts and extra charges (landed cost), view each lot's QR codes, pay suppliers, remove a purchase entered by mistake |
| **Sales** | Product sales and bird sales per house, payments received, outstanding receivables |
| **Finance** | Cash book and cost book, payables and receivables, expenses, payment instruments |
| **People** | Employees and their roles and salaries, tasks and assignments, bonuses, monthly payroll and payouts, admin accounts with temporary passwords |
| **Operations** | Alerts and a notifications inbox, the audit log, settings (categories and units, vaccine templates, farm day start, scale devices) |

Every table sorts and paginates and can be exported to CSV. The whole UI works in light and dark themes.

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | React 19 with the **React Compiler** (no hand-written `useMemo`/`useCallback`) |
| Build | Vite 8 (Rolldown) |
| Routing | React Router 8 |
| Server state | TanStack Query 5, through small `useGetData` / `usePostData` / `usePatchData` / `useDelete` wrappers in [`src/lib/api.ts`](src/lib/api.ts) |
| Tables | TanStack Table (sorting) behind a shared `DataTable` |
| Forms | React Hook Form + Zod |
| UI | Tailwind CSS 4, shadcn components on Base UI, Lucide icons, Sonner toasts, Geist font |
| Charts | Recharts |
| QR | `qrcode.react` for labels and print sheets |

## Getting started

**Prerequisites:** [Bun](https://bun.sh) (or Node 20+) and the [API](https://github.com/AFIF-ZILANI/fms-backend) running locally.

```bash
bun install
bun run dev        # http://localhost:5173
```

The dashboard expects the API at `http://localhost:5085/api` by default. Sign in with an admin account; on a fresh database, create one with the API's `bun run auth:set-password <email>`.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:5085/api` | API base URL. Set it in `.env.local` to point at another API |

`VITE_*` values are inlined at build time; restart `bun run dev` after changing one. The API must list the dashboard's origin in its `ALLOWED_ORIGINS`, because the session travels as an HTTP-only cookie (`credentials: "include"`).

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Dev server with hot reload |
| `bun run build` | Type-check (`tsc -b`) and build to `dist/` |
| `bun run preview` | Serve the production build locally |
| `bun run lint` | ESLint, including the React Hooks and React Compiler rules |
| `bun test src` | Unit tests for the pure helpers |

## Project structure

```
src/
├── main.tsx                 # Providers: Query client, theme, toasts, auth
├── App.tsx                  # Routes
├── lib/
│   ├── api.ts               # fetch wrapper, ApiError (RFC 7807), query/mutation hooks
│   └── utils.ts             # Formatting (money, dates, enums), cn()
├── components/
│   ├── auth/                # AuthProvider, route guards
│   ├── layout/              # App shell, sidebar, top bar, nav config, page titles
│   ├── shared/              # DataTable, KPICard, StatusBadge, ConfirmDialog, QrCode, pickers…
│   └── ui/                  # shadcn primitives (button, dialog, sheet, select, …)
└── pages/
    ├── analytics/  batches/  houses/  inventory/  purchases/  sales/
    ├── payments/  finance/  employees/  tasks/  bonuses/  suppliers/
    ├── customers/  doctors/  admins/  alerts/  audit-log/  settings/  auth/
    └── <area>/types.ts      # The API shapes each area reads
```

A page folder holds the page, its tabs, its dialogs and sheets, and its charts, next to the `types.ts` that describes the API responses it uses.

## Conventions

- **Data fetching:** `useGetData<T>(url, queryKey)` to read, `usePostData` / `usePatchData` / `useDelete` to write. A mutation invalidates its own key; invalidate any other key it affects yourself.
- **Errors:** `ApiError` carries the API's RFC 7807 problem details. `error.fieldError("quantity")` maps a validation message back onto a form field; anything else goes to a toast.
- **Dialogs vs. sheets:** dialogs for creating and recording, side sheets for details (a coded unit, an asset, a purchase lot).
- **Dates:** "today" means the farm's local day (`toLocaleDateString("en-CA")`), and a picked date is sent as local noon, so it never slips a day across the UTC boundary.
- **React Compiler:** read an optional chain into a local before using it inside a closure (`const id = unit?.id`), which works around a compiler crash with optional chains captured in callbacks.
- **Status colours** come from `components/shared/status-tone.ts`, shared with the mobile app's vocabulary.

## Deployment

Hosted on **Vercel**. Every push to `main` builds and deploys to production; `vercel.json` rewrites every path to `index.html` so client-side routes load directly. Set `VITE_API_BASE_URL` to the production API in the Vercel project's environment variables.

## Documentation

| Doc | Covers |
| --- | --- |
| [`docs/PRD.md`](docs/PRD.md) | Every page: layout, fields, actions, states and the endpoints it calls |
| [`docs/design.md`](docs/design.md) | The design system: colour, type, spacing, components |
| API [`docs/FEATURES.md`](https://github.com/AFIF-ZILANI/fms-backend/blob/main/docs/FEATURES.md) | The feature set and permission matrix |
| API [`docs/api.md`](https://github.com/AFIF-ZILANI/fms-backend/blob/main/docs/api.md) | Endpoint reference |
