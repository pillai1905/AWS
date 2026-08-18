import os

class Settings:
    # App Mode: 'LOCAL' or 'AWS'
    APP_MODE: str = os.getenv("APP_MODE", "LOCAL")
    
    # Local Storage Configuration
    LOCAL_DATA_DIR: str = os.getenv("LOCAL_DATA_DIR", "data")
    LOCAL_PRODUCTS_FILE: str = os.path.join(LOCAL_DATA_DIR, "products.json")
    LOCAL_TRANSACTIONS_FILE: str = os.path.join(LOCAL_DATA_DIR, "transactions.json")
    
    # AWS Configuration
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    DYNAMODB_PRODUCTS_TABLE: str = os.getenv("DYNAMODB_PRODUCTS_TABLE", "warehouse_inventory")
    DYNAMODB_TRANSACTIONS_TABLE: str = os.getenv("DYNAMODB_TRANSACTIONS_TABLE", "warehouse_transactions")
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "warehouse-inventory-data-bucket")

settings = Settings()
