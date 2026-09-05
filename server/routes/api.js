// server/routes/api.js
// REST API routes for ClaimFlow AI

import express from "express";
import multer from "multer";
import { initialUsers, expenseCategories, initialClaims } from "../data/seedData.js";
import { checkDuplicateClaim } from "../services/duplicateService.js";
import { extractReceiptData } from "../services/aiExtractor.js";

const router = express.Router();

// Memory store initialized with realistic seed data
let users = [...initialUsers];
let categories = [...expenseCategories];
let claims = JSON.parse(JSON.stringify(initialClaims)); // deep clone
let systemSettings = {
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  companyName: "Acme Corp International",
  defaultCurrency: "INR",
  autoFlagDuplicates: true,
  duplicateThreshold: 0.65
};

// Configure file upload with Multer (memory storage for quick AI extraction)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ==========================================
// 1. USERS & CONFIGURATION
// ==========================================

router.get("/users", (req, res) => {
  res.json({ success: true, users });
});

router.get("/categories", (req, res) => {
  res.json({ success: true, categories });
});

router.get("/settings", (req, res) => {
  res.json({
    success: true,
    settings: {
      ...systemSettings,
      hasCustomApiKey: Boolean(systemSettings.geminiApiKey)
    }
  });
});

router.post("/settings", (req, res) => {
  const { geminiApiKey, duplicateThreshold } = req.body;
  if (typeof geminiApiKey === "string") {
    systemSettings.geminiApiKey = geminiApiKey.trim();
  }
  if (typeof duplicateThreshold === "number") {
    systemSettings.duplicateThreshold = duplicateThreshold;
  }
  res.json({ success: true, message: "Settings updated successfully" });
});

// ==========================================
// 2. CLAIMS RETRIEVAL & FILTERING
// ==========================================

router.get("/claims", (req, res) => {
  const { userId, approverId, status, role } = req.query;

  let filtered = [...claims];

  if (userId) {
    filtered = filtered.filter(c => c.userId === userId);
  }

  if (approverId) {
    // If manager, return claims submitted to them for approval
    filtered = filtered.filter(c => c.approverId === approverId);
  }

  if (status && status !== "all") {
    filtered = filtered.filter(c => c.status === status);
  }

  // Sort: newest submitted first
  filtered.sort((a, b) => new Date(b.submittedAt || b.date) - new Date(a.submittedAt || a.date));

  res.json({ success: true, claims: filtered, total: filtered.length });
});

router.get("/claims/:id", (req, res) => {
  const claim = claims.find(c => c.id === req.params.id);
  if (!claim) {
    return res.status(404).json({ success: false, error: "Claim not found" });
  }
  res.json({ success: true, claim });
});

// ==========================================
// 3. CLAIM CREATION & DUPLICATE DETECTION
// ==========================================

