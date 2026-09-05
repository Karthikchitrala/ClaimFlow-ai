# test/test_api_py.py
"""
Automated Verification Suite for ClaimFlow AI Python Backend
"""

import sys
import os
import requests

if sys.platform == "win32":
    os.environ["PYTHONIOENCODING"] = "utf-8"

BASE_URL = "http://localhost:3000"

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
        r = requests.get(f"{BASE_URL}/api/health", timeout=5)
        assert_test("Health Check", r.status_code == 200 and r.json().get("status") == "healthy")

        # 2. Realistic Users Seeded
        r = requests.get(f"{BASE_URL}/api/users", timeout=5)
        users = r.json().get("users", [])
        assert_test("Realistic Users Seeded", r.status_code == 200 and len(users) >= 5)

        # 3. AI Receipt Extraction from messy text
        extract_payload = {
            "rawText": "Auto meter 180 + 20 tip total 200rs cash koramangala to indiranagar 14/08"
        }
        r = requests.post(f"{BASE_URL}/api/extract-receipt", data=extract_payload, timeout=5)
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
        r = requests.post(f"{BASE_URL}/api/check-duplicate", json=dup_payload, timeout=5)
        dup = r.json().get("duplicate")
        assert_test(
            "Fuzzy Duplicate Detection",
            r.status_code == 200 and dup is not None and dup.get("isDuplicate") is True,
            str(dup)
        )

        # 5. Anti-Self-Approval Rule: Manager cannot approve own claim
        self_approve_payload = {"approverId": "usr_vikram_malhotra"}
        r = requests.post(f"{BASE_URL}/api/claims/CLM-2026-0819-AWS/approve", json=self_approve_payload, timeout=5)
        assert_test(
            "Anti-Self-Approval Rule (Manager Blocked with 403)",
            r.status_code == 403,
            f"Expected 403, got {r.status_code}: {r.text}"
        )

        # 6. Immutable Paid Claim Rule: Paid claim cannot be altered
        edit_paid_payload = {"amount": 1500, "description": "Modifying paid claim"}
        r = requests.put(f"{BASE_URL}/api/claims/CLM-2026-0804", json=edit_paid_payload, timeout=5)
        assert_test(
            "Immutable Paid Claim Rule (Blocked with 400)",
            r.status_code == 400,
            f"Expected 400, got {r.status_code}: {r.text}"
        )

        # 7. Finance Analytics & Monthly Limit Tracking
        r = requests.get(f"{BASE_URL}/api/analytics/finance", timeout=5)
        report = r.json().get("employeeLimitReport", [])
        priya = next((e for e in report if e["user"]["id"] == "usr_priya_sharma"), None)
        assert_test(
            "Finance Analytics - Limit Tracking",
            r.status_code == 200 and priya is not None and priya["percentUsed"] > 90.0,
            f"Priya percent used: {priya.get('percentUsed') if priya else 'None'}%"
        )

        # 8. Finance Single Payout Emulation
        r = requests.post(f"{BASE_URL}/api/claims/CLM-2026-0820/pay", timeout=5)
        claim = r.json().get("claim", {})
        assert_test(
            "Finance Single Payout Emulation",
            r.status_code == 200 and claim.get("status") == "paid" and str(claim.get("payoutRef", "")).startswith("TXN-IMPS-"),
            str(claim)
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
