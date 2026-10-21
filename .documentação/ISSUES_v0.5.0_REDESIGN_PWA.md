# Actionable Issues Catalog — Frontend Redesign & Mobile PWA (v0.5.0)

**Parent Specification:** `/.documentação/TECSPEC_v0.5.0_REDESIGN_PWA.md`  
**Parent PRD:** `/.documentação/PRD_v0.5.0_REDESIGN_PWA.md`  
**Milestones Covered:** M1, M2, M3, M4

---

## Milestone M1: UI Primitives, Alert/Confirm Elimination & Modal Layouts

### ISSUE-01: Zero-Bloat UI Primitives Expansion in `src/components/ui/`
- **Issue Number:** #01
- **Milestone:** M1
- **Issue Type:** UI Primitives Implementation
- **Task Description:** Implement the 10 missing `shadcn/ui` primitives required by the design system without adding any new npm runtime dependencies. Re-use `@radix-ui/react-dialog` for `alert-dialog.tsx` and implement pure React 19 + Tailwind primitives for `switch`, `progress`, `skeleton`, `scroll-area`, `separator`, `tooltip`, `avatar`, `alert`, and `toast`/`use-toast`/`toaster`.
- **The Sandbox:**
  - *Files to Create:*
    - `src/components/ui/alert-dialog.tsx`
    - `src/components/ui/toast.tsx`
    - `src/components/ui/use-toast.ts`
    - `src/components/ui/toaster.tsx`
    - `src/components/ui/switch.tsx`
    - `src/components/ui/progress.tsx`
    - `src/components/ui/skeleton.tsx`
    - `src/components/ui/scroll-area.tsx`
    - `src/components/ui/separator.tsx`
    - `src/components/ui/tooltip.tsx`
    - `src/components/ui/avatar.tsx`
    - `src/components/ui/alert.tsx`
  - *Files to Modify:* None.
  - *Files to Delete:* None.
- **Required Imports & Reusability:**
  - Import `cn` from `src/lib/utils.ts`.
  - Import `@radix-ui/react-dialog` primitives for `alert-dialog.tsx`.
- **Step-by-Step Execution Plan:**
  1. Create `alert-dialog.tsx` composing `@radix-ui/react-dialog` with accessible title, description, action (styled with `buttonVariants()`), and cancel.
  2. Create `use-toast.ts` and `toast.tsx` with event listeners for dispatching toasts, auto-dismissing after 4000ms.
  3. Create `toaster.tsx` rendering active toasts with smooth animations (`slide-in-from-top-full` / `bottom`).
  4. Create `switch.tsx` using native button with `role="switch"`, `aria-checked`, and smooth sliding thumb transition.
  5. Create `progress.tsx` with `role="progressbar"`, `aria-valuenow`, and indicator translated smoothly according to percentage.
  6. Create `skeleton.tsx`, `separator.tsx`, `scroll-area.tsx`, `tooltip.tsx`, `avatar.tsx`, and `alert.tsx`.
- **Definition of Done:**
  - All 10 primitives export TypeScript types cleanly.
  - Zero new packages added to `package.json`.
  - Components render with dark zinc design tokens.
- **Verification Steps & Commands:**
  - Verify TypeScript compilation of UI primitives without errors:
    ```bash
    docker compose run --rm web npx tsc --noEmit
    ```

---

