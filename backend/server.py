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
from geopy.geocoders import Nominatim
from geopy.distance import geodesic

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
    categories: List[str] = []
    item_type: str = "blends"
    meta_details: str = ""
    images: List[str] = []
    variants: List[Variant]
    discount: float = 0.0
    display_order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MenuItemCreate(BaseModel):
    title: str
    description: str
    categories: List[str] = []
    item_type: str = "blends"
    meta_details: str = ""
    images: List[str] = []
    variants: List[Variant]
    discount: float = 0.0
    display_order: int = 0

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
    delivery_method: str
    delivery_address: Optional[str] = None
    referral_name: Optional[str] = None
    items: List[InquiryItem]
    total: float

class Inquiry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    first_name: str
    phone_number: str
    delivery_method: str
    delivery_address: Optional[str] = None
    referral_name: Optional[str] = None
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

class DeliveryValidation(BaseModel):
    delivery_address: str
    cart_total: float

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
async def get_menu_items(
    category: Optional[str] = None, 
    search: Optional[str] = None,
    item_type: Optional[str] = None
):
    query = {}
    if category:
        query["category"] = category
    if item_type:
        query["item_type"] = item_type
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"meta_details": {"$regex": search, "$options": "i"}}
        ]
    
    items = await db.menu_items.find(query, {"_id": 0}).sort("display_order", 1).to_list(1000)
    for item in items:
        if isinstance(item.get('created_at'), str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
    return items

@api_router.get("/menu/categories")
async def get_categories():
    items = await db.menu_items.find({}, {"_id": 0, "categories": 1}).to_list(1000)
    # Flatten all categories from all items into a single unique sorted list
    all_categories = []
    for item in items:
        if "categories" in item and isinstance(item["categories"], list):
            all_categories.extend(item["categories"])
    categories = sorted(list(set(all_categories)))
    return {"categories": categories}

@api_router.delete("/admin/categories/{category_name}")
async def delete_category(category_name: str, token: dict = Depends(verify_token)):
    """Delete a category from the system and remove it from all products"""
    
    # Remove the category from all menu items that have it
    result = await db.menu_items.update_many(
        {"categories": category_name},
        {"$pull": {"categories": category_name}}
    )
    
    return {
        "message": f"Category '{category_name}' deleted successfully",
        "products_updated": result.modified_count
    }

@api_router.post("/validate-delivery")
async def validate_delivery(validation: DeliveryValidation):
    """Validate delivery address and return minimum order requirement"""
    # Full pickup address with city, state for accurate geocoding
    PICKUP_ADDRESS = "5624 Grande River Rd, Atlanta, GA 30349, USA"
    
    try:
        geolocator = Nominatim(user_agent="budbar_marketplace", timeout=10)
        
        # Geocode pickup address with more specific query
        pickup_location = geolocator.geocode(PICKUP_ADDRESS, exactly_one=True)
        
        # Geocode delivery address
        delivery_location = geolocator.geocode(validation.delivery_address, exactly_one=True)
        
        if not delivery_location:
            raise HTTPException(status_code=400, detail="Could not find delivery address. Please enter a valid address.")
        
        if not pickup_location:
            # Fallback coordinates for 5624 Grande River Rd, Atlanta, GA 30349
            pickup_coords = (33.6130, -84.4740)
            logging.warning("Using fallback coordinates for pickup address")
        else:
            pickup_coords = (pickup_location.latitude, pickup_location.longitude)
        
        delivery_coords = (delivery_location.latitude, delivery_location.longitude)
        
        # Calculate distance in miles (geodesic - as the crow flies)
        distance = geodesic(pickup_coords, delivery_coords).miles
        
        # Determine minimum based on distance
        # 0-10 miles: $60, 10-20: $75, 20-35: $90, 35-50: $111
        if distance <= 10:
            minimum = 60.0
        elif distance <= 20:
            minimum = 75.0
        elif distance <= 35:
            minimum = 90.0
        elif distance <= 50:
            minimum = 111.0
        else:
            # For distances over 50 miles, keep the highest minimum
            minimum = 111.0
        
        # Calculate remaining amount needed
        remaining = max(0, minimum - validation.cart_total)
        
        return {
            "distance_miles": round(distance, 2),
            "minimum_order": minimum,
            "cart_total": validation.cart_total,
            "remaining_needed": round(remaining, 2),
            "meets_minimum": remaining == 0
        }
    
    except Exception as e:
        logging.error(f"Geocoding error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error validating address: {str(e)}")

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

@api_router.post("/admin/upload-images")
async def upload_images(files: List[UploadFile] = File(...), token: dict = Depends(verify_token)):
    """Upload multiple images and return base64 encoded strings"""
    images = []
    for file in files:
        content = await file.read()
        base64_image = base64.b64encode(content).decode('utf-8')
        mime_type = file.content_type or 'image/jpeg'
        data_url = f"data:{mime_type};base64,{base64_image}"
        images.append(data_url)
    return {"images": images}

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
async def update_inquiry_status(
    inquiry_id: str, 
    status: str = None,
    token: dict = Depends(verify_token)
):
    if not status:
        raise HTTPException(status_code=400, detail="Status is required")
    
    if status not in ["pending", "complete"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'pending' or 'complete'")
    
    result = await db.inquiries.update_one(
        {"id": inquiry_id},
        {"$set": {"status": status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    
    return {"message": "Status updated successfully", "status": status}

@api_router.delete("/admin/inquiries/{inquiry_id}")
async def delete_inquiry(inquiry_id: str, token: dict = Depends(verify_token)):
    result = await db.inquiries.delete_one({"id": inquiry_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    
    return {"message": "Inquiry deleted successfully"}

@api_router.put("/admin/menu/reorder")
async def reorder_menu_items(order_updates: List[dict], token: dict = Depends(verify_token)):
    """Update display order for multiple menu items"""
    for update in order_updates:
        await db.menu_items.update_one(
            {"id": update["id"]},
            {"$set": {"display_order": update["display_order"]}}
        )
    return {"message": "Menu order updated successfully"}

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