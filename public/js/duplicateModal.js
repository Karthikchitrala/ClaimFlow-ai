// public/js/duplicateModal.js
// Side-by-side comparison modal for duplicate receipt inspection

export function openDuplicateModal(currentClaim, duplicateFlag, priorClaim = null) {
  const modal = document.getElementById("duplicate-modal");
  const modalBody = document.getElementById("modal-dup-body");
  const modalSubtitle = document.getElementById("modal-dup-subtitle");

  if (!modal || !modalBody) return;

  const scorePct = Math.round((duplicateFlag.confidence || 0.95) * 100);

  modalSubtitle.innerHTML = `AI Engine identified a <strong>${scorePct}% match</strong> with an existing expense claim.`;

  const priorMerchant = priorClaim ? priorClaim.merchant : duplicateFlag.matchedMerchant;
  const priorAmount = priorClaim ? priorClaim.amount : duplicateFlag.matchedAmount;
  const priorDate = priorClaim ? priorClaim.date : duplicateFlag.matchedDate;
  const priorStatus = priorClaim ? priorClaim.status : duplicateFlag.matchedStatus || "paid";
  const priorText = priorClaim ? (priorClaim.rawReceiptText || priorClaim.description) : duplicateFlag.matchedRawText || "N/A";
  const priorUser = priorClaim ? priorClaim.userName : duplicateFlag.matchedUser || "Team Member";

  const currentMerchant = currentClaim.merchant;
  const currentAmount = currentClaim.amount;
  const currentDate = currentClaim.date;
  const currentText = currentClaim.rawReceiptText || currentClaim.description;

  modalBody.innerHTML = `
    <div class="dup-modal-alert">
      <div class="alert-icon">🚨</div>
      <div>
        <strong>Why this was flagged:</strong>
        <p>${duplicateFlag.reason}</p>
      </div>
    </div>

    <div class="sandbox-comparison-grid mt-4">
      <div class="sandbox-box">
        <div class="flex-between mb-2">
          <h4>Previously Filed Claim</h4>
          <span class="badge ${priorStatus === 'paid' ? 'badge-immutable' : 'badge-emerald'}">
            ${priorStatus === 'paid' ? '🔒 PAID (IMMUTABLE)' : priorStatus.toUpperCase()}
          </span>
        </div>
        <div class="example-box">
          <p><strong>Claim ID:</strong> <span class="font-mono text-sm">${duplicateFlag.matchedClaimId}</span></p>
          <p><strong>Submitted by:</strong> ${priorUser}</p>
          <p><strong>Vendor / Merchant:</strong> <span class="text-white font-semibold">${priorMerchant}</span></p>
          <p><strong>Amount:</strong> <span class="text-emerald font-mono font-bold">₹${Number(priorAmount).toLocaleString("en-IN")}</span></p>
          <p><strong>Receipt Date:</strong> ${priorDate}</p>
          <div class="mt-2 p-2 bg-black-20 rounded">
            <span class="sub-label">Original Receipt Text:</span>
            <p class="font-mono text-sm text-muted">${priorText}</p>
          </div>
        </div>
      </div>

      <div class="sandbox-vs">
        <span>VS</span>
      </div>

      <div class="sandbox-box">
        <div class="flex-between mb-2">
          <h4>New Candidate Claim</h4>
          <span class="badge badge-amber">CANDIDATE</span>
        </div>
        <div class="example-box">
          <p><strong>Status:</strong> New Submission</p>
          <p><strong>Submitted by:</strong> ${currentClaim.userName || "Current Employee"}</p>
          <p><strong>Vendor / Merchant:</strong> <span class="text-white font-semibold">${currentMerchant}</span></p>
          <p><strong>Amount:</strong> <span class="text-emerald font-mono font-bold">₹${Number(currentAmount).toLocaleString("en-IN")}</span></p>
          <p><strong>Receipt Date:</strong> ${currentDate}</p>
          <div class="mt-2 p-2 bg-black-20 rounded">
            <span class="sub-label">Provided Text:</span>
            <p class="font-mono text-sm text-muted">${currentText}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="dup-policy-advice mt-4">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span>
        <strong>Finance Directive:</strong> Finance has paid identical receipts twice in previous quarters.
        ${priorStatus === 'paid' ? 'Because the original claim has already been disbursed, approving this claim may result in duplicate company loss.' : 'Check with the employee before signing off.'}
      </span>
    </div>
  `;

  modal.classList.remove("hidden");
}

export function closeDuplicateModal() {
  const modal = document.getElementById("duplicate-modal");
  if (modal) modal.classList.add("hidden");
}
