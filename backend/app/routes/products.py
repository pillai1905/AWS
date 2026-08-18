from fastapi import APIRouter, HTTPException, status
from typing import List
from app.repositories import get_db
from app.schemas import ProductCreate, ProductUpdate, ProductResponse

router = APIRouter(prefix="/products", tags=["Products"])

@router.get("", response_model=List[ProductResponse])
def get_all_products():
    db = get_db()
    return db.get_products()

@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: str):
    db = get_db()
    product = db.get_product(product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )
    return product

@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(product: ProductCreate):
    db = get_db()
    try:
        new_prod = db.create_product(product.model_dump())
        return new_prod
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.put("/{product_id}", response_model=ProductResponse)
def update_product(product_id: str, updates: ProductUpdate):
    db = get_db()
    # Filter out None values to avoid overwriting attributes with None
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    
    updated_prod = db.update_product(product_id, update_data)
    if not updated_prod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )
    return updated_prod

@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: str):
    db = get_db()
    success = db.delete_product(product_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )
    return None
