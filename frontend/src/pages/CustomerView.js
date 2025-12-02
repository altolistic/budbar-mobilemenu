import { useState, useEffect } from "react";
import axios from "axios";
import { Search, ShoppingCart, X, ChevronLeft, ChevronRight, ArrowUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ImageCarousel = ({ images, title }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
        <span className="text-gray-400">No image</span>
      </div>
    );
  }

  const goToPrevious = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="relative w-full h-full group">
      <img
        src={images[currentIndex]}
        alt={`${title} - Image ${currentIndex + 1}`}
        className="w-full h-full object-cover"
      />
      {images.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
            {images.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 w-2 rounded-full ${
                  idx === currentIndex ? 'bg-white' : 'bg-white bg-opacity-50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default function CustomerView() {
  const [menuItems, setMenuItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [firstName, setFirstName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [referralName, setReferralName] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    fetchMenuItems();
  }, [selectedType]);

  useEffect(() => {
    fetchCategories();
    
    // Refresh data when window gains focus (e.g., returning from admin)
    const handleFocus = () => {
      fetchMenuItems();
      fetchCategories();
    };
    
    // Show/hide back to top button based on scroll position
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    filterItems();
  }, [menuItems, selectedCategory, selectedType, searchQuery]);

  const fetchMenuItems = async () => {
    try {
      const params = {};
      if (selectedType !== "all") {
        params.item_type = selectedType;
      }
      const response = await axios.get(`${API}/menu/items`, { params });
      setMenuItems(response.data);
    } catch (error) {
      console.error("Error fetching menu items:", error);
      toast.error("Failed to load menu items");
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API}/menu/categories`);
      setCategories(response.data.categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const filterItems = () => {
    let filtered = menuItems;

    // Type is already filtered by API call
    
    if (selectedCategory) {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredItems(filtered);
  };

  const addToCart = (item, variant) => {
    const cartItem = {
      menu_item_id: item.id,
      title: item.title,
      variant_name: variant.name,
      variant_price: variant.price,
      discount: item.discount,
      quantity: 1
    };

    const existingIndex = cart.findIndex(
      ci => ci.menu_item_id === item.id && ci.variant_name === variant.name
    );

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([...cart, cartItem]);
    }

    toast.success(`Added ${item.title} (${variant.name}) to inquiry`);
  };

  const removeFromCart = (index) => {
    const newCart = cart.filter((_, i) => i !== index);
    setCart(newCart);
  };

  const updateQuantity = (index, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(index);
      return;
    }
    const newCart = [...cart];
    newCart[index].quantity = newQuantity;
    setCart(newCart);
  };

  const calculateItemPrice = (item) => {
    const basePrice = item.variant_price * item.quantity;
    const discountAmount = (basePrice * item.discount) / 100;
    return basePrice - discountAmount;
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + calculateItemPrice(item), 0);
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const submitInquiry = async () => {
    if (!firstName || !phoneNumber) {
      toast.error("Please enter your name and phone number");
      return;
    }

    if (deliveryMethod === "delivery" && !deliveryAddress) {
      toast.error("Please enter your delivery address");
      return;
    }

    if (cart.length === 0) {
      toast.error("Your inquiry cart is empty");
      return;
    }

    try {
      await axios.post(`${API}/inquiries`, {
        first_name: firstName,
        phone_number: phoneNumber,
        delivery_method: deliveryMethod,
        delivery_address: deliveryMethod === "delivery" ? deliveryAddress : "5624 Grand River Road",
        referral_name: referralName || null,
        items: cart,
        total: calculateTotal()
      });

      toast.success("Inquiry submitted successfully! We'll contact you soon.");
      setCart([]);
      setFirstName("");
      setPhoneNumber("");
      setDeliveryMethod("pickup");
      setDeliveryAddress("");
      setReferralName("");
      setIsCartOpen(false);
    } catch (error) {
      console.error("Error submitting inquiry:", error);
      toast.error("Failed to submit inquiry. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold" style={{ color: '#D4AF37' }}>BudBar</h1>
            <div className="flex items-center gap-4">
              <a href="/admin/login" className="text-sm text-gray-600 hover:text-gray-900" data-testid="admin-link">
                Admin
              </a>
              <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="relative" data-testid="cart-button">
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Inquiry Cart
                    {cart.length > 0 && (
                      <Badge className="ml-2 bg-green-600" data-testid="cart-count">{cart.length}</Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Your Inquiry Cart</SheetTitle>
                  <SheetDescription>
                    Review your selections and submit your inquiry
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-8 space-y-6">
                  {/* Customer Info */}
                  <div className="space-y-4">
                    <Input
                      placeholder="First Name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      data-testid="inquiry-first-name"
                    />
                    <Input
                      placeholder="Phone Number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      data-testid="inquiry-phone-number"
                    />
                    
                    {/* Delivery Method */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Delivery Method</label>
                      <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
                        <SelectTrigger data-testid="delivery-method-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pickup">Pick Up</SelectItem>
                          <SelectItem value="delivery">Delivery</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Address Info */}
                    {deliveryMethod === "pickup" ? (
                      <div className="p-4 bg-gray-50 rounded-lg border" data-testid="pickup-address-display">
                        <p className="text-sm font-semibold mb-1">Pick Up Location:</p>
                        <p className="text-sm">5624 Grand River Road</p>
                      </div>
                    ) : (
                      <Input
                        placeholder="Delivery Address"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        data-testid="delivery-address-input"
                      />
                    )}

                    {/* Referral Name (Optional) */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Referral Name (Optional)</label>
                      <Input
                        placeholder="Who referred you?"
                        value={referralName}
                        onChange={(e) => setReferralName(e.target.value)}
                        data-testid="referral-name-input"
                      />
                    </div>
                  </div>

                  {/* Cart Items */}
                  <div className="space-y-4">
                    {cart.length === 0 ? (
                      <p className="text-center text-gray-500 py-8" data-testid="empty-cart-message">Your inquiry cart is empty</p>
                    ) : (
                      cart.map((item, index) => (
                        <div key={index} className="border rounded-lg p-4" data-testid={`cart-item-${index}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold">{item.title}</h4>
                              <p className="text-sm text-gray-600">{item.variant_name}</p>
                            </div>
                            <button
                              onClick={() => removeFromCart(index)}
                              className="text-red-500 hover:text-red-700"
                              data-testid={`remove-item-${index}`}
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => updateQuantity(index, item.quantity - 1)}
                                className="px-3 py-1 border rounded"
                                data-testid={`decrease-quantity-${index}`}
                              >
                                -
                              </button>
                              <span data-testid={`quantity-${index}`}>{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(index, item.quantity + 1)}
                                className="px-3 py-1 border rounded"
                                data-testid={`increase-quantity-${index}`}
                              >
                                +
                              </button>
                            </div>
                            <div className="text-right">
                              {item.discount > 0 && (
                                <span className="text-xs text-green-600 block">-{item.discount}% off</span>
                              )}
                              <span className="font-semibold" data-testid={`item-price-${index}`}>${calculateItemPrice(item).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Total */}
                  {cart.length > 0 && (
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center text-xl font-bold">
                        <span>Total:</span>
                        <span className="gold-text" data-testid="cart-total">${calculateTotal().toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    onClick={submitInquiry}
                    className="w-full btn-primary"
                    disabled={cart.length === 0}
                    data-testid="submit-inquiry-button"
                  >
                    Submit Inquiry
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-5xl font-bold mb-4" style={{ color: '#000' }}>Our <span className="gold-text">Marketplace</span></h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">Discover our curated selection of premium products and services</p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              type="text"
              placeholder="How would you like to feel today?"
              className="pl-12 py-6 text-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="search-input"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-3 justify-center">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(selectedCategory === category ? "" : category)}
                className={`px-6 py-2 rounded-full font-medium transition ${
                  selectedCategory === category
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                data-testid={`category-${category}`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Type Toggle - ALL, Buds, Blends */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-lg border-2 border-gray-200 p-1 bg-white" data-testid="type-toggle">
            <button
              onClick={() => setSelectedType("all")}
              className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                selectedType === "all"
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#c9a527] text-black shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              data-testid="all-toggle"
            >
              ALL
            </button>
            <button
              onClick={() => setSelectedType("buds")}
              className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                selectedType === "buds"
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#c9a527] text-black shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              data-testid="buds-toggle"
            >
              Buds
            </button>
            <button
              onClick={() => setSelectedType("blends")}
              className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                selectedType === "blends"
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#c9a527] text-black shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              data-testid="blends-toggle"
            >
              Blends
            </button>
          </div>
        </div>

        {/* Menu Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredItems.map(item => (
            <div key={item.id} className="card" data-testid={`menu-item-${item.id}`}>
              <div className="aspect-video overflow-hidden">
                <ImageCarousel images={item.images || []} title={item.title} />
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-2xl font-bold" data-testid={`menu-item-title-${item.id}`}>{item.title}</h3>
                  {item.discount > 0 && (
                    <Badge className="bg-green-600" data-testid={`discount-badge-${item.id}`}>-{item.discount}%</Badge>
                  )}
                </div>
                <p className="text-gray-600 mb-4" data-testid={`menu-item-description-${item.id}`}>{item.description}</p>
                <Badge variant="outline" className="mb-4" data-testid={`category-badge-${item.id}`}>{item.category}</Badge>

                {/* Variants */}
                <div className="space-y-2 mt-4">
                  {item.variants.map((variant, idx) => (
                    <div key={idx} className="flex justify-between items-center" data-testid={`variant-${item.id}-${idx}`}>
                      <div>
                        <span className="font-medium">{variant.name}</span>
                        {item.discount > 0 && (
                          <span className="ml-2 text-sm text-gray-400 line-through">
                            ${variant.price.toFixed(2)}
                          </span>
                        )}
                        <span className="ml-2 font-bold gold-text">
                          ${(variant.price * (1 - item.discount / 100)).toFixed(2)}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => addToCart(item, variant)}
                        className="btn-outline"
                        data-testid={`add-to-cart-${item.id}-${idx}`}
                      >
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-16" data-testid="no-items-found">
            <p className="text-xl text-gray-500">No items found matching your criteria</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-black text-white mt-20 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="gold-text text-lg font-semibold">BudBar Marketplace</p>
          <p className="text-gray-400 mt-2">Premium products and services</p>
        </div>
      </footer>

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 left-8 z-50 p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
          style={{ 
            background: 'linear-gradient(135deg, #D4AF37 0%, #c9a527 100%)',
            color: '#000000'
          }}
          aria-label="Back to top"
          data-testid="back-to-top-button"
        >
          <ArrowUp className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}