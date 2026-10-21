# Product Requirements Document (PRD) — Frontend Redesign & Mobile PWA (v0.5.0)

## 1. Meta Information
- **Feature/Release Name:** AlfaAltoGrup Frontend Redesign, UI Modularization & Mobile PWA (v0.5.0)
- **Status:** Approved for Implementation (Triple Spec Audit Ready)
- **Primary Objective:** Redesign, modularize, and standardize the entire frontend and PWA of AlfaAltoGrup (Next.js 16 + React 19 + Tailwind CSS + `shadcn/ui` zinc/emerald/indigo), preserving 100% of existing business logic, API integrations, SQLite database state, and WhatsApp sessions, while delivering an ergonomic desktop and mobile PWA experience with zero blocking browser alerts.
- **Traceability:** Fulfills Requirements R1, R2, and R3 from `ORIGINAL_REQUEST.md` and aligns with `orchestrator_main/PROJECT.md`.

---

## 2. Actors & Permissions
- **Guest / Unauthenticated User:** Access strictly limited to public routes: `/login`, public documentation (`/documentacao`, `/api-docs`, `/api/swagger`, `/api/documentacao`, `/api/docs`, `/llm.txt`, `/llms.txt`), and public redirect funnels (`/l/[code]`, `/g/[inviteCode]`). Strictly prohibited from accessing administrative routes (`/`, `/[slug]`, `/tags`, `/relatorios`, `/links`, `/chaves`), group data, API keys, or administrative mutation endpoints.
- **Authenticated Administrator / Operator:** Complete access to all 9 system routes (`/`, `/[slug]`, `/tags`, `/relatorios`, `/relatorios/[date]`, `/links`, `/chaves`, `/documentacao`, `/api-docs`). Capabilities:
  - Manage WhatsApp instances and QR Code connections.
  - Create, view, sync, filter, edit, and bulk-update WhatsApp groups.
  - Manage schedules (text, media, buttons, polls), queue controls, and preview WhatsApp bubbles.
  - Configure Tag funnels, automatic overflow queues, and invite links.
  - Inspect analytical reports, member churn, and São Paulo hourly link attribution heatmaps.
  - Configure welcome rules (PV) with humanized delays, cooldowns, and anti-ban safeguards.
  - Issue and revoke API keys with one-time secret revelation.
- **Background Worker & System Automation:** Autonomous Node.js process executing queue tasks, welcome dispatches, and daily report generation without UI dependency.
- **External API & MCP Consumers:** Systems consuming `/api/*` and `/api/mcp` using Bearer API keys.

---

## 3. Scope of the 9 Frontend Routes & PWA Assets

| # | Route | File(s) | Key Functional Scope & Redesign Deliverables |
|---|-------|---------|----------------------------------------------|
| 1 | `/` (Dashboard) | `src/app/page.tsx`, `src/app/DashboardClient.tsx`, submodules, `src/components/ScrollDial.tsx` | Instance connection bar, 4 KPI cards, 4 workspace views via `shadcn/ui` `Tabs` (`Meus Grupos`, `Agenda & Fila Global`, `Auditoria de Membros & DDDs`, `Boas-Vindas (PV)`), search/tag filters, bulk selection bar, group cards with `Progress` capacity bars. Reuses extracted shared `ScrollDial.tsx` (eliminating ~90 lines of duplicate dial code). Modularized out of 1,639-line monolith. |
| 2 | `/[slug]` (Group Detail) | `src/app/[slug]/page.tsx`, `src/app/[slug]/GroupClient.tsx`, `GroupEditorModal.tsx`, `ScheduleSummary.tsx`, `src/components/ScrollDial.tsx` | Enveloped in `AppShell` (`voltarPara="/"`), group hero header with avatar & tag badges (in-flow hero profile card without sticky collision), 3 tabs (`Detalhes` with member search/roles, `Agenda` with filters, queue alerts, schedule cards, `ScheduleSummary`, WhatsApp bubble preview, and shared `ScrollDial.tsx`, `Permissões` with `Switch` controls). |
| 3 | `/tags` (Tags & Funnel) | `src/app/tags/page.tsx`, `src/app/tags/TagsClient.tsx` | 4 KPI cards, tag queue cards with color accents, occupancy `Progress` bars, copyable `/g/[inviteCode]` funnel links with Toast feedback, step modals (`TagFormModal` and `GruposDaTagModal`). |
| 4 | `/relatorios` & `/relatorios/[date]` | `src/app/relatorios/page.tsx`, `src/app/relatorios/[date]/RelatorioClient.tsx` | Quick date picker, 8 KPI cards, alert configuration card with `Switch` controls, 9 breakdown cards (per instance, group, action type, member churn, tag funnel `/g/`, campaigns, link clicks, polls, daily failures). |
| 5 | `/links` (Link Attribution) | `src/app/links/page.tsx`, `src/app/links/LinksClient.tsx` | 4 KPI cards, 24-hour São Paulo hourly heatmap with `Tooltip`, short link generator (`/l/[code]?grupid=`) with per-group breakdown and copy Toast feedback. |
| 6 | `/chaves` (API Keys & MCP) | `src/app/chaves/page.tsx`, `src/app/chaves/KeysClient.tsx` | API key generator, one-time reveal `Alert` with copy button, active/revoked key lists with `AlertDialog` revocation confirmation, `/api/mcp` reference. |
| 7 | `/documentacao` (Docs) | `src/app/documentacao/page.tsx`, `src/app/documentacao/DocsContent.tsx` | 18 technical sections, mobile section jumper for touch ergonomics, copyable code blocks with Toast feedback. |
| 8 | `/api-docs` (Swagger UI) | `src/app/api-docs/page.tsx` | Integrated cleanly into `AppShell` with dark theme container and navigation topbar. |
| 9 | `/login` (Authentication) | `src/app/login/page.tsx` | Modernized zinc card with `Alert` error messages, `Input`, and loading spinner button. |
| 10 | PWA Core Assets | `public/manifest.json`, `public/sw.js`, `public/offline.html`, `GlobalErrorAlerts.tsx` | Service worker cache bumped to `alfaaltogrup-v3`, offline page 100% self-contained (inline styles, system font stack, no external CDN/font requests) aligned with zinc design tokens, non-blocking error toasts and standardized `Dialog` popups. |

