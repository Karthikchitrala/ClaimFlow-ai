// public/js/claimsList.js
// Staff member claims list, filter pills, and lifecycle timeline drawer

import { state } from "./state.js";

export function initClaimsList() {
  const tbody = document.getElementById("my-claims-tbody");
  const filterPills = document.querySelectorAll("#claims-filter-pills .filter-pill");

  const countAll = document.getElementById("count-all");
  const countSubmitted = document.getElementById("count-submitted");
  const countApproved = document.getElementById("count-approved");
  const countPaid = document.getElementById("count-paid");
  const countRejected = document.getElementById("count-rejected");
  const myClaimsBadge = document.getElementById("my-claims-badge");

  let currentFilter = "all";

  filterPills.forEach(pill => {
    pill.addEventListener("click", () => {
      filterPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      currentFilter = pill.dataset.filter;
      renderTable();
    });
  });

  function renderTable() {
    if (!tbody || !state.currentUser) return;

    // Filter by current user
    const userClaims = state.claims.filter(c => c.userId === state.currentUser.id);

    // Update counts
    const submittedCount = userClaims.filter(c => c.status === "submitted").length;
    const approvedCount = userClaims.filter(c => c.status === "approved").length;
    const paidCount = userClaims.filter(c => c.status === "paid").length;
    const rejectedCount = userClaims.filter(c => c.status === "rejected").length;

    countAll.textContent = userClaims.length;
    countSubmitted.textContent = submittedCount;
    countApproved.textContent = approvedCount;
    countPaid.textContent = paidCount;
    countRejected.textContent = rejectedCount;

    // Total unpaid (submitted + approved)
    if (myClaimsBadge) {
      myClaimsBadge.textContent = submittedCount + approvedCount;
    }

    let filtered = userClaims;
    if (currentFilter !== "all") {
      filtered = userClaims.filter(c => c.status === currentFilter);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-8 text-muted">
            No expense claims found matching "${currentFilter}".
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(claim => {
      const categoryObj = state.categories.find(c => c.id === claim.category) || { name: claim.category, icon: "📦" };
      let statusBadge = "";
      if (claim.status === "paid") {
        statusBadge = `<span class="badge badge-immutable">🔒 PAID</span>`;
      } else if (claim.status === "approved") {
        statusBadge = `<span class="badge badge-indigo">APPROVED</span>`;
      } else if (claim.status === "submitted") {
        statusBadge = `<span class="badge badge-amber">PENDING</span>`;
      } else if (claim.status === "rejected") {
        statusBadge = `<span class="badge badge-rose">REJECTED</span>`;
      }

      return `
        <tr>
          <td>
            <span class="font-mono text-sm font-semibold">${claim.id}</span>
            ${claim.duplicateFlag ? '<span class="badge badge-rose text-xs ml-1" title="AI Duplicate Flag">⚠️ DUP</span>' : ''}
          </td>
          <td>${claim.date}</td>
          <td>
            <div class="font-semibold text-white">${claim.merchant}</div>
            <div class="text-xs text-muted font-mono" style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${claim.description || claim.rawReceiptText}
            </div>
          </td>
          <td>
            <span>${categoryObj.icon} ${categoryObj.name}</span>
          </td>
          <td>
            <span class="font-mono font-bold text-white">₹${Number(claim.amount).toLocaleString("en-IN")}</span>
          </td>
          <td>${statusBadge}</td>
          <td>
            <span class="text-sm text-muted">${claim.approverName || "Reviewer"}</span>
          </td>
          <td>
            <button class="btn btn-outline-subtle btn-sm btn-view-claim-drawer" data-id="${claim.id}">
              Timeline & Details
            </button>
          </td>
        </tr>
      `;
    }).join("");

    // Attach click handlers to detail buttons
    tbody.querySelectorAll(".btn-view-claim-drawer").forEach(btn => {
      btn.addEventListener("click", () => {
        const claimId = btn.dataset.id;
        const claim = state.claims.find(c => c.id === claimId);
        if (claim) openClaimDrawer(claim);
      });
    });
  }

  // Claim Drawer modal
  function openClaimDrawer(claim) {
    const modal = document.getElementById("claim-drawer-modal");
    const drawerTitle = document.getElementById("drawer-title");
    const drawerSubtitle = document.getElementById("drawer-subtitle");
    const drawerBody = document.getElementById("drawer-body");

    drawerTitle.textContent = `Claim #${claim.id}`;
    drawerSubtitle.textContent = `Submitted by ${claim.userName} (${claim.department})`;

    const categoryObj = state.categories.find(c => c.id === claim.category) || { name: claim.category, icon: "📦" };

    let timelineHtml = (claim.timeline || []).map(event => `
      <div class="timeline-step">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-action">${event.action}</div>
          <div class="timeline-meta">${event.by} • ${new Date(event.at).toLocaleString()}</div>
        </div>
      </div>
    `).join("");

    drawerBody.innerHTML = `
      <div class="drawer-header-summary">
        <div>
          <span class="sub-label">Merchant & Category</span>
          <h4>${categoryObj.icon} ${claim.merchant}</h4>
          <span class="text-muted text-sm">${categoryObj.name}</span>
        </div>
        <div class="text-right">
          <span class="sub-label">Total Amount</span>
          <div class="font-mono text-xl font-bold text-emerald">₹${Number(claim.amount).toLocaleString("en-IN")}</div>
          <span class="badge ${claim.status === 'paid' ? 'badge-immutable' : 'badge-emerald'} mt-1">
            ${claim.status === 'paid' ? '🔒 PAID & IMMUTABLE' : claim.status.toUpperCase()}
          </span>
        </div>
      </div>

      ${claim.status === 'paid' ? `
        <div class="paid-guarantee-box mt-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <div>
            <strong>Disbursement Finished (Payout Ref: ${claim.payoutRef})</strong>
            <p class="text-xs text-muted">Per business policy, paid claims are permanently locked and cannot be edited, deleted, or unapproved.</p>
          </div>
        </div>
      ` : ''}

      ${claim.duplicateFlag ? `
        <div class="duplicate-alert-box mt-4">
          <div class="alert-icon">⚠️</div>
          <div>
            <strong>Duplicate Alert (Score: ${Math.round(claim.duplicateFlag.confidence * 100)}%)</strong>
            <p class="text-xs text-muted">${claim.duplicateFlag.reason}</p>
          </div>
        </div>
      ` : ''}

      <div class="mt-4">
        <span class="sub-label">Original Receipt Note:</span>
        <div class="receipt-quote-box font-mono text-sm">${claim.rawReceiptText || claim.description}</div>
      </div>

      <div class="mt-6">
        <span class="sub-label">Lifecycle Audit Timeline:</span>
        <div class="timeline-container mt-2">
          ${timelineHtml}
        </div>
      </div>
    `;

    modal.classList.remove("hidden");
  }

  // Close drawer
  const btnCloseDrawer = document.getElementById("btn-close-drawer");
  if (btnCloseDrawer) {
    btnCloseDrawer.addEventListener("click", () => {
      document.getElementById("claim-drawer-modal").classList.add("hidden");
    });
  }

  // Subscribe to state changes
  state.subscribe((type, payload) => {
    if (type === "CLAIMS_UPDATED" || type === "USER_CHANGED" || type === "INITIALIZED" || (type === "TAB_SWITCHED" && payload === "my-claims")) {
      renderTable();
    }
  });

  renderTable();
}
