# server_py/services/ai_extractor.py
"""
Dual-engine AI receipt parser for ClaimFlow AI (Python):
Google Gemini API (google-genai SDK) + High-Precision Heuristic NLP Regex Engine.
"""

import os
import re
import json
from datetime import datetime
from typing import Dict, Any, Optional

try:
    from google import genai
    from google.genai import types
    HAS_GENAI_LIB = True
except ImportError:
    HAS_GENAI_LIB = False

KNOWN_MERCHANTS = [
    {"name": "Blue Tokai Coffee Roasters", "regex": re.compile(r"blue\s*tokai", re.IGNORECASE), "category": "meals_dining"},
    {"name": "Starbucks Coffee", "regex": re.compile(r"starbucks", re.IGNORECASE), "category": "meals_dining"},
    {"name": "Swiggy - Food Delivery", "regex": re.compile(r"swiggy", re.IGNORECASE), "category": "meals_dining"},
    {"name": "Zomato", "regex": re.compile(r"zomato", re.IGNORECASE), "category": "meals_dining"},
    {"name": "Meghana Foods", "regex": re.compile(r"meghana", re.IGNORECASE), "category": "meals_dining"},
    {"name": "Auto Rickshaw Koramangala", "regex": re.compile(r"auto\s*(?:meter|rickshaw)?", re.IGNORECASE), "category": "travel_taxi"},
    {"name": "Uber Rides", "regex": re.compile(r"uber", re.IGNORECASE), "category": "travel_taxi"},
    {"name": "Ola Cabs", "regex": re.compile(r"ola(?:\s*cabs)?", re.IGNORECASE), "category": "travel_taxi"},
    {"name": "Amazon India", "regex": re.compile(r"amazon(?:\.in)?", re.IGNORECASE), "category": "supplies_office"},
    {"name": "Amazon Web Services (AWS)", "regex": re.compile(r"aws|amazon\s*web\s*services", re.IGNORECASE), "category": "software_cloud"},
    {"name": "Google Cloud Platform", "regex": re.compile(r"google\s*cloud|gcp", re.IGNORECASE), "category": "software_cloud"},
    {"name": "GitHub Enterprise", "regex": re.compile(r"github", re.IGNORECASE), "category": "software_cloud"},
    {"name": "The Taj Hotel", "regex": re.compile(r"taj\s*(?:lands\s*end|hotel|mahal)?", re.IGNORECASE), "category": "hotel_lodging"},
    {"name": "Marriott Hotels", "regex": re.compile(r"marriott", re.IGNORECASE), "category": "hotel_lodging"},
    {"name": "IndiGo Airlines", "regex": re.compile(r"indigo", re.IGNORECASE), "category": "travel_taxi"}
]

