// public/js/state.js
// Centralized state manager & API client for ClaimFlow AI

class StateStore {
  constructor() {
    this.users = [];
    this.currentUser = null;
    this.claims = [];
    this.categories = [];
    this.analytics = null;
    this.activeFilter = "all";
    this.currentCandidateClaim = null;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(changeType, payload) {
    for (const listener of this.listeners) {
      listener(changeType, payload, this);
    }
  }

  setCurrentUser(userId) {
    const found = this.users.find(u => u.id === userId);
    if (found) {
      this.currentUser = found;
      this.notify("USER_CHANGED", this.currentUser);
    }
  }

  // ==========================================
  // API Calls
  // ==========================================

  async init() {
    await Promise.all([
      this.loadUsers(),
      this.loadCategories(),
      this.loadClaims(),
      this.loadAnalytics()
    ]);
    if (!this.currentUser && this.users.length > 0) {
      this.currentUser = this.users[0]; // Priya Sharma by default
    }
    this.notify("INITIALIZED", null);
  }

  async loadUsers() {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success) {
        this.users = data.users;
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  }

  async loadCategories() {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (data.success) {
        this.categories = data.categories;
      }
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }

  async loadClaims() {
    try {
      const res = await fetch("/api/claims");
      const data = await res.json();
      if (data.success) {
        this.claims = data.claims;
        this.notify("CLAIMS_UPDATED", this.claims);
      }
    } catch (err) {
      console.error("Failed to load claims:", err);
    }
  }

  async loadAnalytics() {
    try {
      const res = await fetch("/api/analytics/finance");
      const data = await res.json();
      if (data.success) {
        this.analytics = data;
        this.notify("ANALYTICS_UPDATED", this.analytics);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    }
  }

  async extractReceipt(rawText, file = null) {
    const formData = new FormData();
    if (rawText) formData.append("rawText", rawText);
    if (file) formData.append("receiptImage", file);

    const res = await fetch("/api/extract-receipt", {
      method: "POST",
      body: formData
    });
    return await res.json();
  }

  async checkDuplicate(claimData) {
    const res = await fetch("/api/check-duplicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(claimData)
    });
    return await res.json();
  }

  async submitNewClaim(claimData) {
    const res = await fetch("/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...claimData,
        userId: this.currentUser.id
      })
    });
    const result = await res.json();
    if (result.success) {
      await Promise.all([this.loadClaims(), this.loadAnalytics()]);
    }
    return result;
  }

  async approveClaim(claimId) {
    const res = await fetch(`/api/claims/${claimId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approverId: this.currentUser.id })
    });
    const result = await res.json();
    if (result.success) {
      await Promise.all([this.loadClaims(), this.loadAnalytics()]);
    }
    return result;
  }

  async rejectClaim(claimId, reason) {
    const res = await fetch(`/api/claims/${claimId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approverId: this.currentUser.id, reason })
    });
    const result = await res.json();
    if (result.success) {
      await Promise.all([this.loadClaims(), this.loadAnalytics()]);
    }
    return result;
  }

  async payClaim(claimId) {
    const res = await fetch(`/api/claims/${claimId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const result = await res.json();
    if (result.success) {
      await Promise.all([this.loadClaims(), this.loadAnalytics()]);
    }
    return result;
  }

  async batchPay() {
    const res = await fetch("/api/claims/batch-pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const result = await res.json();
    if (result.success) {
      await Promise.all([this.loadClaims(), this.loadAnalytics()]);
    }
    return result;
  }

  async resetData() {
    const res = await fetch("/api/reset-data", { method: "POST" });
    const result = await res.json();
    if (result.success) {
      await Promise.all([this.loadUsers(), this.loadClaims(), this.loadAnalytics()]);
      this.notify("DATA_RESET", null);
    }
    return result;
  }
}

export const state = new StateStore();
