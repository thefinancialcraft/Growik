import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  CampaignRecord,
  CampaignUserRef,
  CampaignInfluencerRef,
  STATUS_STYLES,
  getPlatformMeta,
  mapCampaignRow,
} from "@/lib/campaign";
import {
  Activity,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  FileText,
  Loader2,
  Megaphone,
  LayoutGrid,
  List,
  Filter,
  Search,
  UserPlus,
  Users,
  Clock,
  UserCog,
  Trash2,
  Circle,
  Download,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type LocationState = {
  campaign?: CampaignRecord;
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

const renderUserCard = (user: CampaignUserRef) => (
  <div
    key={user.id}
    className="rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-slate-700 shadow-sm"
  >
    <div className="font-medium leading-tight text-slate-900 line-clamp-1 text-xs sm:text-sm">{user.name}</div>
    <div className="text-[10px] sm:text-xs text-slate-500 break-all line-clamp-1 mt-0.5">{user.email}</div>
    {user.employeeId && (
      <div className="mt-1.5 sm:mt-2 inline-flex items-center rounded-md border border-indigo-100 bg-indigo-50 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-indigo-700">
        ID: {user.employeeId}
      </div>
    )}
  </div>
);

const renderInfluencerCard = (influencer: CampaignInfluencerRef) => {
  const platforms = Array.from(
    new Set(
      influencer.handles
        .map((handle) => handle.platform.toLowerCase())
        .filter(Boolean)
    )
  );
  const statusMeta = getInfluencerStatusMeta(influencer.status);

  return (
    <div
      key={influencer.id}
      className="rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-slate-700 shadow-sm"
    >
      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          <span className="font-medium leading-tight text-slate-900 line-clamp-1 text-xs sm:text-sm">{influencer.name}</span>
          {influencer.pid && (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-primary shrink-0">
              ID: {influencer.pid}
            </span>
          )}
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-medium shrink-0 ${statusMeta.className}`}
        >
          {statusMeta.label}
        </span>
      </div>
      <div className="mt-1 text-[10px] sm:text-xs text-slate-500 break-all line-clamp-1">
        {influencer.email ?? "Email not available"}
      </div>
      <div className="mt-1.5 sm:mt-2 flex flex-wrap items-center gap-1">
        {platforms.length > 0 ? (
          platforms.map((platform) => {
            const meta = getPlatformMeta(platform);
            return meta.icon ? (
              <img
                key={`${influencer.id}-${platform}`}
                src={meta.icon}
                alt={meta.label}
                title={meta.label}
                className="h-4 w-4 sm:h-5 sm:w-5 rounded-full border border-border/50 bg-white p-[2px]"
              />
            ) : (
              <span
                key={`${influencer.id}-${platform}`}
                className="inline-flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full border border-border/60 bg-muted text-muted-foreground text-[9px] sm:text-[10px]"
                title={meta.label}
              >
                {meta.label.charAt(0)}
              </span>
            );
          })
        ) : (
          <span className="text-[10px] sm:text-[11px] text-slate-500">No platforms listed</span>
        )}
      </div>
      {influencer.country && (
        <div className="mt-1.5 sm:mt-2 inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-emerald-700">
          {influencer.country}
        </div>
      )}
    </div>
  );
};

const getInfluencerStatusMeta = (status?: string | null) => {
  const normalized = (status ?? "").trim().toLowerCase();
  switch (normalized) {
    case "signed":
      return {
        label: "Signed",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "pending":
      return {
        label: "Pending",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case "send":
    case "sent":
      return {
        label: "Send",
        className: "border-sky-200 bg-sky-50 text-sky-700",
      };
    default:
      return {
        label: "--",
        className: "border-slate-200 bg-slate-50 text-slate-600",
      };
  }
};

const renderUserRow = (user: CampaignUserRef) => (
  <TableRow key={user.id}>
    <TableCell className="font-medium text-slate-900 text-xs sm:text-sm">
      <span className="line-clamp-1">{user.name}</span>
    </TableCell>
    <TableCell className="text-slate-600 break-all text-xs sm:text-sm">
      <span className="line-clamp-1">{user.email}</span>
    </TableCell>
    <TableCell className="text-slate-600 hidden sm:table-cell">
      {user.employeeId ? (
        <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-indigo-700">
          {user.employeeId}
        </span>
      ) : (
        <span className="text-[10px] sm:text-xs text-slate-400">Not assigned</span>
      )}
    </TableCell>
  </TableRow>
);

const renderInfluencerRow = (influencer: CampaignInfluencerRef) => {
  const platforms = Array.from(
    new Set(
      influencer.handles
        .map((handle) => handle.platform.toLowerCase())
        .filter(Boolean)
    )
  );
  const statusMeta = getInfluencerStatusMeta(influencer.status);
  return (
    <TableRow key={influencer.id}>
      <TableCell className="font-medium text-slate-900 text-xs sm:text-sm">
        <span className="line-clamp-1">{influencer.name}</span>
      </TableCell>
      <TableCell className="text-slate-600 text-xs sm:text-sm">
        <span className="line-clamp-1">{influencer.email ?? <span className="text-[10px] sm:text-xs text-slate-400">Not provided</span>}</span>
      </TableCell>
      <TableCell className="text-slate-600 hidden md:table-cell">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {platforms.length > 0 ? (
            platforms.map((platform) => {
              const meta = getPlatformMeta(platform);
              return meta.icon ? (
                <img
                  key={`${influencer.id}-${platform}`}
                  src={meta.icon}
                  alt={meta.label}
                  title={meta.label}
                  className="h-4 w-4 sm:h-5 sm:w-5 rounded-full border border-slate-200 bg-white p-[2px]"
                />
              ) : (
                <span
                  key={`${influencer.id}-${platform}`}
                  className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] sm:text-[11px] text-slate-600"
                  title={meta.label}
                >
                  {meta.label.charAt(0)}
                </span>
              );
            })
          ) : (
            <span className="text-[10px] sm:text-xs text-slate-400">No platforms</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-slate-600">
        <span
          className={`inline-flex items-center rounded-full border px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-medium ${statusMeta.className}`}
        >
          {statusMeta.label}
        </span>
      </TableCell>
      <TableCell className="text-slate-600 hidden lg:table-cell text-xs sm:text-sm">
        <span className="line-clamp-1">{influencer.country ?? <span className="text-[10px] sm:text-xs text-slate-400">N/A</span>}</span>
      </TableCell>
    </TableRow>
  );
};

const CampaignDetail = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const state = (location.state as LocationState | undefined) ?? {};

  const [campaign, setCampaign] = useState<CampaignRecord | null>(state.campaign ?? null);
  const [loading, setLoading] = useState<boolean>(!state.campaign);
  const [error, setError] = useState<string | null>(null);
  const [collabStats, setCollabStats] = useState<{
    total: number;
    signed: number;
    pending: number;
  }>({ total: 0, signed: 0, pending: 0 });
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [collaboratorTab, setCollaboratorTab] = useState<"users" | "influencers" | "collab">("influencers");
  const [collaboratorDisplay, setCollaboratorDisplay] = useState<"tile" | "list">("tile");
  const [collaboratorSearch, setCollaboratorSearch] = useState("");
  const [collabSearch, setCollabSearch] = useState("");
  const [selectedCollabActions, setSelectedCollabActions] = useState<Set<string>>(new Set());
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [filters, setFilters] = useState<{
    company: string;
    influencer: string;
    user: string;
    isSigned: string;
    campaign: string;
    contract: string;
  }>({
    company: "",
    influencer: "",
    user: "",
    isSigned: "",
    campaign: "",
    contract: "",
  });
  const [collaborationActions, setCollaborationActions] = useState<Array<{
    id: string;
    campaign_id: string | null;
    influencer_id: string | null;
    user_id: string | null;
    action: string | null;
    remark: string | null;
    occurred_at: string;
    collaboration_id: string;
    campaign_name?: string | null;
    company_name?: string | null;
    contract_name?: string | null;
    contract_id?: string | null;
    user_name?: string | null;
    influencer_name?: string | null;
    is_signed?: boolean | null;
    has_contract_html?: boolean;
  }>>([]);
  const [collaborationActionsLoading, setCollaborationActionsLoading] = useState<boolean>(false);

  // Helper to normalize campaign_id the same way as CollaborationAssignment
  const isUuid = (value: string | undefined | null): value is string =>
    Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));

  const toDeterministicUuid = (input: string): string => {
    const hash = input.split("").reduce((acc, char) => {
      const h = (acc << 5) - acc + char.charCodeAt(0);
      return h & h;
    }, 0);
    const hex = Math.abs(hash).toString(16).padStart(32, "0");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((Math.abs(hash) % 4) + 8)
      .toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  };

  // This should match how collaboration_actions.campaign_id is written
  const resolvedCampaignIdForStats = useMemo(() => {
    const campaignKey = campaign?.id ?? id ?? null;

    if (isUuid(campaign?.id)) {
      return campaign!.id;
    }
    if (isUuid(id ?? null)) {
      return id as string;
    }
    if (campaignKey) {
      return toDeterministicUuid(`campaign:${campaignKey}`);
    }
    return null;
  }, [campaign?.id, id]);

  useEffect(() => {
    if (campaign || !id) {
      return;
    }

    const fetchCampaign = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from("campaigns")
          .select(
            "id, name, brand, objective, users, influencers, contract_id, contract_pid, contract_name, contract_description, contract_status, contract_snapshot, start_date, end_date, is_long_term, status, progress, created_at"
          )
          .eq("id", id)
          .maybeSingle();

        if (fetchError) {
          throw fetchError;
        }

        if (!data) {
          throw new Error("Campaign not found.");
        }

        const mapped = mapCampaignRow(data);
        setCampaign(mapped);
      } catch (fetchErr: any) {
        console.error("CampaignDetail: Error fetching campaign", fetchErr);
        const message = fetchErr?.message || "Unable to load campaign details.";
        setError(message);
        toast({
          title: "Unable to load campaign",
          description: message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [campaign, id, toast]);

  // Fetch collaboration statistics
  useEffect(() => {
    const fetchCollabStats = async () => {
      if (!resolvedCampaignIdForStats) return;

      setLoadingStats(true);
      try {
        // Fetch all collaboration actions for this campaign
        const { data, error: statsError } = await supabase
          .from("collaboration_actions")
          .select("is_signed, collaboration_id")
          .eq("campaign_id", resolvedCampaignIdForStats);

        if (statsError) {
          console.error("Error fetching collaboration stats:", statsError);
          return;
        }

        // Count statistics
        const total = data?.length || 0;
        const signed = data?.filter((item: any) => item.is_signed === true).length || 0;
        const pending = total - signed;

        setCollabStats({ total, signed, pending });
      } catch (err) {
        console.error("Error fetching collaboration stats:", err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchCollabStats();
  }, [resolvedCampaignIdForStats]);

  // Fetch collaboration actions for the campaign
  const fetchCollaborationActions = useCallback(async () => {
    if (!resolvedCampaignIdForStats) return;

    setCollaborationActionsLoading(true);
    try {
      const { data, error } = await supabase
        .from("collaboration_actions")
        .select("id, campaign_id, influencer_id, user_id, action, remark, occurred_at, collaboration_id, contract_id, is_signed")
        .eq("campaign_id", resolvedCampaignIdForStats)
        .order("occurred_at", { ascending: false });

      if (error) {
        throw error;
      }

      // Enrich actions with campaign, contract names, user names, and influencer names
      const enrichedActions = await Promise.all(
        (data || []).map(async (action: any) => {
          let campaignName: string | null = null;
          let companyName: string | null = null;
          let contractName: string | null = null;
          let userName: string | null = null;
          let influencerName: string | null = null;

          // Check if contract HTML exists (contract is filled)
          let hasContractHtml = false;
          if (action.collaboration_id) {
            try {
              const { data: overrideData } = await supabase
                .from("collaboration_variable_overrides")
                .select("contract_html")
                .eq("collaboration_id", action.collaboration_id)
                .maybeSingle();

              if (overrideData && (overrideData as any).contract_html) {
                hasContractHtml = true;
              }
            } catch (overrideErr) {
              // Ignore error, contract not filled
            }
          }
          
          // Fetch user name if user_id exists
          if (action.user_id) {
            try {
              const { data: userData } = await supabase
                .from("user_profiles")
                .select("user_name")
                .eq("user_id", action.user_id)
                .maybeSingle();

              if (userData) {
                userName = (userData as any).user_name || null;
              }
            } catch (userErr) {
              console.error("CampaignDetail: Error fetching user name", userErr);
            }
          }
          
          // Fetch influencer name if influencer_id exists
          if (action.influencer_id) {
            try {
              const { data: influencerData } = await supabase
                .from("influencers")
                .select("name")
                .eq("id", action.influencer_id)
                .maybeSingle();

              if (influencerData) {
                influencerName = (influencerData as any).name || null;
              }
            } catch (influencerErr) {
              console.error("CampaignDetail: Error fetching influencer name", influencerErr);
            }
          }
          
          // Use campaign data from state if available
          if (campaign && campaign.name) {
            campaignName = campaign.name;
            companyName = campaign.brand || null;
            
            if (campaign.contract && campaign.contract.name) {
              contractName = campaign.contract.name;
            }
          }

          return {
            id: action.id,
            campaign_id: action.campaign_id,
            influencer_id: action.influencer_id,
            user_id: action.user_id,
            action: action.action,
            remark: action.remark,
            occurred_at: action.occurred_at,
            collaboration_id: action.collaboration_id,
            contract_id: action.contract_id,
            is_signed: action.is_signed,
            campaign_name: campaignName,
            company_name: companyName,
            contract_name: contractName,
            user_name: userName,
            influencer_name: influencerName,
            has_contract_html: hasContractHtml,
          } as typeof collaborationActions[0];
        })
      );

      setCollaborationActions(enrichedActions as typeof collaborationActions);
    } catch (err) {
      console.error("CampaignDetail: Failed to fetch collaboration actions", err);
      setCollaborationActions([]);
      toast({
        title: "Error loading collaborations",
        description: "Failed to load collaboration actions. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setCollaborationActionsLoading(false);
    }
  }, [resolvedCampaignIdForStats, campaign, toast]);

  // Fetch collaboration actions when tab is "collab" and campaign is loaded
  useEffect(() => {
    if (collaboratorTab === "collab" && resolvedCampaignIdForStats) {
      fetchCollaborationActions().catch((err) => {
        console.error("CampaignDetail: Error fetching collaboration actions", err);
      });
    }
  }, [collaboratorTab, resolvedCampaignIdForStats, fetchCollaborationActions]);

  const startDisplay = useMemo(
    () => formatDateForDisplay(campaign?.startDate),
    [campaign?.startDate]
  );
  const endDisplay = useMemo(
    () => formatDateForDisplay(campaign?.endDate),
    [campaign?.endDate]
  );

  const totalCollaborators = useMemo(() => {
    if (!campaign) return 0;
    return campaign.users.length + campaign.influencers.length;
  }, [campaign]);

  const heroStats = useMemo(() => {
    if (!campaign) return [];
    return [
      {
        id: "timeline",
        title: campaign.isLongTerm ? "Engagement" : "Timeline",
        value: campaign.isLongTerm
          ? "Long-term"
          : startDisplay && endDisplay
          ? `${startDisplay} → ${endDisplay}`
          : startDisplay
          ? `Starts ${startDisplay}`
          : endDisplay
          ? `Ends ${endDisplay}`
          : "Not scheduled",
        subtext: campaign.isLongTerm
          ? startDisplay
            ? `Started on ${startDisplay}`
            : "Start date not set"
          : "Active campaign window",
        icon: CalendarRange,
        iconBg: "from-white/40 to-white/10",
      },
      {
        id: "users",
        title: "Workspace Users",
        value: `${campaign.users.length}`,
        subtext: campaign.users.length === 1 ? "Assigned collaborator" : "Assigned collaborators",
        icon: Users,
        iconBg: "from-indigo-400/60 to-indigo-500/40",
      },
      {
        id: "influencers",
        title: "Influencer Pool",
        value: `${campaign.influencers.length}`,
        subtext: campaign.influencers.length === 1 ? "Creator engaged" : "Creators engaged",
        icon: Megaphone,
        iconBg: "from-emerald-400/60 to-emerald-500/40",
      },
      {
        id: "progress",
        title: "Progress",
        value: `${campaign.progress}%`,
        subtext: "Completion status",
        icon: Activity,
        iconBg: "from-amber-400/60 to-amber-500/40",
      },
    ];
  }, [campaign, endDisplay, startDisplay]);

  const filteredUsers = useMemo(() => {
    if (!campaign) return [];
    if (!collaboratorSearch.trim()) return campaign.users;
    const query = collaboratorSearch.toLowerCase();
    return campaign.users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.employeeId ?? "").toLowerCase().includes(query)
    );
  }, [campaign, collaboratorSearch]);

  const filteredInfluencers = useMemo(() => {
    if (!campaign) return [];
    if (!collaboratorSearch.trim()) return campaign.influencers;
    const query = collaboratorSearch.toLowerCase();
    return campaign.influencers.filter((influencer) => {
      const platformMatch = influencer.handles.some((handle) =>
        getPlatformMeta(handle.platform).label.toLowerCase().includes(query)
      );
      return (
        influencer.name.toLowerCase().includes(query) ||
        (influencer.email ?? "").toLowerCase().includes(query) ||
        (influencer.pid ?? "").toLowerCase().includes(query) ||
        (influencer.country ?? "").toLowerCase().includes(query) ||
        (influencer.status ?? "").toLowerCase().includes(query) ||
        platformMatch
      );
    });
  }, [campaign, collaboratorSearch]);

  const isUserTab = collaboratorTab === "users";
  const isInfluencerTab = collaboratorTab === "influencers";
  const isCollabTab = collaboratorTab === "collab";
  const activeCollaborators = isUserTab ? filteredUsers : filteredInfluencers;

  // Get unique filter values from collaboration actions
  const filterOptions = useMemo(() => {
    const companies = new Set<string>();
    const influencers = new Set<string>();
    const users = new Set<string>();
    const campaigns = new Set<string>();
    const contracts = new Set<string>();

    collaborationActions.forEach((action) => {
      if (action.company_name) companies.add(action.company_name);
      if (action.influencer_name) influencers.add(action.influencer_name);
      if (action.user_name) users.add(action.user_name);
      if (action.campaign_name) campaigns.add(action.campaign_name);
      if (action.contract_name) contracts.add(action.contract_name);
    });

    return {
      companies: Array.from(companies).sort(),
      influencers: Array.from(influencers).sort(),
      users: Array.from(users).sort(),
      campaigns: Array.from(campaigns).sort(),
      contracts: Array.from(contracts).sort(),
    };
  }, [collaborationActions]);

  // Filter collaboration actions based on search and filters
  const filteredCollaborationActions = useMemo(() => {
    let filtered = collaborationActions;

    // Apply search filter
    if (collabSearch.trim()) {
      const query = collabSearch.toLowerCase();
      filtered = filtered.filter((action) => {
        return (
          (action.contract_name || "").toLowerCase().includes(query) ||
          (action.influencer_name || "").toLowerCase().includes(query) ||
          (action.user_name || "").toLowerCase().includes(query) ||
          (action.action || "").toLowerCase().includes(query) ||
          (action.collaboration_id || "").toLowerCase().includes(query) ||
          (action.remark || "").toLowerCase().includes(query)
        );
      });
    }

    // Apply filters
    if (filters.company && filters.company !== "all") {
      filtered = filtered.filter((action) => action.company_name === filters.company);
    }
    if (filters.influencer && filters.influencer !== "all") {
      filtered = filtered.filter((action) => action.influencer_name === filters.influencer);
    }
    if (filters.user && filters.user !== "all") {
      filtered = filtered.filter((action) => action.user_name === filters.user);
    }
    if (filters.isSigned && filters.isSigned !== "all") {
      const isSigned = filters.isSigned === "true";
      filtered = filtered.filter((action) => Boolean(action.is_signed) === isSigned);
    }
    if (filters.campaign && filters.campaign !== "all") {
      filtered = filtered.filter((action) => action.campaign_name === filters.campaign);
    }
    if (filters.contract && filters.contract !== "all") {
      filtered = filtered.filter((action) => action.contract_name === filters.contract);
    }

    return filtered;
  }, [collaborationActions, collabSearch, filters]);

  // Handle select all checkbox
  const handleSelectAllCollab = (checked: boolean) => {
    if (checked) {
      setSelectedCollabActions(new Set(filteredCollaborationActions.map((action) => action.id)));
    } else {
      setSelectedCollabActions(new Set());
    }
  };

  // Handle individual checkbox
  const handleSelectCollab = (actionId: string, checked: boolean) => {
    const newSelected = new Set(selectedCollabActions);
    if (checked) {
      newSelected.add(actionId);
    } else {
      newSelected.delete(actionId);
    }
    setSelectedCollabActions(newSelected);
  };

  // Export collaboration actions to CSV
  const handleExportCollab = () => {
    if (selectedCollabActions.size === 0) {
      toast({
        title: "No items selected",
        description: "Please select collaboration actions to export.",
        variant: "destructive",
      });
      return;
    }

    const dataToExport = filteredCollaborationActions.filter((action) =>
      selectedCollabActions.has(action.id)
    );

    if (dataToExport.length === 0) {
      toast({
        title: "No data to export",
        description: "Selected items not found in filtered results.",
        variant: "destructive",
      });
      return;
    }

    // Create CSV content
    const headers = [
      "Contract",
      "Influencer",
      "Action",
      "Collaboration ID",
      "User Name",
      "Date & Time",
      "Status",
      "Remark",
    ];
    const rows = dataToExport.map((action) => [
      action.contract_name || "",
      action.influencer_name || "",
      action.action || "",
      action.collaboration_id || "",
      action.user_name || "",
      new Date(action.occurred_at).toLocaleString(),
      action.is_signed ? "Signed" : "Pending",
      action.remark || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `collaborations_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export successful",
      description: `Exported ${dataToExport.length} collaboration action(s) to CSV.`,
    });
  };

  return (
    <div className="flex min-h-screen bg-gradient-subtle">
      <Sidebar />
      <MobileNav />

      <div className="flex-1 lg:ml-56">
        <Header />
        <main className="container mx-auto w-full px-3 sm:px-4 lg:px-8 py-4 pb-24 lg:pb-12 max-w-7xl space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-foreground hover:text-primary h-8 sm:h-10 px-2 sm:px-3"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Back
            </Button>
            {campaign && (
              <Badge className={`rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold ${STATUS_STYLES[campaign.status]}`}>
                {campaign.status}
              </Badge>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading campaign details...</span>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-sm text-destructive">
              {error}
            </div>
          ) : campaign ? (
            <section className="space-y-6 animate-fade-in">
              <div className="relative overflow-hidden rounded-2xl lg:rounded-3xl bg-primary text-white shadow-lg">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_55%)]" />
                <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
                <div className="relative p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8">
                  <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2 sm:space-y-4 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <Badge className="rounded-full border border-white/40 bg-white/20 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold text-white/90">
                          {campaign.brand}
                        </Badge>
                        <Badge className={`rounded-full border border-white/30 bg-white/15 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold text-white/90 capitalize ${STATUS_STYLES[campaign.status]}`}>
                          {campaign.status}
                        </Badge>
                        <span className="text-[10px] sm:text-xs text-white/70">#{campaign.id}</span>
                      </div>
                      <h1 className="text-xl sm:text-2xl lg:text-4xl font-bold leading-tight text-white">
                        {campaign.name}
                      </h1>
                      <p className="text-xs sm:text-sm lg:text-base text-white/80 max-w-2xl hidden sm:block">
                        {campaign.objective || "No objective provided for this campaign."}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-white/75">
                        <span>Created {new Date(campaign.createdAt).toLocaleDateString()}</span>
                        <span className="h-1 w-1 rounded-full bg-white/50" />
                        <span className="line-clamp-1">
                          {campaign.isLongTerm
                            ? "Long-term"
                            : startDisplay && endDisplay
                            ? `${startDisplay} – ${endDisplay}`
                            : startDisplay
                            ? `Starts ${startDisplay}`
                            : endDisplay
                            ? `Ends ${endDisplay}`
                            : "Timeline not set"}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-white/50" />
                        <span>{totalCollaborators} collaborators</span>
                      </div>
                    </div>
                    {/* Desktop: Stats Card */}
                    <div className="hidden lg:flex flex-col gap-3 rounded-2xl border border-white/30 bg-white/10 p-5 backdrop-blur-lg text-sm text-white/90 min-w-[240px]">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Total collaborators</span>
                        <span>{totalCollaborators}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Contract</span>
                        <span className="truncate max-w-[120px]">{campaign.contract?.name ?? "Not linked"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Status</span>
                        <span className="capitalize">{campaign.status}</span>
                      </div>
                      <div className="space-y-1 pt-1.5">
                        <div className="flex items-center justify-between text-xs text-white/70">
                          <span>Progress</span>
                          <span>{campaign.progress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/25 overflow-hidden">
                          <div
                            className="h-full bg-white"
                            style={{ width: `${campaign.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    {/* Mobile: Compact Stats */}
                    <div className="lg:hidden flex items-center justify-between gap-3 rounded-xl border border-white/30 bg-white/10 p-3 backdrop-blur-lg text-xs text-white/90">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Collab:</span>
                        <span>{totalCollaborators}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-white/80">
                        <span>P:{campaign.progress}%</span>
                        <span>•</span>
                        <span className="capitalize truncate max-w-[60px]">{campaign.status}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                    {heroStats.map(({ id, title, value, subtext, icon: Icon, iconBg }) => (
                      <Card
                        key={id}
                        className="relative overflow-hidden bg-white/90 px-2 py-2.5 sm:px-4 sm:py-4 border border-white/20 backdrop-blur transition-transform duration-200 hover:-translate-y-1"
                      >
                        <div className="relative flex items-start justify-between gap-2 sm:gap-3">
                          <div className="space-y-0.5 sm:space-y-1.5 flex-1 min-w-0">
                            <p className="text-[9px] sm:text-[11px] uppercase tracking-wide text-slate-500 truncate">
                              {title}
                            </p>
                            <p className="text-sm sm:text-lg font-semibold text-slate-900 leading-tight truncate">{value}</p>
                            {subtext && (
                              <p className="text-[9px] sm:text-xs text-slate-500 line-clamp-1 hidden sm:block">{subtext}</p>
                            )}
                          </div>
                          <span
                            className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br ${iconBg} flex-shrink-0`}
                          >
                            <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr),1fr] gap-4 lg:gap-6">
                <Card className="border-none bg-white/95 backdrop-blur">
                  <div className="p-4 sm:p-5 lg:p-6 space-y-4 sm:space-y-6">
                    <div className="flex items-center justify-between gap-3 sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base sm:text-lg font-semibold text-slate-900">Campaign Overview</h2>
                        <p className="text-xs sm:text-sm text-slate-500 hidden sm:block">
                          Timeline checkpoints, objective summary, and legal snapshot.
                        </p>
                      </div>
                      <Badge className="rounded-full border border-slate-200 bg-slate-50 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold text-slate-700 shrink-0">
                        #{campaign.id}
                      </Badge>
                    </div>
                    <Separator className="bg-slate-200" />
                    <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                      <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4 flex flex-col gap-2 sm:gap-3">
                        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800">
                          <CalendarRange className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-500" />
                          Timeline
                        </div>
                        <div className="flex-1">
                          {campaign.isLongTerm ? (
                            <div className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm text-slate-600">
                              <p className="font-semibold text-slate-900 leading-tight">
                                Long-term engagement
                              </p>
                              <p className="text-[10px] sm:text-xs text-slate-500">
                                {startDisplay ? `Started on ${startDisplay}` : "Start date not set"}
                              </p>
                              <p className="text-[9px] sm:text-[11px] text-slate-500/80 hidden sm:block">
                                Running without a scheduled end date.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm text-slate-600">
                              <p className="font-semibold text-slate-900 leading-tight">
                                {startDisplay ?? "Start date not set"}
                              </p>
                              <p className="text-[10px] sm:text-xs text-slate-500">
                                {endDisplay ? `Ends ${endDisplay}` : "End date not set"}
                              </p>
                              <p className="text-[9px] sm:text-[11px] text-slate-500/80 hidden sm:block">
                                Scheduled activation window for this campaign.
                              </p>
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          className="mt-auto w-full justify-center gap-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-purple-500 text-white shadow-sm hover:opacity-90 h-8 sm:h-10 text-xs sm:text-sm"
                          onClick={() =>
                            navigate(`/collaborationAssignment`, {
                              state: {
                                campaign,
                                campaignId: campaign.id,
                              },
                            })
                          }
                        >
                          Start Collaboration
                          <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                      <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4 space-y-2 sm:space-y-3">
                        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800">
                          <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-500" />
                          Contract & Objective
                        </div>
                        <div className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm text-slate-600">
                          <p className="font-semibold text-slate-900 leading-tight line-clamp-1">
                            {campaign.contract?.name ?? "No contract linked"}
                          </p>
                          {campaign.contract?.pid && (
                            <p className="text-[10px] sm:text-xs text-slate-500">
                              PID: {campaign.contract?.pid}
                            </p>
                          )}
                          <p className="text-[10px] sm:text-xs text-slate-500 leading-snug line-clamp-2">
                            {campaign.contract?.description ??
                              "Attach a contract to keep legal expectations aligned with this campaign."}
                          </p>
                          {campaign.contract?.status && (
                            <span className="inline-flex w-fit rounded-full border border-indigo-200 bg-white px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-indigo-700 capitalize">
                              {campaign.contract.status}
                            </span>
                          )}
                        </div>
                        <div className="rounded-lg sm:rounded-xl border border-white/70 bg-white/90 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-600 shadow-sm">
                          <p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-slate-400">
                            Objective
                          </p>
                          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-700 leading-snug line-clamp-2">
                            {campaign.objective || "No objective provided for this campaign."}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          className="justify-start gap-2 rounded-lg sm:rounded-xl border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-600 h-8 sm:h-10 text-xs sm:text-sm"
                          onClick={() => navigate("/contract")}
                        >
                          <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                          Open contract workspace
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border border-emerald-100 bg-emerald-50/80 p-3 sm:p-4 text-xs sm:text-sm text-emerald-700">
                      <div className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
                        <span>Status insight</span>
                      </div>
                      <p className="leading-snug">
                        {campaign.status === "completed"
                          ? "Final reports are ready for download and archival."
                          : campaign.status === "live"
                          ? "Content approvals are on-track and deliverables are being monitored."
                          : "Draft milestones are saved. Activate the campaign when schedules are confirmed."}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="border-none bg-white/95 backdrop-blur">
                  <div className="sm:p-5 lg:p-6 sm:space-y-5 w-full">
                    <div className="space-y-0.5 sm:space-y-1">
                      <h2 className="text-base sm:text-lg font-semibold text-slate-900">Collaboration Statistics</h2>
                      <p className="text-xs sm:text-sm text-slate-500 hidden sm:block">
                        Overview of collaboration status for this campaign.
                      </p>
                    </div>
                    {loadingStats ? (
                      <div className="flex items-center justify-center py-6 sm:py-8">
                        <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-slate-400" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:gap-4">
                        {/* Total Collaborations */}
                        <div className="flex flex-col justify-between h-full rounded-lg sm:rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 sm:p-4 space-y-1.5 sm:space-y-2">
                          <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                            <p className="text-xs sm:text-sm font-medium text-slate-600">Total Collaborations</p>
                            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
                          </div>
                          <p className="text-2xl sm:text-3xl font-bold text-slate-900 leading-none">{collabStats.total}</p>
                          <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-500">All collaborations</p>
                        </div>

                        {/* Signed Collaborations */}
                        <div className="flex flex-col justify-between h-full rounded-lg sm:rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-3 sm:p-4 space-y-1.5 sm:space-y-2">
                          <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                            <p className="text-xs sm:text-sm font-medium text-emerald-700">Signed</p>
                            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
                          </div>
                          <p className="text-2xl sm:text-3xl font-bold text-emerald-700 leading-none">{collabStats.signed}</p>
                          <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-emerald-600">Contracts signed</p>
                        </div>

                        {/* Pending Collaborations */}
                        <div className="flex flex-col justify-between h-full rounded-lg sm:rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-3 sm:p-4 space-y-1.5 sm:space-y-2">
                          <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                            <p className="text-xs sm:text-sm font-medium text-amber-700">Pending</p>
                            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
                          </div>
                          <p className="text-2xl sm:text-3xl font-bold text-amber-700 leading-none">{collabStats.pending}</p>
                          <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-amber-600">Awaiting signature</p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              <Card className="border-none bg-white/95 backdrop-blur">
                <div className="sm:p-5 lg:p-6 sm:space-y-5 w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base sm:text-lg font-semibold text-slate-900">Collaborator Directory</h2>
                      <p className="text-xs sm:text-sm text-slate-500 hidden sm:block">
                        Toggle between workspace users and influencer partners.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 sm:rounded-xl sm:border sm:border-slate-200 sm:bg-slate-50/80 sm:p-1 w-full sm:w-auto">
                      <Button
                        type="button"
                        variant={isUserTab ? "default" : "ghost"}
                        className="h-8 sm:h-9 px-2 sm:px-4 text-xs sm:text-sm flex-1 sm:flex-initial"
                        onClick={() => setCollaboratorTab("users")}
                      >
                        Users ({filteredUsers.length})
                      </Button>
                      <Button
                        type="button"
                        variant={isInfluencerTab ? "default" : "ghost"}
                        className="h-8 sm:h-9 px-2 sm:px-4 text-xs sm:text-sm flex-1 sm:flex-initial"
                        onClick={() => setCollaboratorTab("influencers")}
                      >
                        Influencers ({filteredInfluencers.length})
                      </Button>
                      <Button
                        type="button"
                        variant={isCollabTab ? "default" : "ghost"}
                        className="h-8 sm:h-9 px-2 sm:px-4 text-xs sm:text-sm flex-1 sm:flex-initial"
                        onClick={() => setCollaboratorTab("collab")}
                      >
                        Collab ({collabStats.total})
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                    <div className="relative w-full sm:max-w-xs">
                      <Search className="absolute left-2.5 sm:left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={isCollabTab ? collabSearch : collaboratorSearch}
                        onChange={(event) => {
                          if (isCollabTab) {
                            setCollabSearch(event.target.value);
                          } else {
                            setCollaboratorSearch(event.target.value);
                          }
                        }}
                        placeholder={`Search ${isUserTab ? "users" : isInfluencerTab ? "influencers" : "collaborations"}...`}
                        className="pl-8 sm:pl-9 h-9 sm:h-10 bg-white text-xs sm:text-sm rounded-xl sm:rounded-2xl"
                      />
                    </div>
                    {isCollabTab ? (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 gap-1.5 sm:gap-2 px-2 sm:px-3 text-xs sm:text-sm"
                          onClick={() => setIsFilterDialogOpen(true)}
                        >
                          <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          Filters
                          {(filters.company || filters.influencer || filters.user || filters.isSigned || filters.campaign || filters.contract) && (
                            <span className="ml-0.5 sm:ml-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-primary text-[10px] sm:text-xs text-primary-foreground flex items-center justify-center">
                              {[filters.company, filters.influencer, filters.user, filters.isSigned, filters.campaign, filters.contract].filter(Boolean).length}
                            </span>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 gap-1.5 sm:gap-2 px-2 sm:px-3 text-xs sm:text-sm"
                          onClick={handleExportCollab}
                          disabled={filteredCollaborationActions.length === 0}
                        >
                          <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          Export
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 sm:p-1 shadow-sm">
                          <Button
                            type="button"
                            variant={collaboratorDisplay === "tile" ? "default" : "ghost"}
                            size="icon"
                            className="h-8 w-8 sm:h-9 sm:w-9"
                            onClick={() => setCollaboratorDisplay("tile")}
                            title="Tile view"
                          >
                            <LayoutGrid className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant={collaboratorDisplay === "list" ? "default" : "ghost"}
                            size="icon"
                            className="h-8 w-8 sm:h-9 sm:w-9"
                            onClick={() => setCollaboratorDisplay("list")}
                            title="List view"
                          >
                            <List className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                        </div>
                        <Button type="button" variant="outline" className="h-9 gap-1.5 sm:gap-2 px-2 sm:px-3 text-xs sm:text-sm">
                          <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          Filters
                        </Button>
                      </div>
                    )}
                  </div>

                  {isCollabTab ? (
                    collaborationActionsLoading ? (
                      <div className="flex items-center justify-center py-6 sm:py-8">
                        <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-slate-400" />
                      </div>
                    ) : filteredCollaborationActions.length > 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden w-full max-w-[350px] mx-auto lg:max-w-none">
                        <div className="overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
                          <div className="inline-block min-w-full">
                            <Table className="min-w-[800px] w-full">
                              <TableHeader className="bg-slate-50/80">
                                <TableRow>
                                  <TableHead className="w-10 sm:w-12 whitespace-nowrap">
                                    <input
                                      type="checkbox"
                                      checked={
                                        filteredCollaborationActions.length > 0 &&
                                        filteredCollaborationActions.every((action) =>
                                          selectedCollabActions.has(action.id)
                                        )
                                      }
                                      onChange={(e) => handleSelectAllCollab(e.target.checked)}
                                      className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded border-slate-300 text-primary focus:ring-primary"
                                    />
                                  </TableHead>
                                  <TableHead className="text-slate-500 text-[10px] sm:text-xs whitespace-nowrap">Contract</TableHead>
                                  <TableHead className="text-slate-500 text-[10px] sm:text-xs whitespace-nowrap">Influencer</TableHead>
                                  <TableHead className="text-slate-500 text-[10px] sm:text-xs whitespace-nowrap">Action</TableHead>
                                  <TableHead className="text-slate-500 text-[10px] sm:text-xs hidden sm:table-cell whitespace-nowrap">Collaboration ID</TableHead>
                                  <TableHead className="text-slate-500 text-[10px] sm:text-xs whitespace-nowrap">User</TableHead>
                                  <TableHead className="text-slate-500 text-[10px] sm:text-xs hidden md:table-cell whitespace-nowrap">Date & Time</TableHead>
                                  <TableHead className="text-slate-500 text-[10px] sm:text-xs whitespace-nowrap">Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredCollaborationActions.map((action) => (
                                  <TableRow 
                                    key={action.id} 
                                    className="hover:bg-slate-50 transition-colors"
                                  >
                                    <TableCell className="whitespace-nowrap">
                                      <input
                                        type="checkbox"
                                        checked={selectedCollabActions.has(action.id)}
                                        onChange={(e) => handleSelectCollab(action.id, e.target.checked)}
                                        className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded border-slate-300 text-primary focus:ring-primary"
                                      />
                                    </TableCell>
                                    <TableCell className="text-slate-600 text-xs whitespace-nowrap">
                                      <span className="line-clamp-1">{action.contract_name || <span className="text-slate-400">—</span>}</span>
                                    </TableCell>
                                    <TableCell className="text-slate-600 text-xs whitespace-nowrap">
                                      <span className="line-clamp-1">{action.influencer_name || <span className="text-slate-400">—</span>}</span>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                      <Badge variant="outline" className="capitalize text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                                        {action.action ? action.action.replace('_', ' ') : '—'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-slate-600 font-mono text-[10px] sm:text-xs hidden sm:table-cell whitespace-nowrap">
                                      <span className="line-clamp-1">{action.collaboration_id}</span>
                                    </TableCell>
                                    <TableCell className="text-slate-600 text-xs whitespace-nowrap">
                                      <span className="line-clamp-1">{action.user_name || <span className="text-slate-400">—</span>}</span>
                                    </TableCell>
                                    <TableCell className="text-slate-600 text-[10px] sm:text-xs hidden md:table-cell whitespace-nowrap">
                                      {new Date(action.occurred_at).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                      {action.is_signed ? (
                                        <div className="inline-flex items-center justify-center">
                                          <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full bg-green-600 flex items-center justify-center">
                                            <svg className="h-2 w-2 sm:h-2.5 sm:w-2.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                              <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                          </div>
                                        </div>
                                      ) : (
                                        <Circle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400" />
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl sm:rounded-2xl border border-dashed border-slate-200 bg-white/80 px-3 sm:px-4 py-6 sm:py-8 text-center text-[10px] sm:text-xs text-slate-400">
                        {collabSearch.trim()
                          ? "No collaboration actions match your search."
                          : "No collaboration actions recorded yet for this campaign."}
                      </div>
                    )
                  ) : collaboratorDisplay === "tile" ? (
                    activeCollaborators.length ? (
                      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {isUserTab
                          ? filteredUsers.map(renderUserCard)
                          : filteredInfluencers.map(renderInfluencerCard)}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-12 text-center text-sm text-slate-500">
                        No {isUserTab ? "users" : "influencers"} match your search.
                      </div>
                    )
                  ) : activeCollaborators.length ? (
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                      <ScrollArea className="max-h-72">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader className="bg-slate-50/80">
                              <TableRow>
                                <TableHead className="text-slate-500 text-[10px] sm:text-xs">
                                  {isUserTab ? "User" : "Influencer"}
                                </TableHead>
                                <TableHead className="text-slate-500 text-[10px] sm:text-xs">Email</TableHead>
                                {isUserTab ? (
                                  <TableHead className="text-slate-500 text-[10px] sm:text-xs hidden sm:table-cell">Employee ID</TableHead>
                                ) : (
                                  <>
                                    <TableHead className="text-slate-500 text-[10px] sm:text-xs hidden md:table-cell">Platforms</TableHead>
                                    <TableHead className="text-slate-500 text-[10px] sm:text-xs">Status</TableHead>
                                    <TableHead className="text-slate-500 text-[10px] sm:text-xs hidden lg:table-cell">Country</TableHead>
                                  </>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {isUserTab
                                ? filteredUsers.map(renderUserRow)
                                : filteredInfluencers.map(renderInfluencerRow)}
                            </TableBody>
                          </Table>
                        </div>
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-8 sm:py-12 text-center text-xs sm:text-sm text-slate-500">
                      No {isUserTab ? "users" : "influencers"} match your search.
                    </div>
                  )}
                </div>
              </Card>
            </section>
          ) : null}
        </main>
      </div>

      {/* Filter Dialog */}
      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Filter Collaboration Actions</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Filter collaboration actions by different criteria. Only available values are shown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-xs sm:text-sm font-medium">Campaign</label>
              <Select
                value={filters.campaign || "all"}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, campaign: value === "all" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Campaigns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns</SelectItem>
                  {filterOptions.campaigns.map((campaign) => (
                    <SelectItem key={campaign} value={campaign}>
                      {campaign}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-xs sm:text-sm font-medium">Company</label>
              <Select
                value={filters.company || "all"}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, company: value === "all" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {filterOptions.companies.map((company) => (
                    <SelectItem key={company} value={company}>
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-xs sm:text-sm font-medium">Contract</label>
              <Select
                value={filters.contract || "all"}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, contract: value === "all" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Contracts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contracts</SelectItem>
                  {filterOptions.contracts.map((contract) => (
                    <SelectItem key={contract} value={contract}>
                      {contract}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-xs sm:text-sm font-medium">Influencer</label>
              <Select
                value={filters.influencer || "all"}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, influencer: value === "all" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Influencers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Influencers</SelectItem>
                  {filterOptions.influencers.map((influencer) => (
                    <SelectItem key={influencer} value={influencer}>
                      {influencer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-xs sm:text-sm font-medium">User</label>
              <Select
                value={filters.user || "all"}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, user: value === "all" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {filterOptions.users.map((user) => (
                    <SelectItem key={user} value={user}>
                      {user}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-xs sm:text-sm font-medium">Signed Status</label>
              <Select
                value={filters.isSigned || "all"}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, isSigned: value === "all" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="true">Signed</SelectItem>
                  <SelectItem value="false">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFilters({
                  company: "",
                  influencer: "",
                  user: "",
                  isSigned: "",
                  campaign: "",
                  contract: "",
                });
              }}
            >
              Clear All
            </Button>
            <Button onClick={() => setIsFilterDialogOpen(false)}>Apply Filters</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CampaignDetail;

