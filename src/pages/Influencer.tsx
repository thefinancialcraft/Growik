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
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Layers, Users, Activity, Filter, Plus, LayoutGrid, List, Loader2, Pencil, Trash2, Power, Upload, Download } from "lucide-react";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

type SocialHandle = {
  platform: string;
  url: string;
};

type SocialPlatformOption = {
  value: string;
  label: string;
  icon: string;
};

const SOCIAL_PLATFORM_OPTIONS: SocialPlatformOption[] = [
  { value: "instagram", label: "Instagram", icon: "https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" },
  { value: "facebook", label: "Facebook", icon: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Facebook_icon.svg" },
  { value: "youtube", label: "YouTube", icon: "https://upload.wikimedia.org/wikipedia/commons/b/b8/YouTube_Logo_2017.svg" },
  { value: "twitter", label: "Twitter (X)", icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/X_%28formerly_Twitter%29_logo_late_2025.svg/120px-X_%28formerly_Twitter%29_logo_late_2025.svg.png" },
  { value: "snapchat", label: "Snapchat", icon: "https://upload.wikimedia.org/wikipedia/en/thumb/c/c4/Snapchat_logo.svg/120px-Snapchat_logo.svg.png" },
  { value: "linkedin", label: "LinkedIn", icon: "https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png" },
  { value: "pinterest", label: "Pinterest", icon: "https://upload.wikimedia.org/wikipedia/commons/0/08/Pinterest-logo.png" },
  { value: "threads", label: "Threads", icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Threads_%28app%29.svg/250px-Threads_%28app%29.svg.png" },
  { value: "TikTok", label: "TikTok", icon: "https://img.freepik.com/premium-vector/set-tiktok-app-icons-social-media-logo-vector-illustration_277909-592.jpg?semt=ais_hybrid&w=740&q=80" },
  { value: "Moj", label: "Moj", icon: "https://yt3.googleusercontent.com/cf4RTYDMH_vrpiBoOxmuQ0z9KNRQKp58UtpdbaYTUKZV7SoX_QvjkjzH3pxiPs-ylcpYI-cPmdk=s900-c-k-c0x00ffffff-no-rj" },
  { value: "Twitch", label: "Twitch", icon: "https://img.freepik.com/premium-vector/vector-twitch-social-media-logo_1093524-449.jpg?semt=ais_hybrid&w=740&q=80" },
  { value: "other", label: "Other", icon: "" },
];

const DEFAULT_HANDLE_ENTRY: SocialHandle = { platform: SOCIAL_PLATFORM_OPTIONS[0].value, url: "" };

const getPlatformMeta = (value: string): SocialPlatformOption =>
  SOCIAL_PLATFORM_OPTIONS.find((option) => option.value === value) ?? {
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1),
    icon: "",
  };

const normalizeHandleUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const formatPidNumber = (value: number): string => value.toString().padStart(4, '0');

const extractPidNumber = (pid?: string | null): number => {
  if (!pid) return -1;
  const match = `${pid}`.match(/(\d+)/);
  if (!match) return -1;
  return Number.parseInt(match[1], 10);
};

const parseHandles = (raw: any, fallbackPlatform?: string): SocialHandle[] => {
  const sanitize = (handle: any): SocialHandle | null => {
    if (!handle) return null;
    if (typeof handle === "string") {
      return {
        platform: fallbackPlatform ?? "other",
        url: handle.trim(),
      };
    }
    if (typeof handle === "object") {
      const platform = typeof handle.platform === "string" && handle.platform.trim() ? handle.platform.trim() : fallbackPlatform ?? "other";
      const url = typeof handle.url === "string" ? handle.url.trim() : "";
      return url ? { platform, url } : null;
    }
    return null;
  };

  if (!raw) return [];

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => sanitize(item))
          .filter((item): item is SocialHandle => Boolean(item));
      }
      const single = sanitize(raw);
      return single ? [single] : [];
    } catch {
      const single = sanitize(raw);
      return single ? [single] : [];
    }
  }

  if (Array.isArray(raw)) {
    return raw
      .map((item) => sanitize(item))
      .filter((item): item is SocialHandle => Boolean(item));
  }

  if (typeof raw === "object") {
    const single = sanitize(raw);
    return single ? [single] : [];
  }

  return [];
};