router.post("/claims", (req, res) => {
  const {
    userId,
    merchant,
    amount,
    currency = "INR",
    category,
    date,
    description,
    rawReceiptText,
    receiptImageUrl,
    extractedItems = []
  } = req.body;

  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(400).json({ success: false, error: "Valid User ID is required" });
  }

  if (!merchant || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ success: false, error: "Merchant and positive amount are required" });
  }

  const numAmount = parseFloat(amount);
  const now = new Date().toISOString();

  // Self-approval rule check
  const isManager = user.role === "manager";
  const approverId = user.managerId || "usr_ananya_iyer";
  const approver = users.find(u => u.id === approverId);

  // Check for duplicates
  const candidate = {
    merchant,
    amount: numAmount,
    currency,
    date: date || now.split("T")[0],
    description,
    rawReceiptText
  };

  const duplicateFlag = checkDuplicateClaim(candidate, claims);

  const newClaim = {
    id: `CLM-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`,
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    department: user.department,
    merchant: merchant.trim(),
    amount: numAmount,
    currency,
    category: category || "supplies_office",
    date: date || now.split("T")[0],
    description: description || rawReceiptText || "Expense claim",
    rawReceiptText: rawReceiptText || "",
    receiptImageUrl: receiptImageUrl || null,
    status: "submitted",
    approverId,
    approverName: approver ? approver.name : "Senior Approver",
    submittedAt: now,
    approvedAt: null,
    paidAt: null,
    payoutRef: null,
    confidenceScore: req.body.confidenceScore || 0.95,
    selfApprovalBlocked: isManager,
    selfApprovalNote: isManager
      ? `${user.name} is a manager. Self-approval is strictly prohibited. Routed to ${approver?.name || "Senior Approver"}.`
      : null,
    extractedItems: extractedItems.length > 0 ? extractedItems : [{ name: merchant, amount: numAmount }],
    duplicateFlag: duplicateFlag,
    timeline: [
      { action: "Claim filed via ClaimFlow AI", by: user.name, at: now }
    ]
  };

  if (isManager) {
    newClaim.timeline.push({
      action: `Anti-Self-Approval Rule: Blocked self sign-off, assigned to ${approver?.name}`,
      by: "System Policy",
      at: now
    });
  }

  if (duplicateFlag) {
    newClaim.timeline.push({
      action: `Duplicate Alert: ${duplicateFlag.reason}`,
      by: "AI Duplicate Engine",
      at: now
    });
  }

  claims.unshift(newClaim);

  res.status(201).json({
    success: true,
    claim: newClaim,
    duplicateWarning: duplicateFlag ? duplicateFlag.reason : null
  });
});

// ==========================================
// 4. CLAIM EDITING (IMMUTABILITY CHECK)
// ==========================================

router.put("/claims/:id", (req, res) => {
  const claimIndex = claims.findIndex(c => c.id === req.params.id);
  if (claimIndex === -1) {
    return res.status(404).json({ success: false, error: "Claim not found" });
  }

  const existing = claims[claimIndex];

  // IMMUTABLE PAID STATE RULE
  if (existing.status === "paid") {
    return res.status(400).json({
      success: false,
      error: "This claim has already been paid out and is finalized. Paid claims are immutable and cannot go backwards or be edited."
    });
  }

  const { merchant, amount, category, date, description, extractedItems } = req.body;

  if (merchant) existing.merchant = merchant;
  if (amount && !isNaN(parseFloat(amount))) existing.amount = parseFloat(amount);
  if (category) existing.category = category;
  if (date) existing.date = date;
  if (description) existing.description = description;
  if (Array.isArray(extractedItems)) existing.extractedItems = extractedItems;

  existing.timeline.push({
    action: "Claim details updated by employee",
    by: existing.userName,
    at: new Date().toISOString()
  });

  // Re-run duplicate check on updated values
  existing.duplicateFlag = checkDuplicateClaim(existing, claims, existing.id);

  res.json({ success: true, claim: existing });
});

// ==========================================
// 5. MANAGER APPROVAL & ANTI-SELF-APPROVAL RULE
// ==========================================

router.post("/claims/:id/approve", (req, res) => {
  const claim = claims.find(c => c.id === req.params.id);
  if (!claim) {
    return res.status(404).json({ success: false, error: "Claim not found" });
  }

  const { approverId } = req.body;
  const approver = users.find(u => u.id === approverId);

  // IMMUTABLE PAID STATE RULE
  if (claim.status === "paid") {
    return res.status(400).json({
      success: false,
      error: "This claim is already PAID and immutable. It cannot be altered."
    });
  }

  // ANTI-SELF-APPROVAL RULE: Managers cannot sign off their own claim!
  if (approverId && claim.userId === approverId) {
    return res.status(403).json({
      success: false,
      error: "Policy Violation: Managers cannot sign off on their own expense claims. This claim must be signed off by senior management."
    });
  }

  claim.status = "approved";
  claim.approvedAt = new Date().toISOString();
  claim.approverId = approverId || claim.approverId;
  claim.approverName = approver ? approver.name : claim.approverName;

  claim.timeline.push({
    action: "Claim approved & signed off",
    by: approver ? approver.name : "Manager",
    at: claim.approvedAt
  });

  res.json({ success: true, claim, message: "Claim approved successfully" });
});

