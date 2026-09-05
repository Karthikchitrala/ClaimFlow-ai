// server/services/aiExtractor.js
// Dual-engine AI receipt parser: Google Gemini API + Heuristic Regex/NLP Engine

import { GoogleGenAI } from "@google/genai";

/**
 * Heuristic NLP Extractor
 * Parses raw messy text, SMS notifications, and invoice snippets into structured claim data.
 */
export function extractWithHeuristics(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return {
      merchant: "Expense Item",
      amount: 0,
      currency: "INR",
      category: "supplies_office",
      date: new Date().toISOString().split("T")[0],
      description: "",
      confidenceScore: 0.5,
      extractedItems: []
    };
  }

  const text = rawText.trim();
  const lower = text.toLowerCase();

  // 1. Currency Extraction
  let currency = "INR";
  if (text.includes("$") || lower.includes("usd")) {
    currency = "USD";
  } else if (text.includes("€") || lower.includes("eur")) {
    currency = "EUR";
  } else if (text.includes("£") || lower.includes("gbp")) {
    currency = "GBP";
  }

  // 2. Amount Extraction
  // Look for total patterns: "total: rs 200", "total 200rs", "rs 850.00", "₹11,850", "$142.50", "3,240 rs"
  let amount = 0;
  const amountPatterns = [
    /(?:total|bill|spent|amount|charges?|charges?|charges?)\s*(?:is|of|:)?\s*(?:rs\.?|inr|₹|\$|€|£)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:rs\.?|inr|₹|\$|€|£)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|rupees?|bucks?)/i,
    /(\d+)\s*(?:\+|plus)\s*(\d+)/i // like "180 + 20 tip total 200"
  ];

  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[2] && pattern.source.includes("plus")) {
        amount = parseFloat(match[1]) + parseFloat(match[2]);
      } else {
        const cleanNum = match[1].replace(/,/g, "");
        const parsed = parseFloat(cleanNum);
        if (!isNaN(parsed) && parsed > 0) {
          amount = parsed;
          break;
        }
      }
    }
  }

  // Fallback: look for largest number that isn't a year or phone/order number
  if (!amount) {
    const allNums = text.match(/\b\d+(?:\.\d{2})?\b/g);
    if (allNums) {
      const candidates = allNums
        .map(n => parseFloat(n))
        .filter(n => n > 10 && n < 500000 && n !== 2024 && n !== 2025 && n !== 2026);
      if (candidates.length > 0) {
        amount = Math.max(...candidates);
      }
    }
  }

  // 3. Merchant Detection
  let merchant = "Unknown Vendor";
  const knownMerchants = [
    { name: "Domino's Pizza (Jubilant FoodWorks)", regex: /domino'?s|jubilant\s*foodworks/i, category: "meals_dining" },
    { name: "Blue Tokai Coffee Roasters", regex: /blue\s*tokai/i, category: "meals_dining" },
    { name: "Starbucks Coffee", regex: /starbucks/i, category: "meals_dining" },
    { name: "Swiggy - Food Delivery", regex: /swiggy/i, category: "meals_dining" },
    { name: "Zomato", regex: /zomato/i, category: "meals_dining" },
    { name: "Meghana Foods", regex: /meghana/i, category: "meals_dining" },
    { name: "Auto Rickshaw Koramangala", regex: /auto\s*(?:meter|rickshaw)?/i, category: "travel_taxi" },
    { name: "Uber Rides", regex: /uber/i, category: "travel_taxi" },
    { name: "Ola Cabs", regex: /ola(?:\s*cabs)?/i, category: "travel_taxi" },
    { name: "Amazon India", regex: /amazon(?:\.in)?/i, category: "supplies_office" },
    { name: "Amazon Web Services (AWS)", regex: /aws|amazon\s*web\s*services/i, category: "software_cloud" },
    { name: "Google Cloud Platform", regex: /google\s*cloud|gcp/i, category: "software_cloud" },
    { name: "GitHub Enterprise", regex: /github/i, category: "software_cloud" },
    { name: "The Taj Hotel", regex: /taj\s*(?:lands\s*end|hotel|mahal)?/i, category: "hotel_lodging" },
    { name: "Marriott Hotels", regex: /marriott/i, category: "hotel_lodging" },
    { name: "IndiGo Airlines", regex: /indigo/i, category: "travel_taxi" }
  ];

  let detectedCategory = "supplies_office";
  for (const km of knownMerchants) {
    if (km.regex.test(text)) {
      merchant = km.name;
      detectedCategory = km.category;
      break;
    }
  }

  // If no known merchant, try capturing starting line or capitalized brand
  if (merchant === "Unknown Vendor") {
    const firstLine = text.split("\n")[0].trim();
    if (firstLine.length > 3 && firstLine.length < 40 && !firstLine.match(/^\d/)) {
      merchant = firstLine;
    } else {
      const brandMatch = text.match(/(?:at|from|vendor|merchant|to)\s+([A-Za-z0-9\s&'-]{3,30})/i);
      if (brandMatch) {
        merchant = brandMatch[1].trim();
      }
    }
  }

  // Category heuristics if not already determined
  if (detectedCategory === "supplies_office") {
    if (lower.includes("coffee") || lower.includes("lunch") || lower.includes("dinner") || lower.includes("food") || lower.includes("restaurant") || lower.includes("biryani") || lower.includes("snack") || lower.includes("breakfast") || lower.includes("meal")) {
      detectedCategory = "meals_dining";
    } else if (lower.includes("auto") || lower.includes("taxi") || lower.includes("cab") || lower.includes("ride") || lower.includes("fare") || lower.includes("toll") || lower.includes("flight") || lower.includes("metro")) {
      detectedCategory = "travel_taxi";
    } else if (lower.includes("cloud") || lower.includes("hosting") || lower.includes("server") || lower.includes("domain") || lower.includes("license") || lower.includes("saas") || lower.includes("ec2") || lower.includes("subscription")) {
      detectedCategory = "software_cloud";
    } else if (lower.includes("hotel") || lower.includes("stay") || lower.includes("room") || lower.includes("resort") || lower.includes("lodging")) {
      detectedCategory = "hotel_lodging";
    }
  }

  // 4. Date Extraction
  let date = new Date().toISOString().split("T")[0];
  const datePatterns = [
    /\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-]((?:19|20)\d{2})\b/, // 11/01/2020
    /\b(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s]((?:19|20)\d{2})\b/i, // 14-Aug-2026
    /\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+((?:19|20)\d{2})\b/i // Aug 14, 2026
  ];

  for (const dp of datePatterns) {
    const match = text.match(dp);
    if (match) {
      const parts = match[0].split(/[\/\.-]/);
      if (parts.length === 3) {
        // Handle DD/MM/YYYY or MM/DD/YYYY
        let d = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10);
        let y = parseInt(parts[2], 10);
        if (m > 12 && d <= 12) {
          [d, m] = [m, d];
        }
        if (y < 100) y += 2000;
        const mm = String(m).padStart(2, "0");
        const dd = String(d).padStart(2, "0");
        date = `${y}-${mm}-${dd}`;
        break;
      }
    }
  }

  // 5. Line items extraction
  const extractedItems = [];
  const lines = text.split(/[\n,;]/).map(l => l.trim()).filter(Boolean);
  const noiseTokens = ["order", "phone", "invoice", "server", "code", "tent", "due", "balance", "carry out", "total", "subtot"];
  for (const line of lines) {
    const itemMatch = line.match(/^([A-Za-z0-9\s\-\(\)\/\@\%]+?)\s*(?:[-:]|\b)\s*(?:rs\.?|₹|\$|€)?\s*([\d,]+(?:\.\d{2})?)$/i);
    if (itemMatch && extractedItems.length < 6) {
      const itemName = itemMatch[1].trim();
      const itemAmt = parseFloat(itemMatch[2].replace(/,/g, ""));
      if (itemAmt > 0 && itemAmt <= 50000 && !noiseTokens.some(k => itemName.toLowerCase().includes(k))) {
        extractedItems.push({
          name: itemName,
          amount: itemAmt
        });
      }
    }
  }

  if (extractedItems.length === 0 && amount > 0) {
    extractedItems.push({
      name: merchant !== "Unknown Vendor" ? `${merchant} Charge` : "Itemized Expense",
      amount: amount
    });
  }

  const confidenceScore = merchant !== "Unknown Vendor" && amount > 0 ? 0.94 : 0.72;

  return {
    merchant,
    amount,
    currency,
    category: detectedCategory,
    date,
    description: text.length > 250 ? text.substring(0, 247) + "..." : text,
    confidenceScore,
    extractedItems
  };
}

/**
 * AI Extractor using Google Gemini API (with seamless heuristic fallback)
 */
export async function extractReceiptData({ rawText, imageBase64, mimeType, apiKey }) {
  const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;

  // If no Gemini API key, use instant heuristic NLP engine
  if (!effectiveApiKey) {
    return extractWithHeuristics(rawText || "Receipt uploaded");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: effectiveApiKey });

    const prompt = `You are an expert expense claim extraction AI for ClaimFlow AI.
Analyze the provided receipt text or image and extract structured data.
Return ONLY a valid JSON object (no markdown code blocks, no backticks, no explanatory text) with this exact schema:
{
  "merchant": "Vendor / Store / Service Name",
  "amount": 200.00,
  "currency": "INR",
  "category": "travel_taxi", // Choose one of: travel_taxi, meals_dining, software_cloud, supplies_office, hotel_lodging
  "date": "YYYY-MM-DD",
  "description": "Short 1-line clear description of what was purchased",
  "confidenceScore": 0.98,
  "extractedItems": [
    { "name": "Item description", "amount": 100.00 }
  ]
}

Receipt text:
${rawText || "See attached image"}`;

    let contents;
    if (imageBase64 && mimeType) {
      contents = [
        prompt,
        {
          inlineData: {
            mimeType: mimeType,
            data: imageBase64
          }
        }
      ];
    } else {
      contents = prompt;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents
    });

    const responseText = response.text ? response.text.trim() : "";
    const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    return {
      merchant: parsed.merchant || "Unknown Vendor",
      amount: typeof parsed.amount === "number" ? parsed.amount : parseFloat(parsed.amount) || 0,
      currency: parsed.currency || "INR",
      category: parsed.category || "supplies_office",
      date: parsed.date || new Date().toISOString().split("T")[0],
      description: parsed.description || rawText || "Expense Claim",
      confidenceScore: typeof parsed.confidenceScore === "number" ? parsed.confidenceScore : 0.95,
      extractedItems: Array.isArray(parsed.extractedItems) ? parsed.extractedItems : []
    };
  } catch (err) {
    console.warn("Gemini API extraction failed or was unavailable, using heuristic fallback:", err.message);
    return extractWithHeuristics(rawText);
  }
}
