from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.repositories import get_db

# Import Routers
from app.routes.products import router as products_router
from app.routes.inventory import router as inventory_router
from app.routes.transactions import router as transactions_router
from app.routes.predictions import router as predictions_router
from app.routes.dashboard import router as dashboard_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # On startup: Check if products exist, seed if empty
    db = get_db()
    products = db.get_products()
    if not products:
        print("Database is empty. Generating 90 days of synthetic warehouse data...")
        from app.services.data_generator import generate_synthetic_data
        try:
            generate_synthetic_data(db, days_history=90)
            print("Database seeding completed.")
        except Exception as e:
            print(f"Error seeding database: {e}")
    yield

app = FastAPI(
    title="Intelligent Warehouse Inventory Prediction System",
    description="MVP for University Cloud Computing Project, simulating predictive inventory management.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS to allow access from local Vite frontend (port 5173) and any future web pages
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For university project demonstration ease
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(products_router)
app.include_router(inventory_router)
app.include_router(transactions_router)
app.include_router(predictions_router)
app.include_router(dashboard_router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "project": "Intelligent Warehouse Inventory Prediction System API",
        "mode": settings.APP_MODE,
        "docs_url": "/docs"
    }
