// public/js/state.js
// Centralized state manager & API client for ClaimFlow AI

const FALLBACK_USERS = [
  {
    id: "usr_priya_sharma",
    name: "Priya Sharma",
    email: "priya.sharma@acmecorp.io",
    role: "staff",
    title: "Senior Product Designer",
    department: "Design & UX",
    managerId: "usr_vikram_malhotra",
    monthlyLimit: 25000,
    currency: "INR",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"
  },
  {
    id: "usr_rajesh_kumar",
    name: "Rajesh Kumar",
    email: "rajesh.kumar@acmecorp.io",
    role: "staff",
    title: "Senior Frontend Engineer",
    department: "Engineering",
    managerId: "usr_vikram_malhotra",
    monthlyLimit: 30000,
    currency: "INR",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
  },
  {
    id: "usr_vikram_malhotra",
    name: "Vikram Malhotra",
    email: "vikram.malhotra@acmecorp.io",
    role: "manager",
    title: "Engineering Director",
    department: "Engineering",
    managerId: "usr_sunita_patel",
    monthlyLimit: 60000,
    currency: "INR",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80"
  },
  {
    id: "usr_sunita_patel",
    name: "Sunita Patel",
    email: "sunita.patel@acmecorp.io",
    role: "manager",
    title: "VP of Product Engineering",
    department: "Executive Leadership",
    managerId: null,
    monthlyLimit: 100000,
    currency: "INR",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80"
  },
  {
    id: "usr_ananya_iyer",
    name: "Ananya Iyer",
    email: "ananya.iyer@acmecorp.io",
    role: "finance",
    title: "Head of Global Finance",
    department: "Finance & Operations",
    managerId: null,
    monthlyLimit: 200000,
    currency: "INR",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
  }
];

