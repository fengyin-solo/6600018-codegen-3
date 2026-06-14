import uuid
import time
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.ocr_service import run_ocr
from app.models.schemas import LowConfidenceRequest, BatchCorrectionRequest, ReviewStats

router = APIRouter()

in_memory_docs = {}


@router.post("/ocr")
async def ocr_endpoint(file: UploadFile = File(...)):
    """Upload an image and run OCR."""
    content = await file.read()
    results = run_ocr(content, file.filename or "unknown")
    doc_id = str(uuid.uuid4())
    doc = {
        "id": doc_id,
        "filename": file.filename,
        "results": results,
        "timestamp": time.time(),
    }
    in_memory_docs[doc_id] = doc
    return doc


@router.get("/ocr/variants")
def get_variants():
    """Get variant character dictionary."""
    from app.services.ocr_service import VARIANT_DICT
    return VARIANT_DICT


@router.post("/ocr/search")
def search_text(query: str):
    """Search across all OCR results."""
    return {"query": query, "results": []}


@router.post("/ocr/{doc_id}/low-confidence")
def get_low_confidence(doc_id: str, request: LowConfidenceRequest):
    """Get OCR results with confidence below threshold for review."""
    doc = in_memory_docs.get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    low_conf = [
        r for r in doc["results"]
        if r["confidence"] < request.threshold
    ]
    stats = ReviewStats(
        total=len(doc["results"]),
        low_confidence=len(low_conf),
        reviewed=sum(1 for r in low_conf if r.get("reviewed")),
        remaining=sum(1 for r in low_conf if not r.get("reviewed"))
    )
    return {"results": low_conf, "stats": stats.model_dump()}


@router.post("/ocr/{doc_id}/batch-correct")
def batch_correct(doc_id: str, request: BatchCorrectionRequest):
    """Batch update corrected text and mark as reviewed."""
    doc = in_memory_docs.get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    result_map = {r["id"]: r for r in doc["results"]}
    updated = []
    for corr in request.corrections:
        r = result_map.get(corr["id"])
        if r:
            r["corrected"] = corr.get("corrected", r.get("corrected"))
            r["reviewed"] = corr.get("reviewed", True)
            updated.append(r)
    return {"updated": len(updated), "results": updated}


@router.get("/ocr/{doc_id}/stats")
def get_review_stats(doc_id: str, threshold: float = 0.9):
    """Get review progress statistics."""
    doc = in_memory_docs.get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    low_conf = [r for r in doc["results"] if r["confidence"] < threshold]
    stats = ReviewStats(
        total=len(doc["results"]),
        low_confidence=len(low_conf),
        reviewed=sum(1 for r in low_conf if r.get("reviewed")),
        remaining=sum(1 for r in low_conf if not r.get("reviewed"))
    )
    return stats.model_dump()
