// public/js/claimFiling.js
// AI receipt extraction, template chips, drag & drop, and pre-submission review

import { state } from "./state.js";
import { openDuplicateModal } from "./duplicateModal.js";

const TEMPLATES = {
  dominos: `TAX INVOICE - JUBILANT FOODWORKS LTD. (Domino's Pizza)
COLES ROAD, COX TOWN, BANGALORE-05 (Phone: 9060316978)
Invoice Number: 66103/20/44492 | Order: 159 | Date: 11/01/2020 7:56 PM
Customer: Akshay pol | Zero Contact Pick-Up | 8722180619 | Tent: egv-786611679
1 Reg HT PM Capsicum (Gk): 99.00
1 Reg HT PM Onion (Gi): 99.00
1 Reg HT PM Gold Corn (Gj): 199.00
1 Reg HT PM Gold Corn (Gj): 199.00
SubTot: 596.00 | CGST @ 2.5%: 7.30 | SGST/UTGST @ 2.5%: 7.30
Total: 603.30
GSTIN: 29AABCD1821C2Z6, PAN: AABCD1821C HSN: 9963 | www.dominos.co.in`,
  auto: "Auto meter 180 + 20 tip total 200rs cash koramangala to indiranagar 14/08",
  sms: "Axis Bank: Rs 850.00 spent at BLUE TOKAI COFFEE ROASTERS on 04-AUG-2026. Avail Bal: Rs 42,100. Txn: BTCR889211",
  swiggy: "Swiggy receipt Meghana Biryani food delivery for devs bill total 3240 rs date 14 Aug",
  aws: "AWS EMEA SARL / Amazon Web Services India Pvt Ltd Invoice #AWS-883190 Total: ₹11,850.00 EC2 On-Demand Instances"
};

let activeSelectedFile = null;
let currentCandidateExtracted = null;

