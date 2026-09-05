// public/js/managerApproval.js
// Manager approvals table with strict anti-self-approval enforcement & duplicate comparison

import { state } from "./state.js";
import { openDuplicateModal } from "./duplicateModal.js";

export function initManagerApproval(showToast) {
  const tbody = document.getElementById("team-approvals-tbody");
  const approvalsCountBadge = document.getElementById("approvals-count-badge");
  const approvalsTabBadge = document.getElementById("approvals-badge");

  function renderApprovals() {
    if (!tbody || !state.currentUser) return;

    // Guidance banner for approving persona
    const guidanceBox = document.getElementById("approvals-role-guidance");
    if (guidanceBox) {
      const isManager = state.currentUser.role === "manager";
      if (!isManager) {
        guidanceBox.innerHTML = `
          <div class="role-guidance-banner guidance-employee">
            <div class="guidance-content">
              <span class="guidance-icon">👨‍💼</span>
              <div>
                <div class="guidance-title">Viewing as Employee: <strong>${state.currentUser.name}</strong> (${state.currentUser.title})</div>
                <div class="guidance-desc">Under corporate governance, staff cannot self-approve expense claims. To approve or reject your team claims, switch persona to <strong>Vikram Malhotra (Manager)</strong>.</div>
              </div>
            </div>
            <button type="button" class="btn btn-primary btn-sm btn-switch-to-manager" style="white-space: nowrap;">
              Switch to Vikram Malhotra (Manager) →
            </button>
          </div>
        `;
        const btnSwitch = guidanceBox.querySelector(".btn-switch-to-manager");
        if (btnSwitch) {
          btnSwitch.onclick = () => {
            state.setCurrentUser("usr_vikram_malhotra");
            showToast("Switched to Vikram Malhotra (Manager) — Approvals unlocked!", "success");
          };
        }
      } else {
        guidanceBox.innerHTML = `
          <div class="role-guidance-banner guidance-manager">
            <div class="guidance-content">
              <span class="guidance-icon">✓</span>
              <div>
                <div class="guidance-title">Manager Authority Active: <strong>${state.currentUser.name}</strong> (${state.currentUser.title})</div>
                <div class="guidance-desc">You are authorized to review, approve, or reject expense claims submitted by your team (Priya Sharma, Rajesh Kumar).</div>
              </div>
            </div>
          </div>
        `;
      }
    }

    // Claims pending approval or recently approved/paid
    const pendingClaims = state.claims.filter(c => c.status === "submitted");

    // Update counters
    if (approvalsCountBadge) approvalsCountBadge.textContent = `${pendingClaims.length} Pending`;
    if (approvalsTabBadge) approvalsTabBadge.textContent = pendingClaims.length;

    if (state.claims.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-muted">No claims in queue.</td></tr>`;
      return;
    }

    // Show submitted claims first, then approved
    const displayList = [...state.claims].sort((a, b) => {
      if (a.status === "submitted" && b.status !== "submitted") return -1;
      if (a.status !== "submitted" && b.status === "submitted") return 1;
      return new Date(b.submittedAt || b.date) - new Date(a.submittedAt || a.date);
    });

    tbody.innerHTML = displayList.map(claim => {
      const isPending = claim.status === "submitted";
      const isPaid = claim.status === "paid";
      const isApproved = claim.status === "approved";
      const isOwnClaim = claim.userId === state.currentUser.id;

      // Anti-self-approval rule
      const canApprove = isPending && !isOwnClaim;

      let duplicateHtml = `<span class="badge badge-emerald">✓ Verified</span>`;
      if (claim.duplicateFlag && claim.duplicateFlag.isDuplicate) {
        const pct = Math.round((claim.duplicateFlag.confidence || 0.95) * 100);
        duplicateHtml = `
          <button type="button" class="badge badge-rose cursor-pointer btn-open-dup-comp" data-claim-id="${claim.id}">
            🚨 ${pct}% Duplicate Match
          </button>
        `;
      }

      let authorityNote = "";
      if (isOwnClaim) {
        authorityNote = `
          <span class="badge badge-rose text-xs" title="Anti-Self-Approval Enforced">
            🚫 Self-Sign Off Prohibited
          </span>
          <div class="text-xs text-muted mt-1">Delegated to Sunita Patel</div>
        `;
      } else {
        authorityNote = `<span class="text-sm text-emerald">Authorized (${state.currentUser.name})</span>`;
      }

      let decisionHtml = "";
      if (isPaid) {
        decisionHtml = `<span class="badge badge-immutable">🔒 PAID & FINISHED</span>`;
      } else if (isApproved) {
        decisionHtml = `<span class="badge badge-indigo">SIGNED OFF</span>`;
      } else if (isPending) {
        if (isOwnClaim) {
          decisionHtml = `
            <button class="btn btn-outline btn-sm" disabled title="Self-approval is prohibited by policy. Higher authority must sign.">
              🔒 Locked (Your Claim)
            </button>
          `;
        } else {
          decisionHtml = `
            <div class="flex gap-2 justify-end">
              <button class="btn btn-success btn-sm btn-action-approve" data-id="${claim.id}">
                ✓ Approve
              </button>
              <button class="btn btn-danger btn-sm btn-action-reject" data-id="${claim.id}">
                ✕ Reject
              </button>
            </div>
          `;
        }
      } else {
        decisionHtml = `<span class="badge badge-rose">REJECTED</span>`;
      }

      return `
        <tr class="${claim.duplicateFlag?.isDuplicate ? 'bg-rose-subtle-row' : ''}">
          <td>
            <div class="font-semibold text-white">${claim.userName}</div>
            <div class="text-xs text-muted">${claim.department}</div>
          </td>
          <td>
            <div class="font-semibold">${claim.merchant}</div>
            <div class="text-xs text-muted font-mono" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${claim.description || claim.rawReceiptText}
            </div>
          </td>
          <td>${claim.date}</td>
          <td><span class="badge badge-outline">${claim.category}</span></td>
          <td>
            <span class="font-mono font-bold text-white">₹${Number(claim.amount).toLocaleString("en-IN")}</span>
          </td>
          <td>${duplicateHtml}</td>
          <td>${authorityNote}</td>
          <td class="text-right">${decisionHtml}</td>
        </tr>
      `;
    }).join("");

    // Attach Approve handlers
    tbody.querySelectorAll(".btn-action-approve").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        const origText = btn.textContent;
        btn.textContent = "Approving...";
        try {
          const res = await state.approveClaim(id);
          if (res && res.success) {
            showToast("Claim signed off and approved for finance payout!", "success");
          } else {
            const msg = res?.error || res?.detail || res?.message || "Unable to approve claim";
            showToast("Approval error: " + msg, "error");
            btn.disabled = false;
            btn.textContent = origText;
          }
        } catch (e) {
          showToast("Approval failed: " + (e.message || "Operation failed"), "error");
          btn.disabled = false;
          btn.textContent = origText;
        }
      });
    });

    // Attach Reject handlers
    tbody.querySelectorAll(".btn-action-reject").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const reason = prompt("Enter reason for rejecting this claim (sent to employee):");
        if (reason === null) return;
        const trimmed = reason.trim();
        if (!trimmed) {
          showToast("Rejection cancelled: A reason is required.", "warning");
          return;
        }

        btn.disabled = true;
        const origText = btn.textContent;
        btn.textContent = "Rejecting...";
        try {
          const res = await state.rejectClaim(id, trimmed);
          if (res && res.success) {
            showToast("Claim rejected.", "warning");
          } else {
            const msg = res?.error || res?.detail || res?.message || "Unable to reject claim";
            showToast("Rejection error: " + msg, "error");
            btn.disabled = false;
            btn.textContent = origText;
          }
        } catch (e) {
          showToast("Error: " + (e.message || "Operation failed"), "error");
          btn.disabled = false;
          btn.textContent = origText;
        }
      });
    });

    // Attach Duplicate Comparison Modal triggers
    tbody.querySelectorAll(".btn-open-dup-comp").forEach(btn => {
      btn.addEventListener("click", () => {
        const claimId = btn.dataset.claimId;
        const currentClaim = state.claims.find(c => c.id === claimId);
        if (currentClaim && currentClaim.duplicateFlag) {
          const prior = state.claims.find(c => c.id === currentClaim.duplicateFlag.matchedClaimId);
          openDuplicateModal(currentClaim, currentClaim.duplicateFlag, prior);
        }
      });
    });
  }

  state.subscribe((type, payload) => {
    if (type === "CLAIMS_UPDATED" || type === "USER_CHANGED" || type === "INITIALIZED" || (type === "TAB_SWITCHED" && payload === "team-approvals")) {
      renderApprovals();
    }
  });

  renderApprovals();
}
