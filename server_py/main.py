# server_py/main.py
"""
ClaimFlow AI - FastAPI Backend
Provides REST endpoints for receipt parsing, fuzzy duplicate detection,
role-based approval chains, and month-end finance analytics.
"""

import os
import copy
import random
from datetime import datetime
from typing import Optional, List

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from server_py.data.seed_data import INITIAL_USERS, EXPENSE_CATEGORIES, INITIAL_CLAIMS
from server_py.services.duplicate_service import check_duplicate_claim
from server_py.services.ai_extractor import extract_receipt_data, extract_with_heuristics
from server_py.models.schemas import (
    ClaimCreate, ClaimUpdate, ApprovalRequest, RejectionRequest,
    DuplicateCheckRequest, SettingsUpdateRequest
)

app = FastAPI(
    title="ClaimFlow AI - Expense Claims Engine",
    description="Intelligent expense management API with Gemini AI receipt parsing, fuzzy duplicate detection, and finance workflows.",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store initialized with deep copy of seed data
users = copy.deepcopy(INITIAL_USERS)
categories = copy.deepcopy(EXPENSE_CATEGORIES)
claims = copy.deepcopy(INITIAL_CLAIMS)

system_settings = {
    "geminiApiKey": os.environ.get("GEMINI_API_KEY", ""),
    "companyName": "Acme Corp International",
    "defaultCurrency": "INR",
    "autoFlagDuplicates": True,
    "duplicateThreshold": 0.65
}

# ==============================================================================
# Health & Settings
# ==============================================================================

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "ClaimFlow AI (Python/FastAPI)",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/users")
def get_users():
    return {"success": True, "users": users}

@app.get("/api/categories")
def get_categories():
    return {"success": True, "categories": categories}

@app.get("/api/settings")
def get_settings():
    return {
        "success": True,
        "settings": {
            **system_settings,
            "hasCustomApiKey": bool(system_settings["geminiApiKey"])
        }
    }

@app.post("/api/settings")
def update_settings(payload: SettingsUpdateRequest):
    if payload.geminiApiKey is not None:
        system_settings["geminiApiKey"] = payload.geminiApiKey.strip()
    if payload.duplicateThreshold is not None:
        system_settings["duplicateThreshold"] = payload.duplicateThreshold
    return {"success": True, "message": "Settings updated successfully"}

# ==============================================================================
# Claims Endpoints
# ==============================================================================

@app.get("/api/claims")
def get_claims(
    userId: Optional[str] = Query(None),
    approverId: Optional[str] = Query(None),
    status: Optional[str] = Query(None)
):
    filtered = list(claims)
    if userId:
        filtered = [c for c in filtered if c.get("userId") == userId]
    if approverId:
        filtered = [c for c in filtered if c.get("approverId") == approverId]
    if status and status != "all":
        filtered = [c for c in filtered if c.get("status") == status]

    # Sort descending by date
    filtered.sort(key=lambda x: x.get("submittedAt") or x.get("date") or "", reverse=True)
    return {"success": True, "claims": filtered, "total": len(filtered)}

@app.get("/api/claims/{claim_id}")
def get_claim(claim_id: str):
    claim = next((c for c in claims if c.get("id") == claim_id), None)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return {"success": True, "claim": claim}

@app.post("/api/claims", status_code=201)
def create_claim(payload: ClaimCreate):
    user = next((u for u in users if u.get("id") == payload.userId), None)
    if not user:
        raise HTTPException(status_code=400, detail="Valid User ID is required")

    if not payload.merchant or payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Merchant and positive amount are required")

    now = datetime.now().isoformat()
    today_str = datetime.now().strftime("%Y-%m-%d")

    is_manager = (user.get("role") == "manager")
    approver_id = user.get("managerId") or "usr_ananya_iyer"
    approver = next((u for u in users if u.get("id") == approver_id), None)

    # Check for duplicates
    candidate = {
        "merchant": payload.merchant,
        "amount": payload.amount,
        "currency": payload.currency,
        "date": payload.date or today_str,
        "description": payload.description,
        "rawReceiptText": payload.rawReceiptText
    }
    duplicate_flag = check_duplicate_claim(candidate, claims)

    claim_id = f"CLM-{datetime.now().year}-{random.randint(1000, 9999)}"

    extracted_items = [item.model_dump() for item in payload.extractedItems] if payload.extractedItems else [{"name": payload.merchant, "amount": payload.amount}]

    new_claim = {
        "id": claim_id,
        "userId": user["id"],
        "userName": user["name"],
        "userRole": user["role"],
        "department": user["department"],
        "merchant": payload.merchant.strip(),
        "amount": payload.amount,
        "currency": payload.currency or "INR",
        "category": payload.category or "supplies_office",
        "date": payload.date or today_str,
        "description": payload.description or payload.rawReceiptText or "Expense claim",
        "rawReceiptText": payload.rawReceiptText or "",
        "receiptImageUrl": payload.receiptImageUrl,
        "status": "submitted",
        "approverId": approver_id,
        "approverName": approver["name"] if approver else "Senior Approver",
        "submittedAt": now,
        "approvedAt": None,
        "paidAt": None,
        "payoutRef": None,
        "confidenceScore": payload.confidenceScore or 0.95,
        "selfApprovalBlocked": is_manager,
        "selfApprovalNote": (
            f"{user['name']} is a manager. Self-approval is strictly prohibited. Routed to {approver['name'] if approver else 'Senior Approver'}."
            if is_manager else None
        ),
        "extractedItems": extracted_items,
        "duplicateFlag": duplicate_flag,
        "timeline": [
            {"action": "Claim filed via ClaimFlow AI (Python)", "by": user["name"], "at": now}
        ]
    }

    if is_manager:
        new_claim["timeline"].append({
            "action": f"Anti-Self-Approval Rule: Blocked self sign-off, assigned to {approver['name'] if approver else 'Executive'}",
            "by": "System Policy",
            "at": now
        })

    if duplicate_flag:
        new_claim["timeline"].append({
            "action": f"Duplicate Alert: {duplicate_flag['reason']}",
            "by": "AI Duplicate Engine",
            "at": now
        })

    claims.insert(0, new_claim)

    return {
        "success": True,
        "claim": new_claim,
        "duplicateWarning": duplicate_flag.get("reason") if duplicate_flag else None
    }

@app.put("/api/claims/{claim_id}")
def update_claim(claim_id: str, payload: ClaimUpdate):
    claim = next((c for c in claims if c.get("id") == claim_id), None)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    # IMMUTABLE PAID STATE RULE
    if claim.get("status") == "paid":
        raise HTTPException(
            status_code=400,
            detail="This claim has already been paid out and is finalized. Paid claims are immutable and cannot go backwards or be edited."
        )

    if payload.merchant:
        claim["merchant"] = payload.merchant
    if payload.amount is not None and payload.amount > 0:
        claim["amount"] = payload.amount
    if payload.category:
        claim["category"] = payload.category
    if payload.date:
        claim["date"] = payload.date
    if payload.description:
        claim["description"] = payload.description
    if payload.extractedItems is not None:
        claim["extractedItems"] = [item.model_dump() for item in payload.extractedItems]

    claim["timeline"].append({
        "action": "Claim details updated by employee",
        "by": claim["userName"],
        "at": datetime.now().isoformat()
    })

    claim["duplicateFlag"] = check_duplicate_claim(claim, claims, claim["id"])
    return {"success": True, "claim": claim}

# ==============================================================================
# Approvals & Anti-Self-Approval Rule
# ==============================================================================

@app.post("/api/claims/{claim_id}/approve")
def approve_claim(claim_id: str, payload: ApprovalRequest):
    claim = next((c for c in claims if c.get("id") == claim_id), None)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if claim.get("status") == "paid":
        raise HTTPException(status_code=400, detail="This claim is already PAID and immutable.")

    # ANTI-SELF-APPROVAL RULE: A manager cannot approve their own claim!
    if payload.approverId and claim.get("userId") == payload.approverId:
        raise HTTPException(
            status_code=403,
            detail="Policy Violation: Managers cannot sign off on their own expense claims. This claim must be signed off by senior management."
        )

    approver = next((u for u in users if u.get("id") == payload.approverId), None)
    now = datetime.now().isoformat()

    claim["status"] = "approved"
    claim["approvedAt"] = now
    claim["approverId"] = payload.approverId
    claim["approverName"] = approver["name"] if approver else "Manager"

    claim["timeline"].append({
        "action": "Claim approved & signed off",
        "by": approver["name"] if approver else "Manager",
        "at": now
    })

    return {"success": True, "claim": claim, "message": "Claim approved successfully"}

@app.post("/api/claims/{claim_id}/reject")
def reject_claim(claim_id: str, payload: RejectionRequest):
    claim = next((c for c in claims if c.get("id") == claim_id), None)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if claim.get("status") == "paid":
        raise HTTPException(status_code=400, detail="This claim is already PAID. A paid claim cannot be rejected or reversed.")

    if payload.approverId and claim.get("userId") == payload.approverId:
        raise HTTPException(status_code=403, detail="You cannot reject your own claim.")

    approver = next((u for u in users if u.get("id") == payload.approverId), None)
    claim["status"] = "rejected"
    claim["rejectionReason"] = payload.reason or "Claim rejected by reviewer"

    claim["timeline"].append({
        "action": f"Claim rejected: {claim['rejectionReason']}",
        "by": approver["name"] if approver else "Reviewer",
        "at": datetime.now().isoformat()
    })

    return {"success": True, "claim": claim, "message": "Claim rejected"}

# ==============================================================================
# Finance Payouts (Single & Batch)
# ==============================================================================

@app.post("/api/claims/{claim_id}/pay")
def pay_claim(claim_id: str):
    claim = next((c for c in claims if c.get("id") == claim_id), None)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if claim.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Claim is already paid.")

    now = datetime.now().isoformat()
    txn_ref = f"TXN-IMPS-{datetime.now().year}-{random.randint(10000, 99999)}-PAID"

    claim["status"] = "paid"
    claim["paidAt"] = now
    claim["payoutRef"] = txn_ref

    claim["timeline"].append({
        "action": f"Emulated Payout Completed (Ref: {txn_ref}). Claim is finalized & locked.",
        "by": "Ananya Iyer (Finance)",
        "at": now
    })

    return {
        "success": True,
        "claim": claim,
        "message": f"Payout of ₹{claim['amount']:,.2f} completed. Reference: {txn_ref}"
    }

@app.post("/api/claims/batch-pay")
def batch_pay_claims():
    approved = [c for c in claims if c.get("status") == "approved"]
    if not approved:
        raise HTTPException(status_code=400, detail="No approved claims available for payout.")

    now = datetime.now().isoformat()
    batch_id = f"BATCH-{datetime.now().year}-{random.randint(1000, 9999)}"
    total_paid = 0.0

    for c in approved:
        txn_ref = f"TXN-IMPS-{datetime.now().year}-{random.randint(10000, 99999)}-PAID"
        c["status"] = "paid"
        c["paidAt"] = now
        c["payoutRef"] = txn_ref
        c["batchId"] = batch_id
        total_paid += float(c.get("amount", 0.0))

        c["timeline"].append({
            "action": f"Batch Payout Processed (Batch {batch_id}, Ref: {txn_ref}). Finalized & locked.",
            "by": "Ananya Iyer (Finance)",
            "at": now
        })

    return {
        "success": True,
        "batchId": batch_id,
        "paidCount": len(approved),
        "totalAmount": total_paid,
        "message": f"Successfully processed batch payout of ₹{total_paid:,.2f} across {len(approved)} claims."
    }

# ==============================================================================
# AI Extraction & Duplicate Checking
# ==============================================================================

@app.post("/api/extract-receipt")
async def extract_receipt(
    rawText: Optional[str] = Form(None),
    receiptImage: Optional[UploadFile] = File(None)
):
    try:
        image_bytes = None
        mime_type = None

        if receiptImage:
            image_bytes = await receiptImage.read()
            mime_type = receiptImage.content_type

        extracted = await extract_receipt_data(
            raw_text=rawText or "",
            image_bytes=image_bytes,
            mime_type=mime_type,
            api_key=system_settings.get("geminiApiKey")
        )

        dup_check = check_duplicate_claim(extracted, claims)

        return {
            "success": True,
            "extracted": extracted,
            "duplicateWarning": dup_check
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

@app.post("/api/check-duplicate")
def check_duplicate_endpoint(payload: DuplicateCheckRequest):
    candidate = {
        "merchant": payload.merchant,
        "amount": payload.amount,
        "date": payload.date,
        "rawReceiptText": payload.rawReceiptText
    }
    dup = check_duplicate_claim(candidate, claims, payload.currentClaimId)
    return {"success": True, "duplicate": dup}

# ==============================================================================
# Finance Month-End Spend & Limit Analytics
# ==============================================================================

@app.get("/api/analytics/finance")
def finance_analytics():
    total_spent = 0.0
    total_paid = 0.0
    total_pending = 0.0
    total_approved = 0.0

    category_map = {
        cat["id"]: {**cat, "total": 0.0, "count": 0}
        for cat in categories
    }

    user_map = {
        u["id"]: {
            "user": u,
            "totalClaimed": 0.0,
            "totalPaid": 0.0,
            "claimsCount": 0,
            "limit": float(u.get("monthlyLimit", 25000))
        }
        for u in users
    }

    for c in claims:
        if c.get("status") == "rejected":
            continue

        amt = float(c.get("amount", 0.0))
        total_spent += amt

        status = c.get("status")
        if status == "paid":
            total_paid += amt
        elif status == "submitted":
            total_pending += amt
        elif status == "approved":
            total_approved += amt

        cat_id = c.get("category")
        if cat_id in category_map:
            category_map[cat_id]["total"] += amt
            category_map[cat_id]["count"] += 1

        uid = c.get("userId")
        if uid in user_map:
            user_map[uid]["totalClaimed"] += amt
            if status == "paid":
                user_map[uid]["totalPaid"] += amt
            user_map[uid]["claimsCount"] += 1

    limit_report = []
    for item in user_map.values():
        limit = item["limit"]
        pct = round((item["totalClaimed"] / limit) * 100, 1) if limit > 0 else 0.0
        limit_report.append({
            **item,
            "percentUsed": pct,
            "isNearLimit": 80.0 <= pct <= 100.0,
            "isOverLimit": pct > 100.0
        })

    over_limit = [e for e in limit_report if e["isOverLimit"]]
    near_limit = [e for e in limit_report if e["isNearLimit"]]

    return {
        "success": True,
        "summary": {
            "totalClaimsCount": len(claims),
            "totalSpent": total_spent,
            "totalPaid": total_paid,
            "totalPendingApproval": total_pending,
            "totalApprovedUnpaid": total_approved,
            "overLimitCount": len(over_limit),
            "nearLimitCount": len(near_limit)
        },
        "categorySpend": list(category_map.values()),
        "employeeLimitReport": limit_report,
        "overLimitEmployees": over_limit,
        "nearLimitEmployees": near_limit
    }

@app.post("/api/reset-data")
def reset_data():
    global users, categories, claims
    users = copy.deepcopy(INITIAL_USERS)
    categories = copy.deepcopy(EXPENSE_CATEGORIES)
    claims = copy.deepcopy(INITIAL_CLAIMS)
    return {"success": True, "message": "Reset database back to realistic showcase seed data."}

# ==============================================================================
# Static Frontend Serving
# ==============================================================================

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")

if os.path.exists(PUBLIC_DIR):
    app.mount("/css", StaticFiles(directory=os.path.join(PUBLIC_DIR, "css")), name="css")
    app.mount("/js", StaticFiles(directory=os.path.join(PUBLIC_DIR, "js")), name="js")

    @app.get("/")
    def serve_frontend_root():
        return FileResponse(os.path.join(PUBLIC_DIR, "index.html"))

    @app.get("/{full_path:path}")
    def serve_frontend_fallback(full_path: str):
        target = os.path.join(PUBLIC_DIR, full_path)
        if os.path.exists(target) and os.path.isfile(target):
            return FileResponse(target)
        return FileResponse(os.path.join(PUBLIC_DIR, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server_py.main:app", host="0.0.0.0", port=3000, reload=True)
