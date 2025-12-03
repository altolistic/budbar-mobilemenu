import requests
import sys
import json
from datetime import datetime

class MarketplaceAPITester:
    def __init__(self, base_url="https://weed-menu.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test_name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    Details: {details}")

    def test_api_root(self):
        """Test API root endpoint"""
        try:
            response = requests.get(f"{self.api_url}/")
            success = response.status_code == 200 and "message" in response.json()
            self.log_test("API Root Endpoint", success, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("API Root Endpoint", False, f"Error: {str(e)}")
            return False

    def test_get_menu_items(self):
        """Test getting menu items"""
        try:
            response = requests.get(f"{self.api_url}/menu/items")
            success = response.status_code == 200
            data = response.json() if success else []
            
            if success:
                items_count = len(data)
                has_required_fields = all(
                    all(field in item for field in ['id', 'title', 'description', 'category', 'variants'])
                    for item in data
                )
                success = success and has_required_fields
                details = f"Found {items_count} items, fields valid: {has_required_fields}"
            else:
                details = f"Status: {response.status_code}"
            
            self.log_test("Get Menu Items", success, details)
            return success, data
        except Exception as e:
            self.log_test("Get Menu Items", False, f"Error: {str(e)}")
            return False, []

    def test_get_categories(self):
        """Test getting categories"""
        try:
            response = requests.get(f"{self.api_url}/menu/categories")
            success = response.status_code == 200
            data = response.json() if success else {}
            
            if success:
                has_categories = "categories" in data and isinstance(data["categories"], list)
                categories_count = len(data.get("categories", []))
                success = success and has_categories
                details = f"Found {categories_count} categories: {data.get('categories', [])}"
            else:
                details = f"Status: {response.status_code}"
            
            self.log_test("Get Categories", success, details)
            return success, data.get("categories", [])
        except Exception as e:
            self.log_test("Get Categories", False, f"Error: {str(e)}")
            return False, []

    def test_search_functionality(self):
        """Test search functionality"""
        try:
            # Test search by title
            response = requests.get(f"{self.api_url}/menu/items?search=consulting")
            success = response.status_code == 200
            data = response.json() if success else []
            
            if success:
                search_works = any("consulting" in item.get("title", "").lower() or 
                                 "consulting" in item.get("description", "").lower() 
                                 for item in data)
                details = f"Search returned {len(data)} items, contains 'consulting': {search_works}"
            else:
                details = f"Status: {response.status_code}"
            
            self.log_test("Search Functionality", success, details)
            return success
        except Exception as e:
            self.log_test("Search Functionality", False, f"Error: {str(e)}")
            return False

    def test_category_filter(self):
        """Test category filtering"""
        try:
            # Test filtering by category
            response = requests.get(f"{self.api_url}/menu/items?category=Services")
            success = response.status_code == 200
            data = response.json() if success else []
            
            if success:
                all_services = all(item.get("category") == "Services" for item in data)
                details = f"Filter returned {len(data)} items, all Services: {all_services}"
                success = success and (len(data) == 0 or all_services)
            else:
                details = f"Status: {response.status_code}"
            
            self.log_test("Category Filter", success, details)
            return success
        except Exception as e:
            self.log_test("Category Filter", False, f"Error: {str(e)}")
            return False

    def test_admin_login(self):
        """Test admin login"""
        try:
            login_data = {
                "email": "admin@purepath.com",
                "password": "admin123"
            }
            response = requests.post(f"{self.api_url}/admin/login", json=login_data)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                has_token = "access_token" in data
                if has_token:
                    self.admin_token = data["access_token"]
                details = f"Login successful, token received: {has_token}"
                success = success and has_token
            else:
                details = f"Status: {response.status_code}"
            
            self.log_test("Admin Login", success, details)
            return success
        except Exception as e:
            self.log_test("Admin Login", False, f"Error: {str(e)}")
            return False

    def test_admin_login_invalid(self):
        """Test admin login with invalid credentials"""
        try:
            login_data = {
                "email": "admin@purepath.com",
                "password": "wrongpassword"
            }
            response = requests.post(f"{self.api_url}/admin/login", json=login_data)
            success = response.status_code == 401
            details = f"Invalid login correctly rejected, Status: {response.status_code}"
            
            self.log_test("Admin Login Invalid Credentials", success, details)
            return success
        except Exception as e:
            self.log_test("Admin Login Invalid Credentials", False, f"Error: {str(e)}")
            return False

    def get_auth_headers(self):
        """Get authorization headers"""
        if not self.admin_token:
            return {}
        return {"Authorization": f"Bearer {self.admin_token}"}

    def test_create_menu_item(self):
        """Test creating a menu item"""
        if not self.admin_token:
            self.log_test("Create Menu Item", False, "No admin token available")
            return False, None

        try:
            item_data = {
                "title": "Test Service",
                "description": "This is a test service for API testing",
                "category": "Testing",
                "image_url": "https://via.placeholder.com/400x300",
                "discount": 5.0,
                "variants": [
                    {"name": "Basic", "price": 100.0},
                    {"name": "Premium", "price": 200.0}
                ]
            }
            
            response = requests.post(
                f"{self.api_url}/admin/menu/items",
                json=item_data,
                headers=self.get_auth_headers()
            )
            success = response.status_code == 200
            
            if success:
                data = response.json()
                has_id = "id" in data
                details = f"Item created successfully, ID: {data.get('id', 'N/A')}"
                return_data = data if has_id else None
            else:
                details = f"Status: {response.status_code}"
                return_data = None
            
            self.log_test("Create Menu Item", success, details)
            return success, return_data
        except Exception as e:
            self.log_test("Create Menu Item", False, f"Error: {str(e)}")
            return False, None

    def test_update_menu_item(self, item_id):
        """Test updating a menu item"""
        if not self.admin_token or not item_id:
            self.log_test("Update Menu Item", False, "No admin token or item ID available")
            return False

        try:
            update_data = {
                "title": "Updated Test Service",
                "description": "This is an updated test service",
                "category": "Testing",
                "image_url": "https://via.placeholder.com/400x300",
                "discount": 10.0,
                "variants": [
                    {"name": "Basic", "price": 120.0},
                    {"name": "Premium", "price": 250.0}
                ]
            }
            
            response = requests.put(
                f"{self.api_url}/admin/menu/items/{item_id}",
                json=update_data,
                headers=self.get_auth_headers()
            )
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            self.log_test("Update Menu Item", success, details)
            return success
        except Exception as e:
            self.log_test("Update Menu Item", False, f"Error: {str(e)}")
            return False

    def test_delete_menu_item(self, item_id):
        """Test deleting a menu item"""
        if not self.admin_token or not item_id:
            self.log_test("Delete Menu Item", False, "No admin token or item ID available")
            return False

        try:
            response = requests.delete(
                f"{self.api_url}/admin/menu/items/{item_id}",
                headers=self.get_auth_headers()
            )
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            self.log_test("Delete Menu Item", success, details)
            return success
        except Exception as e:
            self.log_test("Delete Menu Item", False, f"Error: {str(e)}")
            return False

    def test_create_inquiry(self):
        """Test creating a customer inquiry"""
        try:
            inquiry_data = {
                "first_name": "John",
                "phone_number": "+1234567890",
                "items": [
                    {
                        "menu_item_id": "test-id",
                        "title": "Test Service",
                        "variant_name": "Basic",
                        "variant_price": 100.0,
                        "quantity": 2,
                        "discount": 0.0
                    }
                ],
                "total": 200.0
            }
            
            response = requests.post(f"{self.api_url}/inquiries", json=inquiry_data)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                has_id = "id" in data
                details = f"Inquiry created successfully, ID: {data.get('id', 'N/A')}"
            else:
                details = f"Status: {response.status_code}"
            
            self.log_test("Create Inquiry", success, details)
            return success
        except Exception as e:
            self.log_test("Create Inquiry", False, f"Error: {str(e)}")
            return False

    def test_get_inquiries(self):
        """Test getting inquiries (admin only)"""
        if not self.admin_token:
            self.log_test("Get Inquiries", False, "No admin token available")
            return False

        try:
            response = requests.get(
                f"{self.api_url}/admin/inquiries",
                headers=self.get_auth_headers()
            )
            success = response.status_code == 200
            
            if success:
                data = response.json()
                inquiries_count = len(data)
                details = f"Retrieved {inquiries_count} inquiries"
            else:
                details = f"Status: {response.status_code}"
            
            self.log_test("Get Inquiries", success, details)
            return success
        except Exception as e:
            self.log_test("Get Inquiries", False, f"Error: {str(e)}")
            return False

    def test_unauthorized_access(self):
        """Test unauthorized access to admin endpoints"""
        try:
            # Try to access admin endpoint without token
            response = requests.get(f"{self.api_url}/admin/inquiries")
            success = response.status_code == 401 or response.status_code == 403
            details = f"Unauthorized access correctly blocked, Status: {response.status_code}"
            
            self.log_test("Unauthorized Access Protection", success, details)
            return success
        except Exception as e:
            self.log_test("Unauthorized Access Protection", False, f"Error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Marketplace API Tests")
        print("=" * 50)
        
        # Basic API tests
        self.test_api_root()
        menu_success, menu_items = self.test_get_menu_items()
        self.test_get_categories()
        self.test_search_functionality()
        self.test_category_filter()
        
        # Authentication tests
        self.test_admin_login_invalid()
        login_success = self.test_admin_login()
        self.test_unauthorized_access()
        
        # Admin functionality tests (only if login successful)
        created_item = None
        if login_success:
            create_success, created_item = self.test_create_menu_item()
            if create_success and created_item:
                self.test_update_menu_item(created_item.get("id"))
                self.test_delete_menu_item(created_item.get("id"))
            
            self.test_get_inquiries()
        
        # Customer functionality tests
        self.test_create_inquiry()
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed. Check details above.")
            return 1

def main():
    tester = MarketplaceAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())