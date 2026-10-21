# Technical Specification (Spec) — Frontend Redesign & Mobile PWA (v0.5.0)

## 1. Context & Traceability
- **Parent PRD:** `/.documentação/PRD_v0.5.0_REDESIGN_PWA.md`
- **Target Features:** Requirements R1 (Design System & `shadcn/ui` Standardization), R2 (Desktop & Mobile PWA Navigation, Layout & Route Redesign), and R3 (Containerized Build, Docs & Oracle Cloud Production Deployment).
- **Spec Status:** Approved for Implementation (Triple Spec Audit Ready)

---

## 2. Reusability Analysis & Zero-Bloat Strategy (Mandatory Search Phase)

### 2.1 Existing Codebase Inventory
- **Existing `shadcn/ui` Primitives in `src/components/ui/` (14 files):**
  `badge.tsx`, `button.tsx`, `calendar.tsx`, `card.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `input.tsx`, `label.tsx`, `popover.tsx`, `select.tsx`, `sheet.tsx`, `table.tsx`, `tabs.tsx`, `textarea.tsx`.
- **Installed Radix UI Packages in `package.json`:**
  `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`, `@radix-ui/react-popover`, `@radix-ui/react-select`, `@radix-ui/react-slot`, `@radix-ui/react-tabs`.
- **Styling Utility:** `src/lib/utils.ts` exports `cn(...inputs: ClassValue[])` combining `clsx` and `tailwind-merge`.

### 2.2 Missing 10 UI Primitives (Zero New NPM Packages)
To strictly protect the Oracle Cloud VPS (1 vCPU, 1 GB RAM) against out-of-memory crashes, **NO new runtime npm packages shall be added**. All 10 missing primitives are implemented with zero bloat:

| Primitive File | Architectural Strategy & Dependencies | Memory Overhead |
|---|---|---|
| `src/components/ui/alert-dialog.tsx` | Composed directly from `@radix-ui/react-dialog` (already installed), exporting `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel`. | 0 KB |
| `src/components/ui/toast.tsx` & `use-toast.ts` | Lightweight React 19 state hook + event emitter (`useToast`, `toast`) and `<Toaster />` component supporting `default`, `destructive`, and `success` variants. Auto-dismisses in 4s. | 0 KB |
| `src/components/ui/switch.tsx` | Accessible toggle button (`role="switch"`, `aria-checked`, `data-state="checked" \| "unchecked"`) with sliding thumb animation via Tailwind transitions. | 0 KB |
| `src/components/ui/progress.tsx` | Accessible progress bar (`role="progressbar"`, `aria-valuenow`) with smooth indicator translation (`translateX(-${100 - value}%)`) and semantic color variants (`default`, `warning`, `destructive`). | 0 KB |
| `src/components/ui/skeleton.tsx` | Pure Tailwind pulse container (`animate-pulse rounded-md bg-muted/60`). | 0 KB |
| `src/components/ui/scroll-area.tsx` | Pure Tailwind scrollable container with customized subtle scrollbar utilities (`overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700`). Because `tailwind-scrollbar` is not installed, custom utilities are defined directly in `src/app/globals.css` under `@layer utilities` (`.scrollbar-thin`, webkit scrollbar width, track, and thumb styling) guaranteeing dark zinc styling without external dependencies. | 0 KB |
| `src/components/ui/separator.tsx` | Semantic horizontal/vertical divider with `role="separator"` and `aria-orientation`. | 0 KB |
| `src/components/ui/tooltip.tsx` | Lightweight React hover/focus tooltip with zero external dependencies for heatmaps and action hints. | 0 KB |
| `src/components/ui/avatar.tsx` | Standard avatar primitive with `Avatar`, `AvatarImage`, and `AvatarFallback` supporting graceful image load failure. | 0 KB |
| `src/components/ui/alert.tsx` | Alert container with `cva` variants (`default`, `destructive`, `success`, `warning`), exporting `Alert`, `AlertTitle`, and `AlertDescription`. | 0 KB |

### 2.3 Shared Component Extraction
- **`src/components/ScrollDial.tsx`**: Extract the duplicated ~90-line wheel dial time picker from `src/app/DashboardClient.tsx` (lines 27–123) and `src/app/[slug]/GroupClient.tsx` (lines 48–144) into a single reusable component.
- **Dead Code Cleanup**: `src/app/[slug]/page.module.css` (140 lines of unreferenced legacy CSS) must be deleted.

---

## 3. UI Architecture, Component Hierarchy & Route Redesign

### 3.1 Global Navigation Shell (`src/components/AppShell.tsx`)
`AppShell` provides the unified navigation frame for all 9 routes:

```
+-----------------------------------------------------------------------------------+
| Desktop (>= 1024px)                                                               |
| +---------------------+---------------------------------------------------------+ |
| | Collapsible Sidebar | Contextual Topbar (Page Title, Instance Indicator,      | |
| | (w-64 or w-16)      | Install Button, Quick Actions)                          | |
| | - Logo              +---------------------------------------------------------+ |
| | - Grupos (/)        | Main Content Area                                       | |
| | - Tags (/tags)      | (max-w-7xl mx-auto px-4 py-6)                           | |
| | - Relatórios (/rel) |                                                         | |
| | - Cliques (/links)  |                                                         | |
| | - Chaves (/chaves)  |                                                         | |
| | - Docs (/docs)      |                                                         | |
| | - API (/api-docs)   |                                                         | |
| | - Collapse Toggle   |                                                         | |
| +---------------------+---------------------------------------------------------+ |
+-----------------------------------------------------------------------------------+
| Mobile (< 1024px) PWA Standalone Mode                                             |
| +-------------------------------------------------------------------------------+ |
| | Topbar: [Back Button or Hamburger] [Title / Subtitle] [Instance Indicator]   | |
| +-------------------------------------------------------------------------------+ |
| | Scrollable Main Content (paddingBottom: calc(4.5rem + safe-area-inset-bottom))| |
| +-------------------------------------------------------------------------------+ |
| | Bottom Navigation Bar (Fixed 5 Columns, safe-area-inset-bottom):              | |
| | [Grupos]      [Tags]      [Relatórios]      [Cliques]      [Mais (Drawer)]    | |
| +-------------------------------------------------------------------------------+ |
+-----------------------------------------------------------------------------------+
```

#### Contract:
- **Props**:
  - `titulo: string` (Primary heading)
  - `subtitulo?: string` (Secondary caption)
  - `voltarPara?: string` (Optional URL to render back chevron; must be `"/"` for `/[slug]`)
  - `acoes?: React.ReactNode` (Optional contextual actions rendered on topbar right, e.g. user avatar badge, action buttons, as used in `src/app/page.tsx:34-41`)
  - `children: React.ReactNode`
- **SSR Hydration Guard**:
  - Sidebar state persistence: `AppShell` must guard against SSR hydration mismatch when reading `localStorage.getItem('sidebar-collapsed')`. It must initialize state with a safe default (`true`) and synchronize with `localStorage` inside `useEffect` after mount (`mounted` guard), or store state in a React Context (`SidebarProvider`) in `src/components/Providers.tsx`.
- **Desktop Navigation Affordance**:
  - When `voltarPara` is provided, a desktop-friendly navigation affordance (e.g. `<Link href={voltarPara}><Button variant="ghost" size="sm"><ChevronLeft className="w-4 h-4 mr-1" /> Voltar</Button></Link>`) is rendered on screens `>= 1024px`, rather than hiding it with `lg:hidden`.
- **Safe Area Inset Handling**:
  - Topbar: `paddingTop: max(0.75rem, env(safe-area-inset-top))`
  - Bottom bar: `paddingBottom: max(0.5rem, env(safe-area-inset-bottom))`
  - Lateral padding: `paddingLeft: env(safe-area-inset-left)`, `paddingRight: env(safe-area-inset-right)`

### 3.2 Providers & Global Notification System (`src/components/Providers.tsx`)
- Mount `<Toaster />` from `src/components/ui/toast.tsx` (or `toaster.tsx`) inside `Providers.tsx` so `toast({ title, description, variant })` is callable from anywhere in the component tree without prop drilling.

### 3.3 Elimination of 44 `alert()` and 6 `confirm()` Calls

#### Complete `alert()` Replacement Mapping (44 Occurrences):
1. `GlobalErrorAlerts.tsx:51` -> `toast({ title: "Sucesso", description: "Mensagens aprovadas e reagendadas!", variant: "success" })`
2. `GlobalErrorAlerts.tsx:54` -> `toast({ title: "Erro", description: "Erro ao tentar reagendar mensagens.", variant: "destructive" })`
3. `GlobalErrorAlerts.tsx:57` -> `toast({ title: "Falha", description: "Falha na comunicação com o servidor.", variant: "destructive" })`
4. `DashboardClient.tsx:286` -> `toast({ title: "QR Code", description: "O QR Code não foi retornado pela API.", variant: "destructive" })`
5. `DashboardClient.tsx:291` -> `toast({ title: "Erro", description: "Erro ao buscar QR Code.", variant: "destructive" })`
6. `DashboardClient.tsx:295` -> `toast({ title: "Erro interno", description: "Falha ao processar QR Code.", variant: "destructive" })`
7. `DashboardClient.tsx:312` -> `toast({ title: "Grupo criado", description: "Grupo criado com sucesso!", variant: "success" })`
8. `DashboardClient.tsx:316` -> `toast({ title: "Erro", description: "Erro ao criar grupo.", variant: "destructive" })`
9. `DashboardClient.tsx:320` -> `toast({ title: "Erro fatal", description: "Falha ao criar grupo.", variant: "destructive" })`
10. `DashboardClient.tsx:340` -> `toast({ title: "Erro", description: "Erro ao criar instância na Evolution API.", variant: "destructive" })`
11. `DashboardClient.tsx:344` -> `toast({ title: "Rede", description: "Falha na rede ao tentar criar a instância.", variant: "destructive" })`
12. `DashboardClient.tsx:358` -> `toast({ title: "Sucesso", description: "Grupos sincronizados com sucesso!", variant: "success" })`
13. `DashboardClient.tsx:361` -> `toast({ title: "Erro", description: "Erro ao sincronizar grupos.", variant: "destructive" })`
14. `DashboardClient.tsx:364` -> `toast({ title: "Falha", description: "Falha na comunicação ao sincronizar grupos.", variant: "destructive" })`
15. `DashboardClient.tsx:428` -> `toast({ title: "Agendamentos colados", description: `${insertedCount} agendamento(s) colado(s)!`, variant: "success" })`
16. `DashboardClient.tsx:432` -> `toast({ title: "Erro", description: "Erro ao colar agendamentos.", variant: "destructive" })`
17. `DashboardClient.tsx:479` -> `toast({ title: "JSON inválido", description: "O texto na área de transferência não é um JSON válido.", variant: "destructive" })`
18. `DashboardClient.tsx:486` -> `toast({ title: "Atenção", description: "Selecione pelo menos um grupo destino.", variant: "destructive" })`
19. `DashboardClient.tsx:492` -> `toast({ title: "Atenção", description: "Preencha a Data e Hora para todas as mensagens.", variant: "destructive" })`
20. `DashboardClient.tsx:562` -> `toast({ title: "Sucesso", description: `${insertedCount} agendamento(s) criado(s) com sucesso!`, variant: "success" })`
21. `DashboardClient.tsx:567` -> `toast({ title: "Erro", description: "Erro ao criar agendamentos em massa.", variant: "destructive" })`
22. `GroupClient.tsx:215` -> `toast({ title: "Permissão", description: data.error || "Não foi possível alterar a permissão.", variant: "destructive" })`
23. `GroupClient.tsx:218` -> `toast({ title: "Erro de conexão", description: "Erro de conexão ao alterar a permissão.", variant: "destructive" })`
24. `GroupClient.tsx:298` -> `toast({ title: "Validação", description: problema, variant: "destructive" })`
25. `GroupClient.tsx:408` -> `toast({ title: "Copiado", description: "Agendamentos copiados para a área de transferência!", variant: "success" })`
26. `GroupClient.tsx:412` -> `toast({ title: "Erro", description: "Erro ao copiar. Tente novamente.", variant: "destructive" })`
27. `GroupClient.tsx:467` -> `toast({ title: "Erro", description: "Erro ao processar JSON colado.", variant: "destructive" })`
28. `GroupClient.tsx:493` -> `toast({ title: "Sucesso", description: `${inserted.length} agendamento(s) colado(s) com sucesso!`, variant: "success" })`
29. `GroupClient.tsx:496` -> `toast({ title: "Erro", description: "Erro ao colar agendamentos.", variant: "destructive" })`
30. `PainelBoasVindas.tsx:129` -> `toast({ title: "Upload", description: data.error || "Erro ao enviar arquivo", variant: "destructive" })`
31. `PainelBoasVindas.tsx:132` -> `toast({ title: "Upload", description: "Falha no upload do arquivo", variant: "destructive" })`
32. `PainelBoasVindas.tsx:183` -> `toast({ title: "Validação", description: "Selecione uma Tag para a regra.", variant: "destructive" })`
33. `PainelBoasVindas.tsx:187` -> `toast({ title: "Validação", description: "Selecione um Grupo para a regra.", variant: "destructive" })`
34. `PainelBoasVindas.tsx:213` -> `toast({ title: "Erro", description: json.error || "Erro ao salvar regra", variant: "destructive" })`
35. `PainelBoasVindas.tsx:217` -> `toast({ title: "Salvo", description: "Regra de boas-vindas salva com sucesso!", variant: "success" })`
36. `PainelBoasVindas.tsx:219` -> `toast({ title: "Conexão", description: "Erro de conexão ao salvar regra", variant: "destructive" })`
37. `PainelBoasVindas.tsx:279` -> `toast({ title: "Status", description: "Erro ao alterar status da regra", variant: "destructive" })`
38. `PainelBoasVindas.tsx:293` -> `toast({ title: "Exclusão", description: "Erro ao excluir regra", variant: "destructive" })`
39. `PainelBoasVindas.tsx:299` -> `toast({ title: "Validação", description: "Selecione uma instância conectada de destino.", variant: "destructive" })`
40. `PainelBoasVindas.tsx:322` -> `toast({ title: "Falha", description: json.error || "Falha no envio de teste", variant: "destructive" })`
41. `PainelBoasVindas.tsx:324` -> `toast({ title: "Teste enviado", description: "Mensagem de teste enviada com sucesso!", variant: "success" })`
42. `PainelBoasVindas.tsx:330` -> `toast({ title: "Erro", description: "Erro ao executar disparo de teste", variant: "destructive" })`
43. `PainelBoasVindas.tsx:345` -> `toast({ title: "Fila", description: `Ação concluída (${json.afetados || 0} registro(s) atualizado(s)).`, variant: "success" })`
44. `PainelBoasVindas.tsx:349` -> `toast({ title: "Erro", description: "Erro ao controlar fila de boas-vindas", variant: "destructive" })`

#### Complete `confirm()` Replacement Mapping (6 Occurrences):
1. `PainelAgendaCampanhas.tsx:76` -> State-controlled `AlertDialog` with Title "Confirmar Ação na Fila", Description displaying dynamic action (pausar, retomar, adiar), Action button "Confirmar" and Cancel button "Voltar".
2. `PainelBoasVindas.tsx:284` -> State-controlled `AlertDialog` with Title "Excluir Regra de Boas-Vindas", Description "Deseja realmente excluir esta regra e limpar sua fila pendente?", Action button "Excluir Regra" (destructive variant) and Cancel button "Cancelar".
3. `PainelAuditoriaMembros.tsx:134` -> State-controlled `AlertDialog` with Title "Remover Membros Duplicados", Description displaying count of safe leads to remove while protecting team members, Action button "Executar Limpeza" (destructive variant) and Cancel button "Cancelar".
4. `KeysClient.tsx:77` -> State-controlled `AlertDialog` with Title "Revogar Chave de API", Description displaying key name and warning that external services will immediately lose access, Action button "Revogar Chave" (destructive variant) and Cancel button "Cancelar".
5. `TagsClient.tsx:111` -> State-controlled `AlertDialog` with Title "Remover Tag", Description `Deseja remover a tag "${tag.name}"? Os grupos continuarão existindo sem o agrupamento.`, Action button "Remover Tag" (destructive variant) and Cancel button "Cancelar".
6. `GroupClient.tsx:443` -> State-controlled `AlertDialog` with Title "Colar Agendamentos", Description displaying count of detected valid schedules in clipboard, Action button "Colar Agendamentos" and Cancel button "Cancelar".

---

## 4. Modularization Strategy for Monolithic Components

### 4.1 Modularization of `src/app/DashboardClient.tsx` (1,639 lines)
The monolithic file is broken down into Single Responsibility Principle (SRP) submodules located in `src/app/dashboard/` (or co-located cleanly):
1. `InstanceStatusBar.tsx`: Selected instance status badge (`open`, `connecting`, `close`), sync groups trigger, reconnect / QR Code button, and new instance button.
2. `DashboardKpis.tsx`: 4 summary cards (`Enviadas`, `Pendentes`, `Com Falha`, `Desativadas`).
3. `GroupCardGrid.tsx`: Search input, Tag filter, bulk edit action bar (`modoSelecao`), group cards with semantic capacity `Progress` bars (green/amber/red), and action dropdowns.
4. Dedicated Dialog Submodules:
   - `src/app/dashboard/NewInstanceModal.tsx`: Instance creation form with proxy configuration.
   - `src/app/dashboard/QrCodeModal.tsx`: QR Code base64 display with auto-refresh and connection state polling.
   - `src/app/dashboard/NewGroupModal.tsx`: Group creation form with instance selection.
   - `src/app/dashboard/MassCreateModal.tsx`: Multi-message and multi-group schedule creator with sticky header/footer.
   - `src/app/dashboard/MassPasteModal.tsx`: JSON clipboard parser and bulk schedule applicator.

### 4.2 Modularization of `src/app/[slug]/GroupClient.tsx` (1,677 lines)
1. Wrap top-level in `<AppShell titulo={initialGroup.name} subtitulo="Gestão do Grupo" voltarPara="/">`.
2. Remove `sticky top-0 z-10` from `GroupClient.tsx`'s internal group profile header, converting it into an in-flow Hero Profile card at the top of the main content area inside `AppShell`, eliminating double stacked sticky headers under `AppShell`'s sticky topbar on mobile/desktop.
3. Extract Schedule Modal: `src/app/[slug]/ScheduleModal.tsx` (~540 lines) with sticky header, scrollable options body (`max-h-[85dvh]`), and sticky footer.
4. Extract WhatsApp Preview: `src/app/[slug]/WhatsAppPreviewModal.tsx` (~60 lines).
5. Extract Copy/Paste Modals: `src/app/[slug]/CopyScheduleModal.tsx` and `PasteScheduleModal.tsx`.
6. Permissões Tab: Replace native buttons/checkboxes with accessible `Switch` controls (`isAnnounce`, `isLocked`, `adminOnlyAdd`, `isApprovalRequired`).

---

## 5. Docker Multi-Stage Build & Oracle Cloud Memory Budgets

### 5.1 Multi-Stage Standalone Build (`deploy/Dockerfile.optimized`)
- Stage 1 (`deps`): Installs dependencies via `npm ci --no-audit --no-fund`.
- Stage 2 (`builder`): Generates Prisma client, builds standalone Next.js via `NODE_OPTIONS="--max-old-space-size=1024" next build`.
- Stage 3 (`runner`): Minimal `node:20-slim` image under unprivileged user `app` (UID 1001), copying only `.next/standalone`, `.next/static`, `public`, and essential worker scripts (`worker.js`, `shared/`, `seed.js`).

### 5.2 Container Memory Budgets (`deploy/docker-compose.prod.yml`)
Total physical RAM on the Oracle Cloud VM is 954 MiB, backed by 6.0 GiB of active swap (`vm.swappiness=10`). Memory limits are strictly enforced:

```yaml
services:
  caddy:
    image: caddy:2-alpine
    mem_limit: 64m

  postgres:
    image: postgres:16-alpine
    mem_limit: 352m
    shm_size: 64m
    command: postgres -c shared_buffers=48MB -c work_mem=1MB -c max_connections=120 -c idle_in_transaction_session_timeout=5min

  evolution-go:
    image: evoapicloud/evolution-go:latest
    mem_limit: 640m
    volumes:
      - ./evogo-server:/app/server:ro  # CRITICAL: Binary patch for interactive buttons WhatsApp waE2E

  web:
    image: alfaaltogrup:latest
    mem_limit: 256m
    environment:
      NODE_OPTIONS: "--max-old-space-size=224"

  worker:
    image: alfaaltogrup:latest
    mem_limit: 192m
    environment:
      NODE_OPTIONS: "--max-old-space-size=128"