type InfluencerRecord = {
  id: string;
  pid: string | null;
  name: string;
  handles: SocialHandle[];
  email: string | null;
  phone: string | null;
  categories: string[];
  address: {
    line1: string | null;
    line2: string | null;
    landmark: string | null;
    city: string | null;
    pincode: string | null;
    country: string | null;
  };
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

const normalizeInfluencer = (record: any): InfluencerRecord => {
  const fallbackPlatform = Array.isArray(record.platform) && record.platform.length > 0 ? record.platform[0] : undefined;
  const handles = parseHandles(record.handle, fallbackPlatform);

  return {
    id: record.id,
    pid: record.pid ?? null,
    name: record.name ?? "",
    handles,
    email: record.email ?? null,
    phone: record.phone ?? null,
    categories: Array.isArray(record.categories) ? record.categories : [],
    address: {
      line1: record.address_line1 ?? null,
      line2: record.address_line2 ?? null,
      landmark: record.address_landmark ?? null,
      city: record.address_city ?? null,
      pincode: record.address_pincode ?? null,
      country: record.address_country ?? null,
    },
    status: (record.status ?? 'active') === 'inactive' ? 'inactive' : 'active',
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
};

type InfluencerFormState = {
  pid: string;
  name: string;
  handles: SocialHandle[];
  email: string;
  phone: string;
  categories: string;
  addressLine1: string;
  addressLine2: string;
  addressLandmark: string;
  addressCity: string;
  addressPincode: string;
  addressCountry: string;
  status: 'active' | 'inactive';
};

const Influencer = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [platformFilter, setPlatformFilter] = useState<string>("All");
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState<boolean>(false);
  const [nextPid, setNextPid] = useState<string>(formatPidNumber(0));
  const [formData, setFormData] = useState<InfluencerFormState>({
    pid: "",
    name: "",
    handles: [{ ...DEFAULT_HANDLE_ENTRY }],
    email: "",
    phone: "",
    categories: "",
    addressLine1: "",
    addressLine2: "",
    addressLandmark: "",
    addressCity: "",
    addressPincode: "",
    addressCountry: "",
    status: 'active',
  });
  const [influencers, setInfluencers] = useState<InfluencerRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isStatusUpdatingId, setIsStatusUpdatingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [editingInfluencer, setEditingInfluencer] = useState<InfluencerRecord | null>(null);
  const [editFormData, setEditFormData] = useState<InfluencerFormState>({
    pid: "",
    name: "",
    handles: [{ ...DEFAULT_HANDLE_ENTRY }],
    email: "",
    phone: "",
    categories: "",
    addressLine1: "",
    addressLine2: "",
    addressLandmark: "",
    addressCity: "",
    addressPincode: "",
    addressCountry: "",
    status: 'active',
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<InfluencerRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState<boolean>(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  // Fetch user profile to check role
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;

      try {
        const { data: profileData, error } = await supabase
          .from('user_profiles')
          .select('role, super_admin')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching user profile:', error);
          return;
        }

        if (profileData) {
          setUserRole(profileData.role || null);
          setIsSuperAdmin(profileData.super_admin === true);
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      }
    };

    fetchUserProfile();
  }, [user?.id]);

  const fetchNextPidValue = useCallback(async (): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('influencers')
        .select('pid')
        .not('pid', 'is', null);

      if (error) {
        throw error;
      }

      const maxNumber = (data ?? []).reduce((max, row: any) => {
        const value = extractPidNumber(row.pid as string | null | undefined);
        return value > max ? value : max;
      }, -1);

      const nextNumber = maxNumber >= 0 ? maxNumber + 1 : 0;
      return formatPidNumber(nextNumber);
    } catch (err) {
      console.error('Error fetching next PID:', err);
      return formatPidNumber(0);
    }
  }, []);

  const loadNextPid = useCallback(async () => {
    const next = await fetchNextPidValue();
    setNextPid(next);
    return next;
  }, [fetchNextPidValue]);

  useEffect(() => {
    const fetchInfluencers = async () => {
      try {
        const { data, error } = await supabase
          .from('influencers')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setInfluencers((data ?? []).map(normalizeInfluencer));
      } catch (err: any) {
        console.error('Error fetching influencers:', err);
        toast({
          title: 'Unable to load influencers',
          description: err?.message || 'Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchInfluencers();
    void loadNextPid();
  }, [toast, loadNextPid]);

  const categoryCount = useMemo(() => {
    const set = new Set<string>();
    influencers.forEach((inf) => {
      inf.categories.forEach((category) => set.add(category));
    });
    return set.size;
  }, [influencers]);

  const activeCount = useMemo(() => influencers.filter((inf) => inf.status === 'active').length, [influencers]);
  const inactiveCount = useMemo(() => influencers.filter((inf) => inf.status === 'inactive').length, [influencers]);

  const summaryTiles = [
    {
      id: "categories",
      title: "Categories",
      value: categoryCount,
      subtext: "Curated niches you can activate",
      trend: categoryCount > 0 ? `${categoryCount} active segments` : "No categories yet",
      icon: Layers,
      accent: "from-cyan-500/90 to-sky-500/60",
    },
    {
      id: "influencers",
      title: "Influencers",
      value: activeCount,
      subtext: "Creators currently engaged",
      trend: inactiveCount > 0 ? `${inactiveCount} inactive` : "All active",
      icon: Users,
      accent: "from-violet-500/90 to-fuchsia-500/60",
    },
    {
      id: "platform-status",
      title: "Platform Health",
      value: "Active",
      subtext: "Campaign delivery & reporting",
      trend: "98% uptime",
      icon: Activity,
      accent: "from-emerald-500/90 to-lime-500/60",
      statusBadge: {
        label: "Live",
        variant: "default" as const,
      },
    },
  ];

  const availablePlatforms = useMemo(() => {
    return SOCIAL_PLATFORM_OPTIONS.map((option) => option.label);
  }, [influencers]);

  const filteredInfluencers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return influencers.filter((inf) => {
      const handleMatches =
        term.length > 0 &&
        inf.handles.some((handle) => {
          const meta = getPlatformMeta(handle.platform);
          return (
            meta.label.toLowerCase().includes(term) ||
            handle.platform.toLowerCase().includes(term) ||
            handle.url.toLowerCase().includes(term)
          );
        });

      const matchesSearch =
        term.length === 0 ||
        inf.name.toLowerCase().includes(term) ||
        handleMatches ||
        (inf.email ?? '').toLowerCase().includes(term) ||
        (inf.phone ?? '').toLowerCase().includes(term) ||
        [
          inf.address.line1,
          inf.address.line2,
          inf.address.landmark,
          inf.address.city,
          inf.address.pincode,
          inf.address.country,
        ]
          .filter(Boolean)
          .some((value) => (value ?? '').toLowerCase().includes(term)) ||
        inf.categories.some((category) => category.toLowerCase().includes(term)) ||
        inf.handles.some((handle) => handle.platform.toLowerCase().includes(term));

      const matchesPlatform =
        platformFilter === "All" ||
        inf.handles.some((handle) => {
          const meta = getPlatformMeta(handle.platform);
          return meta.label === platformFilter || handle.platform === platformFilter;
        });

      return matchesSearch && matchesPlatform;
    });
  }, [influencers, searchTerm, platformFilter]);

  const resetForm = useCallback(() => {
    const baseForm = (pidValue: string): InfluencerFormState => ({
      pid: pidValue,
      name: "",
      handles: [{ ...DEFAULT_HANDLE_ENTRY }],
      email: "",
      phone: "",
      categories: "",
      addressLine1: "",
      addressLine2: "",
      addressLandmark: "",
      addressCity: "",
      addressPincode: "",
      addressCountry: "",
      status: 'active',
    });

    setFormData(baseForm(nextPid));

    loadNextPid().then((next) => {
      setFormData(baseForm(next));
    });
  }, [loadNextPid, nextPid]);

  const resetEditForm = () => {
    setEditFormData({
      pid: "",
      name: "",
      handles: [{ ...DEFAULT_HANDLE_ENTRY }],
      email: "",
      phone: "",
      categories: "",
      addressLine1: "",
      addressLine2: "",
      addressLandmark: "",
      addressCity: "",
      addressPincode: "",
      addressCountry: "",
      status: 'active',
    });
    setEditingInfluencer(null);
  };

  const addHandleRow = () => {
    setFormData((prev) => ({
      ...prev,
      handles: [...prev.handles, { ...DEFAULT_HANDLE_ENTRY }],
    }));
  };

  const updateHandleRow = (index: number, field: keyof SocialHandle, value: string) => {
    setFormData((prev) => ({
      ...prev,
      handles: prev.handles.map((handle, idx) =>
        idx === index ? { ...handle, [field]: value } : handle
      ),
    }));
  };

  const removeHandleRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      handles: prev.handles.length > 1 ? prev.handles.filter((_, idx) => idx !== index) : prev.handles,
    }));
  };

  const addEditHandleRow = () => {
    setEditFormData((prev) => ({
      ...prev,
      handles: [...prev.handles, { ...DEFAULT_HANDLE_ENTRY }],
    }));
  };

  const updateEditHandleRow = (index: number, field: keyof SocialHandle, value: string) => {
    setEditFormData((prev) => ({
      ...prev,
      handles: prev.handles.map((handle, idx) =>
        idx === index ? { ...handle, [field]: value } : handle
      ),
    }));
  };

  const removeEditHandleRow = (index: number) => {
    setEditFormData((prev) => ({
      ...prev,
      handles: prev.handles.length > 1 ? prev.handles.filter((_, idx) => idx !== index) : prev.handles,
    }));
  };

  const handleCreateInfluencer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const sanitizedHandles = formData.handles
      .map((handle) => ({
        platform: handle.platform || DEFAULT_HANDLE_ENTRY.platform,
        url: normalizeHandleUrl(handle.url),
      }))
      .filter((handle) => Boolean(handle.url));

    if (!formData.name.trim() || sanitizedHandles.length === 0) {
      toast({
        title: 'Name and handle are required',
        description: 'Please provide at least one social handle with a valid link.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    const generatedPid = await fetchNextPidValue();
    setFormData((prev) => ({ ...prev, pid: generatedPid }));

    const payload = {
      pid: generatedPid,
      name: formData.name.trim(),
      handle: JSON.stringify(sanitizedHandles),
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      categories: formData.categories
        .split(',')
        .map((category) => category.trim())
        .filter(Boolean),
      address_line1: formData.addressLine1.trim() || null,
      address_line2: formData.addressLine2.trim() || null,
      address_landmark: formData.addressLandmark.trim() || null,
      address_city: formData.addressCity.trim() || null,
      address_pincode: formData.addressPincode.trim() || null,
      address_country: formData.addressCountry.trim() || null,
      status: formData.status,
    };

    try {
      const { data, error } = await supabase
        .from('influencers')
        .insert(payload as any)
        .select()
        .single();

      if (error) {
        throw error;
      }

      const normalized = normalizeInfluencer(data);
      setInfluencers((prev) => [normalized, ...prev]);
      setNextPid(formatPidNumber(extractPidNumber(generatedPid) + 1));
      setIsAddDialogOpen(false);
      void resetForm();
      toast({
        title: 'Influencer added',
        description: `${normalized.name} has been added successfully.`,
      });
    } catch (err: any) {
      console.error('Error creating influencer:', err);
      toast({
        title: 'Failed to add influencer',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChip = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
      case 'inactive':
        return 'bg-amber-100 text-amber-700 border border-amber-200';
      default:
        return 'bg-muted text-muted-foreground border border-border/60';
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
        pid: '0000',
        name: 'John Doe',
        handles: 'instagram:https://instagram.com/johndoe,youtube:https://youtube.com/@johndoe',
        email: 'john@example.com',
        phone: '+1234567890',
        categories: 'Fashion; Lifestyle',
        address_line1: '123 Main St',
        address_line2: 'Apt 4B',
        address_landmark: 'Near Central Park',
        address_city: 'New York',
        address_pincode: '10001',
        address_country: 'USA',
        status: 'active',
      },
      {
        pid: '0001',
        name: 'Jane Smith',
        handles: 'twitter:https://twitter.com/janesmith,linkedin:https://linkedin.com/in/janesmith',
        email: 'jane@example.com',
        phone: '+0987654321',
        categories: 'Tech; Business',
        address_line1: '456 Oak Ave',
        address_line2: '',
        address_landmark: 'Next to Tech Hub',
        address_city: 'San Francisco',
        address_pincode: '94102',
        address_country: 'USA',
        status: 'active',
      },
      {
        pid: '0002',
        name: 'Mike Johnson',
        handles: 'tiktok:https://tiktok.com/@mikejohnson',
        email: 'mike@example.com',
        phone: '+1122334455',
        categories: 'Entertainment; Comedy',
        address_line1: '789 Elm St',
        address_line2: 'Suite 200',
        address_landmark: 'Behind Mall',
        address_city: 'Los Angeles',
        address_pincode: '90001',
        address_country: 'USA',
        status: 'inactive',
      },
    ];

    const headerLabels = [
      'PID',
      'Name',
      'Handles',
      'Email',
      'Phone',
      'Categories',
      'Address Line 1',
      'Address Line 2',
      'Landmark',
      'City',
      'Pincode',
      'Country',
      'Status',
    ];

    const toCSVValue = (value: string | number | null | undefined): string => {
      const str = String(value ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerRow = headerLabels.map(toCSVValue).join(',');

    const rows = sampleData.map((row) => {
      const rowValues = [
        row.pid,
        row.name,
        row.handles,
        row.email,
        row.phone,
        row.categories,
        row.address_line1,
        row.address_line2,
        row.address_landmark,
        row.address_city,
        row.address_pincode,
        row.address_country,
        row.status,
      ];

      return rowValues.map(toCSVValue).join(',');
    });

    const csvContent = [headerRow, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `influencers-sample.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Sample downloaded',
      description: 'Check your downloads folder for the sample CSV.',
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
      const lines = text.split(/\r?\n/).filter((line) => line.trim());

      if (lines.length < 2) {
        throw new Error('CSV file is empty or has no data rows.');
      }

      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      const dataRows = lines.slice(1);

      const records = dataRows.map((line) => {
        const values: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());

        const record: any = {};
        headers.forEach((header, index) => {
          record[header] = values[index] || '';
        });
        return record;
      });

      const payloads = records.map((record) => {
        const handles: SocialHandle[] = [];
        
        // Parse handles in format: platform:url,platform:url
        const handlesString = record['Handles'] || '';
        if (handlesString.trim()) {
          const handlePairs = handlesString.split(',');
          for (const pair of handlePairs) {
            const [platform, ...urlParts] = pair.split(':');
            const url = urlParts.join(':'); // rejoin in case URL has colons
            if (platform?.trim() && url?.trim()) {
              handles.push({
                platform: platform.trim(),
                url: url.trim(),
              });
            }
          }
        }

        return {
          pid: record['PID'] || null,
          name: record['Name'] || 'Unnamed',
          handle: JSON.stringify(handles),
          email: record['Email'] || null,
          phone: record['Phone'] || null,
          categories: (record['Categories'] || '')
            .split(';')
            .map((c: string) => c.trim())
            .filter(Boolean),
          address_line1: record['Address Line 1'] || null,
          address_line2: record['Address Line 2'] || null,
          address_landmark: record['Landmark'] || null,
          address_city: record['City'] || null,
          address_pincode: record['Pincode'] || null,
          address_country: record['Country'] || null,
          status: record['Status'] === 'inactive' ? 'inactive' : 'active',
        };
      });

      const { data, error } = await supabase
        .from('influencers')
        .insert(payloads as any)
        .select();

      if (error) {
        throw error;
      }

      const normalized = (data ?? []).map(normalizeInfluencer);
      setInfluencers((prev) => [...normalized, ...prev]);

      toast({
        title: 'Import successful',
        description: `${normalized.length} influencer(s) imported.`,
      });

      setIsImportDialogOpen(false);
      setSelectedImportFile(null);
    } catch (err: any) {
      console.error('Import error:', err);
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
    if (!influencers.length) {
      toast({
        title: 'Nothing to export',
        description: 'Add influencers before exporting.',
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

    const headerLabels = [
      'PID',
      'Name',
      'Handles',
      'Email',
      'Phone',
      'Categories',
      'Address Line 1',
      'Address Line 2',
      'Landmark',
      'City',
      'Pincode',
      'Country',
      'Status',
    ];

    const headerRow = headerLabels.map(toCSVValue).join(',');

    const rows = influencers.map((inf) => {
      // Format handles as platform:url,platform:url
      const handlesString = inf.handles
        .map((handle) => `${handle.platform}:${handle.url}`)
        .join(',');

      const rowValues = [
        inf.pid ?? '',
        inf.name,
        handlesString,
        inf.email ?? '',
        inf.phone ?? '',
        inf.categories.join('; '),
        inf.address.line1 ?? '',
        inf.address.line2 ?? '',
        inf.address.landmark ?? '',
        inf.address.city ?? '',
        inf.address.pincode ?? '',
        inf.address.country ?? '',
        inf.status,
      ];

      return rowValues.map(toCSVValue).join(',');
    });

    const csvContent = [headerRow, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `influencers-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Export ready',
      description: 'A CSV download has started in your browser.',
    });
  };

  const handleStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
      case 'inactive':
        return 'bg-amber-50 text-amber-600 border border-amber-100';
      default:
        return 'bg-muted text-muted-foreground border border-border/60';
    }
  };

  const openEditDialog = (influencer: InfluencerRecord) => {
    setEditingInfluencer(influencer);
    setEditFormData({
      pid: influencer.pid ?? "",
      name: influencer.name,
      handles: (influencer.handles.length ? influencer.handles : [DEFAULT_HANDLE_ENTRY]).map((handle) => ({ ...handle })),
      email: influencer.email ?? "",
      phone: influencer.phone ?? "",
      categories: influencer.categories.join(', '),
      addressLine1: influencer.address.line1 ?? "",
      addressLine2: influencer.address.line2 ?? "",
      addressLandmark: influencer.address.landmark ?? "",
      addressCity: influencer.address.city ?? "",
      addressPincode: influencer.address.pincode ?? "",
      addressCountry: influencer.address.country ?? "",
      status: influencer.status,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateInfluencer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingInfluencer) return;

    const sanitizedHandles = editFormData.handles
      .map((handle) => ({
        platform: handle.platform || DEFAULT_HANDLE_ENTRY.platform,
        url: normalizeHandleUrl(handle.url),
      }))
      .filter((handle) => Boolean(handle.url));

    if (!editFormData.name.trim() || sanitizedHandles.length === 0) {
      toast({
        title: 'Name and handle are required',
        description: 'Please provide at least one social handle with a valid link.',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdating(true);

    const payload = {
      pid: editFormData.pid.trim() || null,
      name: editFormData.name.trim(),
      handle: JSON.stringify(sanitizedHandles),
      email: editFormData.email.trim() || null,
      phone: editFormData.phone.trim() || null,
      categories: editFormData.categories
        .split(',')
        .map((category) => category.trim())
        .filter(Boolean),
      address_line1: editFormData.addressLine1.trim() || null,
      address_line2: editFormData.addressLine2.trim() || null,
      address_landmark: editFormData.addressLandmark.trim() || null,
      address_city: editFormData.addressCity.trim() || null,
      address_pincode: editFormData.addressPincode.trim() || null,
      address_country: editFormData.addressCountry.trim() || null,
      status: editFormData.status,
    };

    try {
      const { data, error } = await supabase
        .from('influencers')
        .update(payload as never)
        .eq('id', editingInfluencer.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      const normalized = normalizeInfluencer(data);
      setInfluencers((prev) => prev.map((inf) => (inf.id === normalized.id ? normalized : inf)));
      setIsEditDialogOpen(false);
      resetEditForm();
      toast({
        title: 'Influencer updated',
        description: `${normalized.name} has been updated.`,
      });
    } catch (err: any) {
      console.error('Error updating influencer:', err);
      toast({
        title: 'Failed to update influencer',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = async (influencer: InfluencerRecord) => {
    const nextStatus: 'active' | 'inactive' = influencer.status === 'active' ? 'inactive' : 'active';
    setIsStatusUpdatingId(influencer.id);
    try {
      const { data, error } = await supabase
        .from('influencers')
        .update({ status: nextStatus } as never)
        .eq('id', influencer.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      const updated = normalizeInfluencer(data);
      setInfluencers((prev) => prev.map((inf) => (inf.id === influencer.id ? updated : inf)));
      toast({
        title: nextStatus === 'active' ? 'Influencer activated' : 'Influencer deactivated',
        description: `${updated.name} is now ${nextStatus}.`,
      });
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

  const handleDeleteInfluencer = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const attemptDelete = async (client: typeof supabase) => {
        const { data, error } = await client
          .from('influencers')
          .delete()
          .eq('id', deleteTarget.id)
          .select('id')
          .maybeSingle();
        return { data, error };
      };

      let deletionError: any = null;
      let deleted = false;

      const { data: primaryData, error: primaryError } = await attemptDelete(supabase);
      if (primaryError) {
        deletionError = primaryError;
      } else if (primaryData) {
        deleted = true;
      }

      if (!deleted && supabaseAdmin) {
        const { data: adminData, error: adminError } = await attemptDelete(supabaseAdmin);
        if (adminError) {
          deletionError = adminError;
        } else if (adminData) {
          deleted = true;
          deletionError = null;
        }
      }

      if (!deleted) {
        throw deletionError ?? new Error('Unable to delete influencer.');
      }

      setInfluencers((prev) => prev.filter((inf) => inf.id !== deleteTarget.id));
      toast({
        title: 'Influencer removed',
        description: `${deleteTarget.name} has been deleted.`,
      });
      setDeleteTarget(null);
    } catch (err: any) {
      console.error('Error deleting influencer:', err);
      toast({
        title: 'Delete failed',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const noResults = !isLoading && filteredInfluencers.length === 0;

  return (
    <>
      <div className="flex min-h-screen bg-gradient-subtle">
        <Sidebar />
        <div className="flex-1 lg:ml-56">
          <Header />
          <main className="container mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-6 space-y-4 pb-24 lg:pb-8 animate-fade-in">
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-3xl bg-primary text-white ">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.28),transparent_55%)]" />
                <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                <div className="relative p-6 sm:p-8 space-y-8">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">Creators</p>
                      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">Influencer Management</h1>
                      <p className="text-sm sm:text-base text-white/80 max-w-2xl">
                        Build, monitor, and activate your influencer roster with live platform stats, imports, and fast edits.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 rounded-2xl border border-white/30 bg-white/10 p-5 backdrop-blur-lg text-sm text-white/90 min-w-[240px]">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Total Creators</span>
                        <span>{influencers.length}</span>
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
                      <div className="flex items-center justify-between text-xs text-white/70 border-t border-white/20 pt-3 mt-2">
                        <span>View mode</span>
                        <span>{viewMode === 'grid' ? 'Grid view' : 'List view'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {summaryTiles.map(({ id, title, value, subtext, trend, icon: Icon, accent, statusBadge }) => (
                      <Card
                        key={id}
                        className="relative overflow-hidden p-4 md:p-6 bg-white/90 border border-white/20 backdrop-blur transition-transform duration-200 hover:-translate-y-1"
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
                                {statusBadge && (
                                  <Badge variant={statusBadge.variant} className="rounded-full text-xs px-2.5 py-0.5">
                                    {statusBadge.label}
                                  </Badge>
                                )}
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
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-stretch">
              <div className="flex-1 flex items-center gap-3">
                <SearchBar
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Search influencers, handles, or categories..."
                />
                <div className="flex items-center rounded-lg border border-border/60 bg-background p-1 shadow-sm">
                  <Button
                    type="button"
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    className="h-10 w-10 rounded-md"
                    onClick={() => setViewMode('grid')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    className="h-10 w-10 rounded-md"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
                <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "h-10 w-10 shrink-0 rounded-md border-border/60",
                        platformFilter !== 'All' && 'bg-primary/10 text-primary'
                      )}
                    >
                      <Filter className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2 space-y-1">
                    {['All', ...availablePlatforms].map((option) => (
                      <Button
                        key={option}
                        type="button"
                        variant={platformFilter === option ? 'default' : 'ghost'}
                        className="w-full justify-start"
                        onClick={() => {
                          setPlatformFilter(option);
                          setIsFilterOpen(false);
                        }}
                      >
                        {option}
                      </Button>
                    ))}
                  </PopoverContent>
                </Popover>
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
                  className="h-11 px-4 rounded-lg border-border/60"
                  onClick={handleImportClick}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
                {(userRole === 'admin' || userRole === 'super_admin' || isSuperAdmin) && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 px-4 rounded-lg border-border/60"
                    onClick={handleExportClick}
                    disabled={!influencers.length}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                )}
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
                      Add Influencer
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Influencer</DialogTitle>
                      <DialogDescription>
                        Provide basic details to onboard a new influencer into your workspace.
                      </DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={handleCreateInfluencer}>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor="pid">PID (optional)</Label>
                          <Input
                            id="pid"
                            value={formData.pid || nextPid}
                            readOnly
                            className="bg-muted/30"
                            placeholder="0000"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="name">Name</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                            placeholder="Influencer name"
                            required
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <div className="flex items-center justify-between">
                            <Label>Social Handles</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-3"
                              onClick={addHandleRow}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add handle
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {formData.handles.map((handle, index) => {
                              const meta = getPlatformMeta(handle.platform);
                              return (
                                <div key={`create-handle-${index}`} className="flex flex-col gap-2 md:flex-row md:items-center">
                                  <Select
                                    value={handle.platform}
                                    onValueChange={(value) => updateHandleRow(index, 'platform', value)}
                                  >
                                    <SelectTrigger className="md:w-48">
                                      <div className="flex items-center gap-2">
                                        {meta.icon ? (
                                          <img src={meta.icon} alt={meta.label} className="h-4 w-4 rounded-full" />
                                        ) : (
                                          <Layers className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <SelectValue placeholder="Platform" />
                                      </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {SOCIAL_PLATFORM_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          <div className="flex items-center gap-2">
                                            {option.icon ? (
                                              <img src={option.icon} alt={option.label} className="h-4 w-4 rounded-full" />
                                            ) : (
                                              <Layers className="h-4 w-4 text-muted-foreground" />
                                            )}
                                            <span>{option.label}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    value={handle.url}
                                    onChange={(event) => updateHandleRow(index, 'url', event.target.value)}
                                    placeholder="https://instagram.com/username"
                                    className="md:flex-1"
                                    required={index === 0}
                                  />
                                  {formData.handles.length > 1 ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive"
                                      onClick={() => removeHandleRow(index)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label>Status</Label>
                          <Select
                            value={formData.status}
                            onValueChange={(value) =>
                              setFormData((prev) => ({ ...prev, status: value as 'active' | 'inactive' }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                            placeholder="hello@example.com"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="phone">Phone</Label>
                          <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))}
                            placeholder="+91 90000 00000"
                          />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <Label htmlFor="categories">Categories</Label>
                          <Input
                            id="categories"
                            value={formData.categories}
                            onChange={(event) => setFormData((prev) => ({ ...prev, categories: event.target.value }))}
                            placeholder="Comma separated e.g. Beauty, Lifestyle"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="addressLine1">Address Line 1</Label>
                          <Input
                            id="addressLine1"
                            value={formData.addressLine1}
                            onChange={(event) => setFormData((prev) => ({ ...prev, addressLine1: event.target.value }))}
                            placeholder="Flat / House No., Street"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="addressLine2">Address Line 2</Label>
                          <Input
                            id="addressLine2"
                            value={formData.addressLine2}
                            onChange={(event) => setFormData((prev) => ({ ...prev, addressLine2: event.target.value }))}
                            placeholder="Area, Locality"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="addressLandmark">Landmark</Label>
                          <Input
                            id="addressLandmark"
                            value={formData.addressLandmark}
                            onChange={(event) => setFormData((prev) => ({ ...prev, addressLandmark: event.target.value }))}
                            placeholder="Nearby landmark"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="addressCity">City</Label>
                          <Input
                            id="addressCity"
                            value={formData.addressCity}
                            onChange={(event) => setFormData((prev) => ({ ...prev, addressCity: event.target.value }))}
                            placeholder="City"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="addressPincode">Pincode</Label>
                          <Input
                            id="addressPincode"
                            value={formData.addressPincode}
                            onChange={(event) => setFormData((prev) => ({ ...prev, addressPincode: event.target.value }))}
                            placeholder="Pincode"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="addressCountry">Country</Label>
                          <Input
                            id="addressCountry"
                            value={formData.addressCountry}
                            onChange={(event) => setFormData((prev) => ({ ...prev, addressCountry: event.target.value }))}
                            placeholder="Country"
                          />
                        </div>
                      </div>
                      <DialogFooter className="space-x-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setIsAddDialogOpen(false);
                            void resetForm();
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                          {isSaving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save Influencer'
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

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
                      <DialogTitle>Edit Influencer</DialogTitle>
                      <DialogDescription>Modify the selected influencer and manage their social handles.</DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={handleUpdateInfluencer}>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor="edit-pid">PID (optional)</Label>
                          <Input
                            id="edit-pid"
                            value={editFormData.pid}
                            placeholder="PID-2400"
                            readOnly
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="edit-name">Name</Label>
                          <Input
                            id="edit-name"
                            value={editFormData.name}
                            onChange={(event) => setEditFormData((prev) => ({ ...prev, name: event.target.value }))}
                            placeholder="Influencer name"
                            required
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <div className="flex items-center justify-between">
                            <Label>Social Handles</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-3"
                              onClick={addEditHandleRow}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add handle
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {editFormData.handles.map((handle, index) => {
                              const meta = getPlatformMeta(handle.platform);
                              return (
                                <div key={`edit-handle-${index}`} className="flex flex-col gap-2 md:flex-row md:items-center">
                                  <Select
                                    value={handle.platform}
                                    onValueChange={(value) => updateEditHandleRow(index, 'platform', value)}
                                  >
                                    <SelectTrigger className="md:w-48">
                                      <div className="flex items-center gap-2">
                                        {meta.icon ? (
                                          <img src={meta.icon} alt={meta.label} className="h-4 w-4 rounded-full" />
                                        ) : (
                                          <Layers className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <SelectValue placeholder="Platform" />
                                      </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {SOCIAL_PLATFORM_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          <div className="flex items-center gap-2">
                                            {option.icon ? (
                                              <img src={option.icon} alt={option.label} className="h-4 w-4 rounded-full" />
                                            ) : (
                                              <Layers className="h-4 w-4 text-muted-foreground" />
                                            )}
                                            <span>{option.label}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    value={handle.url}
                                    onChange={(event) => updateEditHandleRow(index, 'url', event.target.value)}
                                    placeholder="https://instagram.com/username"
                                    className="md:flex-1"
                                    required={index === 0}
                                  />
                                  {editFormData.handles.length > 1 ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive"
                                      onClick={() => removeEditHandleRow(index)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label>Status</Label>
                          <Select
                            value={editFormData.status}
                            onValueChange={(value) =>
                              setEditFormData((prev) => ({ ...prev, status: value as 'active' | 'inactive' }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="edit-email">Email</Label>
                          <Input
                            id="edit-email"
                            type="email"
                            value={editFormData.email}
                            onChange={(event) => setEditFormData((prev) => ({ ...prev, email: event.target.value }))}
                            placeholder="hello@example.com"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="edit-phone">Phone</Label>
                          <Input
                            id="edit-phone"
                            value={editFormData.phone}
                            onChange={(event) => setEditFormData((prev) => ({ ...prev, phone: event.target.value }))}
                            placeholder="+91 90000 00000"
                          />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <Label htmlFor="edit-categories">Categories</Label>
                          <Input
                            id="edit-categories"
                            value={editFormData.categories}
                            onChange={(event) => setEditFormData((prev) => ({ ...prev, categories: event.target.value }))}
                            placeholder="Comma separated e.g. Beauty, Lifestyle"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="edit-addressLine1">Address Line 1</Label>
                          <Input
                            id="edit-addressLine1"
                            value={editFormData.addressLine1}
                            onChange={(event) => setEditFormData((prev) => ({ ...prev, addressLine1: event.target.value }))}
                            placeholder="Flat / House No., Street"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="edit-addressLine2">Address Line 2</Label>
                          <Input
                            id="edit-addressLine2"
                            value={editFormData.addressLine2}
                            onChange={(event) => setEditFormData((prev) => ({ ...prev, addressLine2: event.target.value }))}
                            placeholder="Area, Locality"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="edit-addressLandmark">Landmark</Label>
                          <Input
                            id="edit-addressLandmark"
                            value={editFormData.addressLandmark}
                            onChange={(event) => setEditFormData((prev) => ({ ...prev, addressLandmark: event.target.value }))}
                            placeholder="Nearby landmark"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="edit-addressCity">City</Label>
                          <Input
                            id="edit-addressCity"
                            value={editFormData.addressCity}
                            onChange={(event) => setEditFormData((prev) => ({ ...prev, addressCity: event.target.value }))}
                            placeholder="City"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="edit-addressPincode">Pincode</Label>
                          <Input
                            id="edit-addressPincode"
                            value={editFormData.addressPincode}
                            onChange={(event) => setEditFormData((prev) => ({ ...prev, addressPincode: event.target.value }))}
                            placeholder="Pincode"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="edit-addressCountry">Country</Label>
                          <Input
                            id="edit-addressCountry"
                            value={editFormData.addressCountry}
                            onChange={(event) => setEditFormData((prev) => ({ ...prev, addressCountry: event.target.value }))}
                            placeholder="Country"
                          />
                        </div>
                      </div>
                      <DialogFooter className="space-x-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setIsEditDialogOpen(false);
                            resetEditForm();
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isUpdating}>
                          {isUpdating ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Update Influencer'
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

              </div>
            </div>

            {isLoading ? (
              <Card className="border border-border/50 p-8 text-center space-y-3 bg-card">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading influencers from Supabase...</p>
              </Card>
            ) : noResults ? (
              <Card className="border border-dashed border-border/50 p-8 text-center text-muted-foreground bg-card">
                No influencers match your current search or filters.
              </Card>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredInfluencers.map((influencer) => (
                  <Card
                    key={influencer.id}
                    className="p-4 bg-card hover:shadow-lg transition-all duration-300 border-border/50 hover:scale-[1.02] flex flex-col"
                  >
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.12em]">
                            {influencer.pid || influencer.id}
                          </p>
                          <h3 className="text-lg font-semibold text-foreground">{influencer.name}</h3>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <Badge
                            className={cn(
                              "rounded-full px-3 py-1 text-xs",
                              influencer.status === 'active'
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-100 text-amber-700 border border-amber-200'
                            )}
                          >
                            {influencer.status === 'active' ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid gap-3 text-sm text-muted-foreground">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-3">
                          <span className="font-medium text-foreground">Social Handles</span>
                          <div className="flex flex-wrap items-center gap-2">
                            {influencer.handles.length > 0 ? (
                              influencer.handles.map((handle, idx) => {
                                const meta = getPlatformMeta(handle.platform);
                                const url = normalizeHandleUrl(handle.url);
                                return (
                                  <a
                                    key={`${handle.platform}-${idx}`}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background transition hover:border-primary hover:bg-primary/10"
                                    title={`${meta.label} profile`}
                                    aria-label={`${meta.label} profile`}
                                  >
                                    {meta.icon ? (
                                      <img src={meta.icon} alt={meta.label} className="h-4 w-4" />
                                    ) : (
                                      <Layers className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </a>
                                );
                              })
                            ) : (
                              <span className="text-xs text-muted-foreground">No handles</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-3">
                          <span className="font-medium text-foreground">Email</span>
                          <span>{influencer.email || "N/A"}</span>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-3">
                          <span className="font-medium text-foreground">Phone</span>
                          <span>{influencer.phone || "N/A"}</span>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 md:gap-3">
                          <span className="font-medium text-foreground">Categories</span>
                          <div className="flex flex-wrap gap-2">
                            {influencer.categories.length > 0 ? (
                              influencer.categories.map((category) => (
                                <Badge key={category} variant="outline" className="rounded-full text-xs">
                                  {category}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="outline" className="rounded-full text-xs">
                                No categories
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="font-medium text-foreground">Address</span>
                          <div className="text-muted-foreground text-sm">
                            {[influencer.address.line1, influencer.address.line2]
                              .filter(Boolean)
                              .join(', ') || 'N/A'}
                            {influencer.address.landmark && (
                              <>
                                <br />
                                <span>Landmark: {influencer.address.landmark}</span>
                              </>
                            )}
                            <br />
                            {[influencer.address.city, influencer.address.pincode]
                              .filter(Boolean)
                              .join(' - ') || 'City / Pincode not set'}
                            {influencer.address.country && (
                              <>
                                <br />
                                <span>{influencer.address.country}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-border/30">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleStatus(influencer)}
                          disabled={isStatusUpdatingId === influencer.id}
                          className="flex items-center gap-1"
                        >
                          {isStatusUpdatingId === influencer.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Power className="h-3.5 w-3.5" />
                          )}
                          {influencer.status === 'active' ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(influencer)}
                          className="flex items-center gap-1"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteTarget(influencer)}
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
              <Card className="border border-border/60 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground uppercase text-xs tracking-[0.18em]">
                        <th className="py-3 px-4 font-semibold">PID</th>
                        <th className="py-3 px-4 font-semibold">Name</th>
                        <th className="py-3 px-4 font-semibold">Handles</th>
                        <th className="py-3 px-4 font-semibold">Phone</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInfluencers.map((influencer) => (
                        <tr key={influencer.id} className="border-t border-border/40">
                          <td className="py-3 px-4 font-medium text-foreground">{influencer.pid || influencer.id}</td>
                          <td className="py-3 px-4 text-foreground">{influencer.name}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {influencer.handles.length > 0 ? (
                                influencer.handles.map((handle, idx) => {
                                  const meta = getPlatformMeta(handle.platform);
                                  const url = normalizeHandleUrl(handle.url);
                                  return (
                                    <a
                                      key={`${handle.platform}-${idx}`}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background transition hover:border-primary hover:bg-primary/10"
                                      title={`${meta.label} profile`}
                                      aria-label={`${meta.label} profile`}
                                    >
                                      {meta.icon ? (
                                        <img src={meta.icon} alt={meta.label} className="h-4 w-4" />
                                      ) : (
                                        <Layers className="h-4 w-4 text-muted-foreground" />
                                      )}
                                    </a>
                                  );
                                })
                              ) : (
                                <span className="text-xs text-muted-foreground">N/A</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{influencer.phone || "N/A"}</td>
                          <td className="py-3 px-4">
                            <Badge
                              className={cn(
                                "rounded-full px-3 py-1 text-xs",
                                influencer.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-100 text-amber-700 border border-amber-200'
                              )}
                            >
                              {influencer.status === 'active' ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleStatus(influencer)}
                                disabled={isStatusUpdatingId === influencer.id}
                              >
                                {isStatusUpdatingId === influencer.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Power className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(influencer)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => setDeleteTarget(influencer)}
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

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete influencer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteTarget?.name ?? 'this influencer'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteInfluencer}
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
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={isImportDialogOpen}
        onOpenChange={(open) => {
          setIsImportDialogOpen(open);
          if (!open) {
            setSelectedImportFile(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Influencers</DialogTitle>
            <DialogDescription>
              Download the sample CSV, fill it with your data, and upload it to import influencers in bulk.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
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
                  <Upload className="h-4 w-4 mr-2" />
                  Upload & Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default Influencer;


