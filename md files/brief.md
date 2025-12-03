## Growik Platform – Project Brief

### 1. High‑Level Overview

Growik is a web platform to manage influencer campaigns end‑to‑end for an agency or brand.  
It centralises user accounts, companies, products, influencers, contracts and campaigns so the team can:
- design and approve campaigns,
- assign influencers and owners,
- generate and sign contracts digitally,
- track collaboration actions and timelines,
- monitor account status and insights from a single dashboard.

The application is fully responsive, with a mobile‑optimised experience (simplified headers, compact tiles, bottom navigation, and scrollable tables).

### 2. Technology Stack

- **Frontend**: React + TypeScript, Vite build
- **UI**: Tailwind CSS + shadcn/ui component library (cards, dialogs, tables, sheets, etc.)
- **State / Context**: Custom `AuthContext` for authentication state
- **Backend / Data**: Supabase (Postgres + Auth + Storage)
- **Rich Text & Contracts**: Tiptap editor for building and rendering contract documents

### 3. Core Domains & Data

- **Users & Roles**
  - Stored in Supabase `user_profiles` with roles such as `user`, `admin`, and `super_admin`.
  - Role determines access to admin‑only screens and filters what collaborations a user can see.

- **Campaigns & Collaborations**
  - Campaign data and influencers are mapped via `src/lib/campaign.ts`.
  - Each campaign can have multiple influencers, a linked contract template, and progress/status fields.
  - Collaboration IDs uniquely tie together: campaign + influencer + contract.

- **Contracts**
  - Contract templates live in Supabase (`contracts` table) and are edited with the Tiptap editor (`ContractEditor.tsx`).
  - Variables (e.g. influencer name, company, dates) are injected into templates based on campaign and influencer data.
  - Final, filled contracts are saved as HTML and can be previewed, printed, and signed.

- **Supabase Integration**
  - `supabase.ts` centralises the client.
  - `userProfile.ts` and `magicLink.ts` wrap auth flows (login, signup, magic links).
  - Presence, role lookups, and campaign filters all go through Supabase queries.

### 4. Application Shell & Navigation

- **Layout**
  - Shared `Header` (top bar with profile, quick info, and actions).
  - `Sidebar` for desktop navigation (Dashboard, Contract, Influencer, Campaign, Collaboration, etc.).
  - `MobileNav` for mobile, fixed at the bottom with key sections as icon buttons.

- **Routing**
  - Each page under `src/pages/` is a dedicated route (e.g. `/dashboard`, `/users`, `/contract`, `/campaign`, `/collaboration`).
  - `NotFound.tsx` handles unknown routes.

### 5. Key Screens & Flows

#### 5.1 Authentication & Onboarding

- **Login / Signup / Reset**
  - `Login.tsx`, `SignupPage.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`.
  - Use Supabase email/password or magic‑link style flows.
  - `AuthCallback.tsx` handles provider/token callbacks.

- **Profile Completion & Status Pages**
  - `ProfileCompletion.tsx` ensures a user fills required info before full access.
  - `Suspended.tsx`, `Rejected.tsx`, `Hold.tsx` show account state (e.g. pending review, rejected, on hold).

#### 5.2 Dashboard

- **Dashboard.tsx**
  - “Welcome back” hero card with role, approval status and meta info.
  - Modern tiles summarising account state (role, approval, active status, employee ID).
  - **Quick Actions**: entry points to Users, Contract, Collaboration, Products, Companies etc., with different layouts for mobile (3×3 grid) and desktop (column list).
  - **Account Insights**: profile summary, sign‑out guidance, and performance style metrics.

#### 5.3 Users (Team Management)

- **Users.tsx**
  - Control‑centre style header describing “User Management Dashboard”.
  - Stats tiles (3×3 grid) for total users, active, on hold, suspended, pending, online.
  - Search & filtered table of users with:
    - search by name/email,
    - role/status filters (with a compact filter icon on mobile),
    - separate online count display.

#### 5.4 Companies & Products

- **Companies.tsx**
  - Hero header with description for brand/company management.
  - Tiles showing total companies and key metrics.
  - Desktop stats bar (view modes, search); compact variant on mobile.

- **Product.tsx**
  - Similar structure for managing product catalogue.
  - Summary tiles for total products, active/inactive, categories, linked companies.

#### 5.5 Influencers

- **Influencer.tsx**
  - “Influencer Management” header explaining purpose for the client.
  - Tiles for:
    - number of categories,
    - total influencers,
    - “Platform Health” indicator.
  - Responsive 2‑column grid on mobile with compact fonts, controlled widths and spacing so nothing overlaps.

#### 5.6 Contracts (Templates & Lifecycle)

- **Contract.tsx**
  - “Contract Management Hub” overview: what the client can do with agreements.
  - Tiles for **Active**, **Inactive**, and **Drafts** in a 3‑column grid.
  - On desktop: “Create Contract” workflow to build templates.
  - On mobile: instead of editing, a message card explains contract creation is desktop‑only (to keep mobile simple and safe).