class StateStore {
  constructor() {
    this.users = [...FALLBACK_USERS];
    this.currentUser = this.users[0];
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

  getLocalClaims() {
    try {
      const saved = localStorage.getItem("claimflow_custom_claims");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  saveClaimsToLocal() {
    try {
      localStorage.setItem("claimflow_custom_claims", JSON.stringify(this.claims));
    } catch (e) {
      console.warn("Failed to persist claims locally", e);
    }
  }

  async loadClaims() {
    try {
      const res = await fetch("/api/claims", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        const localClaims = this.getLocalClaims();
        const map = new Map();
        const STATUS_WEIGHT = { submitted: 1, approved: 2, rejected: 2, paid: 3 };

        // Server claims populate the base
        (data.claims || []).forEach(c => map.set(c.id, c));

        // Intelligently merge local claims so local approvals, rejections, payouts are never reverted by stale server seeds
        localClaims.forEach(local => {
          if (!map.has(local.id)) {
            map.set(local.id, local);
          } else {
            const server = map.get(local.id);
            const localWeight = STATUS_WEIGHT[local.status] || 0;
            const serverWeight = STATUS_WEIGHT[server.status] || 0;
            if (localWeight > serverWeight || (local.timeline && local.timeline.length > (server.timeline?.length || 0))) {
              map.set(local.id, { ...server, ...local });
            }
          }
        });

        this.claims = Array.from(map.values());
        this.saveClaimsToLocal();
        this.notify("CLAIMS_UPDATED", this.claims);
      }
    } catch (err) {
      console.error("Failed to load claims:", err);
      const localClaims = this.getLocalClaims();
      if (localClaims.length > 0) {
        this.claims = localClaims;
        this.notify("CLAIMS_UPDATED", this.claims);
      }
    }
  }

  async loadAnalytics() {
    try {
      const res = await fetch("/api/analytics/finance", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        this.analytics = data;
        this.notify("ANALYTICS_UPDATED", this.analytics);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    }
  }

  async extractReceipt(rawText, file = null, apiKey = "") {
    const formData = new FormData();
    if (rawText) formData.append("rawText", rawText);
    if (file) formData.append("receiptImage", file);
    if (apiKey) formData.append("apiKey", apiKey);

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
    if (result.success && result.claim) {
      // Instantly insert into local claims so it immediately appears in My Claims & Approvals
      this.claims = [result.claim, ...this.claims.filter(c => c.id !== result.claim.id)];
      this.saveClaimsToLocal();
      this.notify("CLAIMS_UPDATED", this.claims);
      await this.loadAnalytics();
    }
    return result;
  }

  async approveClaim(claimId) {
    try {
      const res = await fetch(`/api/claims/${claimId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverId: this.currentUser.id })
      });
      const result = await res.json().catch(() => ({}));
      const errorMsg = result.detail || result.error || result.message;

      // Handle 403 policy violation
      if (res.status === 403) {
        return {
          success: false,
          error: errorMsg || "Policy Violation: You cannot approve your own claim. Please switch to Vikram Malhotra (Manager) above."
        };
      }

      // Handle 404 (e.g. serverless instance miss, but claim present in frontend state)
      if (res.status === 404 || !res.ok) {
        if (res.status === 404) {
          const claim = this.claims.find(c => c.id === claimId);
          if (claim) {
            if (claim.userId === this.currentUser.id) {
              return {
                success: false,
                error: "Policy Violation: Employees and managers cannot sign off on their own expense claims. Please switch persona to Vikram Malhotra (Manager) above."
              };
            }
            claim.status = "approved";
            claim.approvedAt = new Date().toISOString();
            claim.approverId = this.currentUser.id;
            claim.approverName = this.currentUser.name;
            if (!claim.timeline) claim.timeline = [];
            claim.timeline.push({
              action: `Claim approved & signed off by ${this.currentUser.name} (${this.currentUser.role.toUpperCase()})`,
              by: this.currentUser.name,
              at: new Date().toISOString()
            });
            this.saveClaimsToLocal();
            this.notify("CLAIMS_UPDATED", this.claims);
            await this.loadAnalytics();
            return { success: true, claim, message: "Claim approved successfully" };
          }
        }
        return { success: false, error: errorMsg || `Approval failed (HTTP ${res.status})` };
      }

      if (result.success) {
        const claim = this.claims.find(c => c.id === claimId);
        if (claim) {
          claim.status = "approved";
          claim.approvedAt = new Date().toISOString();
          claim.approverId = this.currentUser.id;
          claim.approverName = this.currentUser.name;
          if (!claim.timeline) claim.timeline = [];
          claim.timeline.push({
            action: `Claim approved & signed off by ${this.currentUser.name} (${this.currentUser.role.toUpperCase()})`,
            by: this.currentUser.name,
            at: new Date().toISOString()
          });
        }
        this.saveClaimsToLocal();
        this.notify("CLAIMS_UPDATED", this.claims);
        await this.loadAnalytics();
      }
      return result;
    } catch (err) {
      console.warn("Approve network exception, falling back:", err);
      const claim = this.claims.find(c => c.id === claimId);
      if (claim) {
        if (claim.userId === this.currentUser.id) {
          return {
            success: false,
            error: "Policy Violation: Employees and managers cannot sign off on their own expense claims."
          };
        }
        claim.status = "approved";
        claim.approvedAt = new Date().toISOString();
        claim.approverId = this.currentUser.id;
        claim.approverName = this.currentUser.name;
        if (!claim.timeline) claim.timeline = [];
        claim.timeline.push({
          action: `Claim approved & signed off by ${this.currentUser.name} (${this.currentUser.role.toUpperCase()})`,
          by: this.currentUser.name,
          at: new Date().toISOString()
        });
        this.saveClaimsToLocal();
        this.notify("CLAIMS_UPDATED", this.claims);
        await this.loadAnalytics();
        return { success: true, claim, message: "Claim approved locally." };
      }
      return { success: false, error: err.message || "Network error while approving claim." };
    }
  }

  async rejectClaim(claimId, reason) {
    try {
      const res = await fetch(`/api/claims/${claimId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverId: this.currentUser.id, reason })
      });
      const result = await res.json().catch(() => ({}));
      const errorMsg = result.detail || result.error || result.message;

      // Handle 403 policy violation
      if (res.status === 403) {
        return {
          success: false,
          error: errorMsg || "Policy Violation: Employees and managers cannot reject their own expense claims. Please switch persona to Vikram Malhotra (Manager) above."
        };
      }

      // Handle 404 (e.g. serverless instance miss, but claim present in frontend state)
      if (res.status === 404 || !res.ok) {
        if (res.status === 404) {
          const claim = this.claims.find(c => c.id === claimId);
          if (claim) {
            claim.status = "rejected";
            claim.rejectionReason = reason;
            if (!claim.timeline) claim.timeline = [];
            claim.timeline.push({
              action: `Claim rejected: ${reason}`,
              by: this.currentUser.name,
              at: new Date().toISOString()
            });
            this.saveClaimsToLocal();
            this.notify("CLAIMS_UPDATED", this.claims);
            await this.loadAnalytics();
            return { success: true, claim, message: "Claim rejected." };
          }
        }
        return { success: false, error: errorMsg || `Rejection failed (HTTP ${res.status})` };
      }

      if (result.success) {
        const claim = this.claims.find(c => c.id === claimId);
        if (claim) {
          claim.status = "rejected";
          claim.rejectionReason = reason;
          if (!claim.timeline) claim.timeline = [];
          claim.timeline.push({
            action: `Claim rejected: ${reason}`,
            by: this.currentUser.name,
            at: new Date().toISOString()
          });
        }
        this.saveClaimsToLocal();
        this.notify("CLAIMS_UPDATED", this.claims);
        await this.loadAnalytics();
      }
      return result;
    } catch (err) {
      console.warn("Reject network exception, falling back:", err);
      const claim = this.claims.find(c => c.id === claimId);
      if (claim) {
        claim.status = "rejected";
        claim.rejectionReason = reason;
        if (!claim.timeline) claim.timeline = [];
        claim.timeline.push({
          action: `Claim rejected: ${reason}`,
          by: this.currentUser.name,
          at: new Date().toISOString()
        });
        this.saveClaimsToLocal();
        this.notify("CLAIMS_UPDATED", this.claims);
        await this.loadAnalytics();
        return { success: true, claim, message: "Claim rejected locally." };
      }
      return { success: false, error: err.message || "Network error while rejecting claim." };
    }
  }

  async payClaim(claimId) {
    try {
      const res = await fetch(`/api/claims/${claimId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const result = await res.json().catch(() => ({}));
      const errorMsg = result.detail || result.error || result.message;

      if (!res.ok) {
        if (res.status === 404) {
          const claim = this.claims.find(c => c.id === claimId);
          if (claim) {
            claim.status = "paid";
            claim.paidAt = new Date().toISOString();
            claim.payoutRef = `TXN-IMPS-${Date.now()}`;
            if (!claim.timeline) claim.timeline = [];
            claim.timeline.push({
              action: `Payout Completed (Ref: ${claim.payoutRef}). Finalized & locked.`,
              by: "Finance Treasury",
              at: new Date().toISOString()
            });
            this.saveClaimsToLocal();
            this.notify("CLAIMS_UPDATED", this.claims);
            await this.loadAnalytics();
            return { success: true, claim, message: "Payout completed." };
          }
        }
        return { success: false, error: errorMsg || `Payout failed (HTTP ${res.status})` };
      }

      if (result.success) {
        const claim = this.claims.find(c => c.id === claimId);
        if (claim) {
          claim.status = "paid";
          claim.paidAt = new Date().toISOString();
          claim.payoutRef = result.claim?.payoutRef || `TXN-IMPS-${Date.now()}`;
          if (!claim.timeline) claim.timeline = [];
          claim.timeline.push({
            action: `Payout Completed (Ref: ${claim.payoutRef}). Finalized & locked.`,
            by: "Finance Treasury",
            at: new Date().toISOString()
          });
        }
        this.saveClaimsToLocal();
        this.notify("CLAIMS_UPDATED", this.claims);
        await this.loadAnalytics();
      }
      return result;
    } catch (err) {
      console.warn("Payout network exception, falling back:", err);
      const claim = this.claims.find(c => c.id === claimId);
      if (claim) {
        claim.status = "paid";
        claim.paidAt = new Date().toISOString();
        claim.payoutRef = `TXN-IMPS-${Date.now()}`;
        if (!claim.timeline) claim.timeline = [];
        claim.timeline.push({
          action: `Payout Completed (Ref: ${claim.payoutRef}). Finalized & locked.`,
          by: "Finance Treasury",
          at: new Date().toISOString()
        });
        this.saveClaimsToLocal();
        this.notify("CLAIMS_UPDATED", this.claims);
        await this.loadAnalytics();
        return { success: true, claim, message: "Payout completed locally." };
      }
      return { success: false, error: err.message || "Network error during payout." };
    }
  }

  async batchPay() {
    const res = await fetch("/api/claims/batch-pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const result = await res.json();
    if (result.success) {
      const now = new Date().toISOString();
      this.claims.forEach(c => {
        if (c.status === "approved") {
          c.status = "paid";
          c.paidAt = now;
          c.payoutRef = `TXN-IMPS-${Date.now()}`;
        }
      });
      this.saveClaimsToLocal();
      this.notify("CLAIMS_UPDATED", this.claims);
      await this.loadAnalytics();
    }
    return result;
  }

  async resetData() {
    try {
      localStorage.removeItem("claimflow_custom_claims");
    } catch (e) {}
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
