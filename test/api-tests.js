// test/api-tests.js
// Automated verification suite for ClaimFlow AI business rules & edge cases

import http from "http";
import app from "../server/server.js";

const PORT = process.env.TEST_PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;
let server;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        "Content-Type": "application/json"
      }
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on("error", reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("==================================================");
  console.log("🧪 Running ClaimFlow AI Automated Verification Suite");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = "") {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name} -> ${details}`);
      failed++;
    }
  }

  try {
    server = app.listen(PORT);
    // Give server a moment to listen
    await new Promise(r => setTimeout(r, 100));

    // 1. Health Check
    const health = await request("GET", "/api/health");
    assert("Health Check", health.status === 200 && health.body.status === "healthy");

    // 2. Users Loaded
    const usersRes = await request("GET", "/api/users");
    assert("Realistic Users Seeded", usersRes.status === 200 && usersRes.body.users.length >= 5);

    // 3. AI Receipt Extraction from messy text
    const extractRes = await request("POST", "/api/extract-receipt", {
      rawText: "Auto meter 180 + 20 tip total 200rs cash koramangala to indiranagar 14/08"
    });
    assert(
      "AI Extraction - Messy Auto Ride",
      extractRes.status === 200 &&
      extractRes.body.extracted.amount === 200 &&
      extractRes.body.extracted.category === "travel_taxi",
      `Got amount: ${extractRes.body?.extracted?.amount}, category: ${extractRes.body?.extracted?.category}`
    );

    // 4. Duplicate Detection Flagging
    const dupRes = await request("POST", "/api/check-duplicate", {
      merchant: "Swiggy India (Meghana Foods)",
      amount: 3240,
      date: "2026-08-14",
      rawReceiptText: "Swiggy receipt Meghana Biryani food delivery 3240 rs"
    });
    assert(
      "Fuzzy Duplicate Detection",
      dupRes.status === 200 && dupRes.body.duplicate && dupRes.body.duplicate.isDuplicate === true,
      JSON.stringify(dupRes.body?.duplicate)
    );

    // 5. Anti-Self-Approval Business Rule: Manager cannot approve own claim
    const selfApproveRes = await request("POST", "/api/claims/CLM-2026-0819-AWS/approve", {
      approverId: "usr_vikram_malhotra" // Vikram owns this claim!
    });
    assert(
      "Anti-Self-Approval Rule (Manager Blocked)",
      selfApproveRes.status === 403,
      `Expected status 403 Forbidden, got ${selfApproveRes.status}: ${JSON.stringify(selfApproveRes.body)}`
    );

    // 6. Immutability Rule: Paid claim cannot go backwards or be altered
    const editPaidRes = await request("PUT", "/api/claims/CLM-2026-0804", {
      amount: 1500,
      description: "Trying to edit a paid claim"
    });
    assert(
      "Immutable Paid Claim Rule",
      editPaidRes.status === 400,
      `Expected status 400, got ${editPaidRes.status}: ${JSON.stringify(editPaidRes.body)}`
    );

    // 7. Finance Analytics & Monthly Limit Tracking
    const analyticsRes = await request("GET", "/api/analytics/finance");
    const priyaReport = analyticsRes.body.employeeLimitReport?.find(e => e.user.id === "usr_priya_sharma");
    assert(
      "Finance Analytics - Employee Limit Tracking",
      analyticsRes.status === 200 &&
      priyaReport &&
      priyaReport.percentUsed > 90, // Priya spent ₹23,800 of ₹25,000 limit
      `Priya percent used: ${priyaReport?.percentUsed}%`
    );

    // 8. Finance Payout Emulation
    const payRes = await request("POST", "/api/claims/CLM-2026-0820/pay");
    assert(
      "Finance Single Payout Emulation",
      payRes.status === 200 &&
      payRes.body.claim.status === "paid" &&
      payRes.body.claim.payoutRef?.startsWith("TXN-IMPS-"),
      `Payout response: ${JSON.stringify(payRes.body)}`
    );

    console.log("\n==================================================");
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log("==================================================");

    if (server) server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    if (server) server.close();
    console.error("Test execution failed:", err);
    process.exit(1);
  }
}

runTests();
