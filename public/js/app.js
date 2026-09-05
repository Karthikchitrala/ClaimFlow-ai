// public/js/app.js
// Main entry point for ClaimFlow AI frontend

import { state } from "./state.js";
import { initClaimFiling } from "./claimFiling.js";
import { initClaimsList } from "./claimsList.js";
import { initManagerApproval } from "./managerApproval.js";
import { initFinanceDashboard } from "./financeDashboard.js";
import { closeDuplicateModal } from "./duplicateModal.js";

// Toast notification helper
export function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : (type === 'error' ? '✕' : '⚠️')}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Tab switching helper
export function switchTab(tabId) {
  const tabs = document.querySelectorAll(".nav-tab");
  const panes = document.querySelectorAll(".tab-pane");

  tabs.forEach(t => {
    if (t.dataset.tab === tabId) {
      t.classList.add("active");
    } else {
      t.classList.remove("active");
    }
  });

  panes.forEach(p => {
    if (p.id === `pane-${tabId}`) {
      p.classList.add("active");
    } else {
      p.classList.remove("active");
    }
  });
}

async function startApp() {
  // 1. Tab navigation
  document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      switchTab(tab.dataset.tab);
    });
  });

  // 2. Initialize State
  await state.init();

  // 3. User Switcher Dropdown
  const userSelect = document.getElementById("active-user-select");
  if (userSelect && state.users.length > 0) {
    userSelect.innerHTML = state.users.map(u => `
      <option value="${u.id}">
        ${u.name} (${u.role.toUpperCase()} - ${u.title})
      </option>
    `).join("");

    userSelect.value = state.currentUser.id;

    userSelect.addEventListener("change", (e) => {
      state.setCurrentUser(e.target.value);
      showToast(`Switched active persona to ${state.currentUser.name} (${state.currentUser.role.toUpperCase()})`, "success");
    });
  }

  // 4. Update Header & Role Banner
  function updateRoleBanner() {
    if (!state.currentUser) return;
    const u = state.currentUser;

    document.getElementById("banner-user-name").textContent = u.name;
    document.getElementById("banner-user-dept").textContent = `${u.title} • ${u.department}`;
    document.getElementById("banner-avatar").style.backgroundImage = `url(${u.avatar})`;

    const roleBadge = document.getElementById("banner-role-badge");
    const roleDesc = document.getElementById("banner-role-desc");

    if (u.role === "staff") {
      roleBadge.className = "badge badge-indigo";
      roleBadge.textContent = "Staff Member";
      roleDesc.textContent = "Files claims effortlessly with AI receipt paste, watches unpaid claims, and stays within monthly allowance.";
    } else if (u.role === "manager") {
      roleBadge.className = "badge badge-accent";
      roleBadge.textContent = "Manager / Reviewer";
      roleDesc.textContent = "Reviews direct reports' claims and signs off. (Note: Self-approval prohibited; own claims route to Sunita Patel).";
    } else if (u.role === "finance") {
      roleBadge.className = "badge badge-emerald";
      roleBadge.textContent = "Finance & Operations";
      roleDesc.textContent = "Disburses single and batch payouts (immutable lock), watches company spend categories, and monitors limit breaches.";
    }

    // Spend vs Limit
    const userReport = state.analytics?.employeeLimitReport?.find(e => e.user.id === u.id);
    const spent = userReport ? userReport.totalClaimed : 0;
    const limit = u.monthlyLimit || 25000;
    const pct = Math.min(100, (spent / limit) * 100);

    document.getElementById("banner-limit-spent").textContent = `₹${spent.toLocaleString("en-IN")}`;
    document.getElementById("banner-limit-max").textContent = `₹${limit.toLocaleString("en-IN")}`;
    const limitTag = document.getElementById("banner-limit-tag");
    limitTag.textContent = `${pct.toFixed(1)}% Used`;

    const limitBar = document.getElementById("banner-limit-bar");
    limitBar.style.width = `${pct}%`;
    limitBar.className = "progress-bar-fill " + (pct > 90 ? (pct > 100 ? "fill-danger" : "fill-warning") : "fill-success");

    // Mini KPIs in header
    updateMiniKpis();
  }

  function updateMiniKpis() {
    if (!state.claims) return;
    const unpaid = state.claims.filter(c => c.status === "submitted" || c.status === "approved").length;
    const pending = state.claims.filter(c => c.status === "submitted").length;
    const duplicates = state.claims.filter(c => c.duplicateFlag && c.duplicateFlag.isDuplicate).length;

    const elUnpaid = document.getElementById("mini-unpaid-count");
    const elPending = document.getElementById("mini-pending-count");
    const elDup = document.getElementById("mini-duplicate-count");

    if (elUnpaid) elUnpaid.textContent = unpaid;
    if (elPending) elPending.textContent = pending;
    if (elDup) elDup.textContent = duplicates;
  }

  // 5. Reset Demo Data Button
  const btnReset = document.getElementById("btn-reset-data");
  if (btnReset) {
    btnReset.addEventListener("click", async () => {
      if (confirm("Reset ClaimFlow AI back to initial realistic showcase seed data?")) {
        btnReset.disabled = true;
        await state.resetData();
        btnReset.disabled = false;
        showToast("Demo data reset to original showcase state!", "success");
      }
    });
  }

  // 6. Duplicate Modal Close
  const btnCloseDup = document.getElementById("btn-close-dup-modal");
  const btnDismissDup = document.getElementById("btn-dismiss-dup-modal");
  if (btnCloseDup) btnCloseDup.addEventListener("click", closeDuplicateModal);
  if (btnDismissDup) btnDismissDup.addEventListener("click", closeDuplicateModal);

  // 7. Settings Form
  const settingsForm = document.getElementById("settings-form");
  const slider = document.getElementById("settings-threshold");
  const thresholdVal = document.getElementById("threshold-val");

  if (slider && thresholdVal) {
    slider.addEventListener("input", () => {
      thresholdVal.textContent = slider.value + "%";
    });
  }

  if (settingsForm) {
    settingsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const geminiApiKey = document.getElementById("settings-gemini-key").value;
      const sensitivity = parseInt(slider.value, 10) / 100;

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geminiApiKey, duplicateThreshold: sensitivity })
      });
      const data = await res.json();
      if (data.success) {
        showToast("Settings updated successfully!", "success");
      }
    });
  }

  // 8. Initialize Sub-modules
  initClaimFiling(showToast, switchTab);
  initClaimsList();
  initManagerApproval(showToast);
  initFinanceDashboard(showToast);

  // Subscribe to changes
  state.subscribe((type) => {
    if (type === "USER_CHANGED" || type === "CLAIMS_UPDATED" || type === "ANALYTICS_UPDATED" || type === "INITIALIZED" || type === "DATA_RESET") {
      updateRoleBanner();
    }
  });

  updateRoleBanner();
}

// Start application reliably whether DOM is loading or already interactive/complete
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}