def extract_with_heuristics(raw_text: str) -> Dict[str, Any]:
    text = (raw_text or "").strip()
    lower = text.lower()

    # 1. Currency
    currency = "INR"
    if "$" in text or "usd" in lower:
        currency = "USD"
    elif "€" in text or "eur" in lower:
        currency = "EUR"
    elif "£" in text or "gbp" in lower:
        currency = "GBP"

    # 2. Amount
    amount = 0.0
    amount_patterns = [
        re.compile(r"(?:total|bill|spent|amount|charges?)\s*(?:is|of|:)?\s*(?:rs\.?|inr|₹|\$|€|£)?\s*([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE),
        re.compile(r"(?:rs\.?|inr|₹|\$|€|£)\s*([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE),
        re.compile(r"([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|rupees?|bucks?)", re.IGNORECASE),
        re.compile(r"(\d+)\s*(?:\+|plus)\s*(\d+)", re.IGNORECASE)  # "180 + 20 tip total 200"
    ]

    for p in amount_patterns:
        m = p.search(text)
        if m:
            if len(m.groups()) == 2 and m.group(2) and "plus" in p.pattern:
                amount = float(m.group(1)) + float(m.group(2))
                break
            else:
                num_str = m.group(1).replace(",", "")
                try:
                    val = float(num_str)
                    if val > 0:
                        amount = val
                        break
                except ValueError:
                    pass

    if amount == 0.0:
        candidates = re.findall(r"\b\d+(?:\.\d{2})?\b", text)
        clean_nums = []
        for c in candidates:
            try:
                v = float(c)
                if 10 < v < 500000 and v not in (2024, 2025, 2026):
                    clean_nums.append(v)
            except ValueError:
                pass
        if clean_nums:
            amount = max(clean_nums)

    # 3. Merchant & Category
    merchant = "Unknown Vendor"
    detected_category = "supplies_office"

    for km in KNOWN_MERCHANTS:
        if km["regex"].search(text):
            merchant = km["name"]
            detected_category = km["category"]
            break

    if merchant == "Unknown Vendor":
        first_line = text.split("\n")[0].strip()
        if 3 < len(first_line) < 40 and not first_line[0].isdigit():
            merchant = first_line
        else:
            bm = re.search(r"(?:at|from|vendor|merchant|to)\s+([A-Za-z0-9\s&'-]{3,30})", text, re.IGNORECASE)
            if bm:
                merchant = bm.group(1).strip()

    if detected_category == "supplies_office":
        if any(w in lower for w in ["coffee", "lunch", "dinner", "food", "restaurant", "biryani", "snack", "breakfast", "meal"]):
            detected_category = "meals_dining"
        elif any(w in lower for w in ["auto", "taxi", "cab", "ride", "fare", "toll", "flight", "metro"]):
            detected_category = "travel_taxi"
        elif any(w in lower for w in ["cloud", "hosting", "server", "domain", "license", "saas", "ec2", "subscription"]):
            detected_category = "software_cloud"
        elif any(w in lower for w in ["hotel", "stay", "room", "resort", "lodging"]):
            detected_category = "hotel_lodging"

    # 4. Date
    date = datetime.now().strftime("%Y-%m-%d")
    date_matches = [
        re.search(r"(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})", text),
        re.search(r"(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{2,4})", text, re.IGNORECASE),
        re.search(r"([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})", text, re.IGNORECASE)
    ]
    for dm in date_matches:
        if dm:
            try:
                dt = datetime.strptime(dm.group(0), "%d/%m/%Y")
                date = dt.strftime("%Y-%m-%d")
                break
            except Exception:
                try:
                    dt = datetime.strptime(dm.group(0), "%d-%b-%Y")
                    date = dt.strftime("%Y-%m-%d")
                    break
                except Exception:
                    pass

    # 5. Line items
    extracted_items = []
    lines = [l.strip() for l in re.split(r"[\n,;]", text) if l.strip()]
    for line in lines:
        im = re.match(r"^([A-Za-z0-9\s\-]+?)\s*(?:[-:]|\b)\s*(?:rs\.?|₹|\$|€)?\s*([\d,]+(?:\.\d{2})?)$", line, re.IGNORECASE)
        if im and len(extracted_items) < 5:
            try:
                extracted_items.append({
                    "name": im.group(1).strip(),
                    "amount": float(im.group(2).replace(",", ""))
                })
            except ValueError:
                pass

    if not extracted_items and amount > 0:
        extracted_items.append({
            "name": f"{merchant} Charge" if merchant != "Unknown Vendor" else "Itemized Expense",
            "amount": amount
        })

    confidence = 0.94 if merchant != "Unknown Vendor" and amount > 0 else 0.72

    return {
        "merchant": merchant,
        "amount": amount,
        "currency": currency,
        "category": detected_category,
        "date": date,
        "description": text[:247] + "..." if len(text) > 250 else text,
        "confidenceScore": confidence,
        "extractedItems": extracted_items
    }

async def extract_receipt_data(
    raw_text: str = "",
    image_bytes: Optional[bytes] = None,
    mime_type: Optional[str] = None,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    effective_key = api_key or os.environ.get("GEMINI_API_KEY")

    if not effective_key or not HAS_GENAI_LIB:
        return extract_with_heuristics(raw_text or "Receipt uploaded")

    try:
        client = genai.Client(api_key=effective_key)
        prompt = (
            "You are an expert expense claim extraction AI for ClaimFlow AI.\n"
            "Analyze the provided receipt text or image and extract structured data.\n"
            "Return ONLY a valid JSON object with this exact schema:\n"
            "{\n"
            '  "merchant": "Vendor / Store / Service Name",\n'
            '  "amount": 200.00,\n'
            '  "currency": "INR",\n'
            '  "category": "travel_taxi",\n'
            '  "date": "YYYY-MM-DD",\n'
            '  "description": "Short 1-line clear description of what was purchased",\n'
            '  "confidenceScore": 0.98,\n'
            '  "extractedItems": [{"name": "Item description", "amount": 100.00}]\n'
            "}\n"
            f"Receipt text:\n{raw_text or 'See attached image'}"
        )

        contents = [prompt]
        if image_bytes and mime_type:
            contents.append(
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
            )

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents
        )

        clean_json = response.text.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(clean_json)

        return {
            "merchant": parsed.get("merchant", "Unknown Vendor"),
            "amount": float(parsed.get("amount", 0.0)),
            "currency": parsed.get("currency", "INR"),
            "category": parsed.get("category", "supplies_office"),
            "date": parsed.get("date", datetime.now().strftime("%Y-%m-%d")),
            "description": parsed.get("description", raw_text or "Expense Claim"),
            "confidenceScore": float(parsed.get("confidenceScore", 0.95)),
            "extractedItems": parsed.get("extractedItems", [])
        }
    except Exception as e:
        print(f"Gemini API fallback to heuristics: {e}")
        return extract_with_heuristics(raw_text)
