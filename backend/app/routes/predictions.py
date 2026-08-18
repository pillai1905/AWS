from fastapi import APIRouter, HTTPException, status
from typing import List
from app.repositories import get_db
from app.services.prediction_engine import PredictionEngine

router = APIRouter(tags=["Predictions & Recommendations"])

@router.get("/predictions/{product_id}")
def get_product_prediction(product_id: str):
    db = get_db()
    product = db.get_product(product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )
        
    transactions = db.get_transactions(product_id=product_id)
    analysis = PredictionEngine.analyze_product(product, transactions)
    return analysis

@router.get("/predictions")
def get_all_predictions():
    db = get_db()
    products = db.get_products()
    
    results = []
    for product in products:
        transactions = db.get_transactions(product_id=product["product_id"])
        analysis = PredictionEngine.analyze_product(product, transactions)
        results.append(analysis)
        
    return results

@router.get("/recommendations")
def get_all_recommendations():
    db = get_db()
    products = db.get_products()
    
    recommendations = []
    for product in products:
        transactions = db.get_transactions(product_id=product["product_id"])
        analysis = PredictionEngine.analyze_product(product, transactions)
        recommendations.append({
            "product_id": analysis["product_id"],
            "product_name": analysis["product_name"],
            "category": analysis["category"],
            "current_stock": analysis["current_stock"],
            "reorder_level": analysis["reorder_level"],
            "average_predicted_daily_demand": analysis["average_predicted_daily_demand"],
            "predicted_7_day_demand": analysis["predicted_7_day_demand"],
            "estimated_days_until_stockout": analysis["estimated_days_until_stockout"],
            "risk_level": analysis["risk_level"],
            "restock_required": analysis["restock_required"],
            "recommended_reorder_quantity": analysis["recommended_reorder_quantity"],
            "recommended_reorder_timing": analysis["recommended_reorder_timing"],
            "reason": analysis["reason"],
            "forecast_7_day": analysis["forecast_7_day"],
            "days_to_stock_out": analysis["days_to_stock_out"],
            "recommended_qty": analysis["recommended_qty"],
            "recommended_date": analysis["recommended_date"],
            "reorder_point": analysis["reorder_point"]
        })
        
    # Sort recommendations by risk level: Critical > High > Medium > Low
    risk_priority = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    recommendations.sort(key=lambda x: risk_priority.get(x["risk_level"], 4))
    
    return recommendations

@router.get("/recommendations/{product_id}")
def get_product_recommendation(product_id: str):
    db = get_db()
    product = db.get_product(product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )
    transactions = db.get_transactions(product_id=product_id)
    analysis = PredictionEngine.analyze_product(product, transactions)
    return {
        "product_id": analysis["product_id"],
        "product_name": analysis["product_name"],
        "category": analysis["category"],
        "current_stock": analysis["current_stock"],
        "reorder_level": analysis["reorder_level"],
        "average_predicted_daily_demand": analysis["average_predicted_daily_demand"],
        "predicted_7_day_demand": analysis["predicted_7_day_demand"],
        "estimated_days_until_stockout": analysis["estimated_days_until_stockout"],
        "risk_level": analysis["risk_level"],
        "restock_required": analysis["restock_required"],
        "recommended_reorder_quantity": analysis["recommended_reorder_quantity"],
        "recommended_reorder_timing": analysis["recommended_reorder_timing"],
        "reason": analysis["reason"],
        "forecast_7_day": analysis["forecast_7_day"],
        "days_to_stock_out": analysis["days_to_stock_out"],
        "recommended_qty": analysis["recommended_qty"],
        "recommended_date": analysis["recommended_date"],
        "reorder_point": analysis["reorder_point"]
    }