```

> **Build Rule**: To prevent dual concurrent `next build` processes that would trigger an OOM kill, the production build must always target `web` exclusively:
> `docker compose -f docker-compose.prod.yml --env-file .env build web`

---

## 6. Data Persistence & Production Deployment Strategy

### 6.1 Intouchable Production Volumes
The deployment process MUST NOT pass `-v` or delete docker volumes. All persistent data lives across these mapped volumes:
- `deploy_sqlite_data` -> `/app/prisma`: Contains SQLite WAL database files `dev.db` (~2.65 MB), `dev.db-wal` (~4.13 MB), `dev.db-shm` (~32 KB).
- `deploy_uploads_data` -> `/app/uploads`: Contains uploaded media and group avatars (`group-*.jpg`).
- `deploy_pg_data` -> `/var/lib/postgresql/data`: Contains `evogo_auth` and `evogo_users` tables. Specifically, `whatsmeow_device` holds the **2 active WhatsApp sessions**. Touching this volume breaks production connections.

### 6.2 Zero-Downtime Deployment Sequence via SSH
1. Connect securely to `ubuntu@137.131.168.133` using key `C:\Users\theja\.ssh\oracle_vps.key` (verified active key path).
2. Sync updated source code to `/opt/alfaaltogrup`, strictly preserving `/opt/alfaaltogrup/deploy/.env` and `/opt/alfaaltogrup/deploy/evogo-server`.
3. Execute containerized single-target build:
   `docker compose -f docker-compose.prod.yml --env-file .env build web`
4. Recreate only updated application containers:
   `docker compose -f docker-compose.prod.yml --env-file .env up -d --no-deps web worker`
   > **Operational Safeguard**: The `--no-deps` flag is strictly mandatory. In `deploy/docker-compose.prod.yml`, the `init` container executes `prisma db push --accept-data-loss` and `node seed.js`, which would reset admin passwords and risk SQLite data loss. Deploying with `--no-deps` ensures `init` never runs during updates. (Recommended: set `profiles: ["init"]` on the `init` service in `docker-compose.prod.yml`).
5. Verify container health: `docker compose ps` and `curl -I https://<APP_DOMAIN>/login` (expect 200/302).
6. Verify WhatsApp sessions: inspect Postgres `whatsmeow_device` count to confirm 2 active devices remain connected.