export function initClaimFiling(showToast, switchTab) {
  const textarea = document.getElementById("receipt-raw-textarea");
  const btnExtract = document.getElementById("btn-extract-receipt");
  const spinner = document.getElementById("extract-spinner");
  const btnExtractText = document.getElementById("extract-btn-text");

  const toggleText = document.getElementById("toggle-method-text");
  const toggleImage = document.getElementById("toggle-method-image");
  const textPane = document.getElementById("text-input-area");
  const imagePane = document.getElementById("image-input-area");

  const dropzone = document.getElementById("file-dropzone");
  const fileInput = document.getElementById("receipt-file-input");
  const filePreviewCard = document.getElementById("file-preview-card");
  const filePreviewImg = document.getElementById("file-preview-img");
  const fileNameLabel = document.getElementById("file-name-label");
  const btnRemoveFile = document.getElementById("btn-remove-file");

  const claimForm = document.getElementById("claim-submission-form");
  const merchantInput = document.getElementById("claim-merchant");
  const categorySelect = document.getElementById("claim-category");
  const amountInput = document.getElementById("claim-amount");
  const currencySelect = document.getElementById("claim-currency");
  const dateInput = document.getElementById("claim-date");
  const descInput = document.getElementById("claim-description");
  const itemsList = document.getElementById("items-breakdown-list");
  const confidenceBadge = document.getElementById("confidence-badge");
  const confidenceText = document.getElementById("confidence-text");

  const dupBanner = document.getElementById("duplicate-warning-banner");
  const dupMsg = document.getElementById("duplicate-warning-msg");
  const btnViewDup = document.getElementById("btn-view-duplicate-details");

  const limitBanner = document.getElementById("limit-impact-banner");
  const limitCalc = document.getElementById("limit-impact-calc");
  const limitBar = document.getElementById("limit-impact-bar");

  const managerRoutingNotice = document.getElementById("manager-routing-notice");

  // Default date
  if (dateInput) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }

  // 1. Template Chips
  document.querySelectorAll(".chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.template;
      if (TEMPLATES[type]) {
        textarea.value = TEMPLATES[type];
        // Switch to text tab if on image
        toggleText.click();
        triggerExtraction();
      }
    });
  });

  // 2. Input Method Toggle
  toggleText.addEventListener("click", () => {
    toggleText.classList.add("active");
    toggleImage.classList.remove("active");
    textPane.classList.remove("hidden");
    imagePane.classList.add("hidden");
  });

  toggleImage.addEventListener("click", () => {
    toggleImage.classList.add("active");
    toggleText.classList.remove("active");
    imagePane.classList.remove("hidden");
    textPane.classList.add("hidden");
  });

  // 3. File Dropzone
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  });

    function handleFileSelection(file) {
    activeSelectedFile = file;
    fileNameLabel.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (ev) => {
      filePreviewImg.src = ev.target.result;
      filePreviewCard.classList.remove("hidden");
      document.querySelector(".dropzone-content").classList.add("hidden");
    };
    reader.readAsDataURL(file);

    // Auto-trigger OCR scanning in background when image is chosen!
    scanReceiptImageWithOcr(file);
  }

  async function scanReceiptImageWithOcr(file) {
    if (!window.Tesseract) return "";
    showToast("🔍 Reading text from receipt photo via OCR...", "info");
    btnExtractText.textContent = "Scanning Photo (OCR)...";

    try {
      const res = await window.Tesseract.recognize(file, "eng", {
        logger: m => {
          if (m.status === "recognizing text") {
            const pct = Math.round((m.progress || 0) * 100);
            btnExtractText.textContent = `OCR Scanning (${pct}%)...`;
          }
        }
      });
      const ocrText = res?.data?.text || "";
      if (ocrText.trim()) {
        textarea.value = ocrText.trim();
        showToast("✓ Text extracted from bill photo!", "success");
      }
      btnExtractText.textContent = "Extract Claim with AI";
      return ocrText;
    } catch (e) {
      console.warn("Client OCR error:", e);
      btnExtractText.textContent = "Extract Claim with AI";
      return "";
    }
  }

  btnRemoveFile.addEventListener("click", (e) => {
    e.stopPropagation();
    activeSelectedFile = null;
    fileInput.value = "";
    filePreviewCard.classList.add("hidden");
    document.querySelector(".dropzone-content").classList.remove("hidden");
  });

  // 4. Extraction Action
  btnExtract.addEventListener("click", () => {
    triggerExtraction();
  });

  async function triggerExtraction() {
    let text = textarea.value.trim();
    if (!text && !activeSelectedFile) {
      showToast("Please enter receipt text or choose an image", "warning");
      return;
    }

    btnExtract.disabled = true;
    spinner.classList.remove("hidden");

    try {
      // If image is selected and text is empty, scan image first!
      if (activeSelectedFile && !text) {
        btnExtractText.textContent = "OCR Reading Receipt Photo...";
        const ocrText = await scanReceiptImageWithOcr(activeSelectedFile);
        if (ocrText && ocrText.trim()) {
          text = ocrText.trim();
        }
      }

      btnExtractText.textContent = "AI Parsing Receipt...";
      const customApiKey = localStorage.getItem("claimflow_gemini_key") || "";
      const result = await state.extractReceipt(text, activeSelectedFile, customApiKey);

      if (result.success && result.extracted) {
        currentCandidateExtracted = result.extracted;
        populateReviewCard(result.extracted, result.duplicateWarning);
        showToast(`Parsed receipt: ${result.extracted.merchant || 'Vendor'} (₹${result.extracted.amount || 0})`, "success");
      } else {
        showToast("Extraction failed. Please check input.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Extraction error: " + err.message, "error");
    } finally {
      btnExtract.disabled = false;
      spinner.classList.add("hidden");
      btnExtractText.textContent = "Extract Claim with AI";
    }
  }

  function populateReviewCard(extracted, duplicateWarning) {
    merchantInput.value = extracted.merchant || "";
    categorySelect.value = extracted.category || "supplies_office";
    amountInput.value = extracted.amount || "";
    currencySelect.value = extracted.currency || "INR";
    dateInput.value = extracted.date || new Date().toISOString().split("T")[0];
    descInput.value = extracted.description || "";

    const currSym = extracted.currency === "USD" ? "$" : (extracted.currency === "EUR" ? "€" : (extracted.currency === "GBP" ? "£" : "₹"));

    // Items list
    itemsList.innerHTML = "";
    if (Array.isArray(extracted.extractedItems) && extracted.extractedItems.length > 0) {
      extracted.extractedItems.forEach(item => {
        const row = document.createElement("div");
        row.className = "item-row";
        row.innerHTML = `<span>${item.name}</span><strong>${currSym}${Number(item.amount).toLocaleString("en-IN")}</strong>`;
        itemsList.appendChild(row);
      });
    } else {
      itemsList.innerHTML = `<div class="item-row"><span>${extracted.merchant}</span><strong>${currSym}${Number(extracted.amount).toLocaleString("en-IN")}</strong></div>`;
    }

    // Confidence badge
    const conf = Math.round((extracted.confidenceScore || 0.95) * 100);
    confidenceText.textContent = `${conf}% Confidence`;

    // Duplicate alert
    if (duplicateWarning && duplicateWarning.isDuplicate) {
      dupBanner.classList.remove("hidden");
      dupMsg.textContent = duplicateWarning.reason;
      btnViewDup.onclick = () => {
        openDuplicateModal({
          merchant: extracted.merchant,
          amount: extracted.amount,
          date: extracted.date,
          rawReceiptText: textarea.value,
          userName: state.currentUser?.name
        }, duplicateWarning);
      };
    } else {
      dupBanner.classList.add("hidden");
    }

    // Manager self-approval warning
    updateManagerNotice();

    // Update monthly limit impact
    updateLimitImpact();
  }

  // Calculate live monthly limit impact
  function updateLimitImpact() {
    if (!state.currentUser || !state.analytics) return;
    const amount = parseFloat(amountInput.value) || 0;
    const userReport = state.analytics.employeeLimitReport?.find(e => e.user.id === state.currentUser.id);

    const currentSpent = userReport ? userReport.totalClaimed : 0;
    const limit = state.currentUser.monthlyLimit || 25000;
    const projected = currentSpent + amount;
    const pct = Math.min(100, (projected / limit) * 100);

    limitCalc.textContent = `₹${currentSpent.toLocaleString("en-IN")} + ₹${amount.toLocaleString("en-IN")} = ₹${projected.toLocaleString("en-IN")} / ₹${limit.toLocaleString("en-IN")} (${pct.toFixed(1)}%)`;
    limitBar.style.width = `${pct}%`;

    limitBar.className = "progress-bar-fill " + (pct > 90 ? (pct > 100 ? "fill-danger" : "fill-warning") : "fill-success");
  }

  function updateManagerNotice() {
    if (state.currentUser && state.currentUser.role === "manager") {
      managerRoutingNotice.classList.remove("hidden");
    } else {
      managerRoutingNotice.classList.add("hidden");
    }
  }

  amountInput.addEventListener("input", updateLimitImpact);

  // 5. Submit Claim
  claimForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const merchant = merchantInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const category = categorySelect.value;
    const currency = currencySelect.value;
    const date = dateInput.value;
    const description = descInput.value.trim();

    if (!merchant || !amount || amount <= 0) {
      showToast("Please enter a valid merchant and amount", "warning");
      return;
    }

    const claimPayload = {
      merchant,
      amount,
      currency,
      category,
      date,
      description,
      rawReceiptText: textarea.value.trim(),
      confidenceScore: currentCandidateExtracted?.confidenceScore || 0.95,
      extractedItems: currentCandidateExtracted?.extractedItems || []
    };

    const submitBtn = document.getElementById("btn-submit-claim");
    submitBtn.disabled = true;

    try {
      const res = await state.submitNewClaim(claimPayload);

      if (res.success) {
        showToast(
          res.duplicateWarning
            ? "⚠️ Claim submitted! Note: AI flagged potential duplicate for reviewer."
            : "Claim submitted to manager successfully!",
          res.duplicateWarning ? "warning" : "success"
        );

        // Reset form
        textarea.value = "";
        merchantInput.value = "";
        amountInput.value = "";
        descInput.value = "";
        dupBanner.classList.add("hidden");
        if (btnRemoveFile) btnRemoveFile.click();

        // Switch to My Claims tab
        switchTab("my-claims");
      } else {
        showToast("Error: " + res.error, "error");
      }
    } catch (err) {
      showToast("Submission failed: " + err.message, "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Listen to user change to update manager routing notice & limit impact
  state.subscribe((type) => {
    if (type === "USER_CHANGED" || type === "ANALYTICS_UPDATED") {
      updateManagerNotice();
      updateLimitImpact();
    }
  });

  // Pre-populate with auto ride template on first load for awesome first impression
  textarea.value = TEMPLATES.auto;
  triggerExtraction();
}
