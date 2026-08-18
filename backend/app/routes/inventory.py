import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, status
from app.repositories import get_db
from app.schemas import TransactionRequest

router = APIRouter(prefix="/inventory", tags=["Inventory"])

@router.post("/stock-in")
def stock_in(req: TransactionRequest):
    db = get_db()
    product = db.get_product(req.product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {req.product_id} not found."
        )
        
    stock_before = float(product["current_stock"])
    stock_after = stock_before + float(req.quantity)
    
    # Update inventory
    db.update_product(req.product_id, {"current_stock": stock_after})
    
    # Write Transaction History
    tx = {
        "transaction_id": uuid.uuid4().hex,
        "product_id": req.product_id,
        "product_name": product["product_name"],
        "transaction_type": "STOCK_IN",
        "quantity": float(req.quantity),
        "stock_before": stock_before,
        "stock_after": stock_after,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    db.add_transaction(tx)
    
    return {
        "message": f"Successfully added {req.quantity} units to {product['product_name']}.",
        "transaction": tx
    }

@router.post("/stock-out")
def stock_out(req: TransactionRequest):
    db = get_db()
    product = db.get_product(req.product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {req.product_id} not found."
        )
        
    stock_before = float(product["current_stock"])
    if stock_before < req.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock. Requested: {req.quantity}, Available: {stock_before}."
        )
        
    stock_after = stock_before - float(req.quantity)
    
    # Update inventory
    db.update_product(req.product_id, {"current_stock": stock_after})
    
    # Write Transaction History
    tx = {
        "transaction_id": uuid.uuid4().hex,
        "product_id": req.product_id,
        "product_name": product["product_name"],
        "transaction_type": "STOCK_OUT",
        "quantity": float(req.quantity),
        "stock_before": stock_before,
        "stock_after": stock_after,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    db.add_transaction(tx)
    
    return {
        "message": f"Successfully removed {req.quantity} units from {product['product_name']}.",
        "transaction": tx
    }

@router.post("/adjust")
def adjust_inventory(req: TransactionRequest):
    """
    Adjusts the stock level directly to a target amount (reconciliation).
    In this route, the 'quantity' field specifies the new absolute stock level.
    """
    db = get_db()
    product = db.get_product(req.product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {req.product_id} not found."
        )
        
    stock_before = float(product["current_stock"])
    stock_after = float(req.quantity)  # Target absolute quantity
    
    # Update inventory
    db.update_product(req.product_id, {"current_stock": stock_after})
    
    # Write Transaction History
    tx = {
        "transaction_id": uuid.uuid4().hex,
        "product_id": req.product_id,
        "product_name": product["product_name"],
        "transaction_type": "ADJUSTMENT",
        "quantity": float(req.quantity),
        "stock_before": stock_before,
        "stock_after": stock_after,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    db.add_transaction(tx)
    
    return {
        "message": f"Successfully adjusted stock of {product['product_name']} to {req.quantity} units.",
        "transaction": tx
    }
