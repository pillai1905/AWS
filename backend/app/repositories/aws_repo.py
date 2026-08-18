import boto3
import decimal
import json
from datetime import datetime
from typing import List, Dict, Optional
from boto3.dynamodb.conditions import Key, Attr
from app.repositories.base import BaseRepository
from app.config import settings

# Helper functions to convert floats to decimals for DynamoDB, and vice-versa
def to_dynamo_types(obj):
    if isinstance(obj, list):
        return [to_dynamo_types(x) for x in obj]
    if isinstance(obj, dict):
        return {k: to_dynamo_types(v) for k, v in obj.items()}
    if isinstance(obj, float):
        # Use str(obj) to avoid floating point precision representation artifacts in Decimal
        return decimal.Decimal(str(obj))
    return obj

def from_dynamo_types(obj):
    if isinstance(obj, list):
        return [from_dynamo_types(x) for x in obj]
    if isinstance(obj, dict):
        return {k: from_dynamo_types(v) for k, v in obj.items()}
    if isinstance(obj, decimal.Decimal):
        # Check if it can be represented as an int
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    return obj

class AwsRepository(BaseRepository):
    def __init__(self):
        self.dynamodb = boto3.resource("dynamodb", region_name=settings.AWS_REGION)
        self.s3_client = boto3.client("s3", region_name=settings.AWS_REGION)
        self.products_table = self.dynamodb.Table(settings.DYNAMODB_PRODUCTS_TABLE)
        self.transactions_table = self.dynamodb.Table(settings.DYNAMODB_TRANSACTIONS_TABLE)

    def get_products(self) -> List[Dict]:
        try:
            response = self.products_table.scan()
            items = response.get("Items", [])
            return from_dynamo_types(items)
        except Exception as e:
            print(f"Error scanning DynamoDB products: {e}")
            raise e

    def get_product(self, product_id: str) -> Optional[Dict]:
        try:
            response = self.products_table.get_item(Key={"product_id": product_id})
            item = response.get("Item")
            return from_dynamo_types(item) if item else None
        except Exception as e:
            print(f"Error fetching product {product_id} from DynamoDB: {e}")
            raise e

    def create_product(self, product: Dict) -> Dict:
        try:
            # Check if product already exists to enforce uniqueness constraint
            if self.get_product(product["product_id"]):
                raise ValueError(f"Product with ID {product['product_id']} already exists.")
                
            now_str = datetime.utcnow().isoformat() + "Z"
            new_product = {
                **product,
                "created_at": product.get("created_at") or now_str,
                "updated_at": product.get("updated_at") or now_str,
                "current_stock": float(product.get("current_stock", 0)),
                "reorder_level": float(product.get("reorder_level", 0))
            }
            
            dynamo_item = to_dynamo_types(new_product)
            self.products_table.put_item(Item=dynamo_item)
            return new_product
        except Exception as e:
            if isinstance(e, ValueError):
                raise e
            print(f"Error put_item product in DynamoDB: {e}")
            raise e

    def update_product(self, product_id: str, updates: Dict) -> Optional[Dict]:
        try:
            # Retrieve existing item first
            item = self.get_product(product_id)
            if not item:
                return None
                
            now_str = datetime.utcnow().isoformat() + "Z"
            
            # Apply changes
            for key, val in updates.items():
                if key not in ["product_id", "created_at"]:
                    if key in ["current_stock", "reorder_level"]:
                        item[key] = float(val)
                    else:
                        item[key] = val
            item["updated_at"] = now_str
            
            dynamo_item = to_dynamo_types(item)
            self.products_table.put_item(Item=dynamo_item)
            return item
        except Exception as e:
            print(f"Error updating product {product_id} in DynamoDB: {e}")
            raise e

    def delete_product(self, product_id: str) -> bool:
        try:
            # Check if it exists
            if not self.get_product(product_id):
                return False
            self.products_table.delete_item(Key={"product_id": product_id})
            return True
        except Exception as e:
            print(f"Error deleting product {product_id} from DynamoDB: {e}")
            raise e

    def add_transaction(self, transaction: Dict) -> Dict:
        try:
            new_tx = {
                **transaction,
                "timestamp": transaction.get("timestamp") or datetime.utcnow().isoformat() + "Z",
                "quantity": float(transaction["quantity"]),
                "stock_before": float(transaction["stock_before"]),
                "stock_after": float(transaction["stock_after"])
            }
            dynamo_item = to_dynamo_types(new_tx)
            self.transactions_table.put_item(Item=dynamo_item)
            return new_tx
        except Exception as e:
            print(f"Error writing transaction in DynamoDB: {e}")
            raise e

    def get_transactions(
        self,
        product_id: Optional[str] = None,
        transaction_type: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict]:
        try:
            # Standard DynamoDB queries must use GSIs or Scan if filtering attributes dynamically
            # For transaction queries in an MVP, if product_id is specified we query the ProductTransactionsIndex GSI.
            # If no product_id, we scan. 
            
            if product_id:
                # Query on GSI: ProductTransactionsIndex (partition: product_id, sort: timestamp)
                key_expr = Key("product_id").eq(product_id)
                if start_date and end_date:
                    key_expr = key_expr & Key("timestamp").between(start_date, end_date)
                elif start_date:
                    key_expr = key_expr & Key("timestamp").gte(start_date)
                elif end_date:
                    key_expr = key_expr & Key("timestamp").lte(end_date)
                    
                response = self.transactions_table.query(
                    IndexName="ProductTransactionsIndex",
                    KeyConditionExpression=key_expr
                )
                items = response.get("Items", [])
                
                # Apply transaction_type post-filtering if specified
                if transaction_type:
                    items = [t for t in items if t.get("transaction_type", "").upper() == transaction_type.upper()]
            else:
                # No product_id, scan Table
                filter_expression = None
                
                if transaction_type:
                    filter_expression = Attr("transaction_type").eq(transaction_type.upper())
                if start_date:
                    expr = Attr("timestamp").gte(start_date)
                    filter_expression = filter_expression & expr if filter_expression else expr
                if end_date:
                    expr = Attr("timestamp").lte(end_date)
                    filter_expression = filter_expression & expr if filter_expression else expr
                    
                scan_args = {}
                if filter_expression:
                    scan_args["FilterExpression"] = filter_expression
                    
                response = self.transactions_table.scan(**scan_args)
                items = response.get("Items", [])
                
            results = from_dynamo_types(items)
            # Sort by timestamp descending
            results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
            return results
        except Exception as e:
            print(f"Error fetching transactions from DynamoDB: {e}")
            raise e

    def export_transactions_to_s3(self) -> Dict:
        """
        Fetches all transactions and uploads them to S3 in the structured partition format:
        s3://<bucket>/transactions/year=YYYY/month=MM/transactions.json
        """
        try:
            txs = self.get_transactions()
            now = datetime.utcnow()
            year = now.strftime("%Y")
            month = now.strftime("%m")
            
            s3_key = f"transactions/year={year}/month={month}/transactions.json"
            
            # Serialize JSON content
            serialized_data = json.dumps(txs, indent=4)
            
            # Upload to S3
            self.s3_client.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=s3_key,
                Body=serialized_data,
                ContentType="application/json"
            )
            
            return {
                "success": True,
                "bucket": settings.S3_BUCKET_NAME,
                "key": s3_key,
                "records_exported": len(txs),
                "timestamp": now.isoformat() + "Z"
            }
        except Exception as e:
            print(f"Failed S3 export: {e}")
            raise e
