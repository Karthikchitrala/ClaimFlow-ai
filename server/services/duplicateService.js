// server/services/duplicateService.js
// Intelligent fuzzy duplicate detection engine for ClaimFlow AI

/**
 * Normalizes text for comparison: lowercases, strips special characters, removes noise words
 */
function normalizeString(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Common merchant aliases and brand normalizations
 */
const BRAND_ALIASES = [
  { canonical: "swiggy", tokens: ["swiggy", "swigy"] },
  { canonical: "zomato", tokens: ["zomato", "zomato online"] },
  { canonical: "uber", tokens: ["uber", "uber india", "uber trip", "uber rides"] },
  { canonical: "ola", tokens: ["ola", "ola cabs", "ani technologies"] },
  { canonical: "blue tokai", tokens: ["blue tokai", "blue tokai coffee", "btcr"] },
  { canonical: "starbucks", tokens: ["starbucks", "tata starbucks"] },
  { canonical: "amazon", tokens: ["amazon", "amazon in", "cloudtail", "appario"] },
  { canonical: "aws", tokens: ["aws", "amazon web services", "aws emea"] },
  { canonical: "indigo", tokens: ["indigo", "interglobe aviation"] },
  { canonical: "taj", tokens: ["taj", "ihcl", "taj lands end", "taj hotel"] }
];

function getCanonicalMerchant(name) {
  const norm = normalizeString(name);
  for (const alias of BRAND_ALIASES) {
    if (alias.tokens.some(token => norm.includes(token))) {
      return alias.canonical;
    }
  }
  return norm;
}

/**
 * Token Jaccard similarity (0 to 1)
 */
function tokenJaccardSimilarity(str1, str2) {
  const set1 = new Set(normalizeString(str1).split(" ").filter(w => w.length > 2));
  const set2 = new Set(normalizeString(str2).split(" ").filter(w => w.length > 2));
  if (set1.size === 0 && set2.size === 0) return 1.0;
  if (set1.size === 0 || set2.size === 0) return 0.0;

  let intersection = 0;
  for (const item of set1) {
    if (set2.has(item)) intersection++;
  }
  const union = new Set([...set1, ...set2]).size;
  return intersection / union;
}

/**
 * Levenshtein distance based similarity (0 to 1)
 */
function levenshteinSimilarity(s1, s2) {
  const a = normalizeString(s1);
  const b = normalizeString(s2);
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  const distance = matrix[b.length][a.length];
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
}

/**
 * Difference in days between two date strings (YYYY-MM-DD)
 */
function getDaysDifference(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return 999;
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 999;
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check a candidate claim against all existing claims in database
 * Returns duplicate flag details or null if safe.
 */
export function checkDuplicateClaim(newClaim, existingClaims, currentClaimId = null) {
  if (!newClaim || !Array.isArray(existingClaims)) return null;

  const targetAmount = parseFloat(newClaim.amount);
  if (isNaN(targetAmount) || targetAmount <= 0) return null;

  const targetMerchant = newClaim.merchant || "";
  const targetDate = newClaim.date || "";
  const targetText = newClaim.rawReceiptText || newClaim.description || "";
  const targetCanonical = getCanonicalMerchant(targetMerchant);

  let bestMatch = null;
  let highestScore = 0;

  for (const existing of existingClaims) {
    // Skip self when updating an existing claim
    if (currentClaimId && existing.id === currentClaimId) continue;
    // Skip rejected claims from blocking new filings (or flag with info)
    if (existing.status === "rejected") continue;

    const existingAmount = parseFloat(existing.amount);
    const existingMerchant = existing.merchant || "";
    const existingDate = existing.date || "";
    const existingText = existing.rawReceiptText || existing.description || "";
    const existingCanonical = getCanonicalMerchant(existingMerchant);

    let matchScore = 0;
    const reasons = [];

    // 1. Amount comparison
    const amountDiffRatio = Math.abs(targetAmount - existingAmount) / Math.max(targetAmount, existingAmount);
    const exactAmountMatch = targetAmount === existingAmount;
    const closeAmountMatch = amountDiffRatio <= 0.02; // within 2%

    if (exactAmountMatch) {
      matchScore += 0.40;
      reasons.push(`Identical amount (₹${targetAmount.toLocaleString("en-IN")})`);
    } else if (closeAmountMatch) {
      matchScore += 0.30;
      reasons.push(`Nearly identical amount (₹${targetAmount} vs ₹${existingAmount})`);
    }

    // 2. Merchant comparison
    const canonicalMatch = targetCanonical && existingCanonical && (targetCanonical === existingCanonical);
    const merchantLev = levenshteinSimilarity(targetMerchant, existingMerchant);
    const merchantJaccard = tokenJaccardSimilarity(targetMerchant, existingMerchant);

    if (canonicalMatch) {
      matchScore += 0.35;
      reasons.push(`Matching vendor brand ('${existingMerchant}')`);
    } else if (merchantLev > 0.65 || merchantJaccard > 0.5) {
      matchScore += 0.25;
      reasons.push(`Similar vendor name ('${existingMerchant}')`);
    }

    // 3. Date proximity
    const daysDiff = getDaysDifference(targetDate, existingDate);
    if (daysDiff === 0) {
      matchScore += 0.25;
      reasons.push(`Same transaction date (${targetDate})`);
    } else if (daysDiff <= 3) {
      matchScore += 0.15;
      reasons.push(`Dates within ${daysDiff} days (${targetDate} vs ${existingDate})`);
    } else if (daysDiff <= 35) {
      // Re-filed 2-4 weeks later (classic delayed duplicate!)
      matchScore += 0.10;
      reasons.push(`Transaction occurred within ${daysDiff} days of previous claim`);
    }

    // 4. Raw text similarity bonus
    if (targetText && existingText) {
      const textSimilarity = tokenJaccardSimilarity(targetText, existingText);
      if (textSimilarity > 0.40) {
        matchScore += 0.15;
        reasons.push(`Significant receipt description overlap (${Math.round(textSimilarity * 100)}% match)`);
      }
    }

    // Cap at 0.99
    const finalScore = Math.min(0.99, Number(matchScore.toFixed(2)));

    if (finalScore >= 0.65 && finalScore > highestScore) {
      highestScore = finalScore;
      bestMatch = {
        isDuplicate: true,
        confidence: finalScore,
        matchedClaimId: existing.id,
        matchedUser: existing.userName,
        matchedMerchant: existing.merchant,
        matchedAmount: existing.amount,
        matchedDate: existing.date,
        matchedStatus: existing.status,
        matchedRawText: existing.rawReceiptText || existing.description,
        reasons: reasons,
        reason: `Potential duplicate (${Math.round(finalScore * 100)}% match) with Claim #${existing.id} (${existing.merchant}, ₹${existing.amount.toLocaleString("en-IN")}) filed on ${existing.date}. Status: ${existing.status.toUpperCase()}.`
      };
    }
  }

  return bestMatch;
}
