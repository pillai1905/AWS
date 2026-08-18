from fastapi import APIRouter, Query
from typing import List, Optional
from app.repositories import get_db

router = APIRouter(prefix="/transactions", tags=["Transactions"])

@router.get("")
def get_transactions(
    product_id: Optional[str] = Query(None, description="Filter by Product ID"),
    transaction_type: Optional[str] = Query(None, description="Filter by transaction type (STOCK_IN, STOCK_OUT, ADJUSTMENT)"),
    start_date: Optional[str] = Query(None, description="Filter transactions starting from this ISO timestamp (inclusive)"),
    end_date: Optional[str] = Query(None, description="Filter transactions up to this ISO timestamp (inclusive)")
):
    db = get_db()
    return db.get_transactions(
        product_id=product_id,
        transaction_type=transaction_type,
        start_date=start_date,
        end_date=end_date
    )

@router.post("/export-to-s3")
def export_to_s3():
    from fastapi import HTTPException
    db = get_db()
    # Check if the current database implementation supports S3 export
    if not hasattr(db, "export_transactions_to_s3"):
        return {
            "success": False,
            "message": "S3 exports are not available in Local JSON mode. Switch to AWS mode to enable S3 backups."
        }
    try:
        res = db.export_transactions_to_s3()
        return res
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"S3 Upload Error: {str(e)}"
        )
