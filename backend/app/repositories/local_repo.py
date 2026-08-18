import os
import json
import threading
from typing import List, Dict, Optional
from datetime import datetime
from app.repositories.base import BaseRepository
from app.config import settings

class LocalRepository(BaseRepository):
    def __init__(self):
        self.lock = threading.Lock()
        self._ensure_storage()

    def _ensure_storage(self):
        os.makedirs(settings.LOCAL_DATA_DIR, exist_ok=True)
        if not os.path.exists(settings.LOCAL_PRODUCTS_FILE):
            with open(settings.LOCAL_PRODUCTS_FILE, "w") as f:
                json.dump([], f)
        if not os.path.exists(settings.LOCAL_TRANSACTIONS_FILE):
            with open(settings.LOCAL_TRANSACTIONS_FILE, "w") as f:
                json.dump([], f)

    def _read_file(self, filepath: str) -> List[Dict]:
        with self.lock:
            try:
                with open(filepath, "r") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return []

    def _write_file(self, filepath: str, data: List[Dict]):
        with self.lock:
            with open(filepath, "w") as f:
                json.dump(data, f, indent=4)

    def get_products(self) -> List[Dict]:
        return self._read_file(settings.LOCAL_PRODUCTS_FILE)

    def get_product(self, product_id: str) -> Optional[Dict]:
        products = self.get_products()
        for p in products:
            if p["product_id"] == product_id:
                return p
        return None

    def create_product(self, product: Dict) -> Dict:
        products = self.get_products()
        # Verify product_id uniqueness
        for p in products:
            if p["product_id"] == product["product_id"]:
                raise ValueError(f"Product with ID {product['product_id']} already exists.")
        
        now_str = datetime.utcnow().isoformat() + "Z"
        new_product = {
            **product,
            "created_at": product.get("created_at") or now_str,
            "updated_at": product.get("updated_at") or now_str,
            "current_stock": float(product.get("current_stock", 0)),
            "reorder_level": float(product.get("reorder_level", 0))
        }
        products.append(new_product)
        self._write_file(settings.LOCAL_PRODUCTS_FILE, products)
        return new_product

    def update_product(self, product_id: str, updates: Dict) -> Optional[Dict]:
        products = self.get_products()
        for p in products:
            if p["product_id"] == product_id:
                # Update attributes
                for key, val in updates.items():
                    if key not in ["product_id", "created_at"]:
                        if key in ["current_stock", "reorder_level"]:
                            p[key] = float(val)
                        else:
                            p[key] = val
                p["updated_at"] = datetime.utcnow().isoformat() + "Z"
                self._write_file(settings.LOCAL_PRODUCTS_FILE, products)
                return p
        return None

    def delete_product(self, product_id: str) -> bool:
        products = self.get_products()
        initial_count = len(products)
        filtered_products = [p for p in products if p["product_id"] != product_id]
        if len(filtered_products) < initial_count:
            self._write_file(settings.LOCAL_PRODUCTS_FILE, filtered_products)
            return True
        return False

    def add_transaction(self, transaction: Dict) -> Dict:
        transactions = self._read_file(settings.LOCAL_TRANSACTIONS_FILE)
        new_tx = {
            **transaction,
            "timestamp": transaction.get("timestamp") or datetime.utcnow().isoformat() + "Z",
            "quantity": float(transaction["quantity"]),
            "stock_before": float(transaction["stock_before"]),
            "stock_after": float(transaction["stock_after"])
        }
        transactions.append(new_tx)
        self._write_file(settings.LOCAL_TRANSACTIONS_FILE, transactions)
        return new_tx

    def get_transactions(
        self,
        product_id: Optional[str] = None,
        transaction_type: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict]:
        txs = self._read_file(settings.LOCAL_TRANSACTIONS_FILE)
        
        # Apply filters
        if product_id:
            txs = [t for t in txs if t["product_id"] == product_id]
        if transaction_type:
            txs = [t for t in txs if t["transaction_type"].upper() == transaction_type.upper()]
        if start_date:
            txs = [t for t in txs if t["timestamp"] >= start_date]
        if end_date:
            txs = [t for t in txs if t["timestamp"] <= end_date]
            
        # Sort by timestamp descending by default
        txs.sort(key=lambda x: x["timestamp"], reverse=True)
        return txs
