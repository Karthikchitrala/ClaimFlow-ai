// server/data/seedData.js
// High-fidelity realistic seed data for ClaimFlow AI
// No dummy test1/test2 names. Includes messy receipts, duplicate submissions, and limit thresholds.

export const initialUsers = [
  {
    id: "usr_priya_sharma",
    name: "Priya Sharma",
    email: "priya.sharma@acmecorp.io",
    role: "staff", // staff, manager, finance
    title: "Senior Product Designer",
    department: "Design & UX",
    managerId: "usr_vikram_malhotra",
    monthlyLimit: 25000, // INR
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
    managerId: "usr_sunita_patel", // Routed to Sunita because Vikram cannot approve his own claims!
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
    department: "Executive",
    managerId: "usr_ananya_iyer",
    monthlyLimit: 100000,
    currency: "INR",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80"
  },
  {
    id: "usr_ananya_iyer",
    name: "Ananya Iyer",
    email: "ananya.iyer@acmecorp.io",
    role: "finance",
    title: "Head of Global Finance & Operations",
    department: "Finance & Accounting",
    managerId: null,
    monthlyLimit: 200000,
    currency: "INR",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
  }
];

export const expenseCategories = [
  { id: "travel_taxi", name: "Travel & Taxis", icon: "🚕", policyNote: "Cabs, autos, metro fares for client visits or late work" },
  { id: "meals_dining", name: "Meals & Dining", icon: "☕", policyNote: "Client dining, team lunches (capped at ₹1,500/head)" },
  { id: "software_cloud", name: "Software & Cloud", icon: "☁️", policyNote: "SaaS subscriptions, hosting & dev tool licenses" },
  { id: "supplies_office", name: "Supplies & Equipment", icon: "📦", policyNote: "Peripherals, stationery, books, work-from-home gear" },
  { id: "hotel_lodging", name: "Accommodation & Lodging", icon: "🏨", policyNote: "Approved hotel stays during offsite conferences" }
];

