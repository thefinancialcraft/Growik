import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  CampaignContractRef,
  CampaignInfluencerRef,
  CampaignRecord,
  CampaignStatus,
  CampaignUserRef,
  CompanyOption,
  ContractOption,
  InfluencerOption,
  STATUS_STYLES,
  UserOption,
  extractCampaignNumber,
  getPlatformMeta,
  mapCampaignRow,
  parseHandles,
} from "@/lib/campaign";
import {
  Calendar,
  CalendarRange,
  CheckCircle2,
  Clock,
  Filter,
  LayoutGrid,
  Layers,
  List,
  Megaphone,
  Loader2,
  Power,
  PowerOff,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  UserPlus,
  X,
} from "lucide-react";

const Campaign = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [isCampaignsLoading, setIsCampaignsLoading] = useState<boolean>(true);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);
  const [isSavingCampaign, setIsSavingCampaign] = useState<boolean>(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [newStartDate, setNewStartDate] = useState<string>("");
  const [newEndDate, setNewEndDate] = useState<string>("");
  const [isLongTerm, setIsLongTerm] = useState<boolean>(false);
  const [selectedUsers, setSelectedUsers] = useState<CampaignUserRef[]>([]);
  const [selectedInfluencers, setSelectedInfluencers] = useState<CampaignInfluencerRef[]>([]);
  const [selectedContract, setSelectedContract] = useState<CampaignContractRef | null>(null);
  const [newDescription, setNewDescription] = useState("");
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState<boolean>(false);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [isAddCompanyDialogOpen, setIsAddCompanyDialogOpen] = useState<boolean>(false);
  const [newCompanyForm, setNewCompanyForm] = useState({
    name: "",
    description: "",
    managerName: "",
    managerContact: "",
    categories: "",
  });
  const [isSavingCompany, setIsSavingCompany] = useState<boolean>(false);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [contractsLoading, setContractsLoading] = useState<boolean>(false);
  const [contractsError, setContractsError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [isUserPickerOpen, setIsUserPickerOpen] = useState<boolean>(false);
  const [userPickerSelection, setUserPickerSelection] = useState<Set<string>>(new Set());
  const [usersSearch, setUsersSearch] = useState<string>("");
  const [influencers, setInfluencers] = useState<InfluencerOption[]>([]);
  const [influencersLoading, setInfluencersLoading] = useState<boolean>(false);
  const [influencersError, setInfluencersError] = useState<string | null>(null);
  const [isInfluencerPickerOpen, setIsInfluencerPickerOpen] = useState<boolean>(false);
  const [influencerPickerSelection, setInfluencerPickerSelection] = useState<Set<string>>(new Set());
  const [influencersSearch, setInfluencersSearch] = useState<string>("");
  const [editingCampaignIdForUsers, setEditingCampaignIdForUsers] = useState<string | null>(null);
  const [editingCampaignIdForInfluencers, setEditingCampaignIdForInfluencers] = useState<string | null>(null);
  const [campaignActionLoading, setCampaignActionLoading] = useState<Record<string, boolean>>({});
  const [campaignToDelete, setCampaignToDelete] = useState<CampaignRecord | null>(null);
  const [isDeletingCampaign, setIsDeletingCampaign] = useState<boolean>(false);
  const handleNavigateToCampaign = (campaign: CampaignRecord) => {
    navigate(`/campaign/${encodeURIComponent(campaign.id)}`, { state: { campaign } });
  };

  const formatDateForDisplay = (value: string | null | undefined): string | null => {
    if (!value) return null;
    try {
      const date = new Date(`${value}T00:00:00`);
      if (Number.isNaN(date.getTime())) {
        return value;
      }
      return date.toLocaleDateString();
    } catch {
      return value;
    }
  };

  useEffect(() => {
    const fetchCompanies = async () => {
      setCompaniesLoading(true);
      setCompaniesError(null);
      try {
        const { data, error } = await supabase
          .from("companies")
          .select("id, name")
          .order("name", { ascending: true });

        if (error) {
          throw error;
        }

        const items =
          ((data as any[]) ?? [])
            .map((item: any) => ({
              id: item.id as string,
              name: (item.name as string) ?? "",
            }))
            .filter((item) => item.name.trim().length > 0) ?? [];

        setCompanies(items);
      } catch (error: any) {
        console.error("Campaign: Error fetching companies", error);
        setCompaniesError(error?.message || "Unable to load companies.");
        toast({
          title: "Unable to load companies",
          description: error?.message || "Please try again later.",
          variant: "destructive",
        });
      } finally {
        setCompaniesLoading(false);
      }
    };

    const fetchContracts = async () => {
      setContractsLoading(true);
      setContractsError(null);
      try {
        const { data, error } = await supabase
          .from("contracts")
          .select("id, pid, contract_name, description, status")
          .order("contract_name", { ascending: true });

        if (error) {
          throw error;
        }

        const items: ContractOption[] =
          ((data as any[]) ?? [])
            .map((item: any) => ({
              id: item.id as string,
              pid: (item.pid as string | null) ?? null,
              name: (item.contract_name as string | null) ?? "Untitled Contract",
              description: (item.description as string | null) ?? null,
              status: (item.status as string | null) ?? null,
            }))
            .filter((item) => item.id && item.name.trim().length > 0) ?? [];

        setContracts(items);
      } catch (error: any) {
        console.error("Campaign: Error fetching contracts", error);
        setContractsError(error?.message || "Unable to load contracts.");
        toast({
          title: "Unable to load contracts",
          description: error?.message || "Please try again later.",
          variant: "destructive",
        });
      } finally {
        setContractsLoading(false);
      }
    };

    const fetchUsers = async () => {
      setUsersLoading(true);
      setUsersError(null);
      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("user_id, user_name, email, employee_id, status, approval_status, role")
          .order("user_name", { ascending: true });

        if (error) {
          throw error;
        }

        const items: UserOption[] =
          (data ?? [])
            .map((item) => {
              const id = (item as any).user_id as string | null;
              const email = ((item as any).email as string | null) ?? "";
              const nameCandidate = ((item as any).user_name as string | null) ?? "";
              const name = (nameCandidate || email || "").trim();
              if (!id || !name) {
                return null;
              }
              return {
                id,
                name,
                email,
                employeeId: (item as any).employee_id ?? null,
                status: (item as any).status ?? null,
                role: (item as any).role ?? null,
                approvalStatus: (item as any).approval_status ?? null,
              } as UserOption;
            })
            .filter(Boolean) as UserOption[];

        setUsers(items);
      } catch (error: any) {
        console.error("Campaign: Error fetching users", error);
        setUsersError(error?.message || "Unable to load users.");
        toast({
          title: "Unable to load users",
          description: error?.message || "Please try again later.",
          variant: "destructive",
        });
      } finally {
        setUsersLoading(false);
      }
    };

    const fetchInfluencers = async () => {
      setInfluencersLoading(true);
      setInfluencersError(null);
      try {
        const { data, error } = await supabase
          .from("influencers")
          .select("id, pid, name, email, handle, status, address_country")
          .order("name", { ascending: true });

        if (error) {
          throw error;
        }

        const items: InfluencerOption[] =
          ((data as any[]) ?? [])
            .map((item: any) => {
              const name = (item.name as string | null) ?? "";
              if (!item.id || !name.trim()) {
                return null;
              }
              return {
                id: item.id as string,
                pid: item.pid ?? null,
                name: name.trim(),
                email: (item.email as string | null) ?? null,
                handles: parseHandles(item.handle),
                country: (item.address_country as string | null) ?? null,
                status: item.status ?? null,
              } as InfluencerOption;
            })
            .filter(Boolean) as InfluencerOption[];

        setInfluencers(items);
      } catch (error: any) {
        console.error("Campaign: Error fetching influencers", error);
        setInfluencersError(error?.message || "Unable to load influencers.");
        toast({
          title: "Unable to load influencers",
          description: error?.message || "Please try again later.",
          variant: "destructive",
        });
      } finally {
        setInfluencersLoading(false);
      }
    };

    const fetchCampaigns = async () => {
      setIsCampaignsLoading(true);
      setCampaignsError(null);
      try {
        const { data, error } = await supabase
          .from("campaigns")
          .select(
            "id, name, brand, objective, users, influencers, contract_id, contract_snapshot, start_date, end_date, is_long_term, status, progress, created_at"
          )
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        const items =
          ((data as any[]) ?? []).map((row: any) => mapCampaignRow(row)) ?? [];

        setCampaigns(items);
      } catch (error: any) {
        console.error("Campaign: Error fetching campaigns", error);
        setCampaignsError(error?.message || "Unable to load campaigns.");
        toast({
          title: "Unable to load campaigns",
          description: error?.message || "Please try again later.",
          variant: "destructive",
        });
      } finally {
        setIsCampaignsLoading(false);
      }
    };

    fetchCompanies();
    fetchContracts();
    fetchUsers();
    fetchInfluencers();
    fetchCampaigns();
  }, [toast]);

  const resetCreateForm = () => {
    setNewCampaignName("");
    setNewBrandName("");
    setNewStartDate("");
    setNewEndDate("");
    setIsLongTerm(false);
    setSelectedContract(null);
    setNewDescription("");
    setSelectedUsers([]);
    setSelectedInfluencers([]);
    setUserPickerSelection(new Set());
    setInfluencerPickerSelection(new Set());
    setUsersSearch("");
    setInfluencersSearch("");
  };

  const resetNewCompanyForm = () => {
    setNewCompanyForm({
      name: "",
      description: "",
      managerName: "",
      managerContact: "",
      categories: "",
    });
  };

  const handleOpenCreateDialog = () => {
    resetCreateForm();
    setIsCreateDialogOpen(true);
  };

  const handleBrandSelect = (value: string) => {
    if (value === "__add_new_company__") {
      setIsAddCompanyDialogOpen(true);
      return;
    }
    setNewBrandName(value);
  };

  const handleLongTermToggle = (checked: boolean) => {
    setIsLongTerm(checked);
    if (checked) {
      setNewEndDate("");
    }
  };

  const handleContractSelect = (value: string) => {
    if (value === "__loading" || value === "__no_contracts") {
      return;
    }
    const contract = contracts.find((item) => item.id === value) ?? null;
    setSelectedContract(contract);
  };

  const clearSelectedContract = () => {
    setSelectedContract(null);
  };

  const setCampaignLoadingState = (campaignId: string, loading: boolean) => {
    setCampaignActionLoading((prev) => {
      const next = { ...prev };
      if (loading) {
        next[campaignId] = true;
      } else {
        delete next[campaignId];
      }
      return next;
    });
  };

  const handleUpdateCampaignStatus = async (campaign: CampaignRecord, status: CampaignStatus) => {
    if (campaign.status === status) {
      return;
    }

    setCampaignLoadingState(campaign.id, true);
    try {
      const { data, error } = await (supabase as any)
        .from("campaigns")
        .update({ status })
        .eq("id", campaign.id)
        .select("id");

      if (error) {
        throw error;
      }

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Campaign not found or could not be updated.");
      }

      setCampaigns((prev) =>
        prev.map((item) => (item.id === campaign.id ? { ...item, status } : item))
      );

      toast({
        title: status === "live" ? "Campaign activated" : "Campaign updated",
        description:
          status === "live"
            ? `"${campaign.name}" is now marked as active.`
            : status === "inactive"
            ? `"${campaign.name}" has been moved to inactive.`
            : `"${campaign.name}" status updated.`,
      });
    } catch (error: any) {
      console.error("Campaign: Error updating status", error);
      toast({
        title: "Unable to update status",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCampaignLoadingState(campaign.id, false);
    }
  };

  const handleUpdateCampaignUsers = async (
    campaign: CampaignRecord,
    updatedUsers: CampaignUserRef[]
  ): Promise<boolean> => {
    setCampaignLoadingState(campaign.id, true);
    try {
      // Update the campaign with new users array
      const { data, error } = await (supabase as any)
        .from("campaigns")
        .update({ users: updatedUsers })
        .eq("id", campaign.id)
        .select("id, users");

      if (error) {
        console.error("Campaign: Supabase error updating users", error);
        throw error;
      }

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Campaign not found or could not be updated.");
      }

      // Refetch the updated campaign to get the latest data
      const { data: updatedCampaign, error: fetchError } = await supabase
        .from("campaigns")
        .select("id, name, brand, objective, users, influencers, contract_id, contract_snapshot, start_date, end_date, is_long_term, status, progress, created_at")
        .eq("id", campaign.id)
        .maybeSingle();

      if (fetchError) {
        console.error("Campaign: Error fetching updated campaign", fetchError);
        // Still update local state even if refetch fails
      setCampaigns((prev) =>
        prev.map((item) => (item.id === campaign.id ? { ...item, users: updatedUsers } : item))
      );
      } else if (updatedCampaign) {
        // Update with the fetched data
        const mapped = mapCampaignRow(updatedCampaign);
        setCampaigns((prev) =>
          prev.map((item) => (item.id === campaign.id ? mapped : item))
        );
      } else {
        // Fallback to local state update
        setCampaigns((prev) =>
          prev.map((item) => (item.id === campaign.id ? { ...item, users: updatedUsers } : item))
        );
      }

      toast({
        title: "Users updated",
        description: `"${campaign.name}" now has ${updatedUsers.length} assigned ${
          updatedUsers.length === 1 ? "user" : "users"
        }.`,
      });
      return true;
    } catch (error: any) {
      console.error("Campaign: Error updating users", error);
      toast({
        title: "Unable to update users",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setCampaignLoadingState(campaign.id, false);
    }
  };

  const handleUpdateCampaignInfluencers = async (
    campaign: CampaignRecord,
    updatedInfluencers: CampaignInfluencerRef[]
  ): Promise<boolean> => {
    setCampaignLoadingState(campaign.id, true);
    try {
      // Update the campaign with new influencers array
      const { data, error } = await (supabase as any)
        .from("campaigns")
        .update({ influencers: updatedInfluencers })
        .eq("id", campaign.id)
        .select("id, influencers");

      if (error) {
        console.error("Campaign: Supabase error updating influencers", error);
        throw error;
      }

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Campaign not found or could not be updated.");
      }

      // Refetch the updated campaign to get the latest data
      const { data: updatedCampaign, error: fetchError } = await supabase
        .from("campaigns")
        .select("id, name, brand, objective, users, influencers, contract_id, contract_snapshot, start_date, end_date, is_long_term, status, progress, created_at")
        .eq("id", campaign.id)
        .maybeSingle();

      if (fetchError) {
        console.error("Campaign: Error fetching updated campaign", fetchError);
        // Still update local state even if refetch fails
      setCampaigns((prev) =>
        prev.map((item) =>
          item.id === campaign.id ? { ...item, influencers: updatedInfluencers } : item
        )
      );
      } else if (updatedCampaign) {
        // Update with the fetched data
        const mapped = mapCampaignRow(updatedCampaign);
        setCampaigns((prev) =>
          prev.map((item) => (item.id === campaign.id ? mapped : item))
        );
      } else {
        // Fallback to local state update
        setCampaigns((prev) =>
          prev.map((item) =>
            item.id === campaign.id ? { ...item, influencers: updatedInfluencers } : item
          )
        );
      }

      toast({
        title: "Influencers updated",
        description: `"${campaign.name}" now has ${updatedInfluencers.length} assigned ${
          updatedInfluencers.length === 1 ? "influencer" : "influencers"
        }.`,
      });
      return true;
    } catch (error: any) {
      console.error("Campaign: Error updating influencers", error);
      toast({
        title: "Unable to update influencers",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setCampaignLoadingState(campaign.id, false);
    }
  };

  const handleDeleteCampaignConfirm = async () => {
    if (!campaignToDelete) {
      return;
    }

    setIsDeletingCampaign(true);
    try {
      const { error } = await supabase.from("campaigns").delete().eq("id", campaignToDelete.id);
      if (error) {
        throw error;
      }

      const { data: verify, error: verifyError } = await supabase
        .from("campaigns")
        .select("id")
        .eq("id", campaignToDelete.id)
        .maybeSingle();

      if (verifyError && verifyError.code !== "PGRST116") {
        console.warn("Campaign: Verification select failed", verifyError);
      }

      if (verify) {
        throw new Error("Campaign not found or already deleted.");
      }

      setCampaigns((prev) => prev.filter((campaign) => campaign.id !== campaignToDelete.id));
      toast({
        title: "Campaign deleted",
        description: `"${campaignToDelete.name}" has been removed.`,
      });
      setCampaignToDelete(null);
    } catch (error: any) {
      console.error("Campaign: Error deleting campaign", error);
      toast({
        title: "Unable to delete campaign",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingCampaign(false);
    }
  };

  const handleOpenUserPicker = (campaign?: CampaignRecord) => {
    if (campaign) {
      setEditingCampaignIdForUsers(campaign.id);
      setUserPickerSelection(new Set(campaign.users.map((user) => user.id)));
    } else {
      setEditingCampaignIdForUsers(null);
      setUserPickerSelection(new Set(selectedUsers.map((user) => user.id)));
    }
    setUsersSearch("");
    setIsUserPickerOpen(true);
  };

  const toggleUserSelection = (userId: string) => {
    setUserPickerSelection((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };
  
  const applyUserSelection = async () => {
    const selected = users
      .filter((user) => userPickerSelection.has(user.id))
      .map(({ id, name, email, employeeId }) => ({ id, name, email, employeeId }));

    if (editingCampaignIdForUsers) {
      const campaign = campaigns.find((item) => item.id === editingCampaignIdForUsers);
      if (!campaign) {
        toast({
          title: "Campaign not found",
          description: "Unable to update users for this campaign.",
          variant: "destructive",
        });
        return;
      }
      const success = await handleUpdateCampaignUsers(campaign, selected);
      if (!success) {
        return;
      }
      setEditingCampaignIdForUsers(null);
    } else {
      setSelectedUsers(selected);
    }

    setIsUserPickerOpen(false);
  };

  const handleRemoveSelectedUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((user) => user.id !== userId));
  };

  const clearSelectedUsers = () => {
    setSelectedUsers([]);
    setUserPickerSelection(new Set());
  };

  const handleOpenInfluencerPicker = (campaign?: CampaignRecord) => {
    if (campaign) {
      setEditingCampaignIdForInfluencers(campaign.id);
      setInfluencerPickerSelection(new Set(campaign.influencers.map((influencer) => influencer.id)));
    } else {
      setEditingCampaignIdForInfluencers(null);
      setInfluencerPickerSelection(new Set(selectedInfluencers.map((influencer) => influencer.id)));
    }
    setInfluencersSearch("");
    setIsInfluencerPickerOpen(true);
  };

  const handleOpenUserPickerForCreate = () => handleOpenUserPicker();
  const handleOpenInfluencerPickerForCreate = () => handleOpenInfluencerPicker();

  const toggleInfluencerSelection = (influencerId: string) => {
    setInfluencerPickerSelection((prev) => {
      const next = new Set(prev);
      if (next.has(influencerId)) {
        next.delete(influencerId);
      } else {
        next.add(influencerId);
      }
      return next;
    });
  };

  const applyInfluencerSelection = async () => {
    const selected = influencers
      .filter((influencer) => influencerPickerSelection.has(influencer.id))
      .map(({ id, pid, name, email, handles, country, status }) => ({
        id,
        pid: pid ?? null,
        name,
        email: email ?? null,
        handles,
        country: country ?? null,
        status: status ?? null,
      }));

    if (editingCampaignIdForInfluencers) {
      const campaign = campaigns.find((item) => item.id === editingCampaignIdForInfluencers);
      if (!campaign) {
        toast({
          title: "Campaign not found",
          description: "Unable to update influencers for this campaign.",
          variant: "destructive",
        });
        return;
      }
      const success = await handleUpdateCampaignInfluencers(campaign, selected);
      if (!success) {
        return;
      }
      setEditingCampaignIdForInfluencers(null);
    } else {
      setSelectedInfluencers(selected);
    }

    setIsInfluencerPickerOpen(false);
  };

  const handleRemoveSelectedInfluencer = (influencerId: string) => {
    setSelectedInfluencers((prev) => prev.filter((influencer) => influencer.id !== influencerId));
  };

  const clearSelectedInfluencers = () => {
    setSelectedInfluencers([]);
    setInfluencerPickerSelection(new Set());
  };

  const handleCreateCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newCampaignName.trim() || !newBrandName.trim()) {
      toast({
        title: "Missing details",
        description: "Please provide a campaign name and select a brand.",
        variant: "destructive",
      });
      return;
    }

    if (!isLongTerm && (!newStartDate || !newEndDate)) {
      toast({
        title: "Timeline required",
        description: "Please provide both a start and end date, or mark the campaign as long-term.",
        variant: "destructive",
      });
      return;
    }

    if (!isLongTerm && newStartDate && newEndDate) {
      const start = new Date(newStartDate);
      const end = new Date(newEndDate);
      if (end < start) {
        toast({
          title: "Invalid timeline",
          description: "End date cannot be earlier than start date.",
          variant: "destructive",
        });
        return;
      }
    }

    const nextId = nextCampaignPreview;
    const name = newCampaignName.trim();
    const brand = newBrandName.trim();
    const objective = newDescription.trim() || null;
    const startDateValue = newStartDate ? newStartDate : null;
    const endDateValue = isLongTerm ? null : newEndDate ? newEndDate : null;

    const payload = {
      id: nextId,
      name,
      brand,
      objective,
      users: selectedUsers,
      influencers: selectedInfluencers,
      contract_id: selectedContract?.id ?? null,
      contract_snapshot: selectedContract ? { ...selectedContract } : null,
      start_date: startDateValue,
      end_date: endDateValue,
      is_long_term: isLongTerm,
      status: "draft",
      progress: 0,
    };

    setIsSavingCampaign(true);

    try {
      const { data, error } = await supabase
        .from("campaigns")
        .insert(payload as any)
        .select()
        .single();

      if (error) {
        throw error;
      }

      const inserted = mapCampaignRow(data);
      setCampaigns((prev) => [inserted, ...prev.filter((campaign) => campaign.id !== inserted.id)]);

      // Create collaboration_action entries for all influencers
      if (selectedInfluencers.length > 0) {
        try {
          const isUuid = (value: string | undefined | null): value is string =>
            Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));

          const toDeterministicUuid = (input: string): string => {
            const hash = input.split("").reduce((acc, char) => {
              const hash = ((acc << 5) - acc) + char.charCodeAt(0);
              return hash & hash;
            }, 0);
            const hex = Math.abs(hash).toString(16).padStart(32, "0");
            return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((Math.abs(hash) % 4) + 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
          };

          const campaignKey = inserted.id;
          const resolvedCampaignId = isUuid(campaignKey) 
            ? campaignKey 
            : toDeterministicUuid(`campaign:${campaignKey}`);
          
          const contractPid = selectedContract?.pid ?? "none";
          
          // Create collaboration_action entries for each influencer
          const collaborationActions = selectedInfluencers.map((influencer) => {
            const influencerKey = influencer.pid ?? influencer.id ?? "none";
            const collaborationId = `${campaignKey}-${influencerKey}-${contractPid}`;
            
            return {
              campaign_id: resolvedCampaignId,
              influencer_id: influencer.id, // This should be a UUID
              collaboration_id: collaborationId,
              user_id: null, // Blank as requested
              action: "", // Empty string since action is required (NOT NULL)
              remark: null,
              contract_id: selectedContract?.id ?? null,
            };
          });

          // Insert all collaboration actions
          const { error: actionsError } = await supabase
            .from("collaboration_actions")
            .insert(collaborationActions as any);

          if (actionsError) {
            console.error("Campaign: Error creating collaboration actions", actionsError);
            // Don't fail the campaign creation if actions fail
          } else {
            console.log(`Campaign: Created ${collaborationActions.length} collaboration action entries`);
          }
        } catch (actionsErr: any) {
          console.error("Campaign: Exception creating collaboration actions", actionsErr);
          // Don't fail the campaign creation if actions fail
        }
      }

      toast({
        title: "Campaign Created",
        description: `"${inserted.name}" has been saved${selectedInfluencers.length > 0 ? ` with ${selectedInfluencers.length} collaboration action${selectedInfluencers.length !== 1 ? 's' : ''} created.` : '.'}`,
      });

      resetCreateForm();
      setIsCreateDialogOpen(false);
    } catch (error: any) {
      console.error("Campaign: Error creating campaign", error);
      toast({
        title: "Unable to create campaign",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingCampaign(false);
    }
  };

  const filteredCampaigns = useMemo(() => {
    if (!searchTerm.trim()) return campaigns;
    const query = searchTerm.toLowerCase();
    return campaigns.filter((campaign) => {
      if (
        campaign.name.toLowerCase().includes(query) ||
        campaign.brand.toLowerCase().includes(query) ||
        campaign.objective.toLowerCase().includes(query) ||
        campaign.id.toLowerCase().includes(query) ||
        (campaign.contract?.name ?? "").toLowerCase().includes(query) ||
        (campaign.contract?.pid ?? "").toLowerCase().includes(query) ||
        (campaign.contract?.status ?? "").toLowerCase().includes(query) ||
        (campaign.contract?.description ?? "").toLowerCase().includes(query)
      ) {
        return true;
      }
      if (
        (campaign.startDate ?? "").toLowerCase().includes(query) ||
        (campaign.endDate ?? "").toLowerCase().includes(query) ||
        (campaign.isLongTerm ? "long term" : "").includes(query)
      ) {
        return true;
      }
      return (
        campaign.users.some(
          (user) =>
            user.name.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query)
        ) ||
        campaign.influencers.some((influencer) =>
          influencer.name.toLowerCase().includes(query) ||
          (influencer.email ?? "").toLowerCase().includes(query) ||
          (influencer.pid ?? "").toLowerCase().includes(query) ||
          influencer.handles.some((handle) =>
            getPlatformMeta(handle.platform).label.toLowerCase().includes(query)
          )
        )
      );
    });
  }, [campaigns, searchTerm]);

  const liveCount = useMemo(() => campaigns.filter((c) => c.status === "live").length, [campaigns]);
  const scheduledCount = useMemo(() => campaigns.filter((c) => c.status === "scheduled").length, [campaigns]);
  const completedCount = useMemo(() => campaigns.filter((c) => c.status === "completed").length, [campaigns]);

  const totalUsers = useMemo(() => campaigns.reduce((sum, campaign) => sum + campaign.users.length, 0), [campaigns]);
  const totalInfluencers = useMemo(
    () => campaigns.reduce((sum, campaign) => sum + campaign.influencers.length, 0),
    [campaigns]
  );
  const averageInfluencers = useMemo(() => {
    if (!campaigns.length) return 0;
    return Math.round(totalInfluencers / campaigns.length);
  }, [campaigns.length, totalInfluencers]);

  const nextCampaignPreview = useMemo(() => {
    const maxNumber = campaigns.reduce((max, campaign) => {
      const value = extractCampaignNumber(campaign.id);
      return value > max ? value : max;
    }, -1);
    const nextNumber = maxNumber >= 0 ? maxNumber + 1 : 1;
    return `CAM${nextNumber.toString().padStart(3, "0")}`;
  }, [campaigns]);

  const sortedCompanies = useMemo(
    () => [...companies].sort((a, b) => a.name.localeCompare(b.name)),
    [companies]
  );

  const filteredUsersForPicker = useMemo(() => {
    const query = usersSearch.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) => {
      const role = (user.role ?? "").toLowerCase();
      const status = (user.status ?? "").toLowerCase();
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.employeeId ?? "").toLowerCase().includes(query) ||
        role.includes(query) ||
        status.includes(query)
      );
    });
  }, [users, usersSearch]);

  const filteredInfluencersForPicker = useMemo(() => {
    const query = influencersSearch.trim().toLowerCase();
    if (!query) return influencers;
    return influencers.filter((influencer) => {
      const pid = (influencer.pid ?? "").toLowerCase();
      const email = (influencer.email ?? "").toLowerCase();
      const status = (influencer.status ?? "").toLowerCase();
      const country = (influencer.country ?? "").toLowerCase();
      const platformMatch = influencer.handles.some((handle) =>
        getPlatformMeta(handle.platform).label.toLowerCase().includes(query)
      );
      return (
        influencer.name.toLowerCase().includes(query) ||
        pid.includes(query) ||
        email.includes(query) ||
        status.includes(query) ||
        country.includes(query) ||
        platformMatch
      );
    });
  }, [influencers, influencersSearch]);

  const handleAddCompanySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newCompanyForm.name.trim()) {
      toast({
        title: "Company name required",
        description: "Please enter a company name.",
        variant: "destructive",
      });
      return;
    }

    const categoriesArray = newCompanyForm.categories
      .split(",")
      .map((cat) => cat.trim())
      .filter((cat) => cat.length > 0);

    setIsSavingCompany(true);
    try {
    const { data, error } = await supabase
        .from("companies")
        .insert(
          {
            name: newCompanyForm.name.trim(),
            description: newCompanyForm.description.trim() || null,
            manager_name: newCompanyForm.managerName.trim() || null,
            manager_contact: newCompanyForm.managerContact.trim() || null,
            categories: categoriesArray.length ? categoriesArray : null,
          } as any
        )
        .select("id, name")
        .single();

      if (error) {
        throw error;
      }

      if (data) {
      const createdCompany: CompanyOption = {
        id: (data as any).id as string,
          name: ((data as any).name as string) ?? newCompanyForm.name.trim(),
        };

        setCompanies((prev) => {
          const next = [...prev, createdCompany];
          next.sort((a, b) => a.name.localeCompare(b.name));
          return next;
        });
        setNewBrandName(createdCompany.name);
        toast({
          title: "Company added",
          description: `${createdCompany.name} is now available as a brand option.`,
        });
      }

      setIsAddCompanyDialogOpen(false);
      resetNewCompanyForm();
    } catch (error: any) {
      console.error("Campaign: Error adding company", error);
      toast({
        title: "Failed to add company",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingCompany(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-subtle">
      <Sidebar />
      <MobileNav />

      <div className="flex-1 lg:ml-56">
        <Header />
        <main className="container mx-auto px-3 sm:px-4 py-4 space-y-6 pb-24 lg:pb-10 max-w-7xl">
          {campaignsError && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {campaignsError}
            </div>
          )}
          <section className="space-y-6">
            <div className="relative overflow-hidden rounded-3xl bg-primary text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_58%)]" />
              <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-white/15 blur-3xl" />
              <div className="relative p-6 sm:p-8 space-y-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                      Campaign Control Center
                    </p>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">
                      Campaign performance at a glance
                    </h1>
                    <p className="text-sm sm:text-base text-white/80 max-w-2xl">
                      Monitor budgets, timelines, and influencer collaboration metrics for every live activation.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold text-white/90">
                        {campaigns.length} active briefs
                      </Badge>
                      <Badge className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold text-white/90">
                        {liveCount} live campaigns
                      </Badge>
                      <Badge className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold text-white/90">
                        {totalUsers + totalInfluencers} collaborators engaged
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 rounded-2xl border border-white/30 bg-white/10 p-5 backdrop-blur-lg text-sm text-white/90 max-w-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Average Influencers</span>
                      <span>{averageInfluencers}</span>
                    </div>
                    <Separator className="bg-white/20" />
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-wide text-white/70">Live</span>
                        <span className="text-sm font-semibold">{liveCount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-wide text-white/70">Scheduled</span>
                        <span className="text-sm font-semibold">{scheduledCount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-wide text-white/70">Completed</span>
                        <span className="text-sm font-semibold">{completedCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-lg transition-all duration-300 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">Live Campaigns</p>
                    <p className="text-2xl font-bold text-foreground">{liveCount}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Clock className="h-6 w-6" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Actively delivering influencer content right now.</p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-lg transition-all duration-300 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">Scheduled Campaigns</p>
                    <p className="text-2xl font-bold text-foreground">{scheduledCount}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Calendar className="h-6 w-6" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Awaiting kick-off or pending content approvals.</p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-lg transition-all duration-300 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">Influencer Pool</p>
                    <p className="text-2xl font-bold text-foreground">{totalInfluencers}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Users className="h-6 w-6" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Creators currently engaged across campaign briefs.</p>
              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-xl shadow-lg p-6 space-y-5">
              <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                <div className="flex-1 flex items-center gap-3">
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search campaigns, brands, or objectives..."
                      className="pl-10 h-11 bg-card border-border/50 focus:shadow-md transition-all duration-300"
                    />
                  </div>
                  <div className="flex items-center rounded-lg border border-border/60 bg-background p-1 shadow-sm">
                    <Button
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="icon"
                      onClick={() => setViewMode("grid")}
                      className="h-10 w-10"
                      title="Grid view"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="icon"
                      onClick={() => setViewMode("list")}
                      className="h-10 w-10"
                      title="List view"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="outline" className="h-11 px-4">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                  </Button>
                </div>
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <Button variant="outline" className="h-11 px-4">
                    <Upload className="h-4 w-4 mr-2" />
                    Import Brief
                  </Button>
                  <Button
                    type="button"
                    onClick={handleOpenCreateDialog}
                    className="h-11 px-5 bg-gradient-to-r from-indigo-500 via-sky-500 to-purple-500 text-white shadow-md hover:opacity-90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Campaign
                  </Button>
                </div>
              </div>

              <Separator />

              <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2" : "space-y-3"}>
                {filteredCampaigns.map((campaign) => {
                  const startDisplay = formatDateForDisplay(campaign.startDate);
                  const endDisplay = formatDateForDisplay(campaign.endDate);
                  const isCampaignBusy = Boolean(campaignActionLoading[campaign.id]);
                  const isLive = campaign.status === "live";
                  const isInactive = campaign.status === "inactive";
                  return (
                  <div
                    key={campaign.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      // Don't navigate if clicking on buttons, dropdowns, or their children
                      const target = e.target as HTMLElement;
                      if (
                        target.closest('button') ||
                        target.closest('[role="menuitem"]') ||
                        target.closest('[data-radix-popper-content-wrapper]') ||
                        target.closest('[data-radix-dropdown-menu-content]')
                      ) {
                        return;
                      }
                      handleNavigateToCampaign(campaign);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleNavigateToCampaign(campaign);
                      }
                    }}
                    className="group rounded-2xl border border-border/50 bg-background/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200 p-4 flex flex-col gap-3 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                            {campaign.brand}
                          </p>
                          <Badge className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[campaign.status]}`}>
                            {campaign.status}
                          </Badge>
                        </div>
                        <h3 className="text-base font-semibold text-foreground">{campaign.name}</h3>
                        <p className="text-xs text-muted-foreground">{campaign.objective}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase text-muted-foreground">Campaign ID</p>
                        <p className="text-sm font-semibold text-foreground">{campaign.id}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 text-xs sm:text-sm">
                      <div className="rounded-2xl border border-border/60 bg-background/70 backdrop-blur-sm p-3 flex items-start gap-3">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <CalendarRange className="h-5 w-5" />
                        </span>
                        <div className="flex-1 space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Timeline
                          </p>
                          {campaign.isLongTerm ? (
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-foreground leading-tight">
                                Long-term engagement
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {startDisplay ? `Starts ${startDisplay}` : "Start date not set"}
                              </p>
                              <p className="text-[10px] text-muted-foreground/80">
                                Running without a scheduled end date.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <p className="text-sm font-semibold text-foreground leading-tight">
                                {startDisplay ?? "Start date not set"}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {endDisplay ? `Ends ${endDisplay}` : "End date not set"}
                              </p>
                              <p className="text-[10px] text-muted-foreground/80">
                                Scheduled activation window for this brief.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/70 backdrop-blur-sm p-3 flex items-start gap-3">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Users className="h-5 w-5" />
                        </span>
                        <div className="flex-1 space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Users
                          </p>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-semibold text-foreground">
                              {campaign.users.length}
                            </span>
                            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              {campaign.users.length === 1 ? "User" : "Users"}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/80">
                            Assigned collaborators in this campaign.
                          </p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/70 backdrop-blur-sm p-3 flex items-start gap-3">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                          <Megaphone className="h-5 w-5" />
                        </span>
                        <div className="flex-1 space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Influencers
                          </p>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-semibold text-foreground">
                              {campaign.influencers.length}
                            </span>
                            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              {campaign.influencers.length === 1 ? "Influencer" : "Influencers"}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/80">
                            Creators attached to campaign deliverables.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-xs sm:text-sm">
                      <div className="space-y-1">
                        <p className="text-xs uppercase text-muted-foreground">Contract</p>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-sm font-semibold text-foreground leading-tight">
                            {campaign.contract?.name ?? "Not selected"}
                          </p>
                      {campaign.contract?.pid && (
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          PID: {campaign.contract.pid}
                        </p>
                      )}
                          {campaign.contract?.status && (
                            <span className="w-fit rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 capitalize">
                              {campaign.contract.status}
                            </span>
                          )}
                          {campaign.contract?.description && (
                            <p className="text-[11px] text-muted-foreground leading-snug">
                              {campaign.contract.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs uppercase text-muted-foreground">Created</p>
                        <p className="text-sm font-semibold text-foreground leading-tight">
                          {new Date(campaign.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>{campaign.progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 via-sky-500 to-purple-500"
                          style={{ width: `${campaign.progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-1">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        {campaign.status === "completed"
                          ? "Report ready for download"
                          : campaign.status === "live"
                          ? "Content approvals on-track"
                          : "Draft insights auto-saved"}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs"
                          onClick={(event) => event.stopPropagation()}
                        >
                          View Brief
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs bg-primary text-white hover:bg-primary/90 focus-visible:ring-primary"
                              disabled={isCampaignBusy}
                              onClick={(event) => event.stopPropagation()}
                            >
                              Manage
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            align="end" 
                            className="w-56"
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <DropdownMenuLabel>Campaign Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                handleOpenUserPicker(campaign);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenUserPicker(campaign);
                              }}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                              }}
                              disabled={isCampaignBusy || (usersLoading && !users.length)}
                            >
                              <UserPlus className="mr-2 h-4 w-4" />
                              Add Users
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                handleOpenInfluencerPicker(campaign);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenInfluencerPicker(campaign);
                              }}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                              }}
                              disabled={isCampaignBusy || (influencersLoading && !influencers.length)}
                            >
                              <Megaphone className="mr-2 h-4 w-4" />
                              Add Influencers
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => handleUpdateCampaignStatus(campaign, "live")}
                              disabled={isCampaignBusy || isLive}
                            >
                              {isCampaignBusy && !isLive ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Power className="mr-2 h-4 w-4 text-emerald-600" />
                              )}
                              Set Active
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => handleUpdateCampaignStatus(campaign, "inactive")}
                              disabled={isCampaignBusy || isInactive}
                            >
                              {isCampaignBusy && !isInactive ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <PowerOff className="mr-2 h-4 w-4 text-amber-600" />
                              )}
                              Set Inactive
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => setCampaignToDelete(campaign)}
                              disabled={isCampaignBusy}
                              className="text-rose-600 focus:text-rose-700"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Campaign
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}

                {filteredCampaigns.length === 0 && (
                  <div className="col-span-full rounded-2xl border border-dashed border-border/50 bg-background/60 backdrop-blur-sm py-16 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                      <Search className="h-6 w-6" />
                    </div>
                    <h4 className="text-lg font-semibold text-foreground">No campaigns found</h4>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Try adjusting your search filters or create a new campaign brief to get started.
                    </p>
                    <div className="mt-6 flex justify-center">
                      <Button
                        type="button"
                        onClick={handleOpenCreateDialog}
                        className="h-11 px-5 bg-gradient-to-r from-indigo-500 via-sky-500 to-purple-500 text-white shadow-md hover:opacity-90"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        New Campaign
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            resetCreateForm();
          } else {
            setIsCreateDialogOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
            <DialogDescription>
              Provide the core details for this campaign brief. You can update advanced settings after creation.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCampaign} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="campaignName">Campaign Name *</Label>
                <Input
                  id="campaignName"
                  value={newCampaignName}
                  onChange={(event) => setNewCampaignName(event.target.value)}
                  placeholder="e.g., Festive Social Drive"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaignId">Campaign ID</Label>
                <Input
                  id="campaignId"
                  value={nextCampaignPreview}
                  readOnly
                  disabled
                  className="bg-muted/40 text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">Generated automatically when the campaign is saved.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="brandSelect">Brand *</Label>
              <Select
                value={newBrandName || undefined}
                onValueChange={handleBrandSelect}
                disabled={companiesLoading && !sortedCompanies.length}
              >
                <SelectTrigger id="brandSelect">
                  <SelectValue
                    placeholder={
                      companiesLoading ? "Loading companies..." : "Select a company"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {companiesLoading ? (
                    <SelectItem value="__loading" disabled>
                      Loading companies...
                    </SelectItem>
                  ) : (
                    <>
                      {sortedCompanies.length ? (
                        sortedCompanies.map((company) => (
                          <SelectItem key={company.id} value={company.name}>
                            {company.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__no_companies" disabled>
                          No companies found
                        </SelectItem>
                      )}
                      <SelectItem value="__add_new_company__">
                        + Add new company
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              {companiesError ? (
                <p className="text-xs text-red-500">{companiesError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Choose an existing company or create a new one.
                </p>
              )}
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-medium">Timeline</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="campaignStart">Start Date</Label>
                  <Input
                    id="campaignStart"
                    type="date"
                    value={newStartDate}
                    onChange={(event) => setNewStartDate(event.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaignEnd">End Date</Label>
                  <Input
                    id="campaignEnd"
                    type="date"
                    value={isLongTerm ? "" : newEndDate}
                    onChange={(event) => setNewEndDate(event.target.value)}
                    className="bg-background"
                    disabled={isLongTerm}
                    min={newStartDate || undefined}
                    placeholder={isLongTerm ? "Long-term campaign" : undefined}
                  />
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-2">
                <Checkbox
                  id="campaignLongTerm"
                  checked={isLongTerm}
                  onCheckedChange={(checked) => handleLongTermToggle(checked === true)}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <Label htmlFor="campaignLongTerm" className="text-sm font-medium leading-none">
                    Long-term campaign
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Skip the end date to keep this campaign running without a defined end window.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assign Users</Label>
              <div className="min-h-[64px] rounded-lg border border-border/60 bg-background/70 p-3 flex flex-wrap items-start gap-2">
                {selectedUsers.length > 0 ? (
                  selectedUsers.map((user) => (
                    <span
                      key={`selected-${user.id}`}
                      className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary border border-primary/20"
                    >
                      <span className="font-medium text-primary">{user.name}</span>
                      <span className="text-xs text-primary/80">{user.email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSelectedUser(user.id)}
                        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 text-primary-foreground/80 hover:bg-primary/30"
                        aria-label={`Remove ${user.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No users selected yet.</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenUserPickerForCreate();
                  }}
                  disabled={usersLoading && !users.length}
                  className="flex items-center gap-2"
                >
                  {usersLoading && !users.length ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading users...
                    </>
                  ) : (
                    "Browse Users"
                  )}
                </Button>
                {selectedUsers.length > 0 && (
                  <Button type="button" variant="ghost" onClick={clearSelectedUsers} className="text-sm text-muted-foreground hover:text-foreground">
                    Clear selection
                  </Button>
                )}
              </div>
              {usersError ? (
                <p className="text-xs text-red-500">{usersError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Choose existing workspace members; selected users will appear in the campaign summary.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Assign Influencers</Label>
              <div className="min-h-[72px] rounded-lg border border-border/60 bg-background/70 p-3 flex flex-col gap-2">
                {selectedInfluencers.length > 0 ? (
                  selectedInfluencers.map((influencer) => {
                    const uniquePlatforms = Array.from(
                      new Set(
                        influencer.handles
                          .map((handle) => handle.platform.toLowerCase())
                          .filter(Boolean)
                      )
                    );
                    return (
                      <div
                        key={`selected-influencer-${influencer.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-primary">{influencer.name}</span>
                            {influencer.pid && (
                              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary/80">
                                ID: {influencer.pid}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 text-[11px] text-primary/80">
                            <span>{influencer.email ?? "Email not available"}</span>
                            {influencer.country && (
                              <>
                                <span className="mx-1 text-primary/50">•</span>
                                <span>Country: {influencer.country}</span>
                              </>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            {uniquePlatforms.length > 0 ? (
                              uniquePlatforms.map((platform) => {
                                const meta = getPlatformMeta(platform);
                                return meta.icon ? (
                                  <img
                                    key={`${influencer.id}-${platform}`}
                                    src={meta.icon}
                                    alt={meta.label}
                                    title={meta.label}
                                    className="h-4 w-4 rounded-full border border-primary/20 bg-white p-[1px]"
                                  />
                                ) : (
                                  <div
                                    key={`${influencer.id}-${platform}`}
                                    className="flex h-5 w-5 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary"
                                    title={meta.label}
                                  >
                                    <Layers className="h-3 w-3" />
                                  </div>
                                );
                              })
                            ) : (
                              <span className="text-[11px] text-muted-foreground">No platforms listed</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSelectedInfluencer(influencer.id)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                          aria-label={`Remove ${influencer.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">No influencers selected yet.</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenInfluencerPickerForCreate();
                  }}
                  disabled={influencersLoading && !influencers.length}
                  className="flex items-center gap-2"
                >
                  {influencersLoading && !influencers.length ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading influencers...
                    </>
                  ) : (
                    "Browse Influencers"
                  )}
                </Button>
                {selectedInfluencers.length > 0 && (
                  <Button type="button" variant="ghost" onClick={clearSelectedInfluencers} className="text-sm text-muted-foreground hover:text-foreground">
                    Clear selection
                  </Button>
                )}
              </div>
              {influencersError ? (
                <p className="text-xs text-red-500">{influencersError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Pick influencers from your roster. We'll include their IDs, platforms, and emails in the campaign summary.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Contract</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={selectedContract?.id ?? undefined}
                  onValueChange={handleContractSelect}
                  disabled={contractsLoading && !contracts.length}
                >
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue
                      placeholder={
                        contractsLoading ? "Loading contracts..." : "Select a contract"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {contractsLoading ? (
                      <SelectItem value="__loading" disabled>
                        Loading contracts...
                      </SelectItem>
                    ) : contracts.length ? (
                      contracts.map((contract) => (
                        <SelectItem key={contract.id} value={contract.id}>
                          {contract.name}
                          {contract.pid ? ` • ${contract.pid}` : ""}
                          {contract.status ? ` • ${contract.status}` : ""}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__no_contracts" disabled>
                        No contracts found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {selectedContract && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearSelectedContract}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Clear contract
                  </Button>
                )}
              </div>
              {selectedContract && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-xs text-indigo-900">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-indigo-900">
                      {selectedContract.name}
                    </span>
                    {selectedContract.status && (
                      <span className="rounded-full border border-indigo-300 bg-white px-2 py-0.5 text-[11px] font-medium capitalize">
                        {selectedContract.status}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-indigo-900/80">
                    PID: {selectedContract.pid ?? "Pending assignment"}
                  </p>
                  {selectedContract.description && (
                    <p className="mt-1 text-[11px] leading-snug text-indigo-900/80">
                      {selectedContract.description}
                    </p>
                  )}
                </div>
              )}
              {contractsError ? (
                <p className="text-xs text-red-500">{contractsError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Link a contract template to keep legal expectations aligned with this campaign.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaignDescription">Campaign Description</Label>
              <Textarea
                id="campaignDescription"
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder="Outline the objective, deliverables, or key talking points for this campaign."
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetCreateForm();
                  setIsCreateDialogOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingCampaign}>
                {isSavingCampaign ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Campaign"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isAddCompanyDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddCompanyDialogOpen(false);
            resetNewCompanyForm();
          } else {
            setIsAddCompanyDialogOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Company</DialogTitle>
            <DialogDescription>
              Create a company record so it can be selected as a brand across campaigns.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddCompanySubmit} className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="newCompanyName">Company Name *</Label>
                <Input
                  id="newCompanyName"
                  value={newCompanyForm.name}
                  onChange={(event) =>
                    setNewCompanyForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Enter company name"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newCompanyDescription">Description</Label>
                <Textarea
                  id="newCompanyDescription"
                  value={newCompanyForm.description}
                  onChange={(event) =>
                    setNewCompanyForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Describe the company or partnership focus"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newCompanyManager">Manager Name</Label>
                  <Input
                    id="newCompanyManager"
                    value={newCompanyForm.managerName}
                    onChange={(event) =>
                      setNewCompanyForm((prev) => ({
                        ...prev,
                        managerName: event.target.value,
                      }))
                    }
                    placeholder="Primary point of contact"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newCompanyContact">Manager Contact</Label>
                  <Input
                    id="newCompanyContact"
                    value={newCompanyForm.managerContact}
                    onChange={(event) =>
                      setNewCompanyForm((prev) => ({
                        ...prev,
                        managerContact: event.target.value,
                      }))
                    }
                    placeholder="+91 98765 43210"
                    type="tel"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newCompanyCategories">Categories</Label>
                <Input
                  id="newCompanyCategories"
                  value={newCompanyForm.categories}
                  onChange={(event) =>
                    setNewCompanyForm((prev) => ({
                      ...prev,
                      categories: event.target.value,
                    }))
                  }
                  placeholder="Marketing, Wellness, Lifestyle"
                />
                <p className="text-xs text-muted-foreground">
                  Separate categories with commas to keep reporting organised.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddCompanyDialogOpen(false);
                  resetNewCompanyForm();
                }}
                disabled={isSavingCompany}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingCompany}>
                {isSavingCompany ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Add Company"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isUserPickerOpen}
        onOpenChange={(open) => {
          if (open) {
            if (!editingCampaignIdForUsers) {
              setUserPickerSelection(new Set(selectedUsers.map((user) => user.id)));
            }
            setUsersSearch("");
          } else {
            setEditingCampaignIdForUsers(null);
            setUserPickerSelection(new Set());
            setUsersSearch("");
          }
          setIsUserPickerOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Select Users</DialogTitle>
            <DialogDescription>
              Assign existing workspace users to this campaign. Selected users will appear in the campaign overview.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={usersSearch}
                  onChange={(event) => setUsersSearch(event.target.value)}
                  placeholder="Search by name, email, role..."
                  className="pl-9"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {userPickerSelection.size} selected
              </div>
            </div>
            <div className="rounded-lg border border-border/60">
              {usersLoading && !users.length ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading users...</span>
                </div>
              ) : filteredUsersForPicker.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {usersError ? "Unable to load users." : "No users match your search."}
                </div>
              ) : (
                <ScrollArea className="h-72">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-background border-b border-border/60 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">User</th>
                        <th className="px-3 py-2 text-left font-semibold">Employee Code</th>
                        <th className="px-3 py-2 text-left font-semibold">Role</th>
                        <th className="px-3 py-2 text-left font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsersForPicker.map((user) => {
                        const isSelected = userPickerSelection.has(user.id);
                        return (
                          <tr
                            key={user.id}
                            className={`border-b border-border/40 transition-colors ${
                              isSelected ? "bg-primary/5" : "hover:bg-muted/30"
                            }`}
                            onClick={() => toggleUserSelection(user.id)}
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleUserSelection(user.id)}
                                  onClick={(event) => event.stopPropagation()}
                                />
                                <div className="min-w-0">
                                  <p className="font-medium text-foreground truncate">{user.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {user.employeeId ? (
                                <span className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                  {user.employeeId}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/70">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground capitalize">
                              {user.role ? user.role.replace(/_/g, " ") : "—"}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground capitalize">
                              {user.status ? user.status.replace(/_/g, " ") : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsUserPickerOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={applyUserSelection}>
              Add Selected ({userPickerSelection.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isInfluencerPickerOpen}
        onOpenChange={(open) => {
          if (open) {
            if (!editingCampaignIdForInfluencers) {
              setInfluencerPickerSelection(
                new Set(selectedInfluencers.map((influencer) => influencer.id))
              );
            }
            setInfluencersSearch("");
          } else {
            setEditingCampaignIdForInfluencers(null);
            setInfluencerPickerSelection(new Set());
            setInfluencersSearch("");
          }
          setIsInfluencerPickerOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Select Influencers</DialogTitle>
            <DialogDescription>
              Choose influencers to attach to this campaign. We will bring their IDs, primary platforms, and contact info into the brief.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={influencersSearch}
                  onChange={(event) => setInfluencersSearch(event.target.value)}
                  placeholder="Search by name, ID, platform, or email..."
                  className="pl-9"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {influencerPickerSelection.size} selected
              </div>
            </div>
            <div className="rounded-lg border border-border/60">
              {influencersLoading && !influencers.length ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading influencers...</span>
                </div>
              ) : filteredInfluencersForPicker.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {influencersError ? "Unable to load influencers." : "No influencers match your search."}
                </div>
              ) : (
                <ScrollArea className="h-72">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-background border-b border-border/60 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Influencer</th>
                        <th className="px-3 py-2 text-left font-semibold">Influencer ID</th>
                        <th className="px-3 py-2 text-left font-semibold">Platforms</th>
                        <th className="px-3 py-2 text-left font-semibold">Country</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInfluencersForPicker.map((influencer) => {
                        const isSelected = influencerPickerSelection.has(influencer.id);
                        const uniquePlatforms = Array.from(
                          new Set(
                            influencer.handles
                              .map((handle) => handle.platform.toLowerCase())
                              .filter(Boolean)
                          )
                        );
                        return (
                          <tr
                            key={influencer.id}
                            className={`border-b border-border/40 transition-colors ${
                              isSelected ? "bg-primary/5" : "hover:bg-muted/30"
                            }`}
                            onClick={() => toggleInfluencerSelection(influencer.id)}
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleInfluencerSelection(influencer.id)}
                                  onClick={(event) => event.stopPropagation()}
                                />
                                <div className="min-w-0">
                                  <p className="font-medium text-foreground truncate">{influencer.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {influencer.email ?? "Email not available"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {influencer.pid ? (
                                <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                  {influencer.pid}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/70">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap items-center gap-2">
                                {uniquePlatforms.length > 0 ? (
                                  uniquePlatforms.slice(0, 6).map((platform) => {
                                    const meta = getPlatformMeta(platform);
                                    return meta.icon ? (
                                      <img
                                        key={`${influencer.id}-${platform}`}
                                        src={meta.icon}
                                        alt={meta.label}
                                        title={meta.label}
                                        className="h-6 w-6 rounded-full border border-border/60 bg-white p-[2px]"
                                      />
                                    ) : (
                                      <span
                                        key={`${influencer.id}-${platform}`}
                                        className="flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-muted text-muted-foreground"
                                        title={meta.label}
                                      >
                                        <Layers className="h-3.5 w-3.5" />
                                      </span>
                                    );
                                  })
                                ) : (
                                  <span className="text-xs text-muted-foreground">No platforms</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {influencer.country ? (
                                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                  {influencer.country}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/70">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsInfluencerPickerOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={applyInfluencerSelection}>
              Add Selected ({influencerPickerSelection.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(campaignToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeletingCampaign) {
            setCampaignToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-semibold text-foreground">
                {campaignToDelete?.name ?? "this campaign"}
              </span>{" "}
              and its assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCampaign}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCampaignConfirm}
              disabled={isDeletingCampaign}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingCampaign ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </span>
              ) : (
                "Delete Campaign"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Campaign;