router.post("/claims/:id/reject", (req, res) => {
  const claim = claims.find(c => c.id === req.params.id);
  if (!claim) {
    return res.status(404).json({ success: false, error: "Claim not found" });
  }

  const { approverId, reason } = req.body;
  const approver = users.find(u => u.id === approverId);

  // IMMUTABLE PAID STATE RULE
  if (claim.status === "paid") {
    return res.status(400).json({
      success: false,
      error: "This claim is already PAID. A paid claim cannot be rejected or reversed."
    });
  }

  // Manager cannot reject their own claim
  if (approverId && claim.userId === approverId) {
    return res.status(403).json({
      success: false,
      error: "You cannot reject your own claim."
    });
  }

  claim.status = "rejected";
  claim.rejectionReason = reason || "Claim rejected by reviewer";
  claim.timeline.push({
    action: `Claim rejected: ${claim.rejectionReason}`,
    by: approver ? approver.name : "Reviewer",
    at: new Date().toISOString()
  });

  res.json({ success: true, claim, message: "Claim rejected" });
});

// ==========================================
// 6. FINANCE PAYOUT (SINGLE & BATCH)
// ==========================================

router.post("/claims/:id/pay", (req, res) => {
  const claim = claims.find(c => c.id === req.params.id);
  if (!claim) {
    return res.status(404).json({ success: false, error: "Claim not found" });
  }

  if (claim.status === "paid") {
    return res.status(400).json({ success: false, error: "Claim is already paid." });
  }

  const now = new Date().toISOString();
  const txnRef = `TXN-IMPS-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}-PAID`;

  claim.status = "paid";
  claim.paidAt = now;
  claim.payoutRef = txnRef;

  claim.timeline.push({
    action: `Emulated Payout Completed (Ref: ${txnRef}). Claim is finalized & locked.`,
    by: "Ananya Iyer (Finance)",
    at: now
  });

  res.json({
    success: true,
    claim,
    message: `Payout of ₹${claim.amount.toLocaleString("en-IN")} completed. Reference: ${txnRef}`
  });
});