- **ContractEditor.tsx**
  - Full template editor using Tiptap.
  - Supports headings, lists, tables, images, and styled text.
  - On mobile, the editor content is scaled down and centred so the full page is visible without horizontal scrolling.

- **PublicContractSigning.tsx**
  - A public link where influencers/clients can review and sign a specific contract.
  - Handles:
    - showing the filled contract,
    - drawing or uploading a signature,
    - saving the signed version back to Supabase.
  - If the contract is already signed, a non‑scrolling overlay clearly shows “Contract Already Signed” and makes the document read‑only.

#### 5.7 Campaigns

- **Campaign.tsx**
  - Mobile‑friendly “Campaign Management” page (similar visual language to `Contract.tsx`).
  - Header summary and tiles for Live, Scheduled, Influencers.
  - Compact search & filter card.
  - Campaign cards with key stats and a “Manage” action.
  - “New Campaign” and “Import Brief” buttons have been removed per client requirement.

- **CampaignDetail.tsx**
  - Deep‑dive into a single campaign (e.g. `/campaign/CAM007`).
  - Hero header with campaign metadata and mini tiles (budget, status, duration, etc.).
  - Sections:
    - **Campaign Overview** (objective, brand, owner).
    - **Collaboration Statistics** (counts and performance style metrics).
    - **Collaborator Directory**:
      - Tabs for users, influencers, collaboration actions.
      - Search, filters, and view‑mode toggles.
      - Responsive tables: some columns hidden on small screens, outer container max‑width ~340px, contents scroll horizontally.
  - Tab container styling is removed on mobile to look lighter; padding and spacing are also reduced for small screens.

#### 5.8 Collaboration Workspace

- **Collaboration.tsx**
  - Global view of all **collaboration actions** across campaigns.
  - Search + filter bar to slice actions by:
    - company, influencer, user,
    - campaign, contract,
    - signed / unsigned status.
  - Data table (mobile‑optimised):
    - columns like Campaign, Company, Contract, Influencer, Action, Collaboration ID, User, Date & Time, Actions.
    - minor columns hidden on mobile; table scrolls horizontally inside a 350px‑wide card.
  - Row‑level actions:
    - open the collaboration assignment workspace for that campaign + influencer,
    - fill/view contract,
    - change owning user,
    - mark signed/unsigned,
    - delete the row.
  - CSV export for selected collaboration actions.

- **CollaborationAssignment.tsx**
  - Detailed assignment workspace per campaign + influencer.
  - Sections typically include:
    - summary tiles about the current collaboration,
    - influencer and campaign context,
    - action selector (interested / not interested / callback / done) with remark fields,
    - timeline of all actions logged for that collaboration.
  - Contract variables can be filled here; a sheet lists all placeholders and their current values.
  - “Update Contract” generates a filled HTML contract and saves it with all variables; “View Contract” opens the saved HTML with correct fonts and styles and supports printing.
  - Layout and paddings are tuned for mobile (smaller buttons, wrapped controls, stacked layout).

### 6. Messaging & Chat

- **Messaging.tsx**
  - Central page for conversations (internal or with influencers/clients).
  - **ChatWidget.tsx** can also provide a floating chat entry in other views.
  - Mobile header shows a message icon (instead of technical connection details) to keep things simple for end users.

### 7. Reusable Components & UI System

- **UI Library (`src/components/ui/`)**
  - Standardised buttons, cards, tables, dialogs, drawers, sheets, accordions, tabs, toasts, etc.
  - Ensures consistent look‑and‑feel across all pages.

- **Dashboard Components**
  - `StatCard` and `StatsGrid` are reusable for KPI‑style tiles.

- **Utilities**
  - `use-mobile.tsx` – small hook to detect mobile layouts.
  - `useUserProfile.ts` – convenience around the current user profile and role.
  - `ScrollToTop.tsx` – scroll reset on route changes.

### 8. Typical Client Workflow (Example)

1. **Login & Access**
   - Client (or team member) logs in and lands on the dashboard to see overall status and quick actions.

2. **Set Up Companies & Products**
   - Add/update companies and products in their respective pages to keep campaign metadata clean.

3. **Manage Influencers**
   - Review categories and influencer roster on the Influencer page.

4. **Create / Update Contracts**
   - On desktop, use the Contract page and Contract Editor to prepare templates with variables.

5. **Run Campaigns**
   - Create or manage campaigns, attach influencers and contracts.
   - Use Campaign Detail + CollaborationAssignment to track every interaction.

6. **Send & Sign Contracts**
   - From collaboration actions, fill contracts and send links using PublicContractSigning.
   - Counter‑parties sign via mobile‑friendly public pages; the system records signature status.

7. **Monitor & Export**
   - Use Collaboration to see all actions, apply filters, and export CSV summaries for reporting.

This brief can be shared directly with the client to explain what the Growik platform does, how the main modules fit together, and how their team will typically use it day‑to‑day.


