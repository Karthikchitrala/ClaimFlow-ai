# test/test_api_py.py
"""
Automated Verification Suite for ClaimFlow AI Python Backend
"""

import sys
import os
import requests

if sys.platform == "win32":
    os.environ["PYTHONIOENCODING"] = "utf-8"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from server_py.main import app

client = TestClient(app)

def run_tests():
    print("==================================================")
    print("Testing ClaimFlow AI Python/FastAPI Backend")
    print("==================================================\n")

    passed = 0
    failed = 0

    def assert_test(name: str, condition: bool, details: str = ""):
        nonlocal passed, failed
        if condition:
            print(f"  [PASS] {name}")
            passed += 1
        else:
            print(f"  [FAIL] {name} -> {details}")
            failed += 1

    try:
        # 1. Health check
        r = client.get("/api/health")
        assert_test("Health Check", r.status_code == 200 and r.json().get("status") == "healthy")

        # 2. Realistic Users Seeded
        r = client.get("/api/users")
        users = r.json().get("users", [])
        assert_test("Realistic Users Seeded", r.status_code == 200 and len(users) >= 5)

        # 3. AI Receipt Extraction from messy text
        extract_payload = {
            "rawText": "Auto meter 180 + 20 tip total 200rs cash koramangala to indiranagar 14/08"
        }
        r = client.post("/api/extract-receipt", data=extract_payload)
        extracted = r.json().get("extracted", {})
        assert_test(
            "AI Extraction - Messy Auto Ride",
            r.status_code == 200 and extracted.get("amount") == 200 and extracted.get("category") == "travel_taxi",
            f"Got amount: {extracted.get('amount')}, category: {extracted.get('category')}"
        )

        # 4. Fuzzy Duplicate Detection
        dup_payload = {
            "merchant": "Swiggy India (Meghana Foods)",
            "amount": 3240,
            "date": "2026-08-14",
            "rawReceiptText": "Swiggy receipt Meghana Biryani food delivery 3240 rs"
        }
        r = client.post("/api/check-duplicate", json=dup_payload)
        dup = r.json().get("duplicate")
        assert_test(
            "Fuzzy Duplicate Detection",
            r.status_code == 200 and dup is not None and dup.get("isDuplicate") is True,
            str(dup)
        )

        # 5. Anti-Self-Approval Rule: Manager cannot approve own claim
        self_approve_payload = {"approverId": "usr_vikram_malhotra"}
        r = client.post("/api/claims/CLM-2026-0819-AWS/approve", json=self_approve_payload)
        assert_test(
            "Anti-Self-Approval Rule (Manager Blocked with 403)",
            r.status_code == 403,
            f"Expected 403, got {r.status_code}: {r.text}"
        )

        # 6. Immutable Paid Claim Rule: Paid claim cannot be altered
        edit_paid_payload = {"amount": 1500, "description": "Modifying paid claim"}
        r = client.put("/api/claims/CLM-2026-0804", json=edit_paid_payload)
        assert_test(
            "Immutable Paid Claim Rule (Blocked with 400)",
            r.status_code == 400,
            f"Expected 400, got {r.status_code}: {r.text}"
        )

        # 7. Finance Analytics & Monthly Limit Tracking
        r = client.get("/api/analytics/finance")
        report = r.json().get("employeeLimitReport", [])
        priya = next((e for e in report if e["user"]["id"] == "usr_priya_sharma"), None)
        assert_test(
            "Finance Analytics - Limit Tracking",
            r.status_code == 200 and priya is not None and priya["percentUsed"] > 90.0,
            f"Priya percent used: {priya.get('percentUsed') if priya else 'None'}%"
        )

        # 8. Finance Single Payout Emulation
        r = client.post("/api/claims/CLM-2026-0820/pay")
        claim = r.json().get("claim", {})
        assert_test(
            "Finance Single Payout Emulation",
            r.status_code == 200 and claim.get("status") == "paid" and str(claim.get("payoutRef", "")).startswith("TXN-IMPS-"),
            str(claim)
        )

        # 9. Domino's Pizza Thermal Bill Extraction
        dominos_payload = {
            "rawText": (
                "Domino's Pizza F] TAX INVOICE 2 H ili, H LULUDIL ANT FOODWORKS LTD 7\n"
                "COLES ROAD, COX TOWN BANGALORE-05 State Code: (29) $9060316978\n"
                "Invoice Number: 66103/20/44492 Order: 159\n"
                "11/01/2020 7:56 PM Internet O\n"
                "1 Reg HT PM Capsicum (Gk) 99.00\n"
                "1 Reg HT PM Onion (Gi) 99.00\n"
                "1 Reg HT PM Gold Corn (Gj) 199.00\n"
                "1 Reg HT PM Gold Corn (Gj) 199.00\n"
                "Total 603.3"
            )
        }
        r = client.post("/api/extract-receipt", data=dominos_payload)
        d_extracted = r.json().get("extracted", {})
        assert_test(
            "Domino's Pizza Thermal Bill Extraction",
            (
                r.status_code == 200
                and d_extracted.get("amount") == 603.3
                and d_extracted.get("currency") == "INR"
                and d_extracted.get("date") == "2020-01-11"
                and len(d_extracted.get("extractedItems", [])) == 4
            ),
            f"Got: amount={d_extracted.get('amount')}, currency={d_extracted.get('currency')}, date={d_extracted.get('date')}, items={len(d_extracted.get('extractedItems', []))}"
        )

        print("\n==================================================")
        print(f"Results: {passed} passed, {failed} failed")
        print("==================================================")
        sys.exit(0 if failed == 0 else 1)

    except Exception as e:
        print(f"Test run failed with exception: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