### ISSUE-02: Mount Global `<Toaster />` and Eliminate Native `alert()` and `confirm()` Calls
- **Issue Number:** #02
- **Milestone:** M1
- **Issue Type:** Quality Assurance & Refactoring
- **Task Description:** Mount `<Toaster />` inside `src/components/Providers.tsx`. Replace 18 occurrences of native `alert(...)` (3 in `GlobalErrorAlerts.tsx`, 15 in `PainelBoasVindas.tsx`) and 5 occurrences of `confirm(...)` (1 in `PainelAgendaCampanhas.tsx`, 1 in `PainelBoasVindas.tsx`, 1 in `PainelAuditoriaMembros.tsx`, 1 in `KeysClient.tsx`, 1 in `TagsClient.tsx`) with non-blocking `toast()` and accessible `AlertDialog`. Note: The remaining 18 alerts in `DashboardClient.tsx` are refactored in ISSUE-04, and the remaining 8 alerts + 1 confirm in `GroupClient.tsx` are refactored in ISSUE-07 (completing all 44 alerts and 6 confirms across the codebase).
- **The Sandbox:**
  - *Files to Modify:*
    - `src/components/Providers.tsx`
    - `src/components/GlobalErrorAlerts.tsx`
    - `src/components/PainelBoasVindas.tsx`
    - `src/components/PainelAgendaCampanhas.tsx`
    - `src/components/PainelAuditoriaMembros.tsx`
    - `src/app/chaves/KeysClient.tsx`
    - `src/app/tags/TagsClient.tsx`
  - *Files to Create:* None.
  - *Files to Delete:* None.
- **Required Imports & Reusability:**
  - Import `Toaster` from `src/components/ui/toaster`.
  - Import `useToast` or `toast` from `src/components/ui/use-toast`.
  - Import `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, etc., from `src/components/ui/alert-dialog`.
- **Step-by-Step Execution Plan:**
  1. Add `<Toaster />` inside `src/components/Providers.tsx` adjacent to existing theme/session providers.
  2. Replace 3 `alert()` in `GlobalErrorAlerts.tsx` with `toast({ title, description, variant })`.
  3. Replace 15 `alert()` and 1 `confirm()` (delete rule) in `PainelBoasVindas.tsx` with `toast` and `AlertDialog`.
  4. Replace 1 `confirm()` in `PainelAgendaCampanhas.tsx` (bulk queue actions) with `AlertDialog`.
  5. Replace 1 `confirm()` in `PainelAuditoriaMembros.tsx` (safe leads cleanup) with `AlertDialog`.
  6. Replace 1 `confirm()` in `KeysClient.tsx` (key revocation) with `AlertDialog`.
  7. Replace 1 `confirm()` in `TagsClient.tsx` (tag deletion) with `AlertDialog`.
- **Definition of Done:**
  - `grep -rn "alert(" src/components/` returns 0.
  - `grep -rn "confirm(" src/components/ src/app/chaves/ src/app/tags/` returns 0.
  - All notifications in scoped files are non-blocking and confirmations require explicit modal acceptance.
- **Verification Steps & Commands:**
  - Verify zero remaining alerts in components:
    ```bash
    docker compose run --rm web grep -rn "alert(" src/components/
    ```
  - Verify zero remaining confirms in components and scoped client routes:
    ```bash
    docker compose run --rm web grep -rn "confirm(" src/components/ src/app/chaves/ src/app/tags/
    ```
  - Verify TypeScript compilation without errors:
    ```bash
    docker compose run --rm web npx tsc --noEmit
    ```

---

### ISSUE-03: Shared `ScrollDial.tsx` and 14 Standardized Modals Layout Architecture
- **Issue Number:** #03
- **Milestone:** M1
- **Prerequisites:** ISSUE-02 must be completed and merged.
- **Issue Type:** Component Extraction & Modal Standardization
- **Task Description:** Extract the duplicated wheel dial time picker into `src/components/ScrollDial.tsx`. Standardize the layout of `BulkEditModal.tsx` and `GroupEditorModal.tsx` to follow the sticky header, scrollable body (`max-h-[85dvh]`), and sticky footer layout contract. (Note: `GlobalErrorAlerts.tsx` modals are handled in ISSUE-02 / ISSUE-11, and `TagsClient.tsx` modals are handled in ISSUE-08 to prevent sandbox collisions).
- **The Sandbox:**
  - *Files to Create:*
    - `src/components/ScrollDial.tsx`
  - *Files to Modify:*
    - `src/app/BulkEditModal.tsx`
    - `src/app/[slug]/GroupEditorModal.tsx`
  - *Files to Delete:* None.
- **Required Imports & Reusability:**
  - Import `Dialog`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle` from `src/components/ui/dialog`.
  - Import `ScrollArea` from `src/components/ui/scroll-area`.
