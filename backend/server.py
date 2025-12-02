from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, File, UploadFile, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class Variant(BaseModel):
    name: str
    price: float

class MenuItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    category: str
    images: List[str] = []
    variants: List[Variant]
    discount: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MenuItemCreate(BaseModel):
    title: str
    description: str
    category: str
    images: List[str] = []
    variants: List[Variant]
    discount: float = 0.0

class InquiryItem(BaseModel):
    menu_item_id: str
    title: str
    variant_name: str
    variant_price: float
    quantity: int
    discount: float

class InquiryCreate(BaseModel):
    first_name: str
    phone_number: str
    items: List[InquiryItem]
    total: float

class Inquiry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    first_name: str
    phone_number: str
    items: List[InquiryItem]
    total: float
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AdminLogin(BaseModel):
    email: str
    password: str

class AdminUser(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    password_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Auth helpers
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Public endpoints
@api_router.get("/")
async def root():
    return {"message": "Marketplace Digital Menu API"}

@api_router.get("/menu/items", response_model=List[MenuItem])
async def get_menu_items(category: Optional[str] = None, search: Optional[str] = None):
    query = {}
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    items = await db.menu_items.find(query, {"_id": 0}).to_list(1000)
    for item in items:
        if isinstance(item.get('created_at'), str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
    return items

@api_router.get("/menu/categories")
async def get_categories():
    items = await db.menu_items.find({}, {"_id": 0, "category": 1}).to_list(1000)
    categories = list(set([item["category"] for item in items if "category" in item]))
    return {"categories": categories}

@api_router.post("/inquiries", response_model=Inquiry)
async def create_inquiry(inquiry_data: InquiryCreate):
    inquiry = Inquiry(**inquiry_data.model_dump())
    doc = inquiry.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.inquiries.insert_one(doc)
    return inquiry

# Admin endpoints
@api_router.post("/admin/login")
async def admin_login(credentials: AdminLogin):
    admin = await db.admin_users.find_one({"email": credentials.email}, {"_id": 0})
    
    if not admin or not pwd_context.verify(credentials.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"email": admin["email"], "id": admin["id"]})
    return {"access_token": token, "token_type": "bearer"}

@api_router.post("/admin/menu/items", response_model=MenuItem)
async def create_menu_item(item_data: MenuItemCreate, token: dict = Depends(verify_token)):
    menu_item = MenuItem(**item_data.model_dump())
    doc = menu_item.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.menu_items.insert_one(doc)
    return menu_item

@api_router.put("/admin/menu/items/{item_id}")
async def update_menu_item(item_id: str, item_data: MenuItemCreate, token: dict = Depends(verify_token)):
    result = await db.menu_items.update_one(
        {"id": item_id},
        {"$set": item_data.model_dump()}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {"message": "Item updated successfully"}

@api_router.delete("/admin/menu/items/{item_id}")
async def delete_menu_item(item_id: str, token: dict = Depends(verify_token)):
    result = await db.menu_items.delete_one({"id": item_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {"message": "Item deleted successfully"}

@api_router.get("/admin/inquiries", response_model=List[Inquiry])
async def get_inquiries(token: dict = Depends(verify_token)):
    inquiries = await db.inquiries.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for inquiry in inquiries:
        if isinstance(inquiry.get('created_at'), str):
            inquiry['created_at'] = datetime.fromisoformat(inquiry['created_at'])
    return inquiries

@api_router.put("/admin/inquiries/{inquiry_id}/status")
async def update_inquiry_status(inquiry_id: str, status: str, token: dict = Depends(verify_token)):
    result = await db.inquiries.update_one(
        {"id": inquiry_id},
        {"$set": {"status": status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    
    return {"message": "Status updated successfully"}

# Initialize admin user on startup
@app.on_event("startup")
async def startup_event():
    # Update or create default admin with new password
    admin_exists = await db.admin_users.find_one({"email": "admin@purepath.com"})
    if admin_exists:
        # Update existing admin password
        await db.admin_users.update_one(
            {"email": "admin@purepath.com"},
            {"$set": {"password_hash": pwd_context.hash("Feelgoodmix")}}
        )
        logging.info("Admin password updated: admin@purepath.com / Feelgoodmix")
    else:
        # Create new admin
        admin = AdminUser(
            email="admin@purepath.com",
            password_hash=pwd_context.hash("Feelgoodmix")
        )
        doc = admin.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.admin_users.insert_one(doc)
        logging.info("Default admin created: admin@purepath.com / Feelgoodmix")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()