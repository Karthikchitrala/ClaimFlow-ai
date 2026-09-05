# ClaimFlow AI - Intelligent Expense Claims Platform

> **Build Task: Expense Claims**  
> An intelligent enterprise expense management platform featuring **AI receipt parsing**, **fuzzy duplicate detection**, **hierarchical approval controls (with anti-self-approval enforcement)**, **immutable payment state machines**, and **month-end finance spend analytics**.

---

## 🌟 Executive Overview

Staff spend personal funds on travel, meals, supplies, and taxis, then spend more time filing manual claims than the actual coffee cost. Meanwhile, managers struggle with rubber-stamping, and finance suffers from duplicate payouts and month-end limit blindspots.

**ClaimFlow AI solves this with four core pillars:**
1. **Zero-Friction AI Receipt Filing**: Staff simply paste raw text (messy auto notes, bank SMS, restaurant bills) or drop receipt screenshots. The AI extracts Merchant, Amount, Currency, Category, Date, and Line Items with high confidence, presenting an editable review card before submission.
2. **Strict Approval Integrity**: Managers also spend money and file claims, but **a manager is strictly prohibited from approving their own claim**. Self-approval is blocked and automatically re-routed to executive management.
3. **Immutable Paid State**: Once finance executes a single or batch payout, the claim transitions to **PAID** and is permanently locked. Paid claims cannot go backwards, be modified, or deleted.
4. **Fuzzy Duplicate Intelligence**: Catches the same receipt submitted weeks later, typed with altered phrasing or slight vendor name differences, alerting reviewers with a **Side-by-Side Comparison Modal** before payout occurs.

---

## 🚀 How to Run It

ClaimFlow AI provides a **zero-friction setup** with both **Python (FastAPI)** and **Node.js** runtimes.