router.post("/claims/batch-pay", (req, res) => {
  const approvedClaims = claims.filter(c => c.status === "approved");

  if (approvedClaims.length === 0) {
    return res.status(400).json({ success: false, error: "No approved claims available for payout." });
  }

  const now = new Date().toISOString();
  const batchId = `BATCH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  let totalPaid = 0;

  for (const claim of approvedClaims) {
    const txnRef = `TXN-IMPS-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}-PAID`;
    claim.status = "paid";
    claim.paidAt = now;
    claim.payoutRef = txnRef;
    claim.batchId = batchId;
    totalPaid += claim.amount;

    claim.timeline.push({
      action: `Batch Payout Processed (Batch ${batchId}, Ref: ${txnRef}). Finalized & locked.`,
      by: "Ananya Iyer (Finance)",
      at: now
    });
  }

  res.json({
    success: true,
    batchId,
    paidCount: approvedClaims.length,
    totalAmount: totalPaid,
    message: `Successfully processed batch payout of ₹${totalPaid.toLocaleString("en-IN")} across ${approvedClaims.length} claims.`
  });
});

// ==========================================
// 7. AI EXTRACTION & RECEIPT OCR
// ==========================================

router.post("/extract-receipt", upload.single("receiptImage"), async (req, res) => {
  try {
    const rawText = req.body.rawText || "";
    let imageBase64 = null;
    let mimeType = null;

    if (req.file) {
      imageBase64 = req.file.buffer.toString("base64");
      mimeType = req.file.mimetype;
    }

    const extracted = await extractReceiptData({
      rawText,
      imageBase64,
      mimeType,
      apiKey: req.body.apiKey || systemSettings.geminiApiKey
    });

    // Check duplicate immediately for pre-submission warning!
    const duplicateCheck = checkDuplicateClaim(extracted, claims);

    res.json({
      success: true,
      extracted,
      duplicateWarning: duplicateCheck
    });
  } catch (err) {
    console.error("Receipt extraction error:", err);
    res.status(500).json({ success: false, error: "Failed to extract receipt: " + err.message });
  }
});

router.post("/check-duplicate", (req, res) => {
  const { merchant, amount, date, rawReceiptText, currentClaimId } = req.body;
  const duplicate = checkDuplicateClaim(
    { merchant, amount, date, rawReceiptText },
    claims,
    currentClaimId
  );
  res.json({ success: true, duplicate });
});

// ==========================================
// 8. FINANCE MONTH-END SPEND & LIMIT ANALYTICS
// ==========================================

router.get("/analytics/finance", (req, res) => {
  const totalClaimsCount = claims.length;

  // Total amounts
  let totalSpent = 0; // approved + paid + submitted
  let totalPaid = 0;
  let totalPendingApproval = 0;
  let totalApprovedUnpaid = 0;

  // Category breakdowns
  const categorySpend = {};
  for (const cat of categories) {
    categorySpend[cat.id] = { id: cat.id, name: cat.name, icon: cat.icon, total: 0, count: 0 };
  }

  // Employee limit tracking: who spent what and who has gone over their limit
  const userSpendMap = {};
  for (const u of users) {
    userSpendMap[u.id] = {
      user: u,
      totalClaimed: 0,
      totalPaid: 0,
      claimsCount: 0,
      limit: u.monthlyLimit,
      percentUsed: 0,
      isNearLimit: false,
      isOverLimit: false
    };
  }

  for (const c of claims) {
    if (c.status === "rejected") continue;

    totalSpent += c.amount;

    if (c.status === "paid") {
      totalPaid += c.amount;
    } else if (c.status === "submitted") {
      totalPendingApproval += c.amount;
    } else if (c.status === "approved") {
      totalApprovedUnpaid += c.amount;
    }

    if (categorySpend[c.category]) {
      categorySpend[c.category].total += c.amount;
      categorySpend[c.category].count += 1;
    }

    if (userSpendMap[c.userId]) {
      userSpendMap[c.userId].totalClaimed += c.amount;
      if (c.status === "paid") {
        userSpendMap[c.userId].totalPaid += c.amount;
      }
      userSpendMap[c.userId].claimsCount += 1;
    }
  }

  const employeeLimitReport = Object.values(userSpendMap).map(item => {
    const percent = item.limit > 0 ? (item.totalClaimed / item.limit) * 100 : 0;
    return {
      ...item,
      percentUsed: Number(percent.toFixed(1)),
      isNearLimit: percent >= 80 && percent <= 100,
      isOverLimit: percent > 100
    };
  });

  const overLimitEmployees = employeeLimitReport.filter(e => e.isOverLimit);
  const nearLimitEmployees = employeeLimitReport.filter(e => e.isNearLimit);

  res.json({
    success: true,
    summary: {
      totalClaimsCount,
      totalSpent,
      totalPaid,
      totalPendingApproval,
      totalApprovedUnpaid,
      overLimitCount: overLimitEmployees.length,
      nearLimitCount: nearLimitEmployees.length
    },
    categorySpend: Object.values(categorySpend),
    employeeLimitReport,
    overLimitEmployees,
    nearLimitEmployees
  });
});

// ==========================================
// 9. DATA RESET FOR DEMO SHOWCASE
// ==========================================

router.post("/reset-data", (req, res) => {
  users = [...initialUsers];
  claims = JSON.parse(JSON.stringify(initialClaims));
  res.json({
    success: true,
    message: "Reset database back to realistic showcase seed data."
  });
});

export default router;
