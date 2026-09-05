# 3 to 5 Minute Video Walkthrough Script & Guide

Use this script to record your 3–5 minute video walking through your solution, your approach, what gave you trouble, and what you referred to along the way.

---

## ⏱️ Video Structure Breakdown

| Time | Section | Screen Activity | Key Talking Points |
|---|---|---|---|
| **0:00 – 0:45** | **Introduction & Problem Approach** | Camera face visible + Home Screen (`http://localhost:3000`) | Introduce yourself, state the problem: why filing expenses is painful, and how you approached solving it from three stakeholder perspectives (Staff, Manager, Finance). |
| **0:45 – 1:45** | **AI Receipt Filing & Human Review** | "File New Claim" Tab (`Priya Sharma`) | Click messy auto ride chip (`Auto meter 180 + 20 tip total 200rs`). Show AI extraction into structured fields, itemized breakdown, and monthly limit gauge. Explain human-in-the-loop review. Submit claim. |
| **1:45 – 2:45** | **Fuzzy Duplicate Detection & Comparison** | "Team Approvals" Tab | Point out Rajesh Kumar's Swiggy duplicate claim filed 12 days later with altered wording. Click `🚨 96% Duplicate Match` to open the Side-by-Side Comparison Modal. Explain how finance avoids double payment. |
| **2:45 – 3:30** | **Manager Anti-Self-Approval Rule** | Switch persona to `Vikram Malhotra (Manager)` | Show Vikram's own AWS claim: show the `🚫 Self-Sign Off Prohibited` badge and locked approval button. Switch to `Sunita Patel` to show proper delegation. |
| **3:30 – 4:15** | **Finance Month-End Spend & Immutable Payouts** | "Finance & Spend Analytics" Tab (`Ananya Iyer`) | Show category spend breakdown and Employee Monthly Limit Tracker (Priya at 95.2% near limit). Click "Batch Pay All Approved" to simulate bank payout. Highlight that once marked PAID, the claim is permanently locked and cannot go backwards. |
| **4:15 – 5:00** | **What Gave Trouble & What We'd Do Next** | Camera face visible + GitHub / Architecture | Explain what gave trouble (e.g. fuzzy matching balance, preventing self-approval edge cases), what you referred to, and what you would build in another week (ERP sync, credit card feeds). |

---

## 🎙️ Spoken Script (Word-for-Word Guide)

### Part 1: Introduction & Approach (0:00 – 0:45)
> *"Hello! My name is [Your Name], and this is my walkthrough of ClaimFlow AI, built for the Expense Claims challenge.*  
> *When reviewing the prompt, the biggest realization was that most expense tools fail because filing a claim takes longer than the coffee cost. Employees hate filling out six fields for an auto ride, managers get caught in rubber-stamping or approving their own spending, and finance ends up paying the same receipt twice.*  
> *I designed the system around three core personas: Staff, Managers, and Finance, enforcing real-world business constraints like anti-self-approval, immutable paid states, and intelligent fuzzy duplicate screening."*

### Part 2: Effortless AI Receipt Filing (0:45 – 1:45)
> *"Let's start as Priya Sharma, a senior product designer. Instead of typing fields manually, she simply pastes whatever is on her receipt. For example, a messy note: 'Auto meter 180 + 20 tip total 200rs cash koramangala to indiranagar 14/08'.*  
> *When we click 'Extract Claim with AI', our dual-engine extractor parses the merchant, detects the ₹200 total, splits out the driver tip, sets the date, and categorizes it under Travel & Taxis.*  
> *Notice that we don't submit directly to the manager. The system presents an editable verification card so Priya can review or tweak it first. It also shows a live monthly limit impact gauge: she is currently at 95.2% of her ₹25,000 monthly allowance. Let's submit this claim."*

### Part 3: Fuzzy Duplicate Detection (1:45 – 2:45)
> *"Now let's look at one of finance's biggest headaches: duplicate receipts.*  
> *In our seed data, Rajesh Kumar previously filed a Swiggy team lunch receipt on August 14th for ₹3,240, which finance paid out. Twelve days later, he submitted the same receipt, but typed slightly differently: 'Swiggy receipt Meghana Biryani food delivery for devs bill total 3240 rs'.*  
> *Traditional exact-match systems miss this. But ClaimFlow AI's fuzzy engine analyzes canonical vendor tokens, amount tolerance, date proximity, and text similarity, flagging it with a 96% duplicate warning score.*  
> *Clicking the badge opens a Side-by-Side Comparison Modal, showing the original paid claim alongside the new candidate so the reviewer can catch double submissions immediately."*

### Part 4: The Anti-Self-Approval Rule (2:45 – 3:30)
> *"Next is a critical business rule: managers spend money too, so managers file claims as well. But a manager must not be able to sign off their own claim.*  
> *If I switch our active viewing persona to Vikram Malhotra, our Engineering Director, and check his own claim for an AWS cloud bill, you'll see a clear security badge: 'Self-Sign Off Prohibited: Delegated to Sunita Patel', and the approve button is disabled.*  
> *If an attacker attempts to bypass the UI and hit the API directly, the backend strictly rejects it with an HTTP 403 Forbidden. Only when we switch to Sunita Patel, our VP of Product Engineering, does the claim become authorized for sign-off."*

### Part 5: Finance Month-End Spend & Immutable Payouts (3:30 – 4:15)
> *"Finally, let's switch to Ananya Iyer in Finance.*  
> *At month-end, finance needs to know who spent what, under which category, and who exceeded their limit. Our analytics dashboard shows live category bars, and the Employee Monthly Allowance table immediately surfaces who is nearing their cap, like Priya Sharma at 95.2%.*  
> *When finance is ready to disburse funds, they can click 'Batch Pay All Approved'. This triggers an emulated bank transfer, generating unique IMPS transaction references.*  
> *Crucially, once a claim is paid, it enters an immutable finished state. It cannot be edited, deleted, unapproved, or moved backwards."*

### Part 6: Challenges, References, & What's Next (4:15 – 5:00)
> *"What gave me the most trouble during development was tuning the fuzzy duplicate algorithm—balancing false positives with catching legitimate duplicates sent weeks apart with altered wording. Combining canonical vendor aliases with token Jaccard overlap and date proximity gave us the ideal balance.*  
> *I referred to Google's official GenAI documentation for structured LLM extraction and modern enterprise accounting audit guidelines.*  
> *If I had another week, I would build direct ERP synchronization with QuickBooks and NetSuite, live corporate card feeds via Plaid, and a WhatsApp bot for 10-second receipt capture.*  
> *Thank you for your time and for reviewing ClaimFlow AI!"*