- **Step-by-Step Execution Plan:**
  1. Extract `ScrollDial` logic into `src/components/ScrollDial.tsx` with typed props (`value: string`, `onChange: (val: string) => void`, `horas?: boolean`).
  2. In `BulkEditModal.tsx`, wrap content in sticky header, scrollable body (`max-h-[85dvh]`), and sticky footer with preview/save buttons.
  3. In `GroupEditorModal.tsx`, apply standard sticky modal structure and replace inline status banner with Toast.
- **Definition of Done:**
  - Modals never cause page-level scrollbars; internal bodies scroll smoothly.
  - Mobile keyboards do not push action buttons off-screen.
  - `ScrollDial.tsx` exports clean reusable wheel-picker logic.
- **Verification Steps & Commands:**
  - Verify TypeScript compilation without errors:
    ```bash
    docker compose run --rm web npx tsc --noEmit
    ```

---

## Milestone M2: DashboardClient Modularization & Sub-Panels

### ISSUE-04: Modularize `DashboardClient.tsx` Modals & Submodules
- **Issue Number:** #04
- **Milestone:** M2
- **Issue Type:** Refactoring & Modularization
- **Task Description:** Refactor the 1,639-line `src/app/DashboardClient.tsx` into clean, Single Responsibility Principle submodules. Extract instance connection bar, KPI summary cards, group card grid, and the 5 embedded modals (`NewInstanceModal`, `QrCodeModal`, `NewGroupModal`, `MassCreateModal`, `MassPasteModal`). Replace the 18 native `alert()` calls inside `DashboardClient.tsx` with Toast notifications.
- **The Sandbox:**
  - *Files to Create:*
    - `src/app/dashboard/InstanceStatusBar.tsx`
    - `src/app/dashboard/DashboardKpis.tsx`
    - `src/app/dashboard/GroupCardGrid.tsx`
    - `src/app/dashboard/NewInstanceModal.tsx`
    - `src/app/dashboard/QrCodeModal.tsx`
    - `src/app/dashboard/NewGroupModal.tsx`
    - `src/app/dashboard/MassCreateModal.tsx`
    - `src/app/dashboard/MassPasteModal.tsx`
  - *Files to Modify:*
    - `src/app/DashboardClient.tsx`
- **Required Imports & Reusability:**
  - Import `ScrollDial` from `src/components/ScrollDial`.
  - Import `toast` from `src/components/ui/use-toast`.
  - Import `Dialog` primitives from `src/components/ui/dialog`.
- **Step-by-Step Execution Plan:**
  1. Extract `NewInstanceModal`, `QrCodeModal`, `NewGroupModal`, `MassCreateModal`, and `MassPasteModal` into `src/app/dashboard/`.
  2. Standardize each modal with sticky header, scrollable body, and sticky footer.
  3. Replace all 18 `alert()` calls with `toast({ title, description, variant })`.
  4. Extract `InstanceStatusBar.tsx` and `DashboardKpis.tsx`.
  5. Assemble submodules in `DashboardClient.tsx`, reducing file length from 1,639 lines to under 400 lines.
- **Definition of Done:**
  - `grep -rn "alert(" src/app/DashboardClient.tsx` returns 0.
  - All 5 modals open and close correctly without state bugs.
  - Zero regression in instance connection, group creation, or mass scheduling.
- **Verification Steps & Commands:**
  - Verify zero remaining alerts in Dashboard files:
    ```bash
    docker compose run --rm web grep -rn "alert(" src/app/DashboardClient.tsx src/app/dashboard/
    ```
  - Verify TypeScript compilation without errors:
    ```bash
    docker compose run --rm web npx tsc --noEmit
    ```

