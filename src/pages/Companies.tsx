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
import { Building2, Filter, Plus, LayoutGrid, List, Loader2, Pencil, Trash2, User, Phone, Upload, Download } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type CompanyRecord = {
  id: string;
  name: string;
  description: string | null;
  manager_name: string | null;
  manager_contact: string | null;
  categories: string[] | null;
  created_at: string;
  updated_at: string;
};

type CompanyFormState = {
  name: string;
  description: string;
  manager_name: string;
  manager_contact: string;
  categories: string;
};

const Companies = () => {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState<CompanyFormState>({
    name: "",
    description: "",
    manager_name: "",
    manager_contact: "",
    categories: "",
  });
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [editingCompany, setEditingCompany] = useState<CompanyRecord | null>(null);
  const [editFormData, setEditFormData] = useState<CompanyFormState>({
    name: "",
    description: "",
    manager_name: "",
    manager_contact: "",
    categories: "",
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<CompanyRecord | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState<boolean>(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setCompanies(data ?? []);
      } catch (err: any) {
        console.error('Error fetching companies:', err);
        toast({
          title: 'Unable to load companies',
          description: err?.message || 'Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompanies();
  }, [toast]);

  const companyCount = companies.length;

  const summaryTiles = [
    {
      id: "total",
      title: "Total Companies",
      value: companyCount,
      subtext: "Registered companies",
      trend: "Growing network",
      icon: Building2,
      accent: "from-blue-500 to-cyan-500",
    },
  ];

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        company.name.toLowerCase().includes(term) ||
        company.description?.toLowerCase().includes(term) ||
        company.manager_name?.toLowerCase().includes(term) ||
        company.manager_contact?.toLowerCase().includes(term) ||
        false;

      return matchesSearch;
    });
  }, [companies, searchTerm]);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      manager_name: "",
      manager_contact: "",
      categories: "",
    });
  };

  const resetEditForm = () => {
    setEditFormData({
      name: "",
      description: "",
      manager_name: "",
      manager_contact: "",
      categories: "",
    });
    setEditingCompany(null);
  };

  const handleCreateCompany = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: 'Name is required',
        description: 'Please provide a company name.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    const categoriesArray = formData.categories
      .split(',')
      .map(cat => cat.trim())
      .filter(cat => cat.length > 0);

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      manager_name: formData.manager_name.trim() || null,
      manager_contact: formData.manager_contact.trim() || null,
      categories: categoriesArray.length > 0 ? categoriesArray : null,
    };

    try {
      const { data, error } = await supabase
        .from('companies')
        .insert(payload as any)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setCompanies((prev) => [data as CompanyRecord, ...prev]);
        setIsAddDialogOpen(false);
        resetForm();
        toast({
          title: 'Company added',
          description: `${(data as CompanyRecord).name} has been added successfully.`,
        });
      }
    } catch (err: any) {
      console.error('Error creating company:', err);
      toast({
        title: 'Failed to add company',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (company: CompanyRecord) => {
    setEditingCompany(company);
    setEditFormData({
      name: company.name,
      description: company.description ?? "",
      manager_name: company.manager_name ?? "",
      manager_contact: company.manager_contact ?? "",
      categories: company.categories?.join(', ') ?? "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateCompany = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingCompany) return;

    if (!editFormData.name.trim()) {
      toast({
        title: 'Name is required',
        description: 'Please provide a company name.',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdating(true);

    const categoriesArray = editFormData.categories
      .split(',')
      .map(cat => cat.trim())
      .filter(cat => cat.length > 0);

    const payload = {
      name: editFormData.name.trim(),
      description: editFormData.description.trim() || null,
      manager_name: editFormData.manager_name.trim() || null,
      manager_contact: editFormData.manager_contact.trim() || null,
      categories: categoriesArray.length > 0 ? categoriesArray : null,
    };

    try {
      const { data, error } = await supabase
        .from('companies')
        // @ts-ignore - Supabase type inference issue
        .update(payload)
        .eq('id', editingCompany.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setCompanies((prev) => prev.map((comp) => (comp.id === editingCompany.id ? data as CompanyRecord : comp)));
        setIsEditDialogOpen(false);
        resetEditForm();
        toast({
          title: 'Company updated',
          description: `${(data as CompanyRecord).name} has been updated successfully.`,
        });
      }
    } catch (err: any) {
      console.error('Error updating company:', err);
      toast({
        title: 'Failed to update company',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) {
        throw error;
      }

      setCompanies((prev) => prev.filter((comp) => comp.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast({
        title: 'Company deleted',
        description: `${deleteTarget.name} has been deleted successfully.`,
      });
    } catch (err: any) {
      console.error('Error deleting company:', err);
      toast({
        title: 'Failed to delete company',
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
        name: 'Tech Corp',
        description: 'Leading technology solutions provider',
        manager_name: 'John Doe',
        manager_contact: '+1234567890',
        categories: 'Technology; Software',
      },
      {
        name: 'Health Plus',
        description: 'Healthcare and wellness company',
        manager_name: 'Jane Smith',
        manager_contact: '+0987654321',
        categories: 'Healthcare; Wellness',
      },
      {
        name: 'Finance Pro',
        description: 'Financial services and consulting',
        manager_name: 'Mike Johnson',
        manager_contact: '+1122334455',
        categories: 'Finance; Consulting',
      },
    ];

    const toCSVValue = (value: string | number | null | undefined): string => {
      const str = String(value ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLabels = ['Name', 'Description', 'Manager Name', 'Manager Contact', 'Categories'];
    const csvRows = [
      headerLabels.join(','),
      ...sampleData.map((row) =>
        [
          toCSVValue(row.name),
          toCSVValue(row.description),
          toCSVValue(row.manager_name),
          toCSVValue(row.manager_contact),
          toCSVValue(row.categories),
        ].join(',')
      ),
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'companies-sample.csv';
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Sample downloaded',
      description: 'Use this template to import companies.',
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

      const companiesToInsert = dataLines.map((line) => {
        const values = parseCSVLine(line);
        const row: any = {};
        headers.forEach((header, index) => {
          row[header.toLowerCase().replace(/ /g, '_')] = values[index] || null;
        });

        const categoriesStr = row.categories || '';
        const categoriesArray = categoriesStr
          .split(';')
          .map((cat: string) => cat.trim())
          .filter((cat: string) => cat.length > 0);

        return {
          name: row.name || 'Unnamed Company',
          description: row.description || null,
          manager_name: row.manager_name || null,
          manager_contact: row.manager_contact || null,
          categories: categoriesArray.length > 0 ? categoriesArray : null,
        };
      });

      const { data, error } = await supabase
        .from('companies')
        .insert(companiesToInsert as any)
        .select();

      if (error) {
        throw error;
      }

      if (data) {
        setCompanies((prev) => [...(data as CompanyRecord[]), ...prev]);
        toast({
          title: 'Import successful',
          description: `${data.length} companies imported successfully.`,
        });
        setIsImportDialogOpen(false);
        setSelectedImportFile(null);
      }
    } catch (err: any) {
      console.error('Error importing companies:', err);
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
    if (!companies.length) {
      toast({
        title: 'Nothing to export',
        description: 'Add companies before exporting.',
        variant: 'destructive',
      });
      return;
    }

    const toCSVValue = (value: string | number | null | undefined): string => {
      const str = String(value ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLabels = ['Name', 'Description', 'Manager Name', 'Manager Contact', 'Categories'];
    const csvRows = [
      headerLabels.join(','),
      ...companies.map((company) =>
        [
          toCSVValue(company.name),
          toCSVValue(company.description),
          toCSVValue(company.manager_name),
          toCSVValue(company.manager_contact),
          toCSVValue(company.categories?.join('; ') || ''),
        ].join(',')
      ),
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().split('T')[0];
    link.download = `companies-${timestamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export successful',
      description: `${companies.length} companies exported.`,
    });
  };

  return (
    <>
      <div className="flex min-h-screen bg-gradient-subtle">
        <Sidebar />
        <div className="flex-1 lg:ml-56">
          <Header />
          <main className="container mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-6 space-y-4 pb-24 lg:pb-8 animate-fade-in">
            <div className="bg-gradient-primary rounded-xl p-4 md:p-6 text-white shadow-glow">
              <h2 className="text-xl md:text-2xl font-bold mb-1">Company Management</h2>
              <p className="text-white/80 text-sm">Manage your partner companies and their information</p>
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
                        <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
                      </div>
                      <div className={cn("p-3 rounded-xl bg-gradient-to-br shadow-md", accent)}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-medium">{trend}</span>
                      </div>
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
                    placeholder="Search companies..."
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
                type="button"
                variant="outline"
                className="h-11 px-4 rounded-lg border-border/60"
                onClick={handleImportClick}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 px-4 rounded-lg border-border/60"
                onClick={handleExportClick}
                disabled={!companies.length}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Dialog
                  open={isAddDialogOpen}
                  onOpenChange={(open) => {
                    setIsAddDialogOpen(open);
                    if (!open) resetForm();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto h-11 px-5 rounded-lg shadow-md bg-gradient-primary hover:opacity-90 transition-all duration-300">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Company
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Company</DialogTitle>
                      <DialogDescription>Fill in the details to add a new company.</DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={handleCreateCompany}>
                      <div className="space-y-1">
                        <Label htmlFor="name">Company Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="Enter company name"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                          placeholder="Enter company description"
                          rows={3}
                          className="resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label htmlFor="manager_name">Manager Name</Label>
                          <Input
                            id="manager_name"
                            value={formData.manager_name}
                            onChange={(e) => setFormData((prev) => ({ ...prev, manager_name: e.target.value }))}
                            placeholder="Enter manager name"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="manager_contact">Manager Contact</Label>
                          <Input
                            id="manager_contact"
                            value={formData.manager_contact}
                            onChange={(e) => setFormData((prev) => ({ ...prev, manager_contact: e.target.value }))}
                            placeholder="Enter contact number"
                            type="tel"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="categories">Categories</Label>
                        <Input
                          id="categories"
                          value={formData.categories}
                          onChange={(e) => setFormData((prev) => ({ ...prev, categories: e.target.value }))}
                          placeholder="Enter categories (comma-separated)"
                        />
                        <p className="text-xs text-muted-foreground">Example: Technology, Healthcare, Finance</p>
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
                            <>
                              <Plus className="mr-2 h-4 w-4" />
                              Add Company
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
            </div>

            {isLoading ? (
              <Card className="p-8 text-center border-border/60">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Loading companies...</p>
              </Card>
            ) : filteredCompanies.length === 0 ? (
              <Card className="p-8 text-center border-border/60">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No companies found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? 'Try adjusting your search' : 'Get started by adding your first company'}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Company
                  </Button>
                )}
              </Card>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredCompanies.map((company) => (
                    <Card key={company.id} className="p-4 border-border/60 hover:shadow-md transition-shadow">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg truncate flex items-center gap-2">
                              <Building2 className="h-5 w-5 text-primary shrink-0" />
                              {company.name}
                            </h3>
                          </div>
                        </div>
                        {company.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{company.description}</p>
                        )}
                        {company.manager_name && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span className="truncate">{company.manager_name}</span>
                          </div>
                        )}
                        {company.manager_contact && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <span className="truncate">{company.manager_contact}</span>
                          </div>
                        )}
                        {company.categories && company.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {company.categories.map((category, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs px-2.5 py-1">
                                {category}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(company)}
                            className="flex-1 h-9 text-sm"
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteTarget(company)}
                            className="text-destructive hover:text-destructive h-9 w-9 p-0"
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
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border/60">
                      <tr>
                        <th className="py-2 px-3 text-left text-xs font-semibold">Company Name</th>
                        <th className="py-2 px-3 text-left text-xs font-semibold">Description</th>
                        <th className="py-2 px-3 text-left text-xs font-semibold">Manager</th>
                        <th className="py-2 px-3 text-left text-xs font-semibold">Contact</th>
                        <th className="py-2 px-3 text-left text-xs font-semibold">Categories</th>
                        <th className="py-2 px-3 text-right text-xs font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCompanies.map((company) => (
                        <tr key={company.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-3 font-medium">{company.name}</td>
                          <td className="py-2 px-3 text-muted-foreground">
                            {company.description ? (
                              <span className="line-clamp-1">{company.description}</span>
                            ) : (
                              'N/A'
                            )}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{company.manager_name || 'N/A'}</td>
                          <td className="py-2 px-3 text-muted-foreground">{company.manager_contact || 'N/A'}</td>
                          <td className="py-2 px-3">
                            {company.categories && company.categories.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {company.categories.map((category, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs px-2 py-0.5">
                                    {category}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(company)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(company)}
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
        </div>
        <MobileNav />
      </div>

      {/* Edit Dialog */}
      {editingCompany && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Company</DialogTitle>
              <DialogDescription>Update the company details.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleUpdateCompany}>
              <div className="space-y-1">
                <Label htmlFor="edit-name">Company Name *</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter company name"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter company description"
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="edit-manager_name">Manager Name</Label>
                  <Input
                    id="edit-manager_name"
                    value={editFormData.manager_name}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, manager_name: e.target.value }))}
                    placeholder="Enter manager name"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-manager_contact">Manager Contact</Label>
                  <Input
                    id="edit-manager_contact"
                    value={editFormData.manager_contact}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, manager_contact: e.target.value }))}
                    placeholder="Enter contact number"
                    type="tel"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-categories">Categories</Label>
                <Input
                  id="edit-categories"
                  value={editFormData.categories}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, categories: e.target.value }))}
                  placeholder="Enter categories (comma-separated)"
                />
                <p className="text-xs text-muted-foreground">Example: Technology, Healthcare, Finance</p>
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
                    'Update Company'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Company</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {deleteTarget.name}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteCompany}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Companies</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import multiple companies at once.
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

export default Companies;