---

## 4. User Stories & Workflows

### 4.1 Workflow 1: Desktop Navigation & Ergonomics
- **As an** operator on a desktop widescreen (>= 1024px),
- **I want** a collapsible navigation sidebar with clear section icons and a contextual topbar,
- **So that** I have maximum workspace area for group cards and schedule timelines while retaining fast access to all system tools.
- **Rules:**
  - Sidebar state (collapsed vs expanded) persists across route transitions.
  - Active route is visually highlighted with zinc accent and emerald/indigo indicators.
  - Contextual actions (e.g., "Voltar", instance indicator, install button) appear in the topbar.

### 4.2 Workflow 2: Mobile PWA Standalone Experience
- **As a** mobile user running AlfaAltoGrup installed as a PWA,
- **I want** a native-like experience with bottom navigation, smooth drawer menus, and full compliance with safe area insets,
- **So that** I can operate groups on iPhone/Android without browser chrome interference.
- **Rules:**
  - Bottom navigation bar hosts 5 items: Grupos (`/`), Tags (`/tags`), Relatórios (`/relatorios`), Cliques (`/links`), and "Mais" (triggering bottom Sheet drawer).
  - Safe areas (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`, `env(safe-area-inset-left)`, `env(safe-area-inset-right)`) are strictly applied to topbars, bottom bars, and floating alerts.
  - No horizontal scrolling or viewport overflowing exists at `375px` width.

### 4.3 Workflow 3: Non-Blocking User Feedback (Zero `alert()` / Zero `confirm()`)
- **As an** operator performing critical actions (connecting WhatsApp, saving schedules, revoking keys, purging queues),
- **I want** modern non-blocking Toast notifications and accessible `AlertDialog` confirmation modals,
- **So that** my browser is never frozen by native blocking dialogs and actions have clear visual feedback.
- **Rules:**
  - Exactly 0 occurrences of `alert(...)` and 0 occurrences of `confirm(...)` across the entire `src/` codebase.
  - Informative toasts auto-dismiss in 4 seconds; error toasts stay readable with clear error messages.
  - Destructive confirmations (delete tag, revoke key, purge queue, clean duplicates) use red action buttons in `AlertDialog`.

### 4.4 Workflow 4: Group & Schedule Management (`/` and `/[slug]`)
- **As an** operator,
- **I want** to search and filter groups, view semantic capacity progress bars, configure schedules, and toggle group permissions via accessible switches,
- **So that** I have complete control over WhatsApp distribution campaigns.
- **Rules:**
  - `/[slug]` must be wrapped in `AppShell` with `voltarPara="/"`.
  - Group capacity bar displays green (<80%), amber (80-95%), or red (>95%) based on participant limits.
  - Schedule creator supports sticky header, scrollable message options, and sticky footer with preview.
  - Permission toggles use `Switch` instead of text buttons or checkboxes.

---

## 5. UI/UX Standardization Requirements

### 5.1 Design System Tokens & Style Guide
- **Style:** `new-york` variant.
- **Base Color:** `zinc` dark theme (`--background: 240 10% 3.9%`, `--card: 240 10% 3.9%`, `--border: 240 3.7% 15.9%`).
- **Accents:**
  - `emerald-500` / `emerald-600`: WhatsApp status, connected instance badges, success notifications, delivery metrics.
  - `indigo-500` / `sky-500`: Short link clicks, campaign tracking, timeline indicators.
  - `destructive` (red): Error toasts, stuck queue alerts, confirmation actions.
- **Icons:** `lucide-react`.

### 5.2 Modal Standardization Contract (14 Modals)
Every modal in the application must adhere strictly to the following 4-part ergonomic layout:
1. **Container:** `DialogContent` with `sm:max-w-[...] w-[95vw] max-h-[85dvh] flex flex-col p-0 overflow-hidden`.
2. **Sticky Header:** `DialogHeader` with `p-6 pb-4 border-b border-border/40 shrink-0`.
3. **Scrollable Body:** `div` with `p-6 overflow-y-auto flex-1 space-y-4` (or `ScrollArea`).
4. **Sticky Footer:** `DialogFooter` with `p-4 border-t border-border/40 shrink-0 bg-background/80 backdrop-blur`.

### 5.3 Catalog of 14 Standardized Modals
1. `Nova Instância` (`DashboardClient`)
2. `QR Code WhatsApp` (`DashboardClient`)
3. `Novo Grupo` (`DashboardClient`)
4. `Agendamento em Massa` (`DashboardClient`)
5. `Colar JSON em Massa` (`DashboardClient`)
6. `BulkEditModal` (`src/app/BulkEditModal.tsx`)
7. `GroupEditorModal` (`src/app/[slug]/GroupEditorModal.tsx`)
8. `Novo/Editar Agendamento` (`src/app/[slug]/ScheduleModal.tsx`)
9. `Pré-visualizar WhatsApp` (`src/app/[slug]/WhatsAppPreviewModal.tsx`)
10. `Copiar Agendamentos` (`src/app/[slug]/CopyScheduleModal.tsx`)
11. `Colar Agendamentos` (`src/app/[slug]/PasteScheduleModal.tsx`)
12. `TagFormModal` (`src/app/tags/TagsClient.tsx`)
13. `GruposDaTagModal` (`src/app/tags/TagsClient.tsx`)
14. `GlobalErrorAlerts` Modals: `Sessão Desconectada` & `Gerenciador de Falhas e Atrasos` (`src/components/GlobalErrorAlerts.tsx`)

> **Note on Modal Count**: Item 14 encompasses 2 distinct dialog interfaces in `GlobalErrorAlerts.tsx` (`Sessão Desconectada` popup and `Gerenciador de Falhas e Atrasos` modal), resulting in 15 total standardized modal dialogs across the 14 cataloged items.

### 5.4 Catalog of 10 Zero-Bloat UI Primitives (`src/components/ui/`)
To preserve memory on the 1 vCPU / 1 GB RAM production server, **zero new runtime npm packages** shall be installed. The following 10 primitives must be implemented using existing `@radix-ui/react-dialog` dependencies or lightweight React 19 + Tailwind CSS:
1. `src/components/ui/alert-dialog.tsx`: Composed from `@radix-ui/react-dialog` for non-blocking confirmations.
2. `src/components/ui/toast.tsx`, `use-toast.ts`, `toaster.tsx`: Lightweight event-driven toast notification system.
3. `src/components/ui/switch.tsx`: Accessible toggle switch (`role="switch"`, `aria-checked`).
4. `src/components/ui/progress.tsx`: Semantic progress bar with dynamic color indicators (`default`, `warning`, `destructive`).
5. `src/components/ui/skeleton.tsx`: Pulse loading state container (`animate-pulse`).
6. `src/components/ui/scroll-area.tsx`: Styled scroll container with subtle scrollbar styling.
7. `src/components/ui/separator.tsx`: Semantic horizontal and vertical divider (`role="separator"`).
8. `src/components/ui/tooltip.tsx`: Lightweight hover/focus tooltip for heatmaps and quick actions.
9. `src/components/ui/avatar.tsx`: User and group avatar primitive with image fallback.
10. `src/components/ui/alert.tsx`: Accessible banner alert with severity variants (`default`, `destructive`, `success`, `warning`).

### 5.5 Shared Time Dial Component Extraction (`ScrollDial.tsx`)
- Extract the duplicated pointer-drag wheel dial time picker from `DashboardClient.tsx` (lines 27–123) and `GroupClient.tsx` (lines 48–144) into reusable `src/components/ScrollDial.tsx` (eliminating ~90 lines of duplicate code).

---

## 6. Business Rules & Operational Constraints

1. **Thin Client, Fat Server:**
   - Zero direct database queries in client components.
   - All WhatsApp interactions go through Next.js API routes (`/api/*`), which validate input, enforce authentication, and proxy to Evolution GO or Prisma.
2. **Zero Data Loss Guarantee:**
   - Existing SQLite database (`deploy_sqlite_data`: `dev.db`, `dev.db-wal`, `dev.db-shm`) must not be overwritten, reset, or altered in schema.
   - Existing PostgreSQL database (`deploy_pg_data`: `evogo_auth`, `evogo_users`) with WhatsApp active sessions in `whatsmeow_device` must remain 100% untouched.
   - Uploaded media (`deploy_uploads_data`) must remain intact.
3. **Strict Memory & Hardware Budgets (Oracle Cloud 1 vCPU / 1 GB RAM):**
   - The production stack must operate within 954 MiB RAM + 6 GB swap.
   - Docker container limits:
     - `caddy`: 64 MB
     - `postgres`: 352 MB
     - `evolution-go`: 640 MB (with mounted `./evogo-server` binary)
     - `web`: 256 MB (`NODE_OPTIONS="--max-old-space-size=224"`)
     - `worker`: 192 MB (`NODE_OPTIONS="--max-old-space-size=128"`)
4. **Single-Service Build Rule:**
   - In production, always build the `web` target explicitly (`docker compose build web`) to prevent simultaneous multi-container builds that cause memory exhaustion.
5. **Universal Docker Execution (User Rule 1):**
   - No build, test, or deployment command shall be executed directly on the host operating system outside of a Docker container.

---

## 7. Out of Scope

- **Database Schema Migrations:** No changes to `prisma/schema.prisma` or new database tables.
- **Backend API Contract Changes:** All existing endpoint signatures (`/api/groups`, `/api/schedules`, `/api/welcome`, `/api/instances`, `/api/tags`, `/api/links`, `/api/relatorios`, `/api/mcp`) remain identical.
- **Worker Logic Alterations:** No alterations to `worker.js`, `shared/welcome.js`, `shared/variables.js`, `shared/bot-filter.js`, or `shared/capacity.js`.
- **New Third-Party Heavy Dependencies:** No heavy UI component libraries or animation engines outside existing Radix/Tailwind stack.
- **Evolution GO WhatsApp Session Recreation:** No re-scanning of QR codes for existing connected instances in production.

---

## 8. Definition of Done & Acceptance Criteria

### 8.1 Functional & UI Acceptance
- [ ] All 9 routes (`/`, `/[slug]`, `/tags`, `/relatorios/[date]`, `/links`, `/chaves`, `/documentacao`, `/api-docs`, `/login`) render correctly without hydration errors.
- [ ] `/[slug]` and `/api-docs` are wrapped in `AppShell` with seamless navigation.
- [ ] Exactly 0 native `alert(...)` calls remain across `src/` (`grep -rn "alert(" src/` returns 0).
- [ ] Exactly 0 native `confirm(...)` calls remain across `src/` (`grep -rn "confirm(" src/` returns 0).
- [ ] All 14 modals follow the standardized sticky header, scrollable body (`max-h-[85dvh]`), and sticky footer layout.
- [ ] Dashboard workspace views are controlled via `shadcn/ui` `Tabs`.
- [ ] Group capacity bars and Tag occupancy use accessible `Progress` primitives.
- [ ] Group permission switches use `Switch` primitives.
- [ ] Mobile view at `375px` displays 5-item bottom bar + Sheet drawer without horizontal overflow.
- [ ] Desktop view at `>= 1024px` displays collapsible sidebar + contextual topbar.
- [ ] PWA Service Worker cache is updated to `alfaaltogrup-v3` and `offline.html` matches the zinc design system.
- [ ] All 10 zero-bloat UI primitives in `src/components/ui/` (`alert-dialog`, `toast/use-toast/toaster`, `switch`, `progress`, `skeleton`, `scroll-area`, `separator`, `tooltip`, `avatar`, `alert`) are implemented with zero new npm runtime packages.
- [ ] Shared `ScrollDial.tsx` component is extracted and reused across `DashboardClient` and `GroupClient` (eliminating duplicate dial code).
- [ ] `public/offline.html` is 100% self-contained (inline styles, system font stack, no external CDN/font requests) and conforms to zinc design tokens.

### 8.2 Build & Deployment Acceptance
- [ ] Standalone production build (`next build`) completes successfully with exit code 0 inside Docker.
- [ ] Version `0.5.0` is bumped in `package.json`.
- [ ] Git branch `feat/redesign-pwa-v050` is merged into `main` with atomic Conventional Commits.
- [ ] Production deployment on Oracle Cloud VM (`137.131.168.133`) is completed via SSH without touching SQLite or PostgreSQL volumes.
- [ ] Deployment sequence strictly uses `--no-deps web worker` to bypass `init` container execution and prevent database overwrite or password reset.
- [ ] Verified that PostgreSQL `whatsmeow_device` retains 2 active WhatsApp sessions post-deployment.
- [ ] All 5 production containers (`caddy`, `postgres`, `evolution-go`, `web`, `worker`) are running healthy.
- [ ] HTTP health check returns status 200/302.