export const initialClaims = [
  // 1. Priya Sharma: Badly written auto-rickshaw note (Messy text, Submitted)
  {
    id: "CLM-2026-0811",
    userId: "usr_priya_sharma",
    userName: "Priya Sharma",
    userRole: "staff",
    department: "Design & UX",
    merchant: "Auto Rickshaw Koramangala",
    amount: 200,
    currency: "INR",
    category: "travel_taxi",
    date: "2026-08-14",
    description: "Auto meter 180 + 20 tip total 200rs cash koramangala to indiranagar client sprint meeting",
    rawReceiptText: "Auto meter 180 + 20 tip total 200rs cash koramangala to indiranagar 14/08",
    receiptImageUrl: null,
    status: "submitted", // draft, submitted, approved, paid, rejected
    approverId: "usr_vikram_malhotra",
    approverName: "Vikram Malhotra",
    submittedAt: "2026-08-14T18:30:00Z",
    approvedAt: null,
    paidAt: null,
    payoutRef: null,
    confidenceScore: 0.94,
    extractedItems: [
      { name: "Meter fare", amount: 180 },
      { name: "Driver night/traffic tip", amount: 20 }
    ],
    duplicateFlag: null,
    timeline: [
      { action: "Created via AI Text Paste", by: "Priya Sharma", at: "2026-08-14T18:28:10Z" },
      { action: "Submitted for Manager Approval", by: "Priya Sharma", at: "2026-08-14T18:30:00Z" }
    ]
  },

  // 2. Priya Sharma: Messy SMS receipt from Blue Tokai (Paid & Immutable!)
  {
    id: "CLM-2026-0804",
    userId: "usr_priya_sharma",
    userName: "Priya Sharma",
    userRole: "staff",
    department: "Design & UX",
    merchant: "Blue Tokai Coffee Roasters",
    amount: 850,
    currency: "INR",
    category: "meals_dining",
    date: "2026-08-04",
    description: "Coffee & breakfast meetup with Figma user testing candidates at Blue Tokai 100ft Road",
    rawReceiptText: "Axis Bank: Rs 850.00 spent at BLUE TOKAI COFFEE ROASTERS on 04-AUG-2026. Avail Bal: Rs 42,100. Txn: BTCR889211",
    receiptImageUrl: null,
    status: "paid",
    approverId: "usr_vikram_malhotra",
    approverName: "Vikram Malhotra",
    submittedAt: "2026-08-04T12:15:00Z",
    approvedAt: "2026-08-05T09:40:00Z",
    paidAt: "2026-08-10T14:22:00Z",
    payoutRef: "TXN-IMPS-2026-88129-PAID",
    confidenceScore: 0.98,
    extractedItems: [
      { name: "2x Cortado & Avocado Sourdough", amount: 850 }
    ],
    duplicateFlag: null,
    timeline: [
      { action: "Created via SMS paste", by: "Priya Sharma", at: "2026-08-04T12:10:00Z" },
      { action: "Submitted", by: "Priya Sharma", at: "2026-08-04T12:15:00Z" },
      { action: "Signed Off / Approved", by: "Vikram Malhotra", at: "2026-08-05T09:40:00Z" },
      { action: "Paid Out via IMPS Batch (Finished & Immutable)", by: "Ananya Iyer (Finance)", at: "2026-08-10T14:22:00Z" }
    ]
  },

  // 3. Priya Sharma: High-value ergonomic monitor stand & keyboard - pushed her close to her limit!
  // (Total spent this month: 200 + 850 + 22,750 = 23,800 out of 25,000 monthly limit -> 95.2%!)
  {
    id: "CLM-2026-0820",
    userId: "usr_priya_sharma",
    userName: "Priya Sharma",
    userRole: "staff",
    department: "Design & UX",
    merchant: "Amazon India (Cloudtail)",
    amount: 22750,
    currency: "INR",
    category: "supplies_office",
    date: "2026-08-18",
    description: "BenQ 4K Designer Monitor stand and Logitech MX Master mechanical keyboard for design system work",
    rawReceiptText: "Amazon.in Tax Invoice #DEL-2026-990142 Total Rs 22,750.00 incl GST 18%",
    receiptImageUrl: null,
    status: "approved", // Approved, waiting for payout!
    approverId: "usr_vikram_malhotra",
    approverName: "Vikram Malhotra",
    submittedAt: "2026-08-18T16:00:00Z",
    approvedAt: "2026-08-19T11:00:00Z",
    paidAt: null,
    payoutRef: null,
    confidenceScore: 0.96,
    extractedItems: [
      { name: "Logitech MX Master 3S + Mechanical Mini", amount: 14500 },
      { name: "Dual Arm Gas Spring Monitor Riser", amount: 8250 }
    ],
    duplicateFlag: null,
    timeline: [
      { action: "Created from Invoice", by: "Priya Sharma", at: "2026-08-18T15:45:00Z" },
      { action: "Submitted", by: "Priya Sharma", at: "2026-08-18T16:00:00Z" },
      { action: "Approved by Manager", by: "Vikram Malhotra", at: "2026-08-19T11:00:00Z" }
    ]
  },

  // 4. Rajesh Kumar: Original Swiggy Team Lunch receipt (Approved & Paid)
  {
    id: "CLM-2026-0814-SWIGGY",
    userId: "usr_rajesh_kumar",
    userName: "Rajesh Kumar",
    userRole: "staff",
    department: "Engineering",
    merchant: "Swiggy - Meghana Foods",
    amount: 3240,
    currency: "INR",
    category: "meals_dining",
    date: "2026-08-14",
    description: "Team release milestone lunch order #98124 - Biryani & starters for sprint team",
    rawReceiptText: "SWIGGY ORDER #98124 Meghana Foods Indiranagar. Items: 4x Spl Boneless Chicken Biryani, 2x Paneer 65. Total: Rs 3,240. Paid via UPI 14-Aug-2026",
    receiptImageUrl: null,
    status: "paid",
    approverId: "usr_vikram_malhotra",
    approverName: "Vikram Malhotra",
    submittedAt: "2026-08-14T14:00:00Z",
    approvedAt: "2026-08-15T10:00:00Z",
    paidAt: "2026-08-20T16:00:00Z",
    payoutRef: "TXN-IMPS-2026-90214-PAID",
    confidenceScore: 0.99,
    extractedItems: [
      { name: "4x Special Boneless Chicken Biryani", amount: 2400 },
      { name: "2x Paneer 65", amount: 640 },
      { name: "Packaging & GST", amount: 200 }
    ],
    duplicateFlag: null,
    timeline: [
      { action: "Submitted", by: "Rajesh Kumar", at: "2026-08-14T14:00:00Z" },
      { action: "Approved", by: "Vikram Malhotra", at: "2026-08-15T10:00:00Z" },
      { action: "Paid Out (Finished)", by: "Ananya Iyer", at: "2026-08-20T16:00:00Z" }
    ]
  },

  // 5. Rajesh Kumar: DUPLICATE SUBMISSION 12 DAYS LATER! (Typed slightly differently)
  // "People send the same receipt twice. Sometimes the same day, sometimes three weeks later,
  // sometimes typed slightly differently the second time."
  {
    id: "CLM-2026-0826-DUP",
    userId: "usr_rajesh_kumar",
    userName: "Rajesh Kumar",
    userRole: "staff",
    department: "Engineering",
    merchant: "Swiggy India (Meghana Foods)",
    amount: 3240,
    currency: "INR",
    category: "meals_dining",
    date: "2026-08-14",
    description: "Swiggy dine-in / delivery team lunch sprint celebration Aug 14",
    rawReceiptText: "Swiggy receipt Meghana Biryani food delivery for devs bill total 3240 rs date 14 Aug",
    receiptImageUrl: null,
    status: "submitted",
    approverId: "usr_vikram_malhotra",
    approverName: "Vikram Malhotra",
    submittedAt: "2026-08-26T09:15:00Z",
    approvedAt: null,
    paidAt: null,
    payoutRef: null,
    confidenceScore: 0.91,
    extractedItems: [
      { name: "Team food delivery", amount: 3240 }
    ],
    duplicateFlag: {
      isDuplicate: true,
      confidence: 0.96,
      matchedClaimId: "CLM-2026-0814-SWIGGY",
      matchedMerchant: "Swiggy - Meghana Foods",
      matchedAmount: 3240,
      matchedDate: "2026-08-14",
      reason: "High similarity: Same amount (₹3,240), same date (14-Aug), and matching merchant 'Swiggy Meghana Foods'. Prior claim is already PAID."
    },
    timeline: [
      { action: "Submitted (Flagged by AI Duplicate Engine)", by: "Rajesh Kumar", at: "2026-08-26T09:15:00Z" }
    ]
  },

  // 6. Vikram Malhotra (Manager filing his own claim!): AWS Cloud Compute Bill
  // "Managers spend money too, so managers file claims as well. A manager must not be able to sign off their own claim."
  {
    id: "CLM-2026-0819-AWS",
    userId: "usr_vikram_malhotra",
    userName: "Vikram Malhotra",
    userRole: "manager", // Manager filing a claim!
    department: "Engineering",
    merchant: "Amazon Web Services (AWS)",
    amount: 11850,
    currency: "INR",
    category: "software_cloud",
    date: "2026-08-19",
    description: "Emergency benchmark load testing GPU cluster EC2 instances for Q3 product demo",
    rawReceiptText: "AWS EMEA SARL / Amazon Web Services India Pvt Ltd Invoice #AWS-883190 Total: ₹11,850.00 EC2 On-Demand Instances",
    receiptImageUrl: null,
    status: "submitted",
    approverId: "usr_sunita_patel", // Automatically routed to Sunita Patel (Executive Approver)
    approverName: "Sunita Patel",
    submittedAt: "2026-08-19T17:40:00Z",
    approvedAt: null,
    paidAt: null,
    payoutRef: null,
    confidenceScore: 0.98,
    selfApprovalBlocked: true,
    selfApprovalNote: "Vikram Malhotra cannot sign off his own claim. Automatically routed to VP of Engineering (Sunita Patel).",
    extractedItems: [
      { name: "EC2 g5.xlarge GPU compute hours", amount: 9800 },
      { name: "Integrated IGST 18%", amount: 2050 }
    ],
    duplicateFlag: null,
    timeline: [
      { action: "Submitted by Manager", by: "Vikram Malhotra", at: "2026-08-19T17:40:00Z" },
      { action: "Self-Approval Guard: Blocked self sign-off, routed to Sunita Patel", by: "System Security Policy", at: "2026-08-19T17:40:01Z" }
    ]
  },

  // 7. Vikram Malhotra: Hotel stay during Mumbai client architecture review (Approved, awaiting payout)
  {
    id: "CLM-2026-0808-HOTEL",
    userId: "usr_vikram_malhotra",
    userName: "Vikram Malhotra",
    userRole: "manager",
    department: "Engineering",
    merchant: "The Taj Lands End, Mumbai",
    amount: 18500,
    currency: "INR",
    category: "hotel_lodging",
    date: "2026-08-08",
    description: "2 nights lodging for client executive steering committee meetings in Mumbai",
    rawReceiptText: "Taj Lands End Bandra Mumbai Folio #991410 Total Room Charges: Rs 18,500. Paid by Corporate Amex.",
    receiptImageUrl: null,
    status: "approved",
    approverId: "usr_sunita_patel",
    approverName: "Sunita Patel",
    submittedAt: "2026-08-08T20:00:00Z",
    approvedAt: "2026-08-09T14:30:00Z",
    paidAt: null,
    payoutRef: null,
    confidenceScore: 0.97,
    selfApprovalBlocked: true,
    selfApprovalNote: "Approved by VP Sunita Patel (not self-signed).",
    extractedItems: [
      { name: "Deluxe King Room 2 Nights", amount: 16000 },
      { name: "Luxury State Tax & CGST", amount: 2500 }
    ],
    duplicateFlag: null,
    timeline: [
      { action: "Submitted", by: "Vikram Malhotra", at: "2026-08-08T20:00:00Z" },
      { action: "Signed Off & Approved", by: "Sunita Patel", at: "2026-08-09T14:30:00Z" }
    ]
  }
];