---

### ISSUE-05: Convert Dashboard Workspace Views to `Tabs` & Integrate `Progress`
- **Issue Number:** #05
- **Milestone:** M2
- **Prerequisites:** ISSUE-04 must be completed and merged.
- **Issue Type:** UI & Interaction Redesign
- **Task Description:** Convert the 4 workspace views (`Meus Grupos`, `Agenda & Fila Global`, `Auditoria de Membros & DDDs`, `Boas-Vindas (PV)`) from raw state buttons into standardized `shadcn/ui` `Tabs`. In `GroupCardGrid.tsx`, replace custom capacity divs with the accessible semantic `Progress` component with color coding (green/amber/red).
- **The Sandbox:**
  - *Files to Modify:*
    - `src/app/DashboardClient.tsx`
    - `src/app/dashboard/GroupCardGrid.tsx`
    - `src/components/PainelAuditoriaMembros.tsx`
- **Required Imports & Reusability:**
  - Import `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `src/components/ui/tabs`.
  - Import `Progress` from `src/components/ui/progress`.
- **Step-by-Step Execution Plan:**
  1. In `DashboardClient.tsx`, wrap the view selector in `<Tabs value={visaoAtiva} onValueChange={setVisaoAtiva}>`.
  2. In `GroupCardGrid.tsx`, compute clamped capacity percentage: `const pct = Math.min(100, Math.max(0, Math.round((participants / 1024) * 100)));` and display participant count with overflow protection (`${participants}/1024+` if `participants > 1024`). Pass `pct` to `<Progress value={pct} />`. Apply color styling: emerald (<80%), amber (80-95%), red (>95%).
  3. In `PainelAuditoriaMembros.tsx`, convert the 3 sub-views (`duplicados`, `equipe`, `ddd`) from buttons to `Tabs`.
- **Definition of Done:**
  - Workspace view switching is fully keyboard accessible and visually fluid.
  - Group capacity bars accurately show member limits and handle overflow (>1024) safely without distortion.
- **Verification Steps & Commands:**
  - Verify TypeScript compilation without errors:
    ```bash
    docker compose run --rm web npx tsc --noEmit
    ```

---

## Milestone M3: AppShell Navigation, 9 Route Redesigns & PWA

### ISSUE-06: Upgrade `AppShell.tsx` Responsive Navigation & Safe Area Insets
- **Issue Number:** #06
- **Milestone:** M3
- **Issue Type:** Navigation & Layout Engineering
- **Task Description:** Redesign `src/components/AppShell.tsx` to support both widescreen Desktop (collapsible sidebar with collapse toggle + contextual topbar) and Mobile PWA standalone mode (5-column bottom navigation bar + "Mais" Sheet drawer + safe area insets). Update `src/app/layout.tsx` to configure `interactiveWidget: "resizes-content"`.
- **The Sandbox:**
  - *Files to Modify:*
    - `src/components/AppShell.tsx`
    - `src/app/layout.tsx`
  - *Files to Create:* None.
  - *Files to Delete:* None.
- **Required Imports & Reusability:**
  - Import `Sheet`, `SheetContent`, `SheetTrigger` from `src/components/ui/sheet`.
  - Import `Separator` from `src/components/ui/separator`.
  - Import `Tooltip` from `src/components/ui/tooltip`.
  - Import `BotaoInstalar` (internal to AppShell).
- **Step-by-Step Execution Plan:**
  1. In `src/app/layout.tsx`, update `viewport` export to add `interactiveWidget: "resizes-content"` and set zinc dark `themeColor: "#09090b"` to prevent mobile virtual keyboard covering inputs and bottom navigation.
  2. In `src/components/AppShell.tsx`, implement SSR hydration-safe sidebar state: initialize `sidebarOpen` to `true` and synchronize with `localStorage` inside `useEffect` after mount (`mounted` guard), preventing React 19 hydration mismatch errors.
  3. Add `acoes?: React.ReactNode` to `AppShellProps` interface and render in topbar contextual actions.
  4. Ensure desktop navigation affordance: when `voltarPara` is provided, render `<Link href={voltarPara}><Button variant="ghost" size="sm"><ChevronLeft className="w-4 h-4 mr-1" /> Voltar</Button></Link>` on desktop screens (`>= 1024px`), rather than hiding it with `lg:hidden`.
  5. Add `truncate` and `max-w-[200px] sm:max-w-md` on the topbar title container to prevent horizontal overflow on long WhatsApp group titles with emojis.
  6. Refactor mobile bottom navigation: 5 columns (`/`, `/tags`, `/relatorios`, `/links`, "Mais" Sheet drawer).
  7. Ensure `safe-area-inset-*` (top, bottom, left, right) are properly respected.
- **Definition of Done:**
  - Desktop displays a clean sidebar; mobile displays bottom bar.
  - Zero horizontal overflow at `375px`.
  - Virtual keyboard resizes viewport content without obscuring active form elements or bottom navigation.
  - Zero SSR hydration warnings on sidebar toggle reload.
- **Verification Steps & Commands:**
  - Verify TypeScript compilation without errors:
    ```bash
    docker compose run --rm web npx tsc --noEmit
    ```

---

### ISSUE-07: Redesign `/[slug]` (`GroupClient.tsx`) Wrapped in `AppShell`
- **Issue Number:** #07
- **Milestone:** M3
- **Issue Type:** Route Architecture & Refactoring
- **Task Description:** Wrap `src/app/[slug]/page.tsx` and `GroupClient.tsx` in `<AppShell titulo={initialGroup.name} voltarPara="/">`. Remove `sticky top-0 z-10` from internal group header, converting it to an in-flow Hero Profile card inside `AppShell` (eliminating double stacked sticky headers). Modularize schedule modals (`ScheduleModal.tsx`, `WhatsAppPreviewModal.tsx`, `CopyScheduleModal.tsx`, `PasteScheduleModal.tsx`), replace all 8 `alert()` and 1 `confirm()` calls, and convert group permission buttons to `Switch` controls. Delete unused `page.module.css`.
- **The Sandbox:**
  - *Files to Create:*
    - `src/app/[slug]/ScheduleModal.tsx`
    - `src/app/[slug]/WhatsAppPreviewModal.tsx`
    - `src/app/[slug]/CopyScheduleModal.tsx`
    - `src/app/[slug]/PasteScheduleModal.tsx`
  - *Files to Modify:*
    - `src/app/[slug]/page.tsx`
    - `src/app/[slug]/GroupClient.tsx`
  - *Files to Delete:*
    - `src/app/[slug]/page.module.css`
- **Required Imports & Reusability:**
  - Import `AppShell` from `src/components/AppShell`.
  - Import `Switch` from `src/components/ui/switch`.
  - Import `ScrollDial` from `src/components/ScrollDial`.
  - Import `toast` from `src/components/ui/use-toast`.
  - Import `AlertDialog` from `src/components/ui/alert-dialog`.
- **Step-by-Step Execution Plan:**
  1. Wrap `GroupClient` inside `<AppShell titulo={initialGroup.name} subtitulo="Gestão do Grupo" voltarPara="/">`.
  2. Remove `sticky top-0 z-10` from `GroupClient.tsx`'s internal group profile header, converting it to an in-flow Hero Profile card at the top of the main content area inside `AppShell`, preventing double sticky headers.
  3. Apply `truncate` and `max-w-[240px] sm:max-w-md` to group title elements.
  4. Extract `ScheduleModal.tsx` (~540 lines) with sticky header, scrollable options body (`max-h-[85dvh]`), and sticky footer.
  5. Extract `WhatsAppPreviewModal.tsx`, `CopyScheduleModal.tsx`, `PasteScheduleModal.tsx`.
  6. Replace 8 `alert()` with `toast()` and replace 1 `confirm()` (clipboard paste) with `AlertDialog`.
  7. In Permissões tab, replace button toggles with `Switch` controls.
  8. Delete unreferenced `page.module.css`.
- **Definition of Done:**
  - `/[slug]` renders seamlessly inside `AppShell` with working back button.
  - Single sticky header hierarchy (in-flow hero profile card).
  - Exactly 0 `alert()` or `confirm()` in `GroupClient.tsx`.
  - Permission toggles function with accessible `Switch` controls.
- **Verification Steps & Commands:**
  - Verify zero remaining alerts in `[slug]`:
    ```bash
    docker compose run --rm web grep -rn "alert(" src/app/[slug]/
    ```
  - Verify zero remaining confirms in `[slug]`:
    ```bash
    docker compose run --rm web grep -rn "confirm(" src/app/[slug]/
    ```
  - Verify TypeScript compilation without errors:
    ```bash
    docker compose run --rm web npx tsc --noEmit
    ```

---

### ISSUE-08: Standardize `/tags` and `/links` Routes
- **Issue Number:** #08
- **Milestone:** M3
- **Issue Type:** UI & Feature Standardization
- **Task Description:** Standardize `/tags` with `Progress` occupancy bars and Toast feedback on copying funnel links. In `/links`, standardize the 4 KPI cards, integrate `Tooltip` into the 24-hour São Paulo heatmap, and add Toast copy feedback on short link generation.
- **The Sandbox:**
  - *Files to Modify:*
    - `src/app/tags/TagsClient.tsx`
    - `src/app/links/LinksClient.tsx`
- **Required Imports & Reusability:**
  - Import `Progress` from `src/components/ui/progress`.
  - Import `Tooltip` from `src/components/ui/tooltip`.
  - Import `toast` from `src/components/ui/use-toast`.
- **Step-by-Step Execution Plan:**
  1. In `TagsClient.tsx`, replace custom progress bars with semantic clamped Progress: `const pct = Math.min(100, Math.max(0, Math.round((current / max) * 100))); <Progress value={pct} />`. Standardize `TagFormModal` and `GruposDaTagModal` with sticky header, scrollable body, and sticky footer.
  2. Replace funnel link copy state with `toast({ title: "Link copiado!", description: url, variant: "success" })`.
  3. In `LinksClient.tsx`, wrap the 24 hourly activity bars in `<Tooltip content={`${hour}h: ${cliques} cliques`}>`.
  4. Replace short link copy state with Toast notification.
- **Definition of Done:**
  - Heatmap bars show rich tooltips on hover and touch.
  - Funnel and attribution links trigger non-blocking feedback.
  - Occupancy progress bars handle edge cases safely with clamping.
- **Verification Steps & Commands:**
  - Verify TypeScript compilation without errors:
    ```bash
    docker compose run --rm web npx tsc --noEmit
    ```

---

### ISSUE-09: Standardize `/relatorios` & `/relatorios/[date]` Routes
- **Issue Number:** #09
- **Milestone:** M3
- **Issue Type:** UI & Feature Standardization
- **Task Description:** Standardize `RelatorioClient.tsx`: convert alert notification checkboxes to `Switch` controls, polish the 8 KPI summary cards, and standardize the 9 analytical breakdown sections with dark zinc cards and proportional progress bars.
- **The Sandbox:**
  - *Files to Modify:*
    - `src/app/relatorios/[date]/RelatorioClient.tsx`
- **Required Imports & Reusability:**
  - Import `Switch` from `src/components/ui/switch`.
  - Import `Progress` from `src/components/ui/progress`.
  - Import `Card`, `CardHeader`, `CardTitle`, `CardContent` from `src/components/ui/card`.
- **Step-by-Step Execution Plan:**
  1. Replace native `<input type="checkbox">` in `ConfiguracaoAlertas` with `<Switch checked={...} onCheckedChange={...} />`.
  2. Standardize KPI cards with typography and iconography.
  3. Ensure all 9 analytical breakdown cards (instances, groups, action types, churn, `/g/` funnel, campaigns, links, polls, failures) use standard Card components.
- **Definition of Done:**
  - Notification toggles use accessible `Switch`.
  - Reports render cleanly on desktop and mobile without horizontal overflow.
- **Verification Steps & Commands:**
  - Verify TypeScript compilation without errors:
    ```bash
    docker compose run --rm web npx tsc --noEmit
    ```

---

### ISSUE-10: Standardize `/chaves`, `/documentacao`, `/api-docs`, and `/login`
- **Issue Number:** #10
- **Milestone:** M3
- **Issue Type:** UI & Ergonomics Standardization
- **Task Description:** In `/chaves`, use `Alert` with copy toast for one-time token reveal. In `/documentacao`, add a mobile section jumper dropdown for touch navigation. In `/api-docs`, wrap the Swagger UI in `AppShell` with dark zinc framing. In `/login`, modernize the authentication card, update title to "AlfaAltoGrup", and use `Alert` for auth errors with button loading spinner.
- **The Sandbox:**
  - *Files to Modify:*
    - `src/app/chaves/KeysClient.tsx`
    - `src/app/documentacao/DocsContent.tsx`
    - `src/app/api-docs/page.tsx`
    - `src/app/login/page.tsx`
- **Required Imports & Reusability:**
  - Import `AppShell` from `src/components/AppShell`.
  - Import `Alert`, `AlertTitle`, `AlertDescription` from `src/components/ui/alert`.
  - Import `Select` or dropdown primitives for mobile section jumper.
  - Import `toast` from `src/components/ui/use-toast`.
- **Step-by-Step Execution Plan:**
  1. In `KeysClient.tsx`, render newly generated token inside `<Alert variant="success">` with a copy button.
  2. In `DocsContent.tsx`, add mobile jump selector (`<Select>` on mobile screens `< lg`) allowing users to jump directly to any of the 18 sections.
  3. In `/api-docs/page.tsx`, wrap the Swagger UI component inside `<AppShell titulo="Referência da API (Swagger)">`, framing SwaggerUI inside a styled container (`bg-white dark:bg-zinc-900 rounded-xl p-4 overflow-hidden border border-border/40`) to preserve readable text contrast against the dark zinc theme.
  4. In `/login/page.tsx`, change header to "AlfaAltoGrup", wrap errors in `<Alert variant="destructive">`, and add `Loader2` spinner on submit.
- **Definition of Done:**
  - All 4 routes conform to the zinc design system and are fully usable on mobile screens.
  - Swagger UI is framed in a contrast-safe container.
- **Verification Steps & Commands:**
  - Verify TypeScript compilation without errors:
    ```bash
    docker compose run --rm web npx tsc --noEmit
    ```

---

### ISSUE-11: Upgrade PWA Cache v3, Dark Offline Page & Global Error Refinement
- **Issue Number:** #11
- **Milestone:** M3
- **Issue Type:** PWA Engineering
- **Task Description:** Bump the Service Worker cache version in `public/sw.js` to `'alfaaltogrup-v3'`. Redesign `public/offline.html` to align with the dark zinc design tokens. Refine `GlobalErrorAlerts.tsx` so the floating alert safely floats above the mobile bottom bar and session disconnect popups follow standard `Dialog` layout.
- **The Sandbox:**
  - *Files to Modify:*
    - `public/sw.js`
    - `public/offline.html`
    - `src/components/GlobalErrorAlerts.tsx`
- **Required Imports & Reusability:**
  - Standard Dialog and Alert components.
- **Step-by-Step Execution Plan:**
  1. In `public/sw.js`, change `VERSAO = 'alfaaltogrup-v3'`.
  2. In `public/offline.html`, ensure 100% self-contained layout (inline CSS, system font stacks, zero external CDN links or font requests) aligned with zinc dark design tokens (`#09090b`) and styled refresh button.
  3. In `GlobalErrorAlerts.tsx`, adjust mobile floating bottom offset to `bottom-[calc(4.5rem+env(safe-area-inset-bottom))]` and convert both session popup (`isSessionPopupOpen`) and delayed messages manager (`isModalOpen`) to standard `Dialog` components.
