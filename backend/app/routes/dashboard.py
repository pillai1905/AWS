from fastapi import APIRouter
from app.repositories import get_db

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary")
def get_dashboard_summary():
    db = get_db()
    products = db.get_products()
    
    total_products = len(products)
    total_inventory = sum(float(p["current_stock"]) for p in products)
    
    low_stock_count = 0
    critical_stock_count = 0
    
    for p in products:
        stock = float(p["current_stock"])
        reorder = float(p["reorder_level"])
        if stock == 0:
            critical_stock_count += 1
        elif stock <= reorder:
            low_stock_count += 1
            
    recent_transactions = db.get_transactions()[:10]  # Get last 10 transactions
    
    return {
        "total_products": total_products,
        "total_inventory": total_inventory,
        "low_stock_count": low_stock_count,
        "critical_stock_count": critical_stock_count,
        "recent_transactions": recent_transactions
    }
