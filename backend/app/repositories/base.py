from abc import ABC, abstractmethod
from typing import List, Dict, Optional

class BaseRepository(ABC):
    @abstractmethod
    def get_products(self) -> List[Dict]:
        """Retrieve all products from inventory."""
        pass

    @abstractmethod
    def get_product(self, product_id: str) -> Optional[Dict]:
        """Retrieve a specific product by ID."""
        pass

    @abstractmethod
    def create_product(self, product: Dict) -> Dict:
        """Create a new product in inventory."""
        pass

    @abstractmethod
    def update_product(self, product_id: str, updates: Dict) -> Optional[Dict]:
        """Update product details."""
        pass

    @abstractmethod
    def delete_product(self, product_id: str) -> bool:
        """Delete a product from inventory."""
        pass

    @abstractmethod
    def add_transaction(self, transaction: Dict) -> Dict:
        """Record a new transaction history event."""
        pass

    @abstractmethod
    def get_transactions(
        self,
        product_id: Optional[str] = None,
        transaction_type: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict]:
        """Retrieve and filter transactions history."""
        pass
