from pydantic import BaseModel
from typing import List, Optional


class OCRResult(BaseModel):
    id: str
    text: str
    bbox: List[float]
    confidence: float
    corrected: Optional[str] = None
    reviewed: Optional[bool] = False


class Document(BaseModel):
    id: str
    name: str
    image_url: str
    results: List[OCRResult]
    created_at: str


class Annotation(BaseModel):
    id: str
    type: str
    bbox: List[float]
    label: str
    content: str


class LowConfidenceRequest(BaseModel):
    threshold: float = 0.9


class BatchCorrectionRequest(BaseModel):
    corrections: List[dict]


class ReviewStats(BaseModel):
    total: int
    low_confidence: int
    reviewed: int
    remaining: int
