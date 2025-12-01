import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Package, ShoppingCart, TrendingUp, Filter, Plus, LayoutGrid, List, Loader2, Pencil, Trash2, Power, Building2, Upload, Download, Search } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
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
  const [newCompanyCategories, setNewCompanyCategories] = useState<string>("");
  const [isCreatingCompany, setIsCreatingCompany] = useState<boolean>(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState<boolean>(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch products
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false });

        if (productsError) {
          throw productsError;
        }

        setProducts(productsData ?? []);

        // Fetch companies
        const { data: companiesData, error: companiesError } = await supabase
          .from('companies')
          .select('*')
          .order('name', { ascending: true });

        if (companiesError) {
          console.error('Error fetching companies:', companiesError);
        } else {
          setCompanies(companiesData ?? []);
        }
      } catch (err: any) {
        console.error('Error fetching data:', err);
        toast({
          title: 'Unable to load data',
          description: err?.message || 'Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
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
      accent: "from-sky-500/90 to-cyan-500/60",
    },
    {
      id: "companies",
      title: "Companies",
      value: companyCount,
      subtext: "Partner companies",
      trend: "Growing network",
      icon: TrendingUp,
      accent: "from-purple-500/90 to-fuchsia-500/60",
    },
    {
      id: "products",
      title: "Total Products",
      value: products.length,
      subtext: `${activeCount} active, ${inactiveCount} inactive`,
      trend: "Product catalog",
      icon: ShoppingCart,
      accent: "from-emerald-500/90 to-teal-500/60",
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
      const categoriesArray = newCompanyCategories
        .split(',')
        .map(cat => cat.trim())
        .filter(cat => cat.length > 0);

      const companyPayload = {
        name: newCompanyName.trim(),
        description: newCompanyDescription.trim() || null,
        manager_name: newManagerName.trim() || null,
        manager_contact: newManagerContact.trim() || null,
        categories: categoriesArray.length > 0 ? categoriesArray : null,
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
        
        // Add the new company to the companies list
        setCompanies((prev) => [companyData, ...prev]);
        
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
        setNewCompanyCategories("");
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

  const handleImportClick = () => {
    setIsImportDialogOpen(true);
  };

  const handleImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setSelectedImportFile(file);
    event.target.value = '';
  };

  const handleDownloadSample = () => {
    const sampleData = [
      {
        product_id: 'PR0000',
        name: 'Sample Product 1',
        company: 'Tech Corp',
        description: 'High-quality tech product',
        price: '99.99',
        currency: 'USD',
        category: 'Electronics',
        status: 'active',
      },
      {
        product_id: 'PR0001',
        name: 'Sample Product 2',
        company: 'Health Plus',
        description: 'Premium health product',
        price: '149.99',
        currency: 'USD',
        category: 'Healthcare',
        status: 'active',
      },
      {
        product_id: 'PR0002',
        name: 'Sample Product 3',
        company: 'Finance Pro',
        description: 'Professional finance tool',
        price: '4999.00',
        currency: 'INR',
        category: 'Software',
        status: 'inactive',
      },
    ];

    const toCSVValue = (value: string | number | null | undefined): string => {
      const str = String(value ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLabels = ['Product ID', 'Name', 'Company', 'Description', 'Price', 'Currency', 'Category', 'Status'];
    const csvRows = [
      headerLabels.join(','),
      ...sampleData.map((row) =>
        [
          toCSVValue(row.product_id),
          toCSVValue(row.name),
          toCSVValue(row.company),
          toCSVValue(row.description),
          toCSVValue(row.price),
          toCSVValue(row.currency),
          toCSVValue(row.category),
          toCSVValue(row.status),
        ].join(',')
      ),
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'products-sample.csv';
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Sample downloaded',
      description: 'Use this template to import products.',
    });
  };

  const handleImportUpload = async () => {
    if (!selectedImportFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a CSV file to import.',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);

    try {
      const text = await selectedImportFile.text();
      const lines = text.split('\n').filter((line) => line.trim());

      if (lines.length < 2) {
        throw new Error('CSV file is empty or invalid.');
      }

      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      const dataLines = lines.slice(1);

      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const nextChar = line[i + 1];

          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const productsToInsert = dataLines.map((line) => {
        const values = parseCSVLine(line);
        const row: any = {};
        headers.forEach((header, index) => {
          row[header.toLowerCase().replace(/ /g, '_')] = values[index] || null;
        });

        return {
          product_id: row.product_id || null,
          name: row.name || 'Unnamed Product',
          company: row.company || null,
          description: row.description || null,
          price: row.price ? parseFloat(row.price) : null,
          currency: row.currency === 'INR' ? 'INR' : 'USD',
          category: row.category || null,
          status: row.status === 'inactive' ? 'inactive' : 'active',
        };
      });

      const { data, error } = await supabase
        .from('products')
        .insert(productsToInsert as any)
        .select();

      if (error) {
        throw error;
      }

      if (data) {
        setProducts((prev) => [...(data as ProductRecord[]), ...prev]);
        toast({
          title: 'Import successful',
          description: `${data.length} products imported successfully.`,
        });
        setIsImportDialogOpen(false);
        setSelectedImportFile(null);
      }
    } catch (err: any) {
      console.error('Error importing products:', err);
      toast({
        title: 'Import failed',
        description: err?.message || 'Please check your CSV format.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportClick = () => {
    if (!products.length) {
      toast({
        title: 'Nothing to export',
        description: 'Add products before exporting.',
        variant: 'destructive',
      });
      return;
    }

    const toCSVValue = (value: string | number | null | undefined): string => {
      const str = String(value ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLabels = ['Product ID', 'Name', 'Company', 'Description', 'Price', 'Currency', 'Category', 'Status'];
    const csvRows = [
      headerLabels.join(','),
      ...products.map((product) =>
        [
          toCSVValue(product.product_id),
          toCSVValue(product.name),
          toCSVValue(product.company),
          toCSVValue(product.description),
          toCSVValue(product.price),
          toCSVValue(product.currency),
          toCSVValue(product.category),
          toCSVValue(product.status),
        ].join(',')
      ),
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().split('T')[0];
    link.download = `products-${timestamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export successful',
      description: `${products.length} products exported.`,
    });
  };

  const noResults = !isLoading && filteredProducts.length === 0;

  return (
    <>
      <div className="flex min-h-screen bg-gradient-subtle">
        <Sidebar />
        <div className="flex-1 lg:ml-56">
          <Header />
          <main className="container mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-6 space-y-6 pb-24 lg:pb-8 animate-fade-in">
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-3xl bg-primary text-white">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.28),transparent_55%)]" />
                <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                <div className="relative p-6 sm:p-8 space-y-8">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">Products</p>
                      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">Product Management</h1>
                      <p className="text-sm sm:text-base text-white/80 max-w-2xl">
                        Track pricing, pairs, and partner companies in one place. Import catalogs, toggle availability, and keep your inventory launch-ready.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 rounded-2xl border border-white/30 bg-white/10 p-5 backdrop-blur-lg text-sm text-white/90 min-w-[240px]">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Total Products</span>
                        <span>{products.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <span>Active</span>
                        <span>{activeCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <span>Inactive</span>
                        <span>{inactiveCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <span>Categories</span>
                        <span>{categoryCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <span>Companies</span>
                        <span>{companyCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-white/70 border-t border-white/20 pt-3 mt-2">
                        <span>View mode</span>
                        <span>{viewMode === 'grid' ? 'Grid view' : 'List view'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {summaryTiles.map(({ id, title, value, subtext, trend, icon: Icon, accent }) => (
                      <Card
                        key={id}
                        className={cn(
                          "relative overflow-hidden p-4 md:p-6 bg-white/90 border border-white/20 backdrop-blur transition-transform duration-200 hover:-translate-y-1",
                          id === "companies" && "cursor-pointer"
                        )}
                        onClick={() => {
                          if (id === "companies") {
                            navigate("/companies");
                          }
                        }}
                      >
                        <div className={cn("absolute inset-0 opacity-[0.08] pointer-events-none bg-gradient-to-br", accent)} />
                        <div className="relative space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-[0.12em] mb-1">
                                {title}
                              </p>
                              <div className="flex items-end gap-2">
                                <span className="text-2xl md:text-3xl font-bold text-slate-900">
                                  {typeof value === 'number' ? value.toLocaleString() : value}
                                </span>
                              </div>
                            </div>
                            <div
                              className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center text-white",
                                "bg-gradient-to-br",
                                accent
                              )}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                          </div>
                          <p className="text-xs text-slate-600">{subtext}</p>
                          <div className="text-xs font-medium text-indigo-500/80 bg-indigo-50 inline-flex px-2.5 py-1 rounded-full">
                            {trend}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>

              <Card className="border outline-indigo-200 bg-white/95 backdrop-blur">
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                    <div className="flex-1 flex items-center gap-3">
                      <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          placeholder="Search products by name, company, or category..."
                          className="pl-10 h-10 bg-card border-border/50 focus:shadow-md transition-all duration-300"
                        />
                      </div>
                      <div className="flex items-center rounded-lg border border-border/60 bg-background p-1 shadow-sm">
                        <Button
                          variant={viewMode === 'grid' ? 'default' : 'ghost'}
                          size="icon"
                          onClick={() => setViewMode('grid')}
                          className="h-10 w-10"
                          title="Grid view"
                        >
                          <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={viewMode === 'list' ? 'default' : 'ghost'}
                          size="icon"
                          onClick={() => setViewMode('list')}
                          className="h-10 w-10"
                          title="List view"
                        >
                          <List className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button
                        variant={isFilterOpen ? 'default' : 'outline'}
                        onClick={() => setIsFilterOpen((prev) => !prev)}
                        className="h-10 px-4"
                      >
                        <Filter className="h-4 w-4 mr-2" />
                        Filters
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleImportFileChange}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 px-4"
                        onClick={handleImportClick}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Import
                      </Button>
                      {(userRole === 'admin' || userRole === 'super_admin' || isSuperAdmin) && (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 px-4"
                          onClick={handleExportClick}
                          disabled={!products.length}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </Button>
                      )}
                      <Dialog
                        open={isAddDialogOpen}
                        onOpenChange={(open) => {
                          setIsAddDialogOpen(open);
                          resetForm();
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            className="bg-gradient-to-r from-indigo-500 via-sky-500 to-purple-500 text-white shadow-md hover:opacity-90 py-2 h-10 px-4"
                          >
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
                              const selectedCompany = companies.find(c => c.name === value);
                              if (selectedCompany) {
                                setFormData((prev) => ({ 
                                  ...prev, 
                                  company: value,
                                  company_description: selectedCompany.description || "",
                                  manager_name: selectedCompany.manager_name || "",
                                  manager_contact: selectedCompany.manager_contact || "",
                                }));
                              } else {
                                setFormData((prev) => ({ ...prev, company: value }));
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select company" />
                          </SelectTrigger>
                          <SelectContent>
                            {companies.map((company) => (
                              <SelectItem key={company.id} value={company.name}>
                                {company.name}
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
          </div>
        </div>
      </Card>

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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((product) => (
                  <Card
                    key={product.id}
                    className="p-4 bg-card hover:shadow-lg transition-all duration-300 border-border/50 hover:scale-[1.02] flex flex-col"
                  >
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.12em]">
                            {product.product_id || product.id}
                          </p>
                          <h3 className="text-lg font-semibold text-foreground">
                            {product.name}
                          </h3>
                          {product.company && (
                            <p className="text-xs text-muted-foreground">Company: {product.company}</p>
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

                      <div className="grid gap-3 text-sm text-muted-foreground">
                        {product.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {product.description}
                          </p>
                        )}

                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-3">
                          <span className="font-medium text-foreground">Price</span>
                          <span>
                            {product.price !== null
                              ? `${product.currency === 'INR' ? '₹' : '$'}${product.price.toFixed(2)}`
                              : 'Not set'}
                          </span>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-3">
                          <span className="font-medium text-foreground">Category</span>
                          <span>{product.category || 'Uncategorized'}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-border/30">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleStatus(product)}
                          disabled={isStatusUpdatingId === product.id}
                          className="flex items-center gap-1"
                        >
                          {isStatusUpdatingId === product.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Power className="h-3.5 w-3.5" />
                          )}
                          {product.status === 'active' ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(product)}
                          className="flex items-center gap-1"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteTarget(product)}
                          className="flex items-center gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-border/60 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border/60">
                      <tr>
                        <th className="py-2 px-3 text-left text-xs font-semibold">Product ID</th>
                        <th className="py-2 px-3 text-left text-xs font-semibold">Name</th>
                        <th className="py-2 px-3 text-left text-xs font-semibold">Company</th>
                        <th className="py-2 px-3 text-left text-xs font-semibold">Category</th>
                        <th className="py-2 px-3 text-left text-xs font-semibold">Price</th>
                        <th className="py-2 px-3 text-left text-xs font-semibold">Status</th>
                        <th className="py-2 px-3 text-right text-xs font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => (
                        <tr key={product.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-3 text-muted-foreground">{product.product_id || 'N/A'}</td>
                          <td className="py-2 px-3 font-medium">{product.name}</td>
                          <td className="py-2 px-3 text-muted-foreground">{product.company || 'N/A'}</td>
                          <td className="py-2 px-3 text-muted-foreground">{product.category || 'N/A'}</td>
                          <td className="py-2 px-3 text-muted-foreground">
                            {product.price !== null ? `${product.currency === 'INR' ? '₹' : '$'}${product.price.toFixed(2)}` : 'N/A'}
                          </td>
                          <td className="py-2 px-3">
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
                          <td className="py-2 px-3">
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
          </div>
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
                    const selectedCompany = companies.find(c => c.name === value);
                    if (selectedCompany) {
                      setEditFormData((prev) => ({ 
                        ...prev, 
                        company: value,
                        company_description: selectedCompany.description || "",
                        manager_name: selectedCompany.manager_name || "",
                        manager_contact: selectedCompany.manager_contact || "",
                      }));
                    } else {
                      setEditFormData((prev) => ({ ...prev, company: value }));
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.name}>
                      {company.name}
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
            <div className="space-y-2">
              <Label htmlFor="new-company-categories">Categories</Label>
              <Input
                id="new-company-categories"
                value={newCompanyCategories}
                onChange={(e) => setNewCompanyCategories(e.target.value)}
                placeholder="Enter categories (comma-separated)"
              />
              <p className="text-xs text-muted-foreground">Example: Technology, Healthcare, Finance</p>
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
                setNewCompanyCategories("");
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

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Products</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import multiple products at once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleDownloadSample}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Sample CSV
              </Button>
              <div className="relative">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleImportFileChange}
                  className="cursor-pointer"
                />
                {selectedImportFile && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Selected: {selectedImportFile.name}
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsImportDialogOpen(false);
                setSelectedImportFile(null);
              }}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleImportUpload}
              disabled={!selectedImportFile || isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Import
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

