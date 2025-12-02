import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, LogOut, Download, List, Grid, GripVertical } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableMenuItem } from "@/components/SortableMenuItem";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminDashboard() {
  const [menuItems, setMenuItems] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [inquirySearchQuery, setInquirySearchQuery] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
  const [menuView, setMenuView] = useState("detailed"); // "detailed" or "list"
  // Filtered arrays will be computed with useMemo
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    categories: [],
    item_type: "blends",
    meta_details: "",
    images: [],
    discount: 0,
    variants: [{ name: "", price: 0 }]
  });
  const [uploadedImages, setUploadedImages] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [newCategoryInput, setNewCategoryInput] = useState("");

  const getAuthHeaders = () => {
    const token = localStorage.getItem('admin_token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('admin_token');
    navigate("/admin/login");
  }, [navigate]);

  const fetchMenuItems = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/menu/items`);
      setMenuItems(response.data);
    } catch (error) {
      console.error("Error fetching menu items:", error);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/menu/categories`);
      setAvailableCategories(response.data.categories || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }, []);

  const fetchInquiries = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/admin/inquiries`, getAuthHeaders());
      setInquiries(response.data);
    } catch (error) {
      console.error("Error fetching inquiries:", error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  }, [handleLogout]);

  // Filtered menu items using useMemo
  const filteredMenuItems = useMemo(() => {
    if (!menuSearchQuery) {
      return menuItems;
    }

    const query = menuSearchQuery.toLowerCase();
    return menuItems.filter(item =>
      item.title.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      (item.meta_details && item.meta_details.toLowerCase().includes(query))
    );
  }, [menuItems, menuSearchQuery]);

  // Filtered inquiries using useMemo
  const filteredInquiries = useMemo(() => {
    if (!inquirySearchQuery) {
      return inquiries;
    }

    const query = inquirySearchQuery.toLowerCase();
    return inquiries.filter(inquiry =>
      inquiry.first_name.toLowerCase().includes(query) ||
      inquiry.phone_number.includes(query) ||
      inquiry.delivery_address?.toLowerCase().includes(query) ||
      inquiry.items.some(item => item.title.toLowerCase().includes(query))
    );
  }, [inquiries, inquirySearchQuery]);

  useEffect(() => {
    fetchMenuItems();
    fetchCategories();
    fetchInquiries();
  }, [fetchMenuItems, fetchCategories, fetchInquiries]);

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      categories: [],
      item_type: "blends",
      meta_details: "",
      images: [],
      discount: 0,
      variants: [{ name: "", price: 0 }]
    });
    setUploadedImages([]);
    setEditingItem(null);
    setNewCategoryInput("");
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
      categories: item.categories || [],
      item_type: item.item_type || "blends",
      meta_details: item.meta_details || "",
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

  const downloadCSV = (useDateRange = false) => {
    let inquiriesToExport = filteredInquiries;

    // Filter by date range if selected
    if (useDateRange && startDate && endDate) {
      // Set time to start and end of day for proper comparison
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      inquiriesToExport = inquiriesToExport.filter(inquiry => {
        const inquiryDate = new Date(inquiry.created_at);
        return inquiryDate >= startOfDay && inquiryDate <= endOfDay;
      });
    }

    if (inquiriesToExport.length === 0) {
      toast.error("No inquiries found for the selected date range");
      return;
    }

    // CSV Headers
    const headers = ["Date", "Customer Name", "Phone", "Delivery Method", "Address", "Referral Name", "Status", "Total", "Items"];
    
    // CSV Rows
    const rows = inquiriesToExport.map(inquiry => {
      const itemsList = inquiry.items.map(item => 
        `${item.title} (${item.variant_name}) x${item.quantity}`
      ).join("; ");
      
      return [
        new Date(inquiry.created_at).toLocaleString(),
        inquiry.first_name,
        inquiry.phone_number,
        inquiry.delivery_method,
        inquiry.delivery_address || "",
        inquiry.referral_name || "",
        inquiry.status,
        `$${inquiry.total.toFixed(2)}`,
        itemsList
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `inquiries_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${inquiriesToExport.length} inquiries to CSV`);
    setIsDownloadDialogOpen(false);
    setStartDate(null);
    setEndDate(null);
  };

  const handleDragEnd = async (event, itemType) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const itemsOfType = filteredMenuItems.filter(item => item.item_type === itemType);
    const oldIndex = itemsOfType.findIndex(item => item.id === active.id);
    const newIndex = itemsOfType.findIndex(item => item.id === over.id);

    const reorderedItems = arrayMove(itemsOfType, oldIndex, newIndex);
    
    // Update display_order for reordered items
    const orderUpdates = reorderedItems.map((item, index) => ({
      id: item.id,
      display_order: index
    }));

    try {
      await axios.put(`${API}/admin/menu/reorder`, orderUpdates, getAuthHeaders());
      toast.success("Menu order updated");
      fetchMenuItems();
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Failed to update menu order");
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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
              <div className="flex items-center gap-4">
                {/* View Toggle */}
                <div className="inline-flex rounded-lg border p-1 bg-white">
                  <button
                    onClick={() => setMenuView("detailed")}
                    className={`px-4 py-2 rounded-md transition-colors ${
                      menuView === "detailed"
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    data-testid="detailed-view-button"
                  >
                    <Grid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setMenuView("list")}
                    className={`px-4 py-2 rounded-md transition-colors ${
                      menuView === "list"
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    data-testid="list-view-button"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
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
                    
                    {/* Meta Details for Enhanced Search */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Meta Details (Enhanced Search)</label>
                      <Textarea
                        placeholder="Add detailed keywords and descriptions for better search matching (e.g., effects, benefits, feelings, use cases). This is not visible to customers but helps match their search queries."
                        value={formData.meta_details}
                        onChange={(e) => setFormData({ ...formData, meta_details: e.target.value })}
                        rows={4}
                        data-testid="item-meta-details-input"
                        className="text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">Examples: &quot;relaxation, stress relief, calm, peaceful, anxiety, focus, creativity, energy boost, sleep aid&quot;</p>
                    </div>

                    {/* Type Selection */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Type</label>
                      <Select 
                        value={formData.item_type} 
                        onValueChange={(value) => setFormData({ ...formData, item_type: value })}
                      >
                        <SelectTrigger data-testid="item-type-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="blends">Blends</SelectItem>
                          <SelectItem value="buds">Buds</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

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

            {/* Search Bar for Menu Items */}
            <div className="flex gap-4 items-center">
              <Input
                placeholder="Search menu items by title, description, category, or meta details..."
                value={menuSearchQuery}
                onChange={(e) => setMenuSearchQuery(e.target.value)}
                className="flex-1"
                data-testid="menu-search-input"
              />
            </div>

            {/* Detailed View */}
            {menuView === "detailed" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMenuItems.length === 0 && menuSearchQuery && (
                  <div className="col-span-full text-center text-gray-500 py-8">
                    No menu items match your search
                  </div>
                )}
                {filteredMenuItems.map(item => (
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
                      <p className="text-sm mb-2">
                        Type: 
                        <Badge className={`ml-2 ${item.item_type === "buds" ? "bg-green-600" : "bg-purple-600"}`}>
                          {item.item_type === "buds" ? "Bud" : "Blend"}
                        </Badge>
                      </p>
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
            )}

            {/* List View with Drag & Drop */}
            {menuView === "list" && (
              <div className="space-y-8">
                {/* Buds Section */}
                <div>
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span>Buds</span>
                    <span className="text-sm font-normal text-gray-500">
                      (Drag to reorder)
                    </span>
                  </h3>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => handleDragEnd(event, "buds")}
                  >
                    <SortableContext
                      items={filteredMenuItems.filter(item => item.item_type === "buds").map(item => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {filteredMenuItems.filter(item => item.item_type === "buds").map(item => (
                          <SortableMenuItem 
                            key={item.id} 
                            item={item} 
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                          />
                        ))}
                        {filteredMenuItems.filter(item => item.item_type === "buds").length === 0 && (
                          <p className="text-center text-gray-500 py-4">No buds items</p>
                        )}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>

                {/* Blends Section */}
                <div>
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span>Blends</span>
                    <span className="text-sm font-normal text-gray-500">
                      (Drag to reorder)
                    </span>
                  </h3>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => handleDragEnd(event, "blends")}
                  >
                    <SortableContext
                      items={filteredMenuItems.filter(item => item.item_type === "blends").map(item => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {filteredMenuItems.filter(item => item.item_type === "blends").map(item => (
                          <SortableMenuItem 
                            key={item.id} 
                            item={item}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                          />
                        ))}
                        {filteredMenuItems.filter(item => item.item_type === "blends").length === 0 && (
                          <p className="text-center text-gray-500 py-4">No blends items</p>
                        )}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Inquiries Tab */}
          <TabsContent value="inquiries" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Customer Inquiries</h2>
              
              {/* Download Button */}
              <Button 
                onClick={() => setIsDownloadDialogOpen(true)} 
                className="btn-primary" 
                data-testid="download-inquiries-button"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Inquiries
              </Button>
            </div>

            {/* Download Dialog */}
            <Dialog open={isDownloadDialogOpen} onOpenChange={setIsDownloadDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Download Inquiries</DialogTitle>
                  <DialogDescription>
                    Choose to download all inquiries or select a specific date range
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                  {/* Download All Button */}
                  <Button 
                    onClick={() => downloadCSV(false)} 
                    className="w-full btn-secondary"
                    data-testid="download-all-button"
                  >
                    Download All Inquiries
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-gray-500">Or</span>
                    </div>
                  </div>

                  {/* Date Range Selection */}
                  <div className="space-y-4">
                    <label className="text-sm font-medium">Select Date Range:</label>
                    <div className="flex items-center gap-2">
                      <DatePicker
                        selected={startDate}
                        onChange={(date) => setStartDate(date)}
                        selectsStart
                        startDate={startDate}
                        endDate={endDate}
                        placeholderText="Start Date"
                        className="px-3 py-2 border rounded-md text-sm w-full"
                        data-testid="start-date-picker"
                      />
                      <span className="text-gray-500">to</span>
                      <DatePicker
                        selected={endDate}
                        onChange={(date) => setEndDate(date)}
                        selectsEnd
                        startDate={startDate}
                        endDate={endDate}
                        minDate={startDate}
                        placeholderText="End Date"
                        className="px-3 py-2 border rounded-md text-sm w-full"
                        data-testid="end-date-picker"
                      />
                    </div>
                    <Button 
                      onClick={() => downloadCSV(true)} 
                      className="w-full btn-primary"
                      disabled={!startDate || !endDate}
                      data-testid="download-date-range-button"
                    >
                      Download Selected Range
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Search Bar */}
            <Input
              type="text"
              placeholder="Search inquiries by customer name, phone, address, or items..."
              value={inquirySearchQuery}
              onChange={(e) => setInquirySearchQuery(e.target.value)}
              data-testid="inquiry-search-input"
              className="max-w-md"
            />

            <div className="space-y-4">
              {filteredInquiries.map(inquiry => (
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
                      {inquiry.referral_name && (
                        <p><strong>Referral Name:</strong> {inquiry.referral_name}</p>
                      )}
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

              {filteredInquiries.length === 0 && (
                <p className="text-center text-gray-500 py-8" data-testid="no-inquiries">
                  {inquirySearchQuery ? "No inquiries match your search" : "No inquiries yet"}
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}