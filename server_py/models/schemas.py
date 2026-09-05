# server_py/models/schemas.py
from pydantic import BaseModel, Field
from typing import List, Optional, Any

class ExtractedItem(BaseModel):
    name: str
    amount: float

class ClaimCreate(BaseModel):
    userId: str
    merchant: str
    amount: float
    currency: Optional[str] = "INR"
    category: Optional[str] = "supplies_office"
    date: Optional[str] = None
    description: Optional[str] = ""
    rawReceiptText: Optional[str] = ""
    receiptImageUrl: Optional[str] = None
    confidenceScore: Optional[float] = 0.95
    extractedItems: Optional[List[ExtractedItem]] = []

class ClaimUpdate(BaseModel):
    merchant: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    date: Optional[str] = None
    description: Optional[str] = None
    extractedItems: Optional[List[ExtractedItem]] = None

class ApprovalRequest(BaseModel):
    approverId: str

class RejectionRequest(BaseModel):
    approverId: str
    reason: Optional[str] = "Claim rejected by reviewer"

class DuplicateCheckRequest(BaseModel):
    merchant: str
    amount: float
    date: Optional[str] = None
    rawReceiptText: Optional[str] = ""
    currentClaimId: Optional[str] = None

class ExtractTextRequest(BaseModel):
    rawText: str

class SettingsUpdateRequest(BaseModel):
    geminiApiKey: Optional[str] = None
    duplicateThreshold: Optional[float] = None
