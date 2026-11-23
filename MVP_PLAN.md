# MVP Implementation Plan — Single Next.js Project (Vercel Free Tier)

**Goal:** Build a live, working MVP demo in **one single Next.js project** using the client's actual sample files (`UHC Medical PDF`, `Principal Ancillary PDF`, `Excel Comparison Template`, and `PowerPoint Proposal Excerpt`), styled to match the **Cosmo** UI (`#0B1528` navy, `#2D5BFF` royal blue, `#14B8A6` teal) and hosted 100% free on **Vercel**.

**Workflow Rule:** We execute **one step at a time**. After each step, you verify manually and confirm before we move to the next step.

---

## Step-by-Step Progress

### [x] Step 1: Next.js Scaffold, Cosmo UI Theme, Templates & Health Check
* **Status:** Verified by user.

---

### [x] Step 2: PDF Extraction Engine (`/api/extract`) — Both UHC & Principal Samples
* **What we built:**
  * Swappable AI extraction adapter (`src/lib/extractor.ts`) using `gpt-4o` Native PDF Vision (`OPENAI_API_KEY` in `.env.local`) so multi-column PDFs are read accurately.
  * `POST /api/extract` endpoint that accepts uploaded UHC/Principal PDFs or loads the bundled samples.
* **Status:** Verified by user.

---

### [x] Step 3: Side-by-Side Comparison UI + Flagging & Inline Editing
* **What we built:**
  * KPI Summary Cards (Group, Medical Plans, Ancillary Monthly Total + `%` change badge, Approval Status).
  * Interactive Side-by-Side Medical Comparison Matrix + Ancillary Renewal Table with **`▲ +X%` / `▼ -X%` / `New Option` / `No Renewal` badges**.
  * Simple filter bar (`All`, `▲ Increased`, `▼ Decreased`, `Missing / NA`), optional `Edit Values` toggle, 3-step extraction progress loader, and **Approve** button.
* **Status:** Verified by user.

---

### [x] Step 4: 1-Click Exact Excel Export (`/api/export/excel`)
* **What we built:**
  * `POST /api/export/excel` using `xlsx-populate` to load `Sample_Renewal_Comparison_Template-1381a7a6.xlsx`, write the approved Medical & Ancillary numbers into their exact mapped cells, and download the filled `.xlsx`.
  * Fixed `groupName` prompt rule so it always selects the employer/client on the left rather than the broker name.
* **Status:** Verified by user (`Harborview_Renewal_Comparison.xlsx` checked).

---

### [x] Step 5: 1-Click Client-Ready PowerPoint Export (`/api/export/pptx`)
* **What we built:**
  * `POST /api/export/pptx` using `jszip` to load `Sample_Renewal_Proposal_Presentation_FICTIONAL-881fc5b4.pptx`, update Slide 1 (group name) and the slide tables on Slide 7 (Marketing Results), Slide 8 (Medical Comparison), Slide 14 (Ancillary Renewal), and Slide 19 (Master Cost Summary), and download the ready-to-send `.pptx`.
* **Status:** Verified by user & E2E API test (`Harborview_Renewal_Proposal.pptx` checked).

---

### [🟡 Awaiting Manual Verification] Step 6: Vercel Free-Tier Deployment (Live Link)
* **What we built:**
  * `maxDuration = 60` on `/api/extract`, `outputFileTracingIncludes` for `templates/**/*` in `next.config.ts`, and full E2E production build + API test.
* **How you verify manually:**
  * Deploy to Vercel (`npx.cmd vercel --prod`) with `OPENAI_API_KEY` set in Vercel Environment Variables, then test the live URL end-to-end.
