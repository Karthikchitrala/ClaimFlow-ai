// public/js/financeDashboard.js
// Month-end finance analytics, category breakdown, policy limit tracking & payment emulation

import { state } from "./state.js";

export function initFinanceDashboard(showToast) {
  const finTotalSpend = document.getElementById("fin-total-spend");
  const finTotalPaid = document.getElementById("fin-total-paid");
  const finAwaiting = document.getElementById("fin-awaiting-payout");
  const finOverlimitCount = document.getElementById("fin-overlimit-count");

  const categoryBarsContainer = document.getElementById("category-breakdown-bars");
  const payoutQueueList = document.getElementById("payout-queue-list");
  const btnBatchPayout = document.getElementById("btn-batch-payout");
  const limitTrackerTbody = document.getElementById("limit-tracker-tbody");

  // Payout simulation modal elements
  const simModal = document.getElementById("payout-sim-modal");
  const simTitle = document.getElementById("payout-sim-title");
  const simDesc = document.getElementById("payout-sim-desc");
  const simResult = document.getElementById("payout-sim-result");
  const simFooter = document.getElementById("payout-sim-footer");
  const btnCloseSim = document.getElementById("btn-close-payout-sim");

  function renderAnalytics() {
    if (!state.analytics) return;
    const { summary, categorySpend, employeeLimitReport } = state.analytics;

    // 1. KPI Cards
    if (finTotalSpend) finTotalSpend.textContent = `₹${(summary.totalSpent || 0).toLocaleString("en-IN")}`;
    if (finTotalPaid) finTotalPaid.textContent = `₹${(summary.totalPaid || 0).toLocaleString("en-IN")}`;
    if (finAwaiting) finAwaiting.textContent = `₹${(summary.totalApprovedUnpaid || 0).toLocaleString("en-IN")}`;
    if (finOverlimitCount) finOverlimitCount.textContent = (summary.nearLimitCount || 0) + (summary.overLimitCount || 0);

    // 2. Spend by Category
    if (categoryBarsContainer && Array.isArray(categorySpend)) {
      const maxSpend = Math.max(...categorySpend.map(c => c.total), 1);
      categoryBarsContainer.innerHTML = categorySpend.map(cat => {
        const pct = Math.round((cat.total / maxSpend) * 100);
        return `
          <div class="category-bar-item">
            <div class="cat-header">
              <span class="cat-name">
                <span>${cat.icon}</span>
                <span>${cat.name}</span>
                <span class="text-xs text-muted">(${cat.count} claims)</span>
              </span>
              <span class="cat-amount text-white">₹${Number(cat.total).toLocaleString("en-IN")}</span>
            </div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill fill-indigo" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      }).join("");
    }

    // 3. Payout Disbursement Queue (Approved claims waiting for payout)
    if (payoutQueueList) {
      const approvedClaims = state.claims.filter(c => c.status === "approved");

      if (approvedClaims.length === 0) {
        payoutQueueList.innerHTML = `
          <div class="text-center py-8 text-muted">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mx-auto mb-2 text-emerald"><polyline points="20 6 9 17 4 12"/></svg>
            <p>All approved claims have been paid out!</p>
            <span class="text-xs">No pending disbursements in queue.</span>
          </div>
        `;
        if (btnBatchPayout) btnBatchPayout.disabled = true;
      } else {
        if (btnBatchPayout) {
          btnBatchPayout.disabled = false;
          btnBatchPayout.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Batch Pay All (${approvedClaims.length} Claims)</span>
          `;
        }

        payoutQueueList.innerHTML = approvedClaims.map(claim => `
          <div class="payout-item-card">
            <div class="payout-meta">
              <span class="payout-employee">${claim.userName}</span>
              <span class="payout-desc">${claim.merchant} • ${claim.date}</span>
              <span class="text-xs text-indigo">Approved by ${claim.approverName || "Manager"}</span>
            </div>
            <div class="payout-action-box">
              <span class="payout-amount">₹${Number(claim.amount).toLocaleString("en-IN")}</span>
              <button class="btn btn-success btn-sm btn-single-pay" data-id="${claim.id}">
                Disburse
              </button>
            </div>
          </div>
        `).join("");

        // Single pay triggers
        payoutQueueList.querySelectorAll(".btn-single-pay").forEach(btn => {
          btn.addEventListener("click", () => {
            const id = btn.dataset.id;
            executePayoutModal([id]);
          });
        });
      }
    }

    // 4. Employee Monthly Limit Tracker
    if (limitTrackerTbody && Array.isArray(employeeLimitReport)) {
      limitTrackerTbody.innerHTML = employeeLimitReport.map(item => {
        const remaining = Math.max(0, item.limit - item.totalClaimed);
        let statusBadge = "";
        let barClass = "fill-success";

        if (item.isOverLimit) {
          statusBadge = `<span class="badge badge-rose">🚨 Over Limit</span>`;
          barClass = "fill-danger";
        } else if (item.isNearLimit) {
          statusBadge = `<span class="badge badge-warning">⚠️ Near Limit</span>`;
          barClass = "fill-warning";
        } else {
          statusBadge = `<span class="badge badge-emerald">✓ Within Budget</span>`;
        }

        return `
          <tr>
            <td>
              <div class="font-semibold text-white">${item.user.name}</div>
              <div class="text-xs text-muted">${item.user.title}</div>
            </td>
            <td>${item.user.department}</td>
            <td class="font-mono">₹${Number(item.limit).toLocaleString("en-IN")}</td>
            <td class="font-mono font-bold text-white">₹${Number(item.totalClaimed).toLocaleString("en-IN")}</td>
            <td class="font-mono text-muted">₹${Number(remaining).toLocaleString("en-IN")}</td>
            <td style="min-width: 140px;">
              <div class="flex-between text-xs mb-1">
                <span>${item.percentUsed}%</span>
              </div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill ${barClass}" style="width: ${Math.min(100, item.percentUsed)}%;"></div>
              </div>
            </td>
            <td>${statusBadge}</td>
          </tr>
        `;
      }).join("");
    }
  }

  // Batch Payout Action
  if (btnBatchPayout) {
    btnBatchPayout.addEventListener("click", () => {
      const approvedClaims = state.claims.filter(c => c.status === "approved");
      if (approvedClaims.length === 0) return;
      executePayoutModal(approvedClaims.map(c => c.id), true);
    });
  }

  // Payout Modal Simulation
  async function executePayoutModal(claimIds, isBatch = false) {
    simModal.classList.remove("hidden");
    simResult.classList.add("hidden");
    simFooter.classList.add("hidden");
    document.getElementById("payout-sim-icon").innerHTML = `<div class="spinner-ring"></div>`;
    simTitle.textContent = isBatch ? `Processing Batch Bank Transfer (${claimIds.length} Claims)...` : "Disbursing IMPS Transfer...";
    simDesc.textContent = "Connecting to corporate payment gateway (Emulated)...";

    setTimeout(async () => {
      try {
        let res;
        if (isBatch) {
          res = await state.batchPay();
        } else {
          res = await state.payClaim(claimIds[0]);
        }

        if (res.success) {
          document.getElementById("payout-sim-icon").innerHTML = `
            <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--color-emerald); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; margin: 0 auto;">
              ✓
            </div>
          `;
          simTitle.textContent = "Disbursement Succeeded!";
          simDesc.textContent = "Funds transferred to employee bank accounts.";
          simResult.classList.remove("hidden");
          simFooter.classList.remove("hidden");

          const sampleClaim = state.claims.find(c => c.id === claimIds[0]);
          const ref = isBatch ? res.batchId : sampleClaim?.payoutRef;

          simResult.innerHTML = `
            <div class="payout-success-receipt">
              <p><strong>Transaction Ref:</strong> <span class="font-mono text-emerald">${ref}</span></p>
              <p><strong>Total Disbursed:</strong> <span class="font-mono font-bold">₹${Number(isBatch ? res.totalAmount : sampleClaim?.amount).toLocaleString("en-IN")}</span></p>
              <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
              <div class="mt-3 text-xs text-muted">
                🔒 <strong>Policy Enforced:</strong> Claim status changed to <strong>PAID</strong>. Under company policy, paid claims are finalized and cannot be reversed or modified.
              </div>
            </div>
          `;

          showToast("Payout completed successfully!", "success");
        } else {
          simTitle.textContent = "Payout Failed";
          simDesc.textContent = res.error || "Unable to complete transfer";
          simFooter.classList.remove("hidden");
        }
      } catch (err) {
        simTitle.textContent = "Error";
        simDesc.textContent = err.message;
        simFooter.classList.remove("hidden");
      }
    }, 1200);
  }

  if (btnCloseSim) {
    btnCloseSim.addEventListener("click", () => {
      simModal.classList.add("hidden");
    });
  }

  state.subscribe((type) => {
    if (type === "ANALYTICS_UPDATED" || type === "CLAIMS_UPDATED" || type === "INITIALIZED" || type === "DATA_RESET") {
      renderAnalytics();
    }
  });

  renderAnalytics();
}