### Option A: Python 3.12 Backend (Recommended)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Karthikchitrala/ClaimFlow-ai.git
   cd ClaimFlow-ai
   ```

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the application**:
   ```bash
   python server.py
   ```

4. **Access the application**:
   - 🌐 **Web UI**: [http://localhost:3000](http://localhost:3000)
   - 📖 **Interactive Swagger API Docs**: [http://localhost:3000/docs](http://localhost:3000/docs)
   - 🧪 **Health Check**: [http://localhost:3000/api/health](http://localhost:3000/api/health)

5. **Run the automated test suite**:
   ```bash
   python test/test_api_py.py
   ```

---

### Option B: Node.js Backend

```bash
npm install
npm start
# Run automated tests:
npm test
```

---

## 🛠️ Decisions and Assumptions Made

The specification provided real-world business realities. Here are the architectural decisions and assumptions implemented:

### 1. The Anti-Self-Approval Rule
* **The Reality**: Managers spend money on travel and client meetings too.
* **Our Decision**: In the database schema, each user has a hierarchical `managerId`. When **Vikram Malhotra (Engineering Director)** files a claim (e.g. AWS cloud computing bill), the system flags `selfApprovalBlocked: true` and automatically routes the claim to **Sunita Patel (VP of Product Engineering)**.
* **Enforcement**:
  - The UI disables the "Approve" button with a security padlock badge and explanatory tooltip.
  - The backend returns an explicit `HTTP 403 Forbidden` if any user attempts to sign off on their own expense claim.

### 2. Immutability of Paid Claims
* **The Reality**: *"A claim that has been paid is finished and should not go backwards."*
* **Our Decision**: We designed a strict one-way state machine:
  $$\text{Draft} \longrightarrow \text{Submitted} \longrightarrow \text{Approved} \longrightarrow \mathbf{PAID \ (Locked)}$$
* **Enforcement**: Once marked `PAID`, all edit (`PUT /api/claims/:id`), delete, rejection, and reversal actions are blocked at both the API level (`HTTP 400 Bad Request`) and the UI layer with a glowing `🔒 PAID & IMMUTABLE` badge and payout reference ID (e.g. `TXN-IMPS-2026-88129-PAID`).

### 3. Multi-Signal Fuzzy Duplicate Detection
* **The Reality**: *"People send the same receipt twice. Sometimes the same day, sometimes three weeks later, sometimes typed slightly differently the second time."*
* **Our Decision**: Rather than relying on rigid exact string matches, we built a multi-vector similarity scoring algorithm combining:
  1. **Canonical Vendor Aliases**: Maps brand variations (e.g. `"Swiggy - Meghana Foods"` vs. `"Swiggy India (Meghana Foods)"` vs. `"swiggy delivery"`).
  2. **Levenshtein Edit Distance & Token Jaccard Overlap**: Evaluates merchant string similarity and receipt description tokens.
  3. **Amount Proximity**: Exact match ($0.40$ weight) or within $2\%$ tax/rounding tolerance ($0.30$ weight).
  4. **Date Interval Window**: Flags exact same day ($0.25$ weight) or delayed submissions within a 35-day window ($0.10$ weight).
  5. **Duplicate Risk Score**: If cumulative confidence score $\ge 0.65$, the claim is flagged with an alert badge and a **Side-by-Side Comparison Modal** showing exact differences and prior payment status.

### 4. Human-in-the-Loop AI Review
* **The Reality**: *"Nobody wants to fill six fields for a 200 rupee auto ride... your system should show it back before it goes to the manager."*
* **Our Decision**: When AI extracts receipt data from messy text or an uploaded image, the system never auto-submits. It populates an interactive **Pre-Submission Verification Card** showing extracted fields, itemized breakdown, and confidence score. The user can adjust any field before submitting to their manager.

### 5. Month-End Finance Limit Monitoring
* **The Reality**: *"At the end of the month finance asks: who spent what, under which category, and who has gone over their limit."*
* **Our Decision**: Built a dedicated Finance & Spend Analytics dashboard with:
  - Real-time spend metrics across categories (`Meals & Dining`, `Travel & Taxis`, `Software & Cloud`, `Supplies & Equipment`, `Accommodation`).
  - Per-employee monthly budget monitor (e.g. Priya Sharma has a ₹25,000 monthly allowance; at ₹23,800 she is flagged with `⚠️ Near Limit (95.2%)`).

---

## 🤖 Which AI Tools Were Used & Where

1. **Google Gemini API (`gemini-2.5-flash`) via official `google-genai` SDK**:
   - **Where**: Primary extractor in [`server_py/services/ai_extractor.py`](file:///c:/Users/S-Tech/Desktop/ClaimFlow-ai/server_py/services/ai_extractor.py).
   - **Role**: Takes raw unformatted text or receipt image bytes and returns structured JSON with merchant, total, currency, category, date, confidence, and line items.
2. **Local Heuristic Regex/NLP Parsing Engine**:
   - **Where**: Embedded in [`server_py/services/ai_extractor.py`](file:///c:/Users/S-Tech/Desktop/ClaimFlow-ai/server_py/services/ai_extractor.py).
   - **Role**: High-speed, offline-capable fallback that parses Indian Rupee (₹), USD ($), EUR (€), date formats, arithmetic tips (`180 + 20`), and common corporate merchants with zero latency and zero external dependencies.
3. **Fuzzy String Matching & Token Similarity Engine**:
   - **Where**: [`server_py/services/duplicate_service.py`](file:///c:/Users/S-Tech/Desktop/ClaimFlow-ai/server_py/services/duplicate_service.py).
   - **Role**: Real-time duplicate screening scoring algorithm.

---

## 🔮 What We Would Do Next (With Another Week)

1. **Direct Accounting & ERP Synchronization**:
   - Native two-way integrations with QuickBooks Online, NetSuite, Xero, and Tally ERP for automatic general ledger journal entries upon payout.
2. **Corporate Credit Card Feeds**:
   - Live transaction syncing via Plaid / Finicity to automatically reconcile card swipes with uploaded receipts and clear claims in seconds.
3. **Conversational WhatsApp & Slack Bot**:
   - Allow employees to snap a photo on WhatsApp or forward an Uber email directly to a ClaimFlow AI bot to generate drafts without opening a browser.
4. **Automated Multi-Currency FX Conversions**:
   - Real-time daily foreign exchange rate locking via ECB / OpenExchangeRates with historical rate matching for travel receipts.
5. **Government GSTIN Automated Tax Compliance**:
   - Auto-verifying Indian GSTIN / tax IDs against government portal APIs to validate vendor legitimacy and reclaim input tax credits.

---

## 📊 Realistic Demonstration Personas (Seeded Data)

Switch personas with 1-click in the top navigation bar to test all perspectives:

| Name | Role | Department | Monthly Limit | Key Demo Scenario |
|---|---|---|---|---|
| **Priya Sharma** | Staff | Product Designer | ₹25,000 | Files messy auto ride receipt; has ₹23,800 spent (95.2% near limit alert). |
| **Rajesh Kumar** | Staff | Senior Frontend Dev | ₹30,000 | Filed Swiggy team lunch (₹3,240, Paid); re-files same receipt 12 days later (Duplicate Flagged!). |
| **Vikram Malhotra** | Manager | Engineering Director | ₹60,000 | Files AWS cloud bill; **cannot sign off his own claim** (routed to Sunita Patel). |
| **Sunita Patel** | Manager | VP Engineering | ₹100,000 | Executive approver authorized to sign off Vikram's claims. |
| **Ananya Iyer** | Finance | Head of Global Finance | ₹200,000 | Views category spend analytics, runs 1-click single & batch payouts. |

---

## 🧪 Automated Test Verification

The project includes an automated test suite verifying all core business rules:

```bash
python test/test_api_py.py
```

Output:
```
==================================================
Testing ClaimFlow AI Python/FastAPI Backend
==================================================

  [PASS] Health Check
  [PASS] Realistic Users Seeded
  [PASS] AI Extraction - Messy Auto Ride
  [PASS] Fuzzy Duplicate Detection
  [PASS] Anti-Self-Approval Rule (Manager Blocked with 403)
  [PASS] Immutable Paid Claim Rule (Blocked with 400)
  [PASS] Finance Analytics - Limit Tracking
  [PASS] Finance Single Payout Emulation

==================================================
Results: 8 passed, 0 failed
==================================================
```

---

## 🎥 Video Walkthrough Guide (3–5 Minutes)

For recording your submission video, follow the structured script provided in [`VIDEO_WALKTHROUGH_SCRIPT.md`](file:///c:/Users/S-Tech/Desktop/ClaimFlow-ai/VIDEO_WALKTHROUGH_SCRIPT.md).
