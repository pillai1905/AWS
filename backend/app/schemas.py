from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ProductBase(BaseModel):
    product_name: str = Field(..., min_length=1, description="Name of the product")
    category: str = Field(..., min_length=1, description="Category description")
    reorder_level: float = Field(default=10.0, ge=0.0, description="Minimum stock before reorder is triggered")
    unit: str = Field(default="units", description="Unit of measurement (e.g., pcs, kg, boxes)")
    lead_time_days: float = Field(default=3.0, ge=0.0, description="Supplier lead time in days")
    safety_stock: float = Field(default=10.0, ge=0.0, description="Safety stock margin")

class ProductCreate(ProductBase):
    product_id: str = Field(..., min_length=1, description="Unique product ID")
    current_stock: float = Field(default=0.0, ge=0.0, description="Initial stock level")

class ProductUpdate(BaseModel):
    product_name: Optional[str] = None
    category: Optional[str] = None
    reorder_level: Optional[float] = Field(None, ge=0.0)
    unit: Optional[str] = None
    lead_time_days: Optional[float] = Field(None, ge=0.0)
    safety_stock: Optional[float] = Field(None, ge=0.0)

class TransactionRequest(BaseModel):
    product_id: str
    quantity: float = Field(..., gt=0.0, description="Quantity for the stock movement (must be positive)")

class ProductResponse(ProductBase):
    product_id: str
    current_stock: float
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True
