import random
import uuid
from datetime import datetime, timedelta
from typing import Dict, List
from app.repositories import get_db
from app.repositories.base import BaseRepository

def generate_synthetic_data(db: BaseRepository, days_history: int = 90):
    """
    Generates historical products and realistic transaction histories (STOCK_IN, STOCK_OUT, ADJUSTMENT)
    for the last N days. Updates the database repository directly.
    """
    print(f"Starting synthetic data generation for the last {days_history} days...")
    
    # 1. Define Products with specific profiles
    product_profiles = [
        {
            "product_id": "PROD-01",
            "product_name": "EcoWidget A",
            "category": "Electronics",
            "reorder_level": 50.0,
            "unit": "units",
            "lead_time_days": 3.0,
            "safety_stock": 15.0,
            "pattern": "steady",
            "base_demand": 10.0,      # average 10 sales per day
            "initial_stock": 130.0
        },
        {
            "product_id": "PROD-02",
            "product_name": "IronGizmo B",
            "category": "Hardware",
            "reorder_level": 80.0,
            "unit": "units",
            "lead_time_days": 5.0,
            "safety_stock": 25.0,
            "pattern": "growing",
            "base_demand": 2.0,       # starts at 2, grows to 18
            "initial_stock": 100.0
        },
        {
            "product_id": "PROD-03",
            "product_name": "ActiveSeason X",
            "category": "Apparel",
            "reorder_level": 30.0,
            "unit": "units",
            "lead_time_days": 2.0,
            "safety_stock": 10.0,
            "pattern": "spiky",
            "base_demand": 1.5,       # low baseline, random massive spikes
            "initial_stock": 90.0
        },
        {
            "product_id": "PROD-04",
            "product_name": "Titanium Valve Y",
            "category": "Industrial",
            "reorder_level": 5.0,
            "unit": "boxes",
            "lead_time_days": 10.0,
            "safety_stock": 2.0,
            "pattern": "slow",
            "base_demand": 0.08,      # sold very rarely (once every ~12 days)
            "initial_stock": 12.0
        },
        {
            "product_id": "PROD-05",
            "product_name": "Solvent Chemical Z",
            "category": "Chemicals",
            "reorder_level": 40.0,
            "unit": "liters",
            "lead_time_days": 4.0,
            "safety_stock": 15.0,
            "pattern": "depleting",    # high demand, running out of stock now
            "base_demand": 12.0,
            "initial_stock": 80.0
        }
    ]

    # Clear existing data by overwriting or deleting
    # In local mode, we can just delete file contents if needed, or simply delete each product.
    # To be safe and clean, we will delete any existing conflicting product IDs first
    existing_products = db.get_products()
    existing_ids = {p["product_id"] for p in existing_products}
    
    # We will generate a list of transactions to write
    all_transactions = []
    
    start_date = datetime.utcnow() - timedelta(days=days_history)
    
    for profile in product_profiles:
        pid = profile["product_id"]
        
        # If product already exists, delete it and its transactions to avoid duplicate keys
        if pid in existing_ids:
            db.delete_product(pid)
            
        # Create product in DB
        prod_data = {
            "product_id": pid,
            "product_name": profile["product_name"],
            "category": profile["category"],
            "current_stock": profile["initial_stock"],
            "reorder_level": profile["reorder_level"],
            "unit": profile["unit"],
            "lead_time_days": profile["lead_time_days"],
            "safety_stock": profile["safety_stock"],
            "created_at": start_date.isoformat() + "Z"
        }
        db.create_product(prod_data)
        
        # Simulate inventory over time
        current_stock = profile["initial_stock"]
        
        # Keep track of active restock orders: list of (arrival_date, quantity)
        pending_restocks = []
        
        for day in range(days_history):
            current_date = start_date + timedelta(days=day)
            date_str = current_date.isoformat() + "Z"
            
            # 1. Process arriving restocks first
            arrived_restocks = []
            for order in pending_restocks:
                arrival_date, qty = order
                if current_date >= arrival_date:
                    stock_before = current_stock
                    current_stock += qty
                    arrived_restocks.append(order)
                    
                    # Record STOCK_IN transaction
                    tx_in = {
                        "transaction_id": uuid.uuid4().hex,
                        "product_id": pid,
                        "product_name": profile["product_name"],
                        "transaction_type": "STOCK_IN",
                        "quantity": qty,
                        "stock_before": stock_before,
                        "stock_after": current_stock,
                        "timestamp": date_str
                    }
                    all_transactions.append(tx_in)
                    
            # Remove arrived restocks from pending
            for order in arrived_restocks:
                pending_restocks.remove(order)
                
            # 2. Determine demand for today
            demand = 0.0
            pattern = profile["pattern"]
            base_demand = profile["base_demand"]
            
            if pattern == "steady":
                # Normal demand around the base average
                demand = max(0.0, round(random.gauss(base_demand, 3.0)))
            elif pattern == "growing":
                # Linear trend growth
                trend = (day / days_history) * 16.0  # grows by up to +16 units
                demand = max(0.0, round(random.gauss(base_demand + trend, 2.0)))
            elif pattern == "spiky":
                # Normal low days, with occasional huge spikes
                if random.random() < 0.08:  # 8% chance of spike
                    demand = float(random.randint(30, 50))
                else:
                    demand = max(0.0, round(random.gauss(base_demand, 0.8)))
            elif pattern == "slow":
                # Very rare sales
                if random.random() < (1.0 / 12.0):  # averages once per 12 days
                    demand = 1.0
            elif pattern == "depleting":
                # High steady demand, and we don't trigger restocks for the last 15 days
                demand = max(0.0, round(random.gauss(base_demand, 2.0)))
                
            # Execute STOCK_OUT if demand > 0 and stock is available
            if demand > 0:
                actual_sale = min(demand, current_stock)
                if actual_sale > 0:
                    stock_before = current_stock
                    current_stock -= actual_sale
                    
                    tx_out = {
                        "transaction_id": uuid.uuid4().hex,
                        "product_id": pid,
                        "product_name": profile["product_name"],
                        "transaction_type": "STOCK_OUT",
                        "quantity": actual_sale,
                        "stock_before": stock_before,
                        "stock_after": current_stock,
                        "timestamp": date_str
                    }
                    all_transactions.append(tx_out)
                    
            # 3. Simulate adjustments occasionally (audit corrections)
            if random.random() < 0.01:  # 1% chance per day
                adjustment_delta = random.choice([-2.0, -1.0, 1.0, 2.0])
                # Ensure we don't go negative
                if current_stock + adjustment_delta >= 0:
                    stock_before = current_stock
                    current_stock += adjustment_delta
                    
                    tx_adj = {
                        "transaction_id": uuid.uuid4().hex,
                        "product_id": pid,
                        "product_name": profile["product_name"],
                        "transaction_type": "ADJUSTMENT",
                        "quantity": current_stock,  # Target absolute quantity
                        "stock_before": stock_before,
                        "stock_after": current_stock,
                        "timestamp": date_str
                    }
                    all_transactions.append(tx_adj)
                    
            # 4. Check for restock trigger
            # If current stock is below reorder level, and we have no pending orders, place an order
            # (Unless it is the depleting product, which we let run dry to demonstrate out-of-stock features)
            is_depleting_and_late = pattern == "depleting" and day > (days_history - 20)
            
            if current_stock <= profile["reorder_level"] and len(pending_restocks) == 0 and not is_depleting_and_late:
                order_qty = profile["reorder_level"] * 2.0
                arrival_date = current_date + timedelta(days=int(profile["lead_time_days"]))
                pending_restocks.append((arrival_date, order_qty))
                
        # Update the product with its final calculated stock
        db.update_product(pid, {"current_stock": current_stock})
        
    # Write all transactions to the repository
    # Sort transactions chronologically before writing
    all_transactions.sort(key=lambda x: x["timestamp"])
    for tx in all_transactions:
        db.add_transaction(tx)
        
    print(f"Successfully generated {len(all_transactions)} transactions for {len(product_profiles)} products.")

if __name__ == "__main__":
    import sys
    import os
    # Add parent directory to path to enable app imports
    sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    from app.repositories.local_repo import LocalRepository
    
    local_db = LocalRepository()
    generate_synthetic_data(local_db)