---

## 7. Strict File Manifest

### 7.1 Files to Create
1. `src/components/ui/alert-dialog.tsx`: Accessible confirmation dialogs.
2. `src/components/ui/toast.tsx`: Toast presentation component.
3. `src/components/ui/use-toast.ts`: Toast state hook and emitter.
4. `src/components/ui/toaster.tsx`: Global Toast container.
5. `src/components/ui/switch.tsx`: Accessible toggle switch.
6. `src/components/ui/progress.tsx`: Capacity & occupancy progress bar.
7. `src/components/ui/skeleton.tsx`: Pulse loading state component.
8. `src/components/ui/scroll-area.tsx`: Styled scroll container.
9. `src/components/ui/separator.tsx`: Semantic layout divider.
10. `src/components/ui/tooltip.tsx`: Accessible hover tooltip.
11. `src/components/ui/avatar.tsx`: Avatar with image & fallback.
12. `src/components/ui/alert.tsx`: Banner alert with variants.
13. `src/components/ScrollDial.tsx`: Extracted shared time/schedule dial.
14. `src/app/[slug]/ScheduleModal.tsx`: Extracted schedule creation/edit modal.
15. `src/app/[slug]/WhatsAppPreviewModal.tsx`: WhatsApp bubble preview modal.
16. `src/app/[slug]/CopyScheduleModal.tsx`: Extracted copy schedules modal.
17. `src/app/[slug]/PasteScheduleModal.tsx`: Extracted paste schedules modal.
18. `src/app/dashboard/InstanceStatusBar.tsx`: Selected instance status badge, sync trigger, reconnect button.
19. `src/app/dashboard/DashboardKpis.tsx`: 4 summary KPI cards (Enviadas, Pendentes, Com Falha, Desativadas).
20. `src/app/dashboard/GroupCardGrid.tsx`: Filterable group card grid with semantic Progress bars and bulk selection.
21. `src/app/dashboard/NewInstanceModal.tsx`: Instance creation modal with proxy configuration.
22. `src/app/dashboard/QrCodeModal.tsx`: WhatsApp QR Code modal with auto-refresh and status polling.
23. `src/app/dashboard/NewGroupModal.tsx`: Group creation modal with instance selector.
24. `src/app/dashboard/MassCreateModal.tsx`: Mass schedule creator modal with sticky header/footer.
25. `src/app/dashboard/MassPasteModal.tsx`: JSON clipboard schedule parser modal.

