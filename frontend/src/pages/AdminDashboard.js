import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, LogOut } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminDashboard() {
  const [menuItems, setMenuItems] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    item_type: "blends",
    images: [],
    discount: 0,
    variants: [{ name: "", price: 0 }]
  });
  const [uploadedImages, setUploadedImages] = useState([]);

  useEffect(() => {
    fetchMenuItems();
    fetchInquiries();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('admin_token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate("/admin/login");
  };

  const fetchMenuItems = async () => {
    try {
      const response = await axios.get(`${API}/menu/items`);
      setMenuItems(response.data);
    } catch (error) {
      console.error("Error fetching menu items:", error);
    }
  };

  const fetchInquiries = async () => {
    try {
      const response = await axios.get(`${API}/admin/inquiries`, getAuthHeaders());
      setInquiries(response.data);
    } catch (error) {
      console.error("Error fetching inquiries:", error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      category: "",
      item_type: "blends",
      images: [],
      discount: 0,
      variants: [{ name: "", price: 0 }]
    });
    setUploadedImages([]);
    setEditingItem(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingItem) {
        await axios.put(`${API}/admin/menu/items/${editingItem.id}`, formData, getAuthHeaders());
        toast.success("Item updated successfully");
      } else {
        await axios.post(`${API}/admin/menu/items`, formData, getAuthHeaders());
        toast.success("Item added successfully");
      }

      fetchMenuItems();
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving item:", error);
      toast.error("Failed to save item");
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description,
      category: item.category,
      item_type: item.item_type || "blends",
      images: item.images || [],
      discount: item.discount,
      variants: item.variants
    });
    setUploadedImages(item.images || []);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;

    try {
      await axios.delete(`${API}/admin/menu/items/${itemId}`, getAuthHeaders());
      toast.success("Item deleted successfully");
      fetchMenuItems();
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Failed to delete item");
    }
  };

  const addVariant = () => {
    setFormData({
      ...formData,
      variants: [...formData.variants, { name: "", price: 0 }]
    });
  };

  const removeVariant = (index) => {
    const newVariants = formData.variants.filter((_, i) => i !== index);
    setFormData({ ...formData, variants: newVariants });
  };

  const updateVariant = (index, field, value) => {
    const newVariants = [...formData.variants];
    newVariants[index][field] = field === 'price' ? parseFloat(value) || 0 : value;
    setFormData({ ...formData, variants: newVariants });
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const formDataUpload = new FormData();
    files.forEach(file => {
      formDataUpload.append('files', file);
    });

    try {
      const response = await axios.post(`${API}/admin/upload-images`, formDataUpload, {
        ...getAuthHeaders(),
        headers: {
          ...getAuthHeaders().headers,
          'Content-Type': 'multipart/form-data'
        }
      });

      const newImages = [...uploadedImages, ...response.data.images];
      setUploadedImages(newImages);
      setFormData({ ...formData, images: newImages });
      toast.success(`${files.length} image(s) uploaded successfully`);
    } catch (error) {
      console.error("Error uploading images:", error);
      toast.error("Failed to upload images");
    }
  };

  const removeImage = (index) => {
    const newImages = uploadedImages.filter((_, i) => i !== index);
    setUploadedImages(newImages);
    setFormData({ ...formData, images: newImages });
  };

  const handleStatusChange = async (inquiryId, newStatus) => {
    try {
      await axios.put(`${API}/admin/inquiries/${inquiryId}/status`, null, {
        ...getAuthHeaders(),
        params: { status: newStatus }
      });
      toast.success(`Status updated to ${newStatus}`);
      fetchInquiries();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleDeleteInquiry = async (inquiryId, customerName) => {
    if (!window.confirm(`Are you sure you want to delete the inquiry from ${customerName}? This action cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`${API}/admin/inquiries/${inquiryId}`, getAuthHeaders());
      toast.success("Inquiry deleted successfully");
      fetchInquiries();
    } catch (error) {
      console.error("Error deleting inquiry:", error);
      toast.error("Failed to delete inquiry");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold gold-text">Admin Dashboard</h1>
            <Button onClick={handleLogout} variant="outline" data-testid="logout-button">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="menu" className="space-y-6">
          <TabsList>
            <TabsTrigger value="menu" data-testid="menu-tab">Menu Items</TabsTrigger>
            <TabsTrigger value="inquiries" data-testid="inquiries-tab">Inquiries</TabsTrigger>
          </TabsList>

          {/* Menu Items Tab */}
          <TabsContent value="menu" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Manage Menu Items</h2>
              <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                setIsAddDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="btn-primary" data-testid="add-menu-item-button">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingItem ? "Edit" : "Add"} Menu Item</DialogTitle>
                    <DialogDescription>Fill in the details for the menu item</DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                      placeholder="Title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      data-testid="item-title-input"
                    />
                    <Textarea
                      placeholder="Description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                      data-testid="item-description-input"
                    />
                    <Input
                      placeholder="Category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                      data-testid="item-category-input"
                    />

                    {/* Image Upload Section */}
                    <div className="space-y-2">
                      <label className="font-semibold">Product Images</label>
                      <Input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        data-testid="item-image-input"
                      />
                      {uploadedImages.length > 0 && (
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          {uploadedImages.map((img, idx) => (
                            <div key={idx} className="relative">
                              <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-20 object-cover rounded" />
                              <button
                                type="button"
                                onClick={() => removeImage(idx)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Input
                      type="number"
                      placeholder="Discount (%)"
                      value={formData.discount}
                      onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                      min="0"
                      max="100"
                      data-testid="item-discount-input"
                    />

                    {/* Variants */}
                    <div className="space-y-2">
                      <label className="font-semibold">Variants (up to 5)</label>
                      {formData.variants.map((variant, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder="Variant name"
                            value={variant.name}
                            onChange={(e) => updateVariant(index, 'name', e.target.value)}
                            required
                            data-testid={`variant-name-${index}`}
                          />
                          <Input
                            type="number"
                            placeholder="Price"
                            value={variant.price}
                            onChange={(e) => updateVariant(index, 'price', e.target.value)}
                            required
                            min="0"
                            step="0.01"
                            data-testid={`variant-price-${index}`}
                          />
                          {formData.variants.length > 1 && (
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => removeVariant(index)}
                              data-testid={`remove-variant-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {formData.variants.length < 5 && (
                        <Button type="button" variant="outline" onClick={addVariant} data-testid="add-variant-button">
                          <Plus className="mr-2 h-4 w-4" />
                          Add Variant
                        </Button>
                      )}
                    </div>

                    <Button type="submit" className="w-full btn-primary" data-testid="save-item-button">
                      {editingItem ? "Update" : "Add"} Item
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Menu Items List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {menuItems.map(item => (
                <Card key={item.id} data-testid={`admin-menu-item-${item.id}`}>
                  <CardHeader>
                    <div className="aspect-video overflow-hidden rounded-lg mb-4">
                      {item.images && item.images.length > 0 ? (
                        <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-400">No image</span>
                        </div>
                      )}
                    </div>
                    <CardTitle>{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                    <p className="text-sm mb-2">Category: <span className="font-semibold">{item.category}</span></p>
                    {item.discount > 0 && (
                      <p className="text-sm text-green-600 mb-2">Discount: {item.discount}%</p>
                    )}
                    <div className="space-y-1 mb-4">
                      {item.variants.map((v, idx) => (
                        <p key={idx} className="text-sm">{v.name}: ${v.price.toFixed(2)}</p>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(item)}
                        data-testid={`edit-item-${item.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(item.id)}
                        data-testid={`delete-item-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Inquiries Tab */}
          <TabsContent value="inquiries" className="space-y-6">
            <h2 className="text-2xl font-bold">Customer Inquiries</h2>

            <div className="space-y-4">
              {inquiries.map(inquiry => (
                <Card key={inquiry.id} data-testid={`inquiry-${inquiry.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle>Inquiry from {inquiry.first_name}</CardTitle>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteInquiry(inquiry.id, inquiry.first_name)}
                        data-testid={`delete-inquiry-${inquiry.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p><strong>Phone:</strong> {inquiry.phone_number}</p>
                      <div className="flex items-center gap-2">
                        <p><strong>Status:</strong></p>
                        <Select 
                          value={inquiry.status} 
                          onValueChange={(value) => handleStatusChange(inquiry.id, value)}
                        >
                          <SelectTrigger className="w-[180px]" data-testid={`status-select-${inquiry.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="complete">Complete</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p><strong>Delivery Method:</strong> <span className="capitalize">{inquiry.delivery_method || 'N/A'}</span></p>
                      <p><strong>Address:</strong> {inquiry.delivery_address || 'N/A'}</p>
                      <p><strong>Date:</strong> {new Date(inquiry.created_at).toLocaleString()}</p>
                      <p><strong>Total:</strong> <span className="gold-text font-bold">${inquiry.total.toFixed(2)}</span></p>

                      <div className="mt-4">
                        <p className="font-semibold mb-2">Items:</p>
                        <div className="space-y-2">
                          {inquiry.items.map((item, idx) => (
                            <div key={idx} className="border-l-4 border-gold pl-3 py-1">
                              <p>{item.title} - {item.variant_name}</p>
                              <p className="text-sm text-gray-600">Quantity: {item.quantity} × ${item.variant_price.toFixed(2)}</p>
                              {item.discount > 0 && (
                                <p className="text-sm text-green-600">Discount: {item.discount}%</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {inquiries.length === 0 && (
                <p className="text-center text-gray-500 py-8" data-testid="no-inquiries">No inquiries yet</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}