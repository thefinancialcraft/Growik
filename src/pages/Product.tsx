import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import SearchBar from "@/components/SearchBar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Package, ShoppingCart, TrendingUp, Filter, Plus, LayoutGrid, List, Loader2, Pencil, Trash2, Power, Building2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ProductRecord = {
  id: string;
  product_id: string | null;
  name: string;
  company: string | null;
  company_description: string | null;
  manager_name: string | null;
  manager_contact: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  category: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

type ProductFormState = {
  name: string;
  company: string;
  company_description: string;
  manager_name: string;
  manager_contact: string;
  description: string;
  price: string;
  currency: 'USD' | 'INR';
  category: string;
  status: 'active' | 'inactive';
};

const Product = () => {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState<ProductFormState>({
    name: "",
    company: "",
    company_description: "",
    manager_name: "",
    manager_contact: "",
    description: "",
    price: "",
    currency: 'USD',
    category: "",
    status: 'active',
  });
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isStatusUpdatingId, setIsStatusUpdatingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);
  const [editFormData, setEditFormData] = useState<ProductFormState>({
    name: "",
    company: "",
    company_description: "",
    manager_name: "",
    manager_contact: "",
    description: "",
    price: "",
    currency: 'USD',
    category: "",
    status: 'active',
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductRecord | null>(null);
  const [isAddCompanyDialogOpen, setIsAddCompanyDialogOpen] = useState<boolean>(false);
  const [newCompanyName, setNewCompanyName] = useState<string>("");
  const [newCompanyDescription, setNewCompanyDescription] = useState<string>("");
  const [newManagerName, setNewManagerName] = useState<string>("");
  const [newManagerContact, setNewManagerContact] = useState<string>("");
  const [isCreatingCompany, setIsCreatingCompany] = useState<boolean>(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setProducts(data ?? []);
      } catch (err: any) {
        console.error('Error fetching products:', err);
        toast({
          title: 'Unable to load products',
          description: err?.message || 'Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [toast]);

  const categoryCount = useMemo(() => {
    const set = new Set<string>();
    products.forEach((prod) => {
      if (prod.category) set.add(prod.category);
    });
    return set.size;
  }, [products]);

  const activeCount = useMemo(() => products.filter((prod) => prod.status === 'active').length, [products]);
  const inactiveCount = useMemo(() => products.filter((prod) => prod.status === 'inactive').length, [products]);
  
  const companyCount = useMemo(() => {
    const set = new Set<string>();
    products.forEach((prod) => {
      if (prod.company) set.add(prod.company);
    });
    return set.size;
  }, [products]);

  const companyList = useMemo(() => {
    const set = new Set<string>();
    products.forEach((prod) => {
      if (prod.company) set.add(prod.company);
    });
    return Array.from(set).sort();
  }, [products]);

  const summaryTiles = [
    {
      id: "categories",
      title: "Categories",
      value: categoryCount,
      subtext: "Product categories",
      trend: "Organized catalog",
      icon: Package,
      accent: "from-blue-500 to-cyan-500",
    },
    {
      id: "companies",
      title: "Companies",
      value: companyCount,
      subtext: "Partner companies",
      trend: "Growing network",
      icon: TrendingUp,
      accent: "from-purple-500 to-pink-500",
    },
    {
      id: "products",
      title: "Total Products",
      value: products.length,
      subtext: `${activeCount} active, ${inactiveCount} inactive`,
      trend: "Product catalog",
      icon: ShoppingCart,
      accent: "from-emerald-500 to-teal-500",
    },
  ];

  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    products.forEach((prod) => {
      if (prod.category) categories.add(prod.category);
    });
    return Array.from(categories).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return products.filter((prod) => {
      const matchesSearch =
        term.length === 0 ||
        (prod.name ?? '').toLowerCase().includes(term) ||
        (prod.description ?? '').toLowerCase().includes(term) ||
        (prod.category ?? '').toLowerCase().includes(term) ||
        (prod.product_id ?? '').toLowerCase().includes(term);

      const matchesCategory =
        categoryFilter === "All" || prod.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, categoryFilter]);

  const resetForm = () => {
    setFormData({
      name: "",
      company: "",
      company_description: "",
      manager_name: "",
      manager_contact: "",
      description: "",
      price: "",
      currency: 'USD',
      category: "",
      status: 'active',
    });
  };

  const resetEditForm = () => {
    setEditFormData({
      name: "",
      company: "",
      company_description: "",
      manager_name: "",
      manager_contact: "",
      description: "",
      price: "",
      currency: 'USD',
      category: "",
      status: 'active',
    });
    setEditingProduct(null);
  };

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) {
      toast({
        title: 'Company name required',
        description: 'Please enter a company name.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingCompany(true);
    
    try {
      const companyPayload = {
        name: newCompanyName.trim(),
        description: newCompanyDescription.trim() || null,
        manager_name: newManagerName.trim() || null,
        manager_contact: newManagerContact.trim() || null,
      };

      const { data, error } = await supabase
        .from('companies')
        .insert(companyPayload as any)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        const companyData = data as any;
        const companyName = companyData.name;
        
        // Add the company details to both add and edit form data
        setFormData((prev) => ({ 
          ...prev, 
          company: companyName,
          company_description: companyData.description || "",
          manager_name: companyData.manager_name || "",
          manager_contact: companyData.manager_contact || "",
        }));
        setEditFormData((prev) => ({ 
          ...prev, 
          company: companyName,
          company_description: companyData.description || "",
          manager_name: companyData.manager_name || "",
          manager_contact: companyData.manager_contact || "",
        }));
        
        // Clear form
        setNewCompanyName("");
        setNewCompanyDescription("");
        setNewManagerName("");
        setNewManagerContact("");
        setIsAddCompanyDialogOpen(false);
        
        toast({
          title: 'Company created',
          description: `${companyName} has been created successfully.`,
        });
      }
    } catch (err: any) {
      console.error('Error creating company:', err);
      toast({
        title: 'Failed to create company',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingCompany(false);
    }
  };

  const handleCreateProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: 'Name is required',
        description: 'Please provide a product name.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    // Generate product ID starting from PR0000
    let generatedProductId = 'PR0000';
    try {
      const { data: existingProducts } = await supabase
        .from('products')
        .select('product_id')
        .order('created_at', { ascending: false })
        .limit(100);

      if (existingProducts && existingProducts.length > 0) {
        const maxNumber = existingProducts.reduce((max: number, prod: any) => {
          if (prod.product_id && prod.product_id.startsWith('PR')) {
            const numStr = prod.product_id.substring(2);
            const num = parseInt(numStr, 10);
            return !isNaN(num) && num > max ? num : max;
          }
          return max;
        }, 0);
        generatedProductId = `PR${(maxNumber + 1).toString().padStart(4, '0')}`;
      }
    } catch (err) {
      console.error('Error generating product ID:', err);
    }

    const payload = {
      product_id: generatedProductId,
      name: formData.name.trim(),
      company: formData.company.trim() || null,
      description: formData.description.trim() || null,
      price: formData.price ? parseFloat(formData.price) : null,
      currency: formData.currency,
      category: formData.category.trim() || null,
      status: formData.status,
    };

    try {
      const { data, error } = await supabase
        .from('products')
        .insert(payload as any)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setProducts((prev) => [data as ProductRecord, ...prev]);
        setIsAddDialogOpen(false);
        resetForm();
        toast({
          title: 'Product added',
          description: `${(data as ProductRecord).name} has been added successfully.`,
        });
      }
    } catch (err: any) {
      console.error('Error creating product:', err);
      toast({
        title: 'Failed to add product',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (product: ProductRecord) => {
    setEditingProduct(product);
    setEditFormData({
      name: product.name,
      company: product.company ?? "",
      company_description: "",
      manager_name: "",
      manager_contact: "",
      description: product.description ?? "",
      price: product.price?.toString() ?? "",
      currency: (product.currency as 'USD' | 'INR') ?? 'USD',
      category: product.category ?? "",
      status: product.status,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingProduct) return;
    if (!editFormData.name.trim()) {
      toast({
        title: 'Name is required',
        description: 'Please provide a product name.',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdating(true);

    const payload = {
      name: editFormData.name.trim(),
      company: editFormData.company.trim() || null,
      description: editFormData.description.trim() || null,
      price: editFormData.price ? parseFloat(editFormData.price) : null,
      currency: editFormData.currency,
      category: editFormData.category.trim() || null,
      status: editFormData.status,
    };

    try {
      const { data, error } = await supabase
        .from('products')
        // @ts-ignore - Supabase type inference issue
        .update(payload)
        .eq('id', editingProduct.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setProducts((prev) => prev.map((prod) => (prod.id === editingProduct.id ? data as ProductRecord : prod)));
        setIsEditDialogOpen(false);
        resetEditForm();
        toast({
          title: 'Product updated',
          description: `${(data as ProductRecord).name} has been updated successfully.`,
        });
      }
    } catch (err: any) {
      console.error('Error updating product:', err);
      toast({
        title: 'Failed to update product',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = async (product: ProductRecord) => {
    const nextStatus: 'active' | 'inactive' = product.status === 'active' ? 'inactive' : 'active';
    setIsStatusUpdatingId(product.id);
    try {
      const { data, error } = await supabase
        .from('products')
        .update({ status: nextStatus } as never)
        .eq('id', product.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setProducts((prev) => prev.map((prod) => (prod.id === product.id ? data as ProductRecord : prod)));
        toast({
          title: nextStatus === 'active' ? 'Product activated' : 'Product deactivated',
          description: `${(data as ProductRecord).name} is now ${nextStatus}.`,
        });
      }
    } catch (err: any) {
      console.error('Error updating status:', err);
      toast({
        title: 'Status update failed',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsStatusUpdatingId(null);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) {
        throw error;
      }

      setProducts((prev) => prev.filter((prod) => prod.id !== deleteTarget.id));
      toast({
        title: 'Product removed',
        description: `${deleteTarget.name} has been deleted.`,
      });
      setDeleteTarget(null);
    } catch (err: any) {
      console.error('Error deleting product:', err);
      toast({
        title: 'Delete failed',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const noResults = !isLoading && filteredProducts.length === 0;

  return (
    <>
      <div className="flex min-h-screen bg-gradient-subtle">
        <Sidebar />
        <div className="flex-1 lg:ml-56">
          <Header />
          <main className="container mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-6 space-y-4 pb-24 lg:pb-8 animate-fade-in">
            <div className="bg-gradient-primary rounded-xl p-4 md:p-6 text-white shadow-glow">
              <h2 className="text-xl md:text-2xl font-bold mb-1">Product Management</h2>
              <p className="text-white/80 text-sm">Manage your product catalog, inventory, and pricing</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {summaryTiles.map(({ id, title, value, subtext, trend, icon: Icon, accent }) => (
                <Card
                  key={id}
                  className="relative overflow-hidden p-4 md:p-6 bg-card hover:shadow-lg transition-all duration-300 border-border/50 hover:scale-[1.02]"
                >
                  <div className={cn("absolute inset-0 opacity-[0.08] pointer-events-none bg-gradient-to-br", accent)} />
                  <div className="relative space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.12em] mb-1">
                          {title}
                        </p>
                        <div className="flex items-end gap-2">
                          <span className="text-2xl md:text-3xl font-bold text-foreground">
                            {typeof value === 'number' ? value.toLocaleString() : value}
                          </span>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center text-primary-foreground",
                          "bg-gradient-to-br",
                          accent
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{subtext}</p>
                    <div className="text-xs font-medium text-primary/80 bg-primary/10 inline-flex px-2.5 py-1 rounded-full">
                      {trend}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-stretch">
              <div className="flex-1 flex items-center gap-3">
                <div className="flex-1">
                  <SearchBar
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Search products..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => setViewMode('grid')}
                    className="h-10 w-10"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => setViewMode('list')}
                    className="h-10 w-10"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button
                variant="outline"
                className="h-11 md:h-12 px-4 rounded-lg border-border/60"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Dialog
                open={isAddDialogOpen}
                onOpenChange={(open) => {
                  setIsAddDialogOpen(open);
                  if (open) {
                    resetForm();
                  } else {
                    resetForm();
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto h-11 px-5 rounded-lg shadow-md bg-gradient-primary hover:opacity-90 transition-all duration-300">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Product</DialogTitle>
                    <DialogDescription>Fill in the details to add a new product to your catalog.</DialogDescription>
                  </DialogHeader>
                  <form className="space-y-4" onSubmit={handleCreateProduct}>
                    <div className="space-y-1">
                      <Label htmlFor="name">Product Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="Enter product name"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="company">Company</Label>
                      <div className="flex gap-2">
                        <Select
                          value={formData.company}
                          onValueChange={(value) => {
                            if (value === '__create_new__') {
                              setIsAddCompanyDialogOpen(true);
                            } else {
                              setFormData((prev) => ({ ...prev, company: value }));
                            }
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select company" />
                          </SelectTrigger>
                          <SelectContent>
                            {companyList.map((company) => (
                              <SelectItem key={company} value={company}>
                                {company}
                              </SelectItem>
                            ))}
                            <SelectItem value="__create_new__" className="text-primary font-medium">
                              <div className="flex items-center gap-2">
                                <Plus className="h-4 w-4" />
                                <span>Create New Company</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                        placeholder="Enter product description"
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="price">Price</Label>
                        <div className="flex gap-2">
                          <select
                            value={formData.currency}
                            onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value as 'USD' | 'INR' }))}
                            className="w-20 h-10 px-3 rounded-md border border-input bg-background text-sm"
                          >
                            <option value="USD">$ USD</option>
                            <option value="INR">₹ INR</option>
                          </select>
                          <Input
                            id="price"
                            type="number"
                            step="0.01"
                            value={formData.price}
                            onChange={(event) => setFormData((prev) => ({ ...prev, price: event.target.value }))}
                            placeholder="0.00"
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="category">Category</Label>
                        <Input
                          id="category"
                          value={formData.category}
                          onChange={(event) => setFormData((prev) => ({ ...prev, category: event.target.value }))}
                          placeholder="Electronics"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Status</Label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="status"
                            value="active"
                            checked={formData.status === 'active'}
                            onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">Active</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="status"
                            value="inactive"
                            checked={formData.status === 'inactive'}
                            onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">Inactive</span>
                        </label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSaving}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSaving}>
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          'Add Product'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {isFilterOpen && (
              <Card className="p-4 border-border/60">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={categoryFilter === 'All' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCategoryFilter('All')}
                    className={cn(
                      'rounded-full',
                      categoryFilter !== 'All' && 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    All
                  </Button>
                  {availableCategories.map((category) => (
                    <Button
                      key={category}
                      variant={categoryFilter === category ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setCategoryFilter(category)}
                      className="rounded-full"
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </Card>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : noResults ? (
              <Card className="p-8 text-center border-border/60">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No products found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchTerm || categoryFilter !== 'All'
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Get started by adding your first product.'}
                </p>
                {!searchTerm && categoryFilter === 'All' && (
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                )}
              </Card>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProducts.map((product) => (
                  <Card key={product.id} className="p-4 md:p-6 border-border/60 hover:shadow-md transition-shadow">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg truncate">{product.name}</h3>
                          {product.product_id && (
                            <p className="text-xs text-muted-foreground">ID: {product.product_id}</p>
                          )}
                          {product.company && (
                            <p className="text-xs text-muted-foreground mt-1">Company: {product.company}</p>
                          )}
                        </div>
                        <Badge
                          className={cn(
                            "rounded-full px-3 py-1 text-xs",
                            product.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                          )}
                        >
                          {product.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {product.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        {product.price !== null && (
                          <div>
                            <span className="text-muted-foreground">Price: </span>
                            <span className="font-semibold">
                              {product.currency === 'INR' ? '₹' : '$'}{product.price.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                      {product.category && (
                        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                          {product.category}
                        </Badge>
                      )}
                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(product)}
                          disabled={isStatusUpdatingId === product.id}
                          className="flex-1"
                        >
                          {isStatusUpdatingId === product.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Power className="h-4 w-4 mr-2" />
                              {product.status === 'active' ? 'Deactivate' : 'Activate'}
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteTarget(product)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-border/60 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b border-border/60">
                      <tr>
                        <th className="py-3 px-4 text-left font-semibold">Product ID</th>
                        <th className="py-3 px-4 text-left font-semibold">Name</th>
                        <th className="py-3 px-4 text-left font-semibold">Company</th>
                        <th className="py-3 px-4 text-left font-semibold">Category</th>
                        <th className="py-3 px-4 text-left font-semibold">Price</th>
                        <th className="py-3 px-4 text-left font-semibold">Status</th>
                        <th className="py-3 px-4 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => (
                        <tr key={product.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 text-muted-foreground">{product.product_id || 'N/A'}</td>
                          <td className="py-3 px-4 font-medium">{product.name}</td>
                          <td className="py-3 px-4 text-muted-foreground">{product.company || 'N/A'}</td>
                          <td className="py-3 px-4 text-muted-foreground">{product.category || 'N/A'}</td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {product.price !== null ? `${product.currency === 'INR' ? '₹' : '$'}${product.price.toFixed(2)}` : 'N/A'}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              className={cn(
                                "rounded-full px-3 py-1 text-xs",
                                product.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-100 text-amber-700 border border-amber-200'
                              )}
                            >
                              {product.status === 'active' ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(product)}
                                disabled={isStatusUpdatingId === product.id}
                              >
                                {isStatusUpdatingId === product.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Power className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(product)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(product)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </main>
          <MobileNav />
        </div>
      </div>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            resetEditForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update the product details.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleUpdateProduct}>
            <div className="space-y-1">
              <Label htmlFor="edit-name">Product Name *</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(event) => setEditFormData((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Enter product name"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-company">Company</Label>
              <Select
                value={editFormData.company}
                onValueChange={(value) => {
                  if (value === '__create_new__') {
                    setIsAddCompanyDialogOpen(true);
                  } else {
                    setEditFormData((prev) => ({ ...prev, company: value }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companyList.map((company) => (
                    <SelectItem key={company} value={company}>
                      {company}
                    </SelectItem>
                  ))}
                  <SelectItem value="__create_new__" className="text-primary font-medium">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      <span>Create New Company</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editFormData.description}
                onChange={(event) => setEditFormData((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Enter product description"
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="edit-price">Price</Label>
                <div className="flex gap-2">
                  <select
                    value={editFormData.currency}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, currency: e.target.value as 'USD' | 'INR' }))}
                    className="w-20 h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="USD">$ USD</option>
                    <option value="INR">₹ INR</option>
                  </select>
                  <Input
                    id="edit-price"
                    type="number"
                    step="0.01"
                    value={editFormData.price}
                    onChange={(event) => setEditFormData((prev) => ({ ...prev, price: event.target.value }))}
                    placeholder="0.00"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-category">Category</Label>
                <Input
                  id="edit-category"
                  value={editFormData.category}
                  onChange={(event) => setEditFormData((prev) => ({ ...prev, category: event.target.value }))}
                  placeholder="Electronics"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="edit-status"
                    value="active"
                    checked={editFormData.status === 'active'}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="edit-status"
                    value="inactive"
                    checked={editFormData.status === 'inactive'}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Inactive</span>
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Product'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {deleteTarget && (
        <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Product</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {deleteTarget.name}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteProduct}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Company Dialog */}
      <Dialog open={isAddCompanyDialogOpen} onOpenChange={setIsAddCompanyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Company</DialogTitle>
            <DialogDescription>Add a new company to your product catalog.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-company-name">Company Name *</Label>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <Input
                  id="new-company-name"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Enter company name"
                  className="flex-1"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-company-description">Company Description</Label>
              <Textarea
                id="new-company-description"
                value={newCompanyDescription}
                onChange={(e) => setNewCompanyDescription(e.target.value)}
                placeholder="Enter company description"
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-manager-name">Manager Name</Label>
                <Input
                  id="new-manager-name"
                  value={newManagerName}
                  onChange={(e) => setNewManagerName(e.target.value)}
                  placeholder="Enter manager name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-manager-contact">Manager Contact</Label>
                <Input
                  id="new-manager-contact"
                  value={newManagerContact}
                  onChange={(e) => setNewManagerContact(e.target.value)}
                  placeholder="Enter contact number"
                  type="tel"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddCompanyDialogOpen(false);
                setNewCompanyName("");
                setNewCompanyDescription("");
                setNewManagerName("");
                setNewManagerContact("");
              }}
              disabled={isCreatingCompany}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateCompany}
              disabled={isCreatingCompany || !newCompanyName.trim()}
            >
              {isCreatingCompany ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Company
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Product;