### 7.2 Files to Modify
1. `package.json`: Bump version to `"0.5.0"`.
2. `src/components/Providers.tsx`: Mount `<Toaster />`.
3. `src/components/AppShell.tsx`: Collapsible desktop sidebar, mobile bottom nav safe area adjustments.
4. `src/components/GlobalErrorAlerts.tsx`: Replace alerts with Toast, convert raw overlay modals to `Dialog`.
5. `src/components/PainelAgendaCampanhas.tsx`: Replace `window.confirm` with `AlertDialog`.
6. `src/components/PainelAuditoriaMembros.tsx`: Replace `window.confirm` with `AlertDialog`, use `Tabs`.
7. `src/components/PainelBoasVindas.tsx`: Replace 14 alerts with Toast, replace 1 confirm with `AlertDialog`.
8. `src/app/DashboardClient.tsx`: Replace 18 alerts with Toast, modularize views via `Tabs`, integrate `Progress`.
9. `src/app/[slug]/page.tsx` & `GroupClient.tsx`: Wrap in `AppShell`, replace alerts/confirm, integrate `Switch`.
10. `src/app/BulkEditModal.tsx`: Standardize sticky header/footer layout.
11. `src/app/tags/TagsClient.tsx`: Replace confirm with `AlertDialog`, use `Progress`, standardize modals.
12. `src/app/relatorios/[date]/RelatorioClient.tsx`: Use `Switch` for notification controls, standardize KPIs.
13. `src/app/links/LinksClient.tsx`: Use `Tooltip` for 24h heatmap, toast feedback on copy.
14. `src/app/chaves/KeysClient.tsx`: Replace confirm with `AlertDialog`, one-time reveal `Alert`.
15. `src/app/documentacao/DocsContent.tsx`: Add mobile section jumper, toast feedback on code copy.
16. `src/app/api-docs/page.tsx`: Integrate with `AppShell`.
17. `src/app/login/page.tsx`: Modernize zinc card, use `Alert` for auth errors.
18. `public/sw.js`: Bump cache name to `'alfaaltogrup-v3'`.
19. `public/offline.html`: Align with zinc dark design tokens.
20. `/.documentação/arquitetura.md`: Update architecture documentation for v0.5.0.
21. `src/app/layout.tsx`: Configure `interactiveWidget: "resizes-content"` on viewport and zinc dark `themeColor: "#09090b"`.
22. `src/app/globals.css`: Define dark scrollbar utility classes under `@layer utilities` (`.scrollbar-thin`, webkit scrollbar rules) for zero-bloat `scroll-area.tsx`.

### 7.3 Files to Delete
1. `src/app/[slug]/page.module.css`: Obsolete, unreferenced legacy CSS file.