- **Definition of Done:**
  - Service worker installs and activates `alfaaltogrup-v3` without cache corruption.
  - Offline fallback is 100% self-contained and displays correctly without network.
  - Floating error alert safely clears mobile bottom navigation bar.
- **Verification Steps & Commands:**
  - Verify TypeScript compilation without errors:
    ```bash
    docker compose run --rm web npx tsc --noEmit
    ```

---

## Milestone M4: Containerized Build, Git Release & Oracle Cloud Deployment

### ISSUE-12: Containerized Build, Git Release v0.5.0 & Oracle Cloud Deployment
- **Issue Number:** #12
- **Milestone:** M4
- **Issue Type:** Build, Release & Production Deployment
- **Task Description:** Bump `package.json` to `"0.5.0"`. Create Git branch `feat/redesign-pwa-v050`. Execute containerized Next.js production build (`next build`) inside Docker. Execute the pre-merge Triple Testing battery (Pillars 1, 2, 3). Merge branch into `main` with atomic Conventional Commits. Connect to Oracle Cloud VM (`ubuntu@137.131.168.133`) via SSH, build and restart `web`/`worker` containers without touching SQLite or PostgreSQL volumes, and verify production health.
- **The Sandbox:**
  - *Files to Modify:*
    - `package.json`
- **Required Tools & Commands:**
  - Docker container execution for local builds.
  - SSH client using `C:\Users\theja\.ssh\oracle_vps.key`.
- **Step-by-Step Execution Plan:**
  1. Bump version to `"0.5.0"` in `package.json`.
  2. Create branch `feat/redesign-pwa-v050`.
  3. Run containerized Next.js build: verify exit code 0.
  4. Perform Triple Testing verification:
     - Pillar 1: Code quality, zero `alert()` or `confirm()`, zero lint errors.
     - Pillar 2: Memory limits and load resilience.
     - Pillar 3: UI/UX design alignment across all 9 routes.
  5. Merge `feat/redesign-pwa-v050` into `main` and tag `v0.5.0`.
  6. Deploy to Oracle Cloud VM:
     - SSH to `ubuntu@137.131.168.133` using key `C:\Users\theja\.ssh\oracle_vps.key`.
     - Sync source code to `/opt/alfaaltogrup` preserving `.env` and `evogo-server`.
     - Run `docker compose -f docker-compose.prod.yml --env-file .env build web`.
     - Run `docker compose -f docker-compose.prod.yml --env-file .env up -d --no-deps web worker`.
     - Verify containers healthy and WhatsApp sessions in `whatsmeow_device` preserved (2 active sessions).
     - HTTP health check (200/302).
- **Definition of Done:**
  - Version `0.5.0` merged in `main`.
  - Production stack up and healthy on Oracle Cloud VM within 1 GB RAM memory limits.
  - Zero loss of SQLite data or WhatsApp sessions.
- **Verification Steps & Commands:**
  - Pre-merge build verification:
    ```bash
    docker compose build web
    ```
  - Pre-merge alert/confirm audits:
    ```bash
    docker compose run --rm web grep -rn "alert(" src/
    docker compose run --rm web grep -rn "confirm(" src/
    ```
  - Full TypeScript type-check:
    ```bash
    docker compose run --rm web npx tsc --noEmit
    ```
