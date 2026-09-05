# server_py/services/duplicate_service.py
"""
Intelligent fuzzy duplicate detection engine for ClaimFlow AI (Python).
Catches exact duplicates and fuzzy duplicates (different days, slight typos, altered merchant names).
"""

import re
from datetime import datetime
from typing import Dict, List, Optional, Any

BRAND_ALIASES = [
    {"canonical": "swiggy", "tokens": ["swiggy", "swigy"]},
    {"canonical": "zomato", "tokens": ["zomato", "zomato online"]},
    {"canonical": "uber", "tokens": ["uber", "uber india", "uber trip", "uber rides"]},
    {"canonical": "ola", "tokens": ["ola", "ola cabs", "ani technologies"]},
    {"canonical": "blue tokai", "tokens": ["blue tokai", "blue tokai coffee", "btcr"]},
    {"canonical": "starbucks", "tokens": ["starbucks", "tata starbucks"]},
    {"canonical": "amazon", "tokens": ["amazon", "amazon in", "cloudtail", "appario"]},
    {"canonical": "aws", "tokens": ["aws", "amazon web services", "aws emea"]},
    {"canonical": "indigo", "tokens": ["indigo", "interglobe aviation"]},
    {"canonical": "taj", "tokens": ["taj", "ihcl", "taj lands end", "taj hotel"]}
]

def normalize_string(s: str) -> str:
    if not s:
        return ""
    clean = re.sub(r"[^\w\s]", " ", s.lower())
    return re.sub(r"\s+", " ", clean).strip()

def get_canonical_merchant(name: str) -> str:
    norm = normalize_string(name)
    for alias in BRAND_ALIASES:
        if any(token in norm for token in alias["tokens"]):
            return alias["canonical"]
    return norm

def token_jaccard_similarity(s1: str, s2: str) -> float:
    tokens1 = set(w for w in normalize_string(s1).split(" ") if len(w) > 2)
    tokens2 = set(w for w in normalize_string(s2).split(" ") if len(w) > 2)
    if not tokens1 and not tokens2:
        return 1.0
    if not tokens1 or not tokens2:
        return 0.0
    intersection = len(tokens1.intersection(tokens2))
    union = len(tokens1.union(tokens2))
    return intersection / union if union > 0 else 0.0

def levenshtein_similarity(s1: str, s2: str) -> float:
    a = normalize_string(s1)
    b = normalize_string(s2)
    if a == b:
        return 1.0
    if not a or not b:
        return 0.0

    len_a = len(a)
    len_b = len(b)
    matrix = [[0] * (len_b + 1) for _ in range(len_a + 1)]

    for i in range(len_a + 1):
        matrix[i][0] = i
    for j in range(len_b + 1):
        matrix[0][j] = j

    for i in range(1, len_a + 1):
        for j in range(1, len_b + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            matrix[i][j] = min(
                matrix[i - 1][j] + 1,       # deletion
                matrix[i][j - 1] + 1,       # insertion
                matrix[i - 1][j - 1] + cost # substitution
            )

    dist = matrix[len_a][len_b]
    max_len = max(len_a, len_b)
    return 1.0 - (dist / max_len)

def get_days_difference(d1_str: str, d2_str: str) -> int:
    if not d1_str or not d2_str:
        return 999
    try:
        dt1 = datetime.strptime(d1_str[:10], "%Y-%m-%d")
        dt2 = datetime.strptime(d2_str[:10], "%Y-%m-%d")
        return abs((dt2 - dt1).days)
    except Exception:
        return 999

def check_duplicate_claim(
    candidate: Dict[str, Any],
    existing_claims: List[Dict[str, Any]],
    current_claim_id: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    if not candidate or not existing_claims:
        return None

    try:
        target_amount = float(candidate.get("amount", 0))
    except (ValueError, TypeError):
        return None

    if target_amount <= 0:
        return None

    target_merchant = candidate.get("merchant", "") or ""
    target_date = candidate.get("date", "") or ""
    target_text = candidate.get("rawReceiptText") or candidate.get("description") or ""
    target_canonical = get_canonical_merchant(target_merchant)

    highest_score = 0.0
    best_match = None

    for existing in existing_claims:
        if current_claim_id and existing.get("id") == current_claim_id:
            continue
        if existing.get("status") == "rejected":
            continue

        existing_amount = float(existing.get("amount", 0))
        existing_merchant = existing.get("merchant", "") or ""
        existing_date = existing.get("date", "") or ""
        existing_text = existing.get("rawReceiptText") or existing.get("description") or ""
        existing_canonical = get_canonical_merchant(existing_merchant)

        match_score = 0.0
        reasons = []

        # 1. Amount match
        diff_ratio = abs(target_amount - existing_amount) / max(target_amount, existing_amount, 1.0)
        if target_amount == existing_amount:
            match_score += 0.40
            reasons.append(f"Identical amount (₹{target_amount:,.2f})")
        elif diff_ratio <= 0.02:
            match_score += 0.30
            reasons.append(f"Nearly identical amount (₹{target_amount} vs ₹{existing_amount})")

        # 2. Merchant match
        canonical_match = target_canonical and existing_canonical and (target_canonical == existing_canonical)
        lev = levenshtein_similarity(target_merchant, existing_merchant)
        jaccard = token_jaccard_similarity(target_merchant, existing_merchant)

        if canonical_match:
            match_score += 0.35
            reasons.append(f"Matching vendor brand ('{existing_merchant}')")
        elif lev > 0.65 or jaccard > 0.50:
            match_score += 0.25
            reasons.append(f"Similar vendor name ('{existing_merchant}')")

        # 3. Date match / proximity
        days = get_days_difference(target_date, existing_date)
        if days == 0:
            match_score += 0.25
            reasons.append(f"Same transaction date ({target_date})")
        elif days <= 3:
            match_score += 0.15
            reasons.append(f"Dates within {days} days ({target_date} vs {existing_date})")
        elif days <= 35:
            match_score += 0.10
            reasons.append(f"Transaction occurred within {days} days of previous claim")

        # 4. Text overlap bonus
        if target_text and existing_text:
            text_sim = token_jaccard_similarity(target_text, existing_text)
            if text_sim > 0.40:
                match_score += 0.15
                reasons.append(f"Significant receipt description overlap ({int(text_sim * 100)}% match)")

        final_score = min(0.99, round(match_score, 2))

        if final_score >= 0.65 and final_score > highest_score:
            highest_score = final_score
            best_match = {
                "isDuplicate": True,
                "confidence": final_score,
                "matchedClaimId": existing.get("id"),
                "matchedUser": existing.get("userName"),
                "matchedMerchant": existing.get("merchant"),
                "matchedAmount": existing.get("amount"),
                "matchedDate": existing.get("date"),
                "matchedStatus": existing.get("status"),
                "matchedRawText": existing.get("rawReceiptText") or existing.get("description"),
                "reasons": reasons,
                "reason": (
                    f"Potential duplicate ({int(final_score * 100)}% match) with Claim #{existing.get('id')} "
                    f"({existing.get('merchant')}, ₹{existing.get('amount'):,.2f}) filed on {existing.get('date')}. "
                    f"Status: {existing.get('status', '').upper()}."
                )
            }

    return best_match
