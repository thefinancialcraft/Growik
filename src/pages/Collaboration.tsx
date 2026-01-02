import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Printer, ChevronLeft, ChevronRight, FileText, UserCog, Trash2, CheckCircle2, FileCheck, Circle, Search, Filter, Download } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  CampaignRecord,
  CampaignInfluencerRef,
  CampaignContractRef,
  getPlatformMeta,
  mapCampaignRow,
} from "@/lib/campaign";

const TIMELINE_ITEMS = [
  {
    id: "brief",
    title: "Brief Shared",
    description: "Campaign brief emailed to the influencer.",
    timestamp: "Mon, 10:30 AM",
  },
  {
    id: "followup",
    title: "Follow-up Call",
    description: "Discovery call scheduled to align on deliverables.",
    timestamp: "Tue, 2:00 PM",
  },
  {
    id: "contract",
    title: "Contract Sent",
    description: "Draft contract shared for signature.",
    timestamp: "Wed, 5:45 PM",
  },
];

type LocationState = {
  campaign?: CampaignRecord;
  influencerId?: string;
};

type ActionOption = "interested" | "not_interested" | "callback" | "done";

const ACTION_LABELS: Record<ActionOption, string> = {
  interested: "Contact marked interested",
  not_interested: "Marked as not interested",
  callback: "Callback scheduled",
  done: "Collaboration marked done",
};

type ContractVariablesRow = {
  variables: Record<string, unknown> | null;
  content: string | null;
};

type ContractVariableEntry = {
  key: string;
  description?: string;
  value?: string;
  rawValues?: string[];
  editable?: boolean;
  inputValue?: string;
};

type ActionSnapshot = {
  action: ActionOption | "";
  callbackDate: string;
  callbackTime: string;
  remark: string;
};

const DEFAULT_CONTRACT_VARIABLE_HINTS: ContractVariableEntry[] = [
  { key: "var[{{user_id}}]", description: "Platform user identifier (account owner or manager)", rawValues: [] },
  { key: "var[{{influencer_name}}]", description: "Primary influencer assigned to the campaign", rawValues: [] },
  { key: "var[{{company_name}}]", description: "Brand or company linked to the campaign", rawValues: [] },
  { key: "var[{{plain_text}}]", description: "Manual text placeholder", rawValues: [], editable: true, inputValue: "" },
];

const TIPTAP_PREVIEW_STYLE_ID = "contract-preview-tiptap-style";
const TIPTAP_PREVIEW_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --font-base: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  --color-base: #111827;
  --color-muted: #4b5563;
}

.contract-preview-container .tiptap-rendered {
  font-family: var(--font-base);
  font-size: 11.5pt;
  line-height: 1.7;
  color: var(--color-base);
  word-break: break-word;
}

.contract-preview-container .tiptap-rendered strong {
  font-weight: 600;
}

.contract-preview-container .tiptap-rendered em {
  font-style: italic;
}

.contract-preview-container .tiptap-rendered u {
  text-decoration: underline;
}

.contract-preview-container .tiptap-rendered s {
  text-decoration: line-through;
}

.contract-preview-container .tiptap-rendered mark {
  background-color: #fef08a;
  padding: 0 2px;
  border-radius: 2px;
}

.contract-preview-container .tiptap-rendered p {
  margin: 0 0 14px;
}

.contract-preview-container .tiptap-rendered h1,
.contract-preview-container .tiptap-rendered h2,
.contract-preview-container .tiptap-rendered h3,
.contract-preview-container .tiptap-rendered h4,
.contract-preview-container .tiptap-rendered h5,
.contract-preview-container .tiptap-rendered h6 {
  margin: 26px 0 14px;
  font-weight: 600;
  line-height: 1.3;
}

.contract-preview-container .tiptap-rendered h1 { font-size: 30px; }
.contract-preview-container .tiptap-rendered h2 { font-size: 24px; }
.contract-preview-container .tiptap-rendered h3 { font-size: 20px; }
.contract-preview-container .tiptap-rendered h4 { font-size: 18px; }
.contract-preview-container .tiptap-rendered h5 { font-size: 16px; }
.contract-preview-container .tiptap-rendered h6 { font-size: 14px; }

.contract-preview-container .tiptap-rendered ul,
.contract-preview-container .tiptap-rendered ol {
  margin: 0 0 14px 26px;
  padding: 0;
}

.contract-preview-container .tiptap-rendered ul { list-style: disc; }
.contract-preview-container .tiptap-rendered ul ul { list-style: circle; }
.contract-preview-container .tiptap-rendered ul ul ul { list-style: square; }

.contract-preview-container .tiptap-rendered ol { list-style: decimal; }
.contract-preview-container .tiptap-rendered ol ol { list-style: lower-alpha; }
.contract-preview-container .tiptap-rendered ol ol ol { list-style: lower-roman; }

.contract-preview-container .tiptap-rendered li {
  margin: 0 0 8px;
}

.contract-preview-container .tiptap-rendered blockquote {
  margin: 14px 0;
  padding: 12px 18px;
  border-left: 4px solid #d1d5db;
  background-color: #f9fafb;
  color: var(--color-muted);
}

.contract-preview-container .tiptap-rendered table {
  width: 100%;
  border-collapse: collapse;
  margin: 18px 0;
  font-size: 10.5pt;
}

.contract-preview-container .tiptap-rendered table th,
.contract-preview-container .tiptap-rendered table td {
  border: 1px solid #d1d5db;
  padding: 10px;
  text-align: left;
  vertical-align: top;
}

.contract-preview-container .tiptap-rendered table thead th {
  background-color: #f3f4f6;
  font-weight: 600;
}

.contract-preview-container .tiptap-rendered pre {
  background-color: #1f2937;
  color: #f9fafb;
  padding: 14px;
  border-radius: 8px;
  margin: 14px 0;
  font-family: var(--font-mono);
  font-size: 10pt;
  white-space: pre-wrap;
}

.contract-preview-container .tiptap-rendered code {
  font-family: var(--font-mono);
  font-size: 10pt;
  background-color: #f3f4f6;
  padding: 2px 4px;
  border-radius: 4px;
}

.contract-preview-container .tiptap-rendered pre code {
  background: transparent;
  padding: 0;
}

.contract-preview-container .tiptap-rendered a {
  color: #2563eb;
  text-decoration: underline;
}

.contract-preview-container .tiptap-rendered hr {
  border: 0;
  border-top: 1px solid #d1d5db;
  margin: 28px 0;
}

.contract-preview-container .tiptap-rendered .text-left,
.contract-preview-container .tiptap-rendered .has-text-align-left,
.contract-preview-container .tiptap-rendered [style*='text-align: left'] {
  text-align: left !important;
}

.contract-preview-container .tiptap-rendered .text-center,
.contract-preview-container .tiptap-rendered .has-text-align-center,
.contract-preview-container .tiptap-rendered [style*='text-align: center'] {
  text-align: center !important;
}

.contract-preview-container .tiptap-rendered .text-right,
.contract-preview-container .tiptap-rendered .has-text-align-right,
.contract-preview-container .tiptap-rendered [style*='text-align: right'] {
  text-align: right !important;
}

.contract-preview-container .tiptap-rendered .text-justify,
.contract-preview-container .tiptap-rendered .has-text-align-justify,
.contract-preview-container .tiptap-rendered [style*='text-align: justify'] {
  text-align: justify !important;
}

.contract-preview-container .tiptap-rendered .tiptap-image-wrapper {
  display: block;
  margin: 18px 0;
}

.contract-preview-container .tiptap-rendered .tiptap-image-wrapper[data-alignment="right"] {
  text-align: right;
}

.contract-preview-container .tiptap-rendered .tiptap-image-wrapper[data-alignment="center"] {
  text-align: center;
}

.contract-preview-container .tiptap-rendered .tiptap-image-wrapper[data-alignment="left"] {
  text-align: left;
}

.contract-preview-container .tiptap-rendered .tiptap-image-wrapper img {
  display: inline-block;
  max-width: 100%;
  height: auto;
  margin: 0;
}

.contract-preview-container .tiptap-rendered img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 18px 0;
}
`;

const VARIABLE_OVERRIDE_TABLE = "collaboration_variable_overrides";
const UUID_MASK_128 = (1n << 128n) - 1n;

const toDeterministicUuid = (source: string): string => {
  const prime = 0x100000001b3n;
  let h1 = 0xcbf29ce484222325n;
  let h2 = 0x84222325cbf29cen;

  for (let i = 0; i < source.length; i++) {
    const code = BigInt(source.charCodeAt(i));
    h1 = (h1 ^ code) * prime & UUID_MASK_128;
    h2 = (h2 ^ ((code << 1n) & UUID_MASK_128)) * prime & UUID_MASK_128;
  }

  const combined = ((h1 << 64n) | (h2 & ((1n << 64n) - 1n))) & UUID_MASK_128;
  const hex = combined.toString(16).padStart(32, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const Collaboration = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const state = (location.state as LocationState | undefined) ?? {};

  const [campaign, setCampaign] = useState<CampaignRecord | null>(state.campaign ?? null);
  const [loading, setLoading] = useState<boolean>(Boolean(id && !state.campaign));
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<{
    label: string;
    timestamp: string;
    remark?: string;
  } | null>(null);
  const [actionRemark, setActionRemark] = useState<string>("");
  const [selectedAction, setSelectedAction] = useState<ActionOption | "">("");
  const [callbackTime, setCallbackTime] = useState<string>("");
  const [callbackDate, setCallbackDate] = useState<string>("");
  const [isVariableSheetOpen, setIsVariableSheetOpen] = useState<boolean>(false);
  const [contractVariableEntries, setContractVariableEntries] = useState<ContractVariableEntry[]>(
    () => DEFAULT_CONTRACT_VARIABLE_HINTS.map((entry) => ({ ...entry }))
  );
  const [contractVariablesLoading, setContractVariablesLoading] = useState<boolean>(false);
  const [contractVariablesError, setContractVariablesError] = useState<string | null>(null);
  const [contractContent, setContractContent] = useState<string | null>(null);
  const [originalContractContent, setOriginalContractContent] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [contractPreviewHtml, setContractPreviewHtml] = useState<string>("");
  const [isGeneratingPreview, setIsGeneratingPreview] = useState<boolean>(false);
  const [isViewContractOpen, setIsViewContractOpen] = useState<boolean>(false);
  const [savedContractHtml, setSavedContractHtml] = useState<string | null>(null);
  const [isLoadingSavedContract, setIsLoadingSavedContract] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [resolvedContractPid, setResolvedContractPid] = useState<string | null>(null);
  const [hasLoadedInitialAction, setHasLoadedInitialAction] = useState<boolean>(false);
  const [actionBaseline, setActionBaseline] = useState<ActionSnapshot>({
    action: "",
    callbackDate: "",
    callbackTime: "",
    remark: "",
  });
  const [timelineEntries, setTimelineEntries] = useState<Array<{
    id: string;
    action_type: string;
    description: string;
    remark: string | null;
    action: string | null;
    occurred_at: string;
    user_id: string | null;
  }>>([]);
  const [timelineLoading, setTimelineLoading] = useState<boolean>(false);
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
  const [viewingContractFromTable, setViewingContractFromTable] = useState<string | null>(null);
  const [contractHtmlFromTable, setContractHtmlFromTable] = useState<string | null>(null);
  const [isLoadingContractFromTable, setIsLoadingContractFromTable] = useState<boolean>(false);
  const [changingUserId, setChangingUserId] = useState<{ id: string; currentUserId: string | null; collaborationId: string } | null>(null);
  const [deletingAction, setDeletingAction] = useState<string | null>(null);
  const [usersForPicker, setUsersForPicker] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [loadingCampaignUsers, setLoadingCampaignUsers] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [assignedCampaignIds, setAssignedCampaignIds] = useState<Set<string>>(new Set());
  const injectedStyleLinksRef = useRef<HTMLLinkElement[]>([]);

  // Inject stylesheet links into document head when viewing saved contract
  useEffect(() => {
    if (isViewContractOpen && savedContractHtml) {
      const { links } = extractStylesFromHtml(savedContractHtml);
      if (links) {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(links, "text/html");
          const linkElements = doc.querySelectorAll('link[rel="stylesheet"]');
          const injected: HTMLLinkElement[] = [];
          
          linkElements.forEach((link) => {
            const newLink = document.createElement("link");
            newLink.rel = "stylesheet";
            newLink.href = link.getAttribute("href") || "";
            if (link.getAttribute("integrity")) {
              newLink.setAttribute("integrity", link.getAttribute("integrity") || "");
            }
            if (link.getAttribute("crossorigin")) {
              newLink.setAttribute("crossorigin", link.getAttribute("crossorigin") || "");
            }
            document.head.appendChild(newLink);
            injected.push(newLink);
          });
          
          injectedStyleLinksRef.current = injected;
        } catch (err) {
          console.error("Collaboration: Failed to inject style links", err);
        }
      }
    }

    return () => {
      // Clean up injected links when dialog closes
      injectedStyleLinksRef.current.forEach((link) => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });
      injectedStyleLinksRef.current = [];
    };
  }, [isViewContractOpen, savedContractHtml]);

  const isUuid = (value: string | undefined | null): value is string =>
    Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));

  const currentActionSnapshot = useMemo<ActionSnapshot>(
    () => ({
      action: (selectedAction as ActionOption | "") || "",
      callbackDate: selectedAction === "callback" ? callbackDate : "",
      callbackTime: selectedAction === "callback" ? callbackTime : "",
      remark: actionRemark.trim(),
    }),
    [selectedAction, callbackDate, callbackTime, actionRemark]
  );

  const isActionDirty = useMemo(() => {
    if (!selectedAction) {
      return false;
    }

    return (
      currentActionSnapshot.action !== actionBaseline.action ||
      currentActionSnapshot.callbackDate !== actionBaseline.callbackDate ||
      currentActionSnapshot.callbackTime !== actionBaseline.callbackTime ||
      currentActionSnapshot.remark !== actionBaseline.remark
    );
  }, [selectedAction, currentActionSnapshot, actionBaseline]);

  const campaignKey = useMemo(() => {
    return campaign?.id ?? id ?? null;
  }, [campaign?.id, id]);

  const resolvedCampaignId = useMemo(() => {
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
  }, [campaign?.id, id, campaignKey]);

  const influencer: CampaignInfluencerRef | null = useMemo(() => {
    if (!campaign || !campaign.influencers.length) {
      return null;
    }
    // If influencerId is provided in state, find that influencer, otherwise use first one
    if (state.influencerId) {
      const found = campaign.influencers.find(
        (inf) => inf.id === state.influencerId || inf.pid === state.influencerId
      );
      if (found) return found;
    }
    return campaign.influencers[0];
  }, [campaign, state.influencerId]);
  
  // Get current influencer index and navigation info
  const influencerNavigation = useMemo(() => {
    if (!campaign || !campaign.influencers.length || !influencer) {
      return { currentIndex: -1, hasPrevious: false, hasNext: false, previousInfluencer: null, nextInfluencer: null };
    }
    const currentIndex = campaign.influencers.findIndex(
      (inf) => inf.id === influencer.id || inf.pid === influencer.pid
    );
    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex < campaign.influencers.length - 1;
    const previousInfluencer = hasPrevious ? campaign.influencers[currentIndex - 1] : null;
    const nextInfluencer = hasNext ? campaign.influencers[currentIndex + 1] : null;
    return { currentIndex, hasPrevious, hasNext, previousInfluencer, nextInfluencer };
  }, [campaign, influencer]);

  const resolvedInfluencerId = useMemo(() => {
    if (isUuid(influencer?.id)) {
      return influencer!.id;
    }
    return null;
  }, [influencer?.id]);
  
  // Navigation functions for previous/next influencer
  const handlePreviousInfluencer = useCallback(() => {
    if (!influencerNavigation.hasPrevious || !influencerNavigation.previousInfluencer || !campaign) {
      return;
    }
    navigate('/collaboration', {
      state: {
        campaign,
        influencerId: influencerNavigation.previousInfluencer.id || influencerNavigation.previousInfluencer.pid,
      },
    });
  }, [influencerNavigation, campaign, navigate]);
  
  const handleNextInfluencer = useCallback(() => {
    if (!influencerNavigation.hasNext || !influencerNavigation.nextInfluencer || !campaign) {
      return;
    }
    navigate('/collaboration', {
      state: {
        campaign,
        influencerId: influencerNavigation.nextInfluencer.id || influencerNavigation.nextInfluencer.pid,
      },
    });
  }, [influencerNavigation, campaign, navigate]);

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
            "id, name, brand, objective, users, influencers, contract_id, contract_snapshot, start_date, end_date, is_long_term, status, progress, created_at"
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
        console.error("Collaboration: Error fetching campaign", fetchErr);
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

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setCurrentUserId(data?.user?.id ?? null);

        // Fetch user role and assigned campaigns
        if (data?.user?.id) {
          try {
            // Get role from localStorage first
            let finalRole: string | null = null;
            const cachedRole = localStorage.getItem('currentUserRole');
            if (cachedRole && (cachedRole === 'admin' || cachedRole === 'super_admin' || cachedRole === 'user')) {
              finalRole = cachedRole;
              setUserRole(cachedRole);
            } else {
              // Fetch from Supabase
              const { data: profileData, error: profileError } = await supabase
                .from("user_profiles")
                .select("role")
                .eq("user_id", data.user.id)
                .maybeSingle();

              if (!profileError && profileData) {
                const role = (profileData as any).role;
                if (role) {
                  finalRole = role;
                  setUserRole(role);
                  localStorage.setItem('currentUserRole', role);
                }
              }
            }

            // If role is "user", fetch assigned and active campaigns only
            if (finalRole === 'user') {
              // Fetch all campaigns where user is assigned and status is "live" (active)
              const { data: campaignsData, error: campaignsError } = await supabase
                .from("campaigns")
                .select("id, users, status")
                .eq("status", "live")
                .order("created_at", { ascending: false });

              if (!campaignsError && campaignsData) {
                const assignedIds = new Set<string>();
                campaignsData.forEach((campaign: any) => {
                  const users = campaign.users;
                  if (Array.isArray(users)) {
                    const isAssigned = users.some((user: any) => 
                      user.id === data.user.id || user.user_id === data.user.id
                    );
                    // Only add if user is assigned AND campaign is active (status === "live")
                    if (isAssigned && campaign.status === "live") {
                      // Store both the campaign ID and the resolved UUID if needed
                      assignedIds.add(campaign.id);
                      // Also add resolved UUID if it's not a UUID
                      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaign.id);
                      if (!isUuid) {
                        const resolvedId = toDeterministicUuid(`campaign:${campaign.id}`);
                        assignedIds.add(resolvedId);
                      }
                    }
                  }
                });
                setAssignedCampaignIds(assignedIds);
              }
            }
          } catch (err) {
            console.error("Collaboration: Error fetching user role/assigned campaigns", err);
          }
        }
      } catch (error) {
        console.error("Collaboration: Unable to fetch current user", error);
        setCurrentUserId(null);
      }
    };

    fetchUser();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const existing = document.getElementById(TIPTAP_PREVIEW_STYLE_ID);
    if (!existing) {
      const style = document.createElement("style");
      style.id = TIPTAP_PREVIEW_STYLE_ID;
      style.textContent = TIPTAP_PREVIEW_STYLE;
      document.head.appendChild(style);
    }
  }, []);

  const contractMeta: CampaignContractRef | null = useMemo(() => {
    if (!campaign?.contract || typeof campaign.contract !== "object") {
      return null;
    }

    const candidate = campaign.contract as Partial<CampaignContractRef>;
    return candidate.id ? (candidate as CampaignContractRef) : null;
  }, [campaign]);

  useEffect(() => {
    if (contractMeta?.pid) {
      setResolvedContractPid(contractMeta.pid);
    } else if (!contractMeta?.id) {
      setResolvedContractPid(null);
    }
  }, [contractMeta?.pid, contractMeta?.id]);

  useEffect(() => {
    const fetchContractPid = async () => {
      if (!contractMeta?.id || contractMeta?.pid) {
        return;
      }
      try {
        const { data, error } = await supabase
          .from("contracts")
          .select("pid")
          .eq("id", contractMeta.id)
          .maybeSingle();
        if (error) {
          throw error;
        }
        setResolvedContractPid((data as { pid?: string | null } | null)?.pid ?? null);
      } catch (err) {
        console.error("Collaboration: Unable to fetch contract PID", err);
        setResolvedContractPid(null);
      }
    };
    fetchContractPid();
  }, [contractMeta?.id, contractMeta?.pid]);

  const collaborationId = useMemo(() => {
    if (!campaignKey) {
      return null;
    }
    const influencerKey = influencer?.pid ?? influencer?.id ?? "none";
    const contractKey = resolvedContractPid ?? contractMeta?.id ?? "none";
    return `${campaignKey}-${influencerKey}-${contractKey}`;
  }, [campaignKey, influencer?.pid, influencer?.id, resolvedContractPid, contractMeta?.id]);

  // Function to fetch timeline entries
  const fetchTimelineEntries = useCallback(async () => {
    if (!collaborationId) {
      return;
    }

    setTimelineLoading(true);
    try {
      const client = supabase as any;
      const { data, error } = await client
        .from("collaboration_timeline")
        .select("id, action_type, description, remark, action, occurred_at, user_id")
        .eq("collaboration_id", collaborationId)
        .order("occurred_at", { ascending: false });

      if (error) {
        throw error;
      }

      setTimelineEntries(data || []);
    } catch (err) {
      console.error("Collaboration: Failed to fetch timeline entries", err);
      setTimelineEntries([]);
    } finally {
      setTimelineLoading(false);
    }
  }, [collaborationId, supabase]);

  // Function to log timeline entries
  const logTimelineEntry = useCallback(async (
    actionType: 'action_taken' | 'remark_added' | 'contract_sent' | 'contract_viewed' | 'contract_updated' | 'variable_updated' | 'status_changed',
    description: string,
    remark?: string | null,
    action?: string | null,
    metadata?: Record<string, any>
  ) => {
    if (!collaborationId || !currentUserId) {
      return;
    }

    try {
      const client = supabase as any;
      const { error } = await client
        .from("collaboration_timeline")
        .insert({
          collaboration_id: collaborationId,
          action_type: actionType,
          description,
          remark: remark || null,
          action: action || null,
          user_id: currentUserId,
          metadata: metadata || {},
        });

      if (error) {
        console.error("Collaboration: Failed to log timeline entry", error);
      } else {
        // Refresh timeline after logging
        void fetchTimelineEntries();
      }
    } catch (err) {
      console.error("Collaboration: Error logging timeline entry", err);
    }
  }, [collaborationId, currentUserId, fetchTimelineEntries]);

  // Fetch collaboration actions
  const fetchCollaborationActions = useCallback(async () => {
    setCollaborationActionsLoading(true);
    try {
      const { data, error } = await supabase
        .from("collaboration_actions")
        .select("id, campaign_id, influencer_id, user_id, action, remark, occurred_at, collaboration_id, contract_id, is_signed")
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

          // Extract campaign key from collaboration_id (format: "CAM001-0001-CON0001")
          const campaignKey = action.collaboration_id?.split("-")[0];
          
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
              console.error("Collaboration: Error fetching user name", userErr);
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
              console.error("Collaboration: Error fetching influencer name", influencerErr);
            }
          }
          
          if (campaignKey) {
            try {
              // Fetch campaign name and company (brand)
              const { data: campaignData } = await supabase
                .from("campaigns")
                .select("name, brand, contract_id")
                .eq("id", campaignKey)
                .maybeSingle();

              if (campaignData) {
                campaignName = (campaignData as any).name || null;
                companyName = (campaignData as any).brand || null;
                const campaignContractId = (campaignData as any).contract_id;
                
                // Fetch contract name if contract_id exists
                if (campaignContractId || action.contract_id) {
                  const contractId = campaignContractId || action.contract_id;
                  const { data: contractData } = await supabase
                    .from("contracts")
                    .select("contract_name")
                    .eq("id", contractId)
                    .maybeSingle();

                  if (contractData) {
                    contractName = (contractData as any).contract_name || null;
                  }
                }
              }
            } catch (fetchErr) {
              console.error("Collaboration: Error fetching campaign/contract names", fetchErr);
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
      console.error("Collaboration: Failed to fetch collaboration actions", err);
      setCollaborationActions([]);
    } finally {
      setCollaborationActionsLoading(false);
    }
  }, []);

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

    // If user role is "user", only show actions assigned to this user
    if (userRole === 'user' && currentUserId) {
      filtered = filtered.filter((action) => {
        // First check if user_id matches current user
        if (action.user_id && action.user_id === currentUserId) {
          // Also verify campaign is assigned (additional check)
          if (assignedCampaignIds.size > 0) {
            // Check if campaign_id matches any assigned campaign
            if (action.campaign_id && assignedCampaignIds.has(action.campaign_id)) {
              return true;
            }
            // Also check collaboration_id format: extract campaign key (e.g., "CAM001-0001-CON0001" -> "CAM001")
            if (action.collaboration_id) {
              const campaignKey = action.collaboration_id.split("-")[0];
              if (campaignKey && assignedCampaignIds.has(campaignKey)) {
                return true;
              }
              // Also check resolved UUID
              const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaignKey);
              if (!isUuid) {
                const resolvedId = toDeterministicUuid(`campaign:${campaignKey}`);
                if (assignedCampaignIds.has(resolvedId)) {
                  return true;
                }
              }
            }
          } else {
            // If no assigned campaigns, still show if user_id matches
            return true;
          }
        }
        return false;
      });
    } else if (userRole === 'user' && assignedCampaignIds.size > 0) {
      // Fallback: if no currentUserId but has assigned campaigns, filter by campaigns only
      filtered = filtered.filter((action) => {
        // Check if campaign_id matches any assigned campaign
        if (action.campaign_id && assignedCampaignIds.has(action.campaign_id)) {
          return true;
        }
        // Also check collaboration_id format: extract campaign key (e.g., "CAM001-0001-CON0001" -> "CAM001")
        if (action.collaboration_id) {
          const campaignKey = action.collaboration_id.split("-")[0];
          if (campaignKey && assignedCampaignIds.has(campaignKey)) {
            return true;
          }
          // Also check resolved UUID
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaignKey);
          if (!isUuid) {
            const resolvedId = toDeterministicUuid(`campaign:${campaignKey}`);
            if (assignedCampaignIds.has(resolvedId)) {
              return true;
            }
          }
        }
        return false;
      });
    }

    // Apply search filter
    if (collabSearch.trim()) {
      const query = collabSearch.toLowerCase();
      filtered = filtered.filter((action) => {
        return (
          (action.campaign_name || "").toLowerCase().includes(query) ||
          (action.company_name || "").toLowerCase().includes(query) ||
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
  }, [collaborationActions, collabSearch, filters, userRole, assignedCampaignIds, currentUserId]);

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
      "Campaign",
      "Company",
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
      action.campaign_name || "",
      action.company_name || "",
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

  // Fetch timeline entries when collaborationId is available
  useEffect(() => {
    if (collaborationId) {
      void fetchTimelineEntries();
    }
  }, [collaborationId, fetchTimelineEntries]);

  // Fetch all collaboration actions on component mount
  useEffect(() => {
    void fetchCollaborationActions();
  }, [fetchCollaborationActions]);

  // Handle viewing contract from table row
  const handleViewContractFromTable = useCallback(async (collaborationId: string) => {
    setIsLoadingContractFromTable(true);
    setViewingContractFromTable(collaborationId);
    try {
      const { data, error } = await supabase
        .from("collaboration_variable_overrides")
        .select("contract_html")
        .eq("collaboration_id", collaborationId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data && (data as any).contract_html) {
        setContractHtmlFromTable((data as any).contract_html);
      } else {
        toast({
          title: "No contract found",
          description: "Contract has not been filled yet.",
          variant: "destructive",
        });
        setContractHtmlFromTable(null);
      }
    } catch (err: any) {
      console.error("Collaboration: Error loading contract from table", err);
      toast({
        title: "Unable to load contract",
        description: err?.message || "Failed to fetch the contract.",
        variant: "destructive",
      });
      setContractHtmlFromTable(null);
    } finally {
      setIsLoadingContractFromTable(false);
    }
  }, [toast]);

  // Handle changing user ID
  const handleChangeUserId = useCallback(async (actionId: string, newUserId: string) => {
    try {
      const { error } = await (supabase as any)
        .from("collaboration_actions")
        .update({ user_id: newUserId || null })
        .eq("id", actionId);

      if (error) {
        throw error;
      }

      toast({
        title: "User ID updated",
        description: "The user ID has been successfully updated.",
      });

      setChangingUserId(null);
      void fetchCollaborationActions();
    } catch (err: any) {
      console.error("Collaboration: Error updating user ID", err);
      toast({
        title: "Unable to update user ID",
        description: err?.message || "Failed to update the user ID.",
        variant: "destructive",
      });
    }
  }, [toast, fetchCollaborationActions]);

  // Handle deleting action
  const handleDeleteAction = useCallback(async (collabId: string) => {
    if (!collabId) {
      toast({
        title: "Error",
        description: "Collaboration ID is missing. Cannot delete.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log(`[Collaboration Deletion] Starting removal for: ${collabId}`);
      
      // Use supabaseAdmin if available for deletion to ensure it bypasses RLS
      const { supabaseAdmin } = await import("@/lib/supabase");
      const client = supabaseAdmin || supabase;
      
      if (!supabaseAdmin) {
        console.warn("[Collaboration Deletion] supabaseAdmin not available, using standard client (RLS applies)");
      } else {
        console.log("[Collaboration Deletion] Using Admin client for bypass");
      }

      // Perform deletions across all 3 tables
      console.log(`[Collaboration Deletion] 1/3: Clearing overrides...`);
      const { data: ovData, error: ovErr } = await client
        .from("collaboration_variable_overrides")
        .delete()
        .eq("collaboration_id", collabId)
        .select();
      
      if (ovErr) console.error("[Collaboration Deletion] Override Error:", ovErr);
      else console.log(`[Collaboration Deletion] Overrides removed: ${ovData?.length || 0}`);

      console.log(`[Collaboration Deletion] 2/3: Clearing timeline...`);
      const { data: tmData, error: tmErr } = await client
        .from("collaboration_timeline")
        .delete()
        .eq("collaboration_id", collabId)
        .select();
      
      if (tmErr) console.error("[Collaboration Deletion] Timeline Error:", tmErr);
      else console.log(`[Collaboration Deletion] Timeline entries removed: ${tmData?.length || 0}`);

      console.log(`[Collaboration Deletion] 3/3: Clearing action...`);
      const { data: acData, error: acErr } = await client
        .from("collaboration_actions")
        .delete()
        .eq("collaboration_id", collabId)
        .select();

      if (acErr) throw acErr;
      
      const deletedCount = acData?.length || 0;
      console.log(`[Collaboration Deletion] Actions removed: ${deletedCount}`);

      if (deletedCount === 0) {
        // One final try using ilike in case of case issues or spaces
        console.log(`[Collaboration Deletion] Row not found with exact match. Trying fuzzy match...`);
        const { data: fuzzyData, error: fuzzyErr } = await client
          .from("collaboration_actions")
          .delete()
          .ilike("collaboration_id", `%${collabId.trim()}%`)
          .select();
          
        if (fuzzyErr) throw fuzzyErr;
        if (fuzzyData && fuzzyData.length > 0) {
          console.log(`[Collaboration Deletion] Removed ${fuzzyData.length} records via fuzzy match.`);
        } else {
          toast({
            title: "Record not found",
            description: "No record in Supabase matched this Collaboration ID.",
            variant: "destructive",
          });
          return;
        }
      }

      toast({
        title: "Collaboration deleted",
        description: "Everything related to this collaboration has been removed.",
      });

      // Refresh data
      void fetchCollaborationActions();
    } catch (err: any) {
      console.error("[Collaboration Deletion] CRITICAL FAILURE:", err);
      toast({
        title: "Deletion failed",
        description: err?.message || "Failed to remove entries from Supabase.",
        variant: "destructive",
      });
    } finally {
      setDeletingAction(null);
    }
  }, [toast, fetchCollaborationActions]);

  // Handle toggling signed status
  const handleToggleSigned = useCallback(async (actionId: string, currentStatus: boolean | null) => {
    try {
      const { error } = await (supabase as any)
        .from("collaboration_actions")
        .update({ is_signed: !currentStatus })
        .eq("id", actionId);

      if (error) {
        throw error;
      }

      toast({
        title: currentStatus ? "Contract unsigned" : "Contract signed",
        description: `The contract has been marked as ${!currentStatus ? 'signed' : 'unsigned'}.`,
      });

      void fetchCollaborationActions();
    } catch (err: any) {
      console.error("Collaboration: Error toggling signed status", err);
      toast({
        title: "Unable to update signed status",
        description: err?.message || "Failed to update the signed status.",
        variant: "destructive",
      });
    }
  }, [toast, fetchCollaborationActions]);

  // Fetch campaign users for picker
  useEffect(() => {
    const fetchCampaignUsers = async () => {
      if (!changingUserId || !changingUserId.collaborationId) {
        return;
      }

      setLoadingCampaignUsers(true);
      setUsersForPicker([]); // Reset users list
      
      try {
        // Extract campaign key from collaboration_id (format: "CAM001-0001-CON0001")
        const campaignKey = changingUserId.collaborationId.split("-")[0];
        
        if (!campaignKey) {
          console.warn("Collaboration: Invalid collaboration ID format", changingUserId.collaborationId);
          setUsersForPicker([]);
          setLoadingCampaignUsers(false);
          return;
        }

        // Fetch campaign data to get assigned users
        const { data: campaignData, error: campaignError } = await supabase
          .from("campaigns")
          .select("users")
          .eq("id", campaignKey)
          .maybeSingle();

        if (campaignError) {
          console.error("Collaboration: Error fetching campaign", campaignError);
          setUsersForPicker([]);
          setLoadingCampaignUsers(false);
          return;
        }

        const users = (campaignData as any)?.users;
        if (!campaignData || !users || !Array.isArray(users)) {
          console.log("Collaboration: No users found in campaign", campaignKey);
          setUsersForPicker([]);
          setLoadingCampaignUsers(false);
          return;
        }

        // Extract user IDs from campaign.users array
        const userIds = users
          .map((user: any) => user.id || user.user_id)
          .filter(Boolean);

        if (userIds.length === 0) {
          console.log("Collaboration: No valid user IDs found in campaign users");
          setUsersForPicker([]);
          setLoadingCampaignUsers(false);
          return;
        }

        // Fetch user profiles for these user IDs
        const { data: userProfiles, error: usersError } = await supabase
          .from("user_profiles")
          .select("user_id, user_name, email")
          .in("user_id", userIds)
          .order("user_name", { ascending: true });

        if (usersError) {
          console.error("Collaboration: Error fetching user profiles", usersError);
          setUsersForPicker([]);
          setLoadingCampaignUsers(false);
          return;
        }

        setUsersForPicker(
          (userProfiles || []).map((user: any) => ({
            id: user.user_id,
            name: user.user_name || user.email || "Unknown",
            email: user.email || "",
          }))
        );
      } catch (err: any) {
        console.error("Collaboration: Exception fetching campaign users", err);
        setUsersForPicker([]);
      } finally {
        setLoadingCampaignUsers(false);
      }
    };

    if (changingUserId) {
      void fetchCampaignUsers();
    } else {
      setUsersForPicker([]);
      setLoadingCampaignUsers(false);
    }
  }, [changingUserId]);

  // Handle row click to navigate to collaboration assignment
  const handleRowClick = useCallback(async (action: {
    campaign_id: string | null;
    influencer_id: string | null;
    collaboration_id: string;
    user_id: string | null;
  }) => {
    if (!action.collaboration_id || !action.influencer_id) {
      toast({
        title: "Missing information",
        description: "Collaboration ID or Influencer ID is missing from collaboration_actions table.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Extract campaign key from collaboration_id (format: "CAM001-0001-CON0001")
      // The campaign key is the first part before the first "-"
      const campaignKey = action.collaboration_id.split("-")[0];
      
      if (!campaignKey) {
        toast({
          title: "Invalid collaboration ID",
          description: "Could not extract campaign ID from collaboration_id.",
          variant: "destructive",
        });
        return;
      }

      // Fetch campaign data from campaigns table using the extracted campaign key
      // campaigns.id is text (like "CAM001"), not UUID
      const { data: campaignData, error: campaignError } = await supabase
        .from("campaigns")
        .select(
          "id, name, brand, objective, users, influencers, contract_id, contract_snapshot, start_date, end_date, is_long_term, status, progress, created_at"
        )
        .eq("id", campaignKey)
        .maybeSingle();

      if (campaignError) {
        throw campaignError;
      }

      if (!campaignData) {
        toast({
          title: "Campaign not found",
          description: `Campaign with ID "${campaignKey}" (extracted from collaboration_id "${action.collaboration_id}") could not be found in campaigns table.`,
          variant: "destructive",
        });
        return;
      }

      const mappedCampaign = mapCampaignRow(campaignData);

      // Navigate to collaboration assignment with:
      // - influencer_id from collaboration_actions table
      // - campaign_id extracted from collaboration_id
      // - campaign data (which includes contract_id from campaigns table)
      navigate('/collaborationAssignment', {
        state: {
          campaign: mappedCampaign,
          influencerId: action.influencer_id, // From collaboration_actions.influencer_id
          campaignId: campaignKey, // Extracted from collaboration_id (e.g., "CAM001")
        },
      });
    } catch (err: any) {
      console.error("Collaboration: Error fetching campaign for navigation", err);
      toast({
        title: "Unable to navigate",
        description: err?.message || "An error occurred while loading the campaign from campaigns table.",
        variant: "destructive",
      });
    }
  }, [navigate, toast]);

  useEffect(() => {
    if (hasLoadedInitialAction) {
      return;
    }
    if (!resolvedCampaignId || !collaborationId) {
      return;
    }

    let cancelled = false;

    const fetchLatestAction = async () => {
      try {
        const { data, error } = await supabase
          .from("collaboration_actions")
          .select("action, remark, occurred_at")
          .eq("campaign_id", resolvedCampaignId)
          .eq("collaboration_id", collaborationId)
          .order("occurred_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (cancelled) {
          return;
        }

        const latestAction = data as { action?: string | null; remark?: string | null; occurred_at?: string | null } | null;

        if (latestAction) {
          const actionValue = (latestAction.action ?? "") as ActionOption | "";
          const remarkValue = (latestAction.remark ?? "").trim();

          setSelectedAction(actionValue);
          setActionRemark(remarkValue);
          setCallbackDate("");
          setCallbackTime("");

          setActionBaseline({
            action: actionValue,
            callbackDate: "",
            callbackTime: "",
            remark: remarkValue,
          });

          if (actionValue) {
            setLastAction({
              label: ACTION_LABELS[actionValue as ActionOption] ?? "Action recorded",
              timestamp: latestAction.occurred_at
                ? new Date(latestAction.occurred_at).toLocaleString()
                : new Date().toLocaleString(),
              remark: remarkValue || undefined,
            });
          }
        } else {
          setActionBaseline({ action: "", callbackDate: "", callbackTime: "", remark: "" });
        }

        setHasLoadedInitialAction(true);
      } catch (err) {
        if (!cancelled) {
          console.error("Collaboration: Unable to load existing action", err);
          setHasLoadedInitialAction(true);
        }
      }
    };

    fetchLatestAction();

    return () => {
      cancelled = true;
    };
  }, [resolvedCampaignId, collaborationId, hasLoadedInitialAction]);

  const normalizeVariableKey = (rawKey: string | null | undefined): string => {
    if (!rawKey) {
      return "";
    }
    return rawKey
      .replace(/var\[\s*/i, "")
      .replace(/\s*\]/, "")
      .replace(/^\{\{/, "")
      .replace(/\}\}$/, "")
      .trim();
  };

  const extractRenderedHtml = (html: string | null | undefined): string | null => {
    if (!html) {
      return null;
    }
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const rendered = doc.querySelector(".tiptap-rendered");
      if (rendered) {
        return rendered.innerHTML;
      }
      if (doc.body && doc.body.innerHTML.trim()) {
        return doc.body.innerHTML;
      }
      return html;
    } catch {
      return html;
    }
  };

  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const loadContractVariables = useCallback(
    async (contractId: string) => {
      setContractVariablesLoading(true);
      setContractVariablesError(null);
      try {
        const { data, error } = await (supabase as any)
          .from("contracts")
          .select("variables, content")
          .eq("id", contractId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        const contractData = (data ?? null) as ContractVariablesRow | null;

        if (!contractData) {
          setContractContent(null);
          setOriginalContractContent(null);
          setContractVariableEntries(DEFAULT_CONTRACT_VARIABLE_HINTS.map((entry) => ({ ...entry })));
          return;
        }

        // Store original content with all styles
        setOriginalContractContent(contractData.content);
        setContractContent(extractRenderedHtml(contractData.content));

        const collected = new Map<
          string,
          {
            description?: string;
            descriptors: string[];
          }
        >();

        if (contractData.variables && typeof contractData.variables === "object") {
          Object.entries(contractData.variables).forEach(([rawKey, rawValue]) => {
            const normalizedKey = normalizeVariableKey(rawKey);
            if (!normalizedKey) {
              return;
            }

            let descriptors: string[] = [];
            let occurrences: number | undefined;

            if (rawValue && typeof rawValue === "object" && rawValue !== null) {
              const entry = rawValue as { descriptor?: string; descriptors?: unknown; occurrences?: number };
              if (Array.isArray(entry.descriptors)) {
                descriptors = entry.descriptors
                  .map((item) => (typeof item === "string" ? item : ""))
                  .map((item) => item.trim())
                  .filter(Boolean);
              }
              if (typeof entry.descriptor === "string" && entry.descriptor.trim().length) {
                descriptors.push(entry.descriptor.trim());
              }
              if (
                typeof entry.occurrences === "number" &&
                Number.isFinite(entry.occurrences) &&
                entry.occurrences > 0
              ) {
                occurrences = Math.floor(entry.occurrences);
              }
            } else if (typeof rawValue === "string" && rawValue.trim().length) {
              descriptors = [rawValue.trim()];
            }

            const uniqueDescriptors = Array.from(new Set(descriptors)).filter(Boolean);
            const descriptionParts: string[] = [];

            if (uniqueDescriptors.length === 1) {
              descriptionParts.push(uniqueDescriptors[0]);
            } else if (uniqueDescriptors.length > 1) {
              descriptionParts.push(uniqueDescriptors.join(" • "));
            }

            const countHint = occurrences ?? (uniqueDescriptors.length ? uniqueDescriptors.length : undefined);
            if (countHint && countHint > (uniqueDescriptors.length || 1)) {
              descriptionParts.push(`used ${countHint} times`);
            } else if (countHint && countHint > 1 && uniqueDescriptors.length <= 1) {
              descriptionParts.push(`used ${countHint} times`);
            }

            const combinedDescription = descriptionParts.length ? descriptionParts.join(" • ") : undefined;

            const existing = collected.get(normalizedKey);
            const mergedDescriptors = existing ? Array.from(new Set([...existing.descriptors, ...uniqueDescriptors])) : uniqueDescriptors;
            const description = existing?.description
              ? existing.description
              : combinedDescription;

            collected.set(normalizedKey, {
              description,
              descriptors: mergedDescriptors,
            });
          });
        }

        if (typeof contractData.content === "string" && contractData.content.trim().length) {
          const regex = /var\[\s*\{\{\s*([^}\s]+(?:[^}]*)?)\s*\}\}\s*\]/gi;
          let match: RegExpExecArray | null;

          while ((match = regex.exec(contractData.content)) !== null) {
            const normalizedKey = normalizeVariableKey(match[1]);
            if (normalizedKey && !collected.has(normalizedKey)) {
              collected.set(normalizedKey, { description: undefined, descriptors: [] });
            }
          }
        }

        if (!collected.size) {
          setContractVariableEntries(DEFAULT_CONTRACT_VARIABLE_HINTS);
          return;
        }

        const parseSourceDescriptor = (descriptor: string) => {
          const match = descriptor.match(/^source:(?:(?<schema>[^.]+)\.)?(?<table>[^.]+)\.(?<column>.+)$/);
          if (!match || !match.groups) {
            return null;
          }
          return {
            schema: match.groups.schema ?? "public",
            table: match.groups.table,
            column: match.groups.column,
          };
        };

        const rowCache = new Map<string, Record<string, any> | null>();

        const resolveColumnValue = (row: any, columnPath: string): any => {
          if (!row || typeof row !== "object") {
            return undefined;
          }

          const parts = columnPath.split(".");
          const normalizeKey = (key: string) => key.replace(/[^a-z0-9]/gi, "").toLowerCase();

          let current: any = row;

          for (const part of parts) {
            if (Array.isArray(current)) {
              const index = Number(part);
              if (Number.isNaN(index) || index < 0 || index >= current.length) {
                return undefined;
              }
              current = current[index];
              continue;
            }

            if (!current || typeof current !== "object") {
              return undefined;
            }

            const keys = Object.keys(current);
            let actualKey: string | undefined = keys.find((key) => key === part);

            if (!actualKey && /\d/.test(part)) {
              const withUnderscore = part.replace(/(\d+)/g, "_$1");
              actualKey = keys.find((key) => key === withUnderscore);
              if (!actualKey) {
                const camelCandidate = part.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
                actualKey = keys.find((key) => key === camelCandidate);
              }
            }

            if (!actualKey) {
              const targetNorm = normalizeKey(part);
              actualKey = keys.find((key) => normalizeKey(key) === targetNorm);
            }

            if (!actualKey) {
              return undefined;
            }

            current = current[actualKey];
          }

          return current;
        };

        const fetchRow = async (schema: string, table: string): Promise<Record<string, any> | null> => {
          const cacheKey = `${schema}.${table}`;
          if (rowCache.has(cacheKey)) {
            return rowCache.get(cacheKey) ?? null;
          }

          const fromName = schema === "public" ? table : `${schema}.${table}`;
          let row: Record<string, any> | null = null;
          const client = supabase as any;

          try {
            if (table === "influencers") {
              const influencerId = resolvedInfluencerId;
              const influencerPid = influencer?.pid ?? null;
              if (influencerId) {
                const { data, error } = await client.from(fromName).select("*").eq("id", influencerId).maybeSingle();
                if (!error && data) {
                  row = data as Record<string, any>;
                }
              }
              if (!row && influencerPid) {
                const { data, error } = await client.from(fromName).select("*").eq("pid", influencerPid).maybeSingle();
                if (!error && data) {
                  row = data as Record<string, any>;
                }
              }
            } else if (table === "user_profiles") {
              const userId = campaign?.users?.[0]?.id ?? null;
              if (userId) {
                let query = client.from(fromName).select("*").eq("user_id", userId).maybeSingle();
                let { data, error } = await query;
                if (!error && data) {
                  row = data as Record<string, any>;
                } else {
                  const fallback: any = await client.from(fromName).select("*").eq("id", userId).maybeSingle();
                  if (!fallback.error && fallback.data) {
                    row = fallback.data as Record<string, any>;
                  }
                }
              }
            } else if (table === "companies") {
              const companyId = (campaign as any)?.company_id ?? null;
              if (companyId) {
                const { data, error } = await client.from(fromName).select("*").eq("id", companyId).maybeSingle();
                if (!error && data) {
                  row = data as Record<string, any>;
                }
              }
            } else if (table === "campaigns") {
              if (resolvedCampaignId) {
                const { data, error } = await client.from(fromName).select("*").eq("id", resolvedCampaignId).maybeSingle();
                if (!error && data) {
                  row = data as Record<string, any>;
                }
              }
            }
          } catch (err) {
            console.error(`Collaboration: failed to fetch ${fromName}`, err);
          }

          rowCache.set(cacheKey, row);
          return row;
        };

        const formatResolvedValue = (rawValue: any): string => {
          if (rawValue === undefined || rawValue === null) {
            return "--";
          }
          if (typeof rawValue === "string") {
            const trimmed = rawValue.trim();
            return trimmed.length ? trimmed : "--";
          }
          if (typeof rawValue === "number" || typeof rawValue === "boolean") {
            return String(rawValue);
          }
          try {
            return JSON.stringify(rawValue);
          } catch {
            return String(rawValue);
          }
        };

        const resolveDescriptorsToValue = async (
          descriptors: string[]
        ): Promise<{ display?: string; rawValues: string[] }> => {
          if (!descriptors.length) {
            return { display: undefined, rawValues: [] };
          }

          const rendered: string[] = [];
          const rawValues: string[] = [];

          for (const descriptor of descriptors) {
            if (!descriptor) {
              continue;
            }

            if (!descriptor.startsWith("source:")) {
              rendered.push(descriptor);
              rawValues.push(descriptor);
              continue;
            }

            const parsed = parseSourceDescriptor(descriptor);
            if (!parsed) {
              rendered.push(descriptor);
              continue;
            }

            const row = await fetchRow(parsed.schema, parsed.table);
            const columnLabel = parsed.column.split(".").pop() ?? parsed.column;

            if (!row) {
              rendered.push(`${columnLabel}: --`);
              continue;
            }

            const rawValue = resolveColumnValue(row, parsed.column);
            const valueText = formatResolvedValue(rawValue);
            rendered.push(`${columnLabel}: ${valueText}`);

            if (valueText && valueText !== "--") {
              rawValues.push(valueText);
            }
          }

          const displayParts = rendered.filter((value) => value && value.trim().length > 0);

          return {
            display: displayParts.length ? displayParts.join(" • ") : undefined,
            rawValues,
          };
        };

        const preparedEntries = await Promise.all(
          Array.from(collected.entries()).map(async ([key, info]) => {
            const resolved = await resolveDescriptorsToValue(info.descriptors);
            return {
              key: `var[{{${key}}}]`,
              description: info.description,
              value: resolved.display,
              rawValues: resolved.rawValues,
              editable: key === "plain_text",
              inputValue: key === "plain_text" ? "" : undefined,
            };
          })
        );

        const overrideMap = new Map<string, string>();
        try {
          const client = supabase as any;
          const baseFilters: Record<string, any> = {
            campaign_id: resolvedCampaignId ?? null,
            influencer_id: resolvedInfluencerId,
          };

          const loadOverrides = async (sessionId?: string | null) => {
            let query = client
              .from(VARIABLE_OVERRIDE_TABLE)
              .select("variable_key,value,contract_html");

            if (baseFilters.campaign_id) {
              query = query.eq("campaign_id", baseFilters.campaign_id);
            } else {
              query = query.is("campaign_id", null);
            }

            if (baseFilters.influencer_id) {
              query = query.eq("influencer_id", baseFilters.influencer_id);
            } else {
              query = query.is("influencer_id", null);
            }

            if (sessionId) {
              query = query.eq("collaboration_id", sessionId);
            } else {
              query = query.is("collaboration_id", null);
            }

            const { data, error } = await query;
            if (error) {
              console.error("Collaboration: override query error", error);
              return [];
            }
            return Array.isArray(data) ? data : [];
          };

          let overrideData: any[] = [];
          if (collaborationId) {
            overrideData = await loadOverrides(collaborationId);
          }
          if (!overrideData.length) {
            overrideData = await loadOverrides(null);
          }

          if (overrideData.length) {
            // Handle new structure: single record with all variables as JSON
            overrideData.forEach((row: any) => {
              if (row?.variable_key === "all_variables" && typeof row.value === "string") {
                // Parse JSON to get all variables
                try {
                  const variablesObj = JSON.parse(row.value);
                  Object.entries(variablesObj).forEach(([key, value]) => {
                    overrideMap.set(key, value as string | null ?? "");
                  });
                } catch (parseErr) {
                  console.error("Collaboration: Failed to parse variables JSON", parseErr);
                }
              } else if (row?.variable_key && typeof row.value === "string") {
                // Fallback for old structure (individual variable records)
                overrideMap.set(row.variable_key, row.value);
              } else if (row?.variable_key && row.value == null) {
                overrideMap.set(row.variable_key, "");
              }
            });
          }
        } catch (overrideErr) {
          console.error("Collaboration: Unable to load variable overrides", overrideErr);
        }

        const mergedEntries = preparedEntries.map((entry) => {
          if (!entry.editable) {
            return entry;
          }
          const overrideValue = overrideMap.get(entry.key);
          return {
            ...entry,
            inputValue: overrideValue ?? entry.inputValue ?? "",
          };
        });

        mergedEntries.sort((a, b) => a.key.localeCompare(b.key));

        setContractVariableEntries(mergedEntries);
      } catch (err: any) {
        console.error("Collaboration: Unable to load contract variables", err);
        setContractVariableEntries(DEFAULT_CONTRACT_VARIABLE_HINTS.map((entry) => ({ ...entry })));
        setContractContent(null);
        setContractVariablesError(err?.message ?? "Unable to fetch contract variables.");
      } finally {
        setContractVariablesLoading(false);
      }
    },
    [supabase, campaign, influencer, collaborationId, resolvedCampaignId]
  );

  useEffect(() => {
    if (!contractMeta?.id) {
      setContractVariableEntries(DEFAULT_CONTRACT_VARIABLE_HINTS.map((entry) => ({ ...entry })));
      setContractVariablesLoading(false);
      setContractVariablesError(null);
      setContractContent(null);
    }
  }, [contractMeta?.id, collaborationId]);

  const handleFillContract = () => {
    if (!campaign) {
      toast({
        title: "No campaign selected",
        description: "Select or load a campaign before filling a contract.",
        variant: "destructive",
      });
      return;
    }

    if (contractMeta?.id) {
      void loadContractVariables(contractMeta.id);
    } else {
      setContractVariableEntries(DEFAULT_CONTRACT_VARIABLE_HINTS.map((entry) => ({ ...entry })));
      setContractVariablesError(null);
      setContractContent(null);
    }

    setIsVariableSheetOpen(true);
  };

  const handleViewContract = async () => {
    if (!collaborationId) {
      toast({
        title: "No collaboration ID",
        description: "Cannot view contract without a collaboration ID.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingSavedContract(true);
    setIsViewContractOpen(true);

    try {
      const client = supabase as any;
      const { data, error } = await client
        .from(VARIABLE_OVERRIDE_TABLE)
        .select("contract_html")
        .eq("collaboration_id", collaborationId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data && data.contract_html) {
        setSavedContractHtml(data.contract_html);
      } else {
        toast({
          title: "No saved contract found",
          description: "Please update the contract first to view it.",
          variant: "destructive",
        });
        setSavedContractHtml(null);
      }
    } catch (err: any) {
      console.error("Collaboration: Failed to load saved contract", err);
      toast({
        title: "Unable to load contract",
        description: err?.message || "Failed to fetch the saved contract.",
        variant: "destructive",
      });
      setSavedContractHtml(null);
    } finally {
      setIsLoadingSavedContract(false);
    }
  };

  const extractBodyContent = (html: string | null): string => {
    if (!html) return "";
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const body = doc.body;
      if (body) {
        // Check if there's a tiptap-rendered div inside contract-preview-container
        const tiptapDiv = body.querySelector('.contract-preview-container .tiptap-rendered') || 
                         body.querySelector('.tiptap-rendered');
        if (tiptapDiv) {
          // Extract content from within tiptap-rendered div
          return tiptapDiv.innerHTML;
        }
        // Fallback to body innerHTML
        return body.innerHTML;
      }
      return html;
    } catch {
      return html;
    }
  };

  const extractStylesFromHtml = (html: string | null): { css: string; links: string } => {
    if (!html) return { css: "", links: "" };
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const head = doc.head;
      if (!head) return { css: "", links: "" };
      
      let css = "";
      const styleTags = head.querySelectorAll("style");
      styleTags.forEach((tag) => {
        css += tag.textContent || "";
        css += "\n";
      });
      
      let links = "";
      const linkTags = head.querySelectorAll('link[rel="stylesheet"]');
      linkTags.forEach((tag) => {
        links += tag.outerHTML + "\n";
      });
      
      return { css, links };
    } catch {
      return { css: "", links: "" };
    }
  };

  const handlePrintContract = async () => {
    if (!savedContractHtml) {
      toast({
        title: "No contract to print",
        description: "Please load the contract first.",
        variant: "destructive",
      });
      return;
    }

    let container: HTMLDivElement | null = null;
    let style: HTMLStyleElement | null = null;
    
    try {
      // Create a temporary container for the contract content (exactly like Contract page)
      container = document.createElement('div');
      container.id = 'contract-print-container';
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '210mm'; // A4 width
      container.style.padding = '20mm';
      container.style.backgroundColor = '#fff';
      
      // Parse the saved HTML
      const parser = new DOMParser();
      const parsedDoc = parser.parseFromString(savedContractHtml, 'text/html');
      
      // Extract styles from the saved HTML and add to container (like Contract page)
      const styles = parsedDoc.head ? Array.from(parsedDoc.head.querySelectorAll('style, link[rel="stylesheet"]')) : [];
      styles.forEach((styleNode) => {
        container!.appendChild(styleNode.cloneNode(true));
      });
      
      // Extract body content directly (like Contract page)
      // The saved HTML already has contract-preview-container structure, so use it directly
      const bodyContent = parsedDoc.body ? parsedDoc.body.innerHTML : savedContractHtml;
      
      // Create content wrapper (like Contract page)
      const contentWrapper = document.createElement('div');
      contentWrapper.style.padding = '0';
      contentWrapper.style.backgroundColor = '#ffffff';
      
      // Use body content directly - it already has the proper structure
      if (bodyContent && bodyContent.trim()) {
        contentWrapper.innerHTML = bodyContent;
        container.appendChild(contentWrapper);
      } else {
        throw new Error('No contract content found in saved HTML');
      }
      
      // CRITICAL: Don't add custom line-height or margins
      // Preserve only what's already in the contract HTML
      // The original styles from saved HTML will be applied via extracted styles
      
      // CRITICAL: Preserve image wrapper attributes (data-alignment) before processing images
      // This ensures alignment is maintained during print
      const imageWrappers = Array.from(container.querySelectorAll('.tiptap-image-wrapper, [class*="image-wrapper"]')) as HTMLElement[];
      imageWrappers.forEach(wrapper => {
        // Ensure data-alignment attribute is preserved
        const alignment = wrapper.getAttribute('data-alignment');
        if (alignment) {
          wrapper.setAttribute('data-alignment', alignment);
          // Also set inline style to ensure it's preserved
          const currentStyle = wrapper.getAttribute('style') || '';
          if (!currentStyle.includes('text-align')) {
            wrapper.setAttribute('style', `${currentStyle}; text-align: ${alignment};`.trim());
          }
        } else {
          // If no alignment, default to left (but check parent)
          const parentAlignment = wrapper.parentElement?.getAttribute('data-alignment');
          if (parentAlignment) {
            wrapper.setAttribute('data-alignment', parentAlignment);
          } else {
            wrapper.setAttribute('data-alignment', 'left');
          }
        }
        console.log('Collaboration: Image wrapper alignment:', wrapper.getAttribute('data-alignment'), wrapper.outerHTML.substring(0, 200));
      });
      
      // Handle images - convert to data URLs if needed (exactly like Contract page)
      // CRITICAL: Preserve all original attributes and styles to maintain positioning
      const images = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
      await Promise.all(
        images.map(async (img) => {
          // Preserve all original attributes before modifying src
          const originalSrc = img.getAttribute('src');
          const originalStyle = img.getAttribute('style') || '';
          const originalClass = img.getAttribute('class') || '';
          const originalId = img.getAttribute('id') || '';
          const originalAlt = img.getAttribute('alt') || '';
          const originalTitle = img.getAttribute('title') || '';
          
          // Preserve all data-* attributes
          const dataAttributes: Record<string, string> = {};
          Array.from(img.attributes).forEach(attr => {
            if (attr.name.startsWith('data-')) {
              dataAttributes[attr.name] = attr.value;
            }
          });
          
          // CRITICAL: Preserve parent wrapper's data-alignment if image doesn't have it
          const parentWrapper = img.closest('.tiptap-image-wrapper, [class*="image-wrapper"]');
          if (parentWrapper) {
            const wrapperAlignment = parentWrapper.getAttribute('data-alignment');
            if (wrapperAlignment && !img.getAttribute('data-alignment')) {
              img.setAttribute('data-alignment', wrapperAlignment);
            }
          }
          
          if (originalSrc && !originalSrc.startsWith('data:')) {
            try {
              const response = await fetch(originalSrc, { mode: 'cors' });
              if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status}`);
              }
              const blob = await response.blob();
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error('Failed to convert image to data URL'));
                reader.readAsDataURL(blob);
              });
              
              // Update src but preserve all other attributes
              img.src = dataUrl;
              
              // Restore all preserved attributes
              if (originalStyle) img.setAttribute('style', originalStyle);
              if (originalClass) img.setAttribute('class', originalClass);
              if (originalId) img.setAttribute('id', originalId);
              if (originalAlt) img.setAttribute('alt', originalAlt);
              if (originalTitle) img.setAttribute('title', originalTitle);
              
              // Restore data-* attributes
              Object.entries(dataAttributes).forEach(([name, value]) => {
                img.setAttribute(name, value);
              });
            } catch (error) {
              console.warn('Collaboration: unable to inline image for printing', error);
            }
          }

          await new Promise<void>((resolve) => {
            const handleResolve = () => {
              img.removeEventListener('load', handleResolve);
              img.removeEventListener('error', handleResolve);
              resolve();
            };

            if (img.complete) {
              resolve();
            } else {
              img.addEventListener('load', handleResolve, { once: true });
              img.addEventListener('error', handleResolve, { once: true });
            }
          });
        })
      );
      
      // Add container to body
      document.body.appendChild(container);
      
      // Make container visible but off-screen for rendering
      // This ensures content is fully rendered before print
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '210mm';
      
      // Add print-only stylesheet to hide everything except our container
      const printOnlyStyle = document.createElement('style');
      printOnlyStyle.id = 'contract-print-only-styles';
      printOnlyStyle.textContent = `
        /* Ensure container is rendered (off-screen) */
        #contract-print-container {
          position: absolute;
          left: -9999px;
          top: 0;
          width: 210mm;
          padding: 20mm;
          background: white;
        }
        
        @media print {
          @page {
            margin: 1.5cm;
            size: A4;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          body > *:not(#contract-print-container) {
            display: none !important;
          }
          #contract-print-container {
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            visibility: visible !important;
            background: white !important;
            page-break-inside: auto !important;
          }
          /* Ensure content wrapper doesn't interfere with alignment */
          #contract-print-container > div {
            width: 100% !important;
            /* Don't set text-align here - let children control their own alignment */
          }
          #contract-print-container * {
            visibility: visible !important;
          }
          /* CRITICAL: Preserve original styles from contract - don't override line-height or margins */
          /* Only ensure visibility and basic display properties */
          #contract-print-container .tiptap-rendered,
          #contract-print-container [class*="tiptap-rendered"],
          #contract-print-container div.tiptap-rendered,
          #contract-print-container div[class*="tiptap-rendered"] {
            /* Don't set line-height - preserve original from contract */
            /* Don't set font-size - preserve original from contract */
            /* Don't set color - preserve original from contract */
            word-break: break-word !important;
            visibility: visible !important;
          }
          /* CRITICAL: Preserve paragraph spacing from original contract - don't force margins */
          #contract-print-container .tiptap-rendered p,
          #contract-print-container [class*="tiptap-rendered"] p,
          #contract-print-container div.tiptap-rendered p,
          #contract-print-container div[class*="tiptap-rendered"] p,
          #contract-print-container p {
            /* Don't set margin - preserve original from contract */
            /* Don't set line-height - preserve original from contract */
            padding: 0 !important;
            display: block !important;
            visibility: visible !important;
          }
          /* CRITICAL: Preserve heading styles from original contract - don't force values */
          #contract-print-container .tiptap-rendered h1,
          #contract-print-container .tiptap-rendered h2,
          #contract-print-container .tiptap-rendered h3,
          #contract-print-container .tiptap-rendered h4,
          #contract-print-container .tiptap-rendered h5,
          #contract-print-container .tiptap-rendered h6,
          #contract-print-container [class*="tiptap-rendered"] h1,
          #contract-print-container [class*="tiptap-rendered"] h2,
          #contract-print-container [class*="tiptap-rendered"] h3,
          #contract-print-container [class*="tiptap-rendered"] h4,
          #contract-print-container [class*="tiptap-rendered"] h5,
          #contract-print-container [class*="tiptap-rendered"] h6 {
            /* Don't set margin - preserve original from contract */
            /* Don't set line-height - preserve original from contract */
            /* Don't set font-size - preserve original from contract */
            display: block !important;
            visibility: visible !important;
          }
          /* CRITICAL: Preserve list styles from original contract - don't force values */
          #contract-print-container .tiptap-rendered ul,
          #contract-print-container .tiptap-rendered ol,
          #contract-print-container [class*="tiptap-rendered"] ul,
          #contract-print-container [class*="tiptap-rendered"] ol {
            /* Don't set margin - preserve original from contract */
            /* Don't set padding - preserve original from contract */
            display: block !important;
            visibility: visible !important;
          }
          /* CRITICAL: Preserve table styles from original contract - don't force values */
          #contract-print-container .tiptap-rendered table,
          #contract-print-container [class*="tiptap-rendered"] table {
            /* Don't set margin - preserve original from contract */
            /* Don't set font-size - preserve original from contract */
            display: table !important;
            visibility: visible !important;
          }
          /* CRITICAL: Preserve blockquote styles from original contract - don't force values */
          #contract-print-container .tiptap-rendered blockquote,
          #contract-print-container [class*="tiptap-rendered"] blockquote {
            /* Don't set margin - preserve original from contract */
            /* Don't set padding - preserve original from contract */
            /* Don't set border - preserve original from contract */
            display: block !important;
            visibility: visible !important;
          }
          /* CRITICAL: Preserve pre/code styles from original contract - don't force values */
          #contract-print-container .tiptap-rendered pre,
          #contract-print-container [class*="tiptap-rendered"] pre {
            /* Don't set margin - preserve original from contract */
            /* Don't set padding - preserve original from contract */
            display: block !important;
            visibility: visible !important;
          }
          /* CRITICAL: Preserve line breaks */
          #contract-print-container .tiptap-rendered br,
          #contract-print-container [class*="tiptap-rendered"] br {
            display: inline !important;
            visibility: visible !important;
          }
          /* CRITICAL: Ensure box-sizing but don't override line-height or spacing */
          #contract-print-container .tiptap-rendered *,
          #contract-print-container [class*="tiptap-rendered"] * {
            box-sizing: border-box !important;
            /* Don't set line-height - preserve original from contract */
          }
          /* Ensure proper spacing between all block elements */
          #contract-print-container .tiptap-rendered > * + *,
          #contract-print-container [class*="tiptap-rendered"] > * + * {
            /* This ensures spacing between sibling elements */
          }
          /* Ensure all content elements are visible */
          /* CRITICAL: Only set display for elements without inline styles to preserve positioning */
          #contract-print-container div:not([style*="display"]):not(.tiptap-rendered):not([class*="tiptap-rendered"]) {
            display: block !important;
            visibility: visible !important;
          }
          #contract-print-container span:not([style*="display"]) {
            display: inline !important;
            visibility: visible !important;
          }
          /* CRITICAL: Preserve image positioning - don't override inline styles */
          #contract-print-container img {
            visibility: visible !important;
            /* Only set display if not already set in inline style */
          }
          #contract-print-container img:not([style*="display"]) {
            display: inline-block !important;
          }
          /* CRITICAL: Preserve image wrapper positioning (tiptap-image-wrapper) */
          /* These styles MUST match the original contract styles */
          #contract-print-container .tiptap-image-wrapper,
          #contract-print-container [class*="image-wrapper"],
          #contract-print-container div.tiptap-image-wrapper,
          #contract-print-container div[class*="image-wrapper"] {
            display: block !important;
            margin: 18px 0 !important;
            visibility: visible !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          /* CRITICAL: Preserve alignment using data-alignment attribute - HIGHEST PRIORITY */
          #contract-print-container .tiptap-image-wrapper[data-alignment="right"],
          #contract-print-container [class*="image-wrapper"][data-alignment="right"],
          #contract-print-container div.tiptap-image-wrapper[data-alignment="right"],
          #contract-print-container div[class*="image-wrapper"][data-alignment="right"],
          #contract-print-container *[data-alignment="right"].tiptap-image-wrapper {
            text-align: right !important;
            display: block !important;
          }
          #contract-print-container .tiptap-image-wrapper[data-alignment="center"],
          #contract-print-container [class*="image-wrapper"][data-alignment="center"],
          #contract-print-container div.tiptap-image-wrapper[data-alignment="center"],
          #contract-print-container div[class*="image-wrapper"][data-alignment="center"],
          #contract-print-container *[data-alignment="center"].tiptap-image-wrapper {
            text-align: center !important;
            display: block !important;
          }
          #contract-print-container .tiptap-image-wrapper[data-alignment="left"],
          #contract-print-container [class*="image-wrapper"][data-alignment="left"],
          #contract-print-container div.tiptap-image-wrapper[data-alignment="left"],
          #contract-print-container div[class*="image-wrapper"][data-alignment="left"],
          #contract-print-container *[data-alignment="left"].tiptap-image-wrapper {
            text-align: left !important;
            display: block !important;
          }
          /* Also handle inline style text-align if present */
          #contract-print-container .tiptap-image-wrapper[style*="text-align: center"],
          #contract-print-container [class*="image-wrapper"][style*="text-align: center"] {
            text-align: center !important;
          }
          #contract-print-container .tiptap-image-wrapper[style*="text-align: right"],
          #contract-print-container [class*="image-wrapper"][style*="text-align: right"] {
            text-align: right !important;
          }
          #contract-print-container .tiptap-image-wrapper[style*="text-align: left"],
          #contract-print-container [class*="image-wrapper"][style*="text-align: left"] {
            text-align: left !important;
          }
          /* Ensure image inside wrapper maintains inline-block */
          #contract-print-container .tiptap-image-wrapper img,
          #contract-print-container [class*="image-wrapper"] img,
          #contract-print-container div.tiptap-image-wrapper img,
          #contract-print-container div[class*="image-wrapper"] img {
            display: inline-block !important;
            max-width: 100% !important;
            visibility: visible !important;
            margin: 0 !important;
          }
          #contract-print-container table:not([style*="display"]) {
            display: table !important;
            visibility: visible !important;
          }
          #contract-print-container tr:not([style*="display"]) {
            display: table-row !important;
            visibility: visible !important;
          }
          #contract-print-container td:not([style*="display"]),
          #contract-print-container th:not([style*="display"]) {
            display: table-cell !important;
            visibility: visible !important;
          }
          /* Preserve all spacing, margins, padding, and positioning from original contract */
          #contract-print-container * {
            /* Don't override any margin, padding, float, position, text-align, etc. */
            /* Only ensure visibility */
          }
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `;
      document.head.appendChild(printOnlyStyle);
      
      // Wait for everything to render
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify container has content
      const containerContent = container.innerHTML.trim();
      if (!containerContent || containerContent.length === 0) {
        console.error('Collaboration: Container is empty', {
          containerHTML: container.outerHTML.substring(0, 500),
          savedHtmlLength: savedContractHtml?.length,
          bodyContentLength: bodyContent?.length
        });
        throw new Error('Container is empty - cannot print');
      }
      
      // Verify contentWrapper has content
      const contentWrapperEl = container.querySelector('div');
      if (!contentWrapperEl || !contentWrapperEl.innerHTML.trim()) {
        console.error('Collaboration: Content wrapper is empty', {
          containerHTML: container.outerHTML.substring(0, 500)
        });
        throw new Error('Content wrapper is empty - cannot print');
      }
      
      // Force multiple reflows to ensure rendering
      void container.offsetHeight;
      void container.scrollHeight;
      void container.clientHeight;
      
      // Use requestAnimationFrame to ensure browser has painted
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            void container!.offsetHeight;
            resolve(undefined);
          });
        });
      });
      
      // Final wait
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Print
      window.print();
      
      // Cleanup after printing
      setTimeout(() => {
        if (container && container.parentNode) {
          document.body.removeChild(container);
        }
        const printStyleEl = document.getElementById('contract-print-only-styles');
        if (printStyleEl && document.head.contains(printStyleEl)) {
          document.head.removeChild(printStyleEl);
        }
      }, 1000);
      
    } catch (error: any) {
      console.error('Collaboration: Error printing contract', error);
      toast({
        title: "Print error",
        description: error.message || "Failed to print contract. Please try again.",
        variant: "destructive",
      });
      
      // Cleanup on error
      if (container && container.parentNode) {
        document.body.removeChild(container);
      }
      const printStyleEl = document.getElementById('contract-print-only-styles');
      if (printStyleEl && document.head.contains(printStyleEl)) {
        document.head.removeChild(printStyleEl);
      }
    }
  };

  const formatCallbackTime = (value: string) => {
    if (!value) {
      return "";
    }

    const [hours, minutes] = value.split(":").map((part) => Number(part));

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return value;
    }

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatCallbackDate = (value: string) => {
    if (!value) {
      return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleActionSubmit = async () => {
    if (!selectedAction) {
      toast({
        title: "No action selected",
        description: "Choose one of the available options before saving.",
        variant: "destructive",
      });
      return;
    }

    if (selectedAction === "callback" && (!callbackDate || !callbackTime)) {
      toast({
        title: "Callback time required",
        description: "Please select a date and time for the callback.",
        variant: "destructive",
      });
      return;
    }

    const timestamp = new Date().toLocaleString();
    const label = ACTION_LABELS[selectedAction as ActionOption] ?? "Action recorded";

    const remarkParts: string[] = [];

    if (selectedAction === "callback" && callbackDate && callbackTime) {
      remarkParts.push(
        `Callback scheduled for ${formatCallbackDate(callbackDate)} at ${formatCallbackTime(callbackTime)}`
      );
    }

    const userRemark = actionRemark.trim();
    if (userRemark) {
      remarkParts.push(userRemark);
    }

    // Always save the remark if user entered one, or if there's callback info
    const finalRemark = remarkParts.length > 0 ? remarkParts.join(" | ") : null;

    console.log("Collaboration: Saving action with remark:", {
      actionRemark: actionRemark,
      userRemark: userRemark,
      remarkParts,
      finalRemark,
      willSaveRemark: finalRemark !== null,
    });

    const snapshotToPersist: ActionSnapshot = {
      action: selectedAction,
      callbackDate: selectedAction === "callback" ? callbackDate : "",
      callbackTime: selectedAction === "callback" ? callbackTime : "",
      remark: actionRemark.trim(),
    };

    if (!campaignKey || !influencer?.id || !currentUserId) {
      toast({
        title: "Missing data",
        description: "Campaign, influencer, or user context is missing. Reload and try again.",
        variant: "destructive",
      });
      return;
    }

    if (!resolvedCampaignId) {
      toast({
        title: "Missing campaign identifier",
        description: "This campaign does not have a valid ID. Please reload or revisit from the campaigns list.",
        variant: "destructive",
      });
      return;
    }

    const influencerKey = influencer?.pid ?? influencer.id ?? "none";
    const contractKey = resolvedContractPid ?? contractMeta?.id ?? "none";
    const collabId = collaborationId ?? `${campaignKey}-${influencerKey}-${contractKey}`;

    try {
      let effectiveUserId = currentUserId;
      if (!effectiveUserId) {
        try {
          const { data } = await supabase.auth.getUser();
          effectiveUserId = data?.user?.id ?? null;
        } catch (authErr) {
          console.error("Collaboration: Unable to fetch auth user", authErr);
        }
      }

      const baseData: {
        campaign_id: string;
        influencer_id: string | null;
        user_id: string | null;
        action: string;
        remark: string | null;
        occurred_at: string;
        collaboration_id: string;
      } = {
        campaign_id: resolvedCampaignId,
        influencer_id: resolvedInfluencerId,
        user_id: effectiveUserId,
        action: selectedAction,
        remark: finalRemark || null, // Explicitly set to null if empty
        occurred_at: new Date().toISOString(),
        collaboration_id: collabId,
      };

      console.log("Collaboration: baseData being saved:", baseData);

      const client = supabase as any;

      console.log("Collaboration: Upserting with collaboration_id as unique key:", collabId);
      
      // Explicitly set remark in the payload
      const upsertPayload = {
        ...baseData,
        remark: finalRemark || null, // Always explicitly set remark
      };
      
      console.log("Collaboration: Upsert payload:", JSON.stringify(upsertPayload, null, 2));
      
      // Use upsert with collaboration_id as unique key - this will update existing entry or insert new one
      const { data: resultData, error: upsertError } = await client
        .from("collaboration_actions")
        .upsert(upsertPayload, {
          onConflict: "collaboration_id",
        })
        .select();
      
      if (upsertError) {
        console.error("Collaboration: Failed to upsert action", upsertError);
        throw upsertError;
      }
      
      console.log("Collaboration: ✓ Action upserted successfully (updated existing or created new), returned data:", resultData);
      
      // Verify the remark was saved correctly
      if (resultData && resultData.length > 0) {
        const savedRemark = resultData[0]?.remark;
        console.log("Collaboration: Saved remark in database:", savedRemark);
        console.log("Collaboration: Expected remark:", finalRemark);
        if (savedRemark !== finalRemark) {
          console.warn("Collaboration: WARNING - Remark mismatch! Expected:", finalRemark, "Got:", savedRemark);
        } else {
          console.log("Collaboration: ✓ Remark successfully saved/updated in database");
        }
      }

      setLastAction({
        label,
        timestamp,
        remark: finalRemark,
      });

      // Log to timeline
      await logTimelineEntry(
        'action_taken',
        label,
        finalRemark || null,
        selectedAction,
        { timestamp }
      );

      // Refresh collaboration actions
      await fetchCollaborationActions();

      toast({
        title: "Action saved",
        description: label,
      });

      setActionBaseline({ ...snapshotToPersist });
      setActionRemark(snapshotToPersist.remark);
      setCallbackDate(snapshotToPersist.callbackDate);
      setCallbackTime(snapshotToPersist.callbackTime);
    } catch (error: any) {
      console.error("Collaboration: Error while saving action", error);
      toast({
        title: "Unable to save action",
        description: error?.message ?? "An unexpected error occurred while saving the action.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateContractPreview = async () => {
    if (!contractContent) {
      toast({
        title: "No contract content",
        description: "This contract does not have any content to preview.",
        variant: "destructive",
      });
      return;
    }

    if (!resolvedCampaignId) {
      toast({
        title: "Missing campaign identifier",
        description: "Cannot update overrides without a valid campaign ID.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPreview(true);
    try {
      if (!collaborationId) {
        toast({
          title: "Missing collaboration ID",
          description: "Cannot update contract without a collaboration ID.",
          variant: "destructive",
        });
        return;
      }

      let previewHtml = contractContent;
      const variablesMap: Record<string, string | null> = {};

      contractVariableEntries.forEach((entry) => {
        const placeholder = entry.key;
        let values: string[] = [];

        if (entry.editable) {
          const input = entry.inputValue?.trim() ?? "";
          values = input ? [input] : [];
        } else if (entry.rawValues && entry.rawValues.length) {
          values = entry.rawValues;
        } else if (entry.value) {
          values = [entry.value];
        }

        const sanitizedValues = values.map((value) =>
          escapeHtml(value).replace(/\r?\n/g, "<br />")
        );
        const replacement = sanitizedValues.length
          ? sanitizedValues.join("<br />")
          : "--";
        const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        previewHtml = previewHtml.replace(new RegExp(escapedPlaceholder, "g"), replacement);

        // Store variable value for saving
        const storedValue = entry.editable
          ? entry.inputValue?.trim() ?? null
          : entry.rawValues && entry.rawValues.length
          ? entry.rawValues.join("\n")
          : entry.value ?? null;
        
        variablesMap[entry.key] = storedValue && storedValue.length ? storedValue : null;
      });

      previewHtml = previewHtml.replace(/var\[\s*\{\{[^}]+\}\}\s*\]/g, "--");

      // Extract all existing styles and links from the original contract content
      let extractedStyles = "";
      let extractedLinks = "";
      let cleanedHtml = previewHtml;

      // Use original contract content to extract all styles (before extraction)
      const sourceContent = originalContractContent || contractContent || "";

      // Extract <style> tags from original content
      const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
      let styleMatch;
      const styleMatches: string[] = [];
      while ((styleMatch = styleRegex.exec(sourceContent)) !== null) {
        styleMatches.push(styleMatch[0]);
        extractedStyles += styleMatch[0] + "\n";
      }

      // Extract <link> tags for stylesheets
      const linkRegex = /<link[^>]*rel=["']stylesheet["'][^>]*>/gi;
      let linkMatch;
      while ((linkMatch = linkRegex.exec(sourceContent)) !== null) {
        extractedLinks += linkMatch[0] + "\n";
      }

      // Extract <style> tags from previewHtml as well (in case they were preserved)
      const previewStyleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
      let previewStyleMatch;
      const previewStyles: string[] = [];
      while ((previewStyleMatch = previewStyleRegex.exec(previewHtml)) !== null) {
        previewStyles.push(previewStyleMatch[0]);
        cleanedHtml = cleanedHtml.replace(previewStyleMatch[0], "");
      }

      // Combine all extracted styles (avoid duplicates)
      const allStylesSet = new Set([...styleMatches, ...previewStyles]);
      const allStyles = Array.from(allStylesSet).join("\n");

      // Wrap HTML in complete document structure with all original styles preserved
      // Base styles are added first, then extracted styles will override them if needed
      // Include contract-preview-container styles to match preview window exactly
      const completeHtmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contract Document</title>
  ${extractedLinks}
  <style>
    /* Base fallback styles */
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11.5pt;
      line-height: 1.7;
      color: #111827;
      word-break: break-word;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
    }
    
    /* Contract preview container styles - matches preview window exactly */
    .contract-preview-container {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 24px;
      border: 1px solid #e2e8f0;
      padding: 24px;
      box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);
    }
    
    .contract-preview-container .tiptap-rendered {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11.5pt;
      line-height: 1.7;
      color: #111827;
      word-break: break-word;
    }

    .contract-preview-container .tiptap-rendered strong {
      font-weight: 600;
    }

    .contract-preview-container .tiptap-rendered em {
      font-style: italic;
    }

    .contract-preview-container .tiptap-rendered u {
      text-decoration: underline;
    }

    .contract-preview-container .tiptap-rendered s {
      text-decoration: line-through;
    }

    .contract-preview-container .tiptap-rendered mark {
      background-color: #fef08a;
      padding: 0 2px;
      border-radius: 2px;
    }

    .contract-preview-container .tiptap-rendered p {
      margin: 0 0 14px;
    }

    .contract-preview-container .tiptap-rendered h1,
    .contract-preview-container .tiptap-rendered h2,
    .contract-preview-container .tiptap-rendered h3,
    .contract-preview-container .tiptap-rendered h4,
    .contract-preview-container .tiptap-rendered h5,
    .contract-preview-container .tiptap-rendered h6 {
      margin: 26px 0 14px;
      font-weight: 600;
      line-height: 1.3;
    }

    .contract-preview-container .tiptap-rendered h1 { font-size: 30px; }
    .contract-preview-container .tiptap-rendered h2 { font-size: 24px; }
    .contract-preview-container .tiptap-rendered h3 { font-size: 20px; }
    .contract-preview-container .tiptap-rendered h4 { font-size: 18px; }
    .contract-preview-container .tiptap-rendered h5 { font-size: 16px; }
    .contract-preview-container .tiptap-rendered h6 { font-size: 14px; }

    .contract-preview-container .tiptap-rendered ul,
    .contract-preview-container .tiptap-rendered ol {
      margin: 0 0 14px 26px;
      padding: 0;
    }

    .contract-preview-container .tiptap-rendered ul { list-style: disc; }
    .contract-preview-container .tiptap-rendered ul ul { list-style: circle; }
    .contract-preview-container .tiptap-rendered ul ul ul { list-style: square; }

    .contract-preview-container .tiptap-rendered ol { list-style: decimal; }
    .contract-preview-container .tiptap-rendered ol ol { list-style: lower-alpha; }
    .contract-preview-container .tiptap-rendered ol ol ol { list-style: lower-roman; }

    .contract-preview-container .tiptap-rendered li {
      margin: 0 0 8px;
    }

    .contract-preview-container .tiptap-rendered blockquote {
      margin: 14px 0;
      padding: 12px 18px;
      border-left: 4px solid #d1d5db;
      background-color: #f9fafb;
      color: #6b7280;
    }

    .contract-preview-container .tiptap-rendered table {
      width: 100%;
      border-collapse: collapse;
      margin: 18px 0;
      font-size: 10.5pt;
    }

    .contract-preview-container .tiptap-rendered table th,
    .contract-preview-container .tiptap-rendered table td {
      border: 1px solid #d1d5db;
      padding: 10px;
      text-align: left;
      vertical-align: top;
    }

    .contract-preview-container .tiptap-rendered table thead th {
      background-color: #f3f4f6;
      font-weight: 600;
    }

    .contract-preview-container .tiptap-rendered pre {
      background-color: #1f2937;
      color: #f9fafb;
      padding: 14px;
      border-radius: 8px;
      margin: 14px 0;
      font-family: 'Courier New', monospace;
      font-size: 10pt;
      white-space: pre-wrap;
    }

    .contract-preview-container .tiptap-rendered code {
      font-family: 'Courier New', monospace;
      font-size: 10pt;
      background-color: #f3f4f6;
      padding: 2px 4px;
      border-radius: 4px;
    }

    .contract-preview-container .tiptap-rendered pre code {
      background: transparent;
      padding: 0;
    }

    .contract-preview-container .tiptap-rendered a {
      color: #2563eb;
      text-decoration: underline;
    }

    .contract-preview-container .tiptap-rendered hr {
      border: 0;
      border-top: 1px solid #d1d5db;
      margin: 28px 0;
    }

    .contract-preview-container .tiptap-rendered .text-left,
    .contract-preview-container .tiptap-rendered .has-text-align-left,
    .contract-preview-container .tiptap-rendered [style*='text-align: left'] {
      text-align: left !important;
    }

    .contract-preview-container .tiptap-rendered .text-center,
    .contract-preview-container .tiptap-rendered .has-text-align-center,
    .contract-preview-container .tiptap-rendered [style*='text-align: center'] {
      text-align: center !important;
    }

    .contract-preview-container .tiptap-rendered .text-right,
    .contract-preview-container .tiptap-rendered .has-text-align-right,
    .contract-preview-container .tiptap-rendered [style*='text-align: right'] {
      text-align: right !important;
    }

    .contract-preview-container .tiptap-rendered .text-justify,
    .contract-preview-container .tiptap-rendered .has-text-align-justify,
    .contract-preview-container .tiptap-rendered [style*='text-align: justify'] {
      text-align: justify !important;
    }

    .contract-preview-container .tiptap-rendered .tiptap-image-wrapper {
      display: block;
      margin: 18px 0;
    }

    .contract-preview-container .tiptap-rendered .tiptap-image-wrapper[data-alignment="right"] {
      text-align: right;
    }

    .contract-preview-container .tiptap-rendered .tiptap-image-wrapper[data-alignment="center"] {
      text-align: center;
    }

    .contract-preview-container .tiptap-rendered .tiptap-image-wrapper[data-alignment="left"] {
      text-align: left;
    }

    .contract-preview-container .tiptap-rendered .tiptap-image-wrapper img {
      display: inline-block;
      max-width: 100%;
      height: auto;
      margin: 0;
    }

    .contract-preview-container .tiptap-rendered img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 18px 0;
    }
    
    /* Print-specific styles - preserve preview appearance */
    @media print {
      body {
        padding: 0;
        margin: 0;
        max-width: 100%;
        background: #ffffff;
      }
      @page {
        margin: 1cm;
      }
      .contract-preview-container {
        background: #ffffff !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        border-radius: 0 !important;
      }
      .contract-preview-container .tiptap-rendered {
        padding: 0;
      }
      img {
        max-width: 100% !important;
        height: auto !important;
        page-break-inside: avoid;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
  ${allStyles}
</head>
<body>
  <div class="contract-preview-container">
    <div class="tiptap-rendered">
      ${cleanedHtml}
              </div>
            </div>
</body>
</html>`;

      setContractPreviewHtml(previewHtml);
      setIsPreviewOpen(true);

      // Save all variables in a single entry with complete HTML
      const persistOverrides = async () => {
        try {
          const client = supabase as any;
          
          // Create a single record with all variables as JSON and complete HTML
          const singleOverrideRecord = {
            campaign_id: resolvedCampaignId,
            influencer_id: resolvedInfluencerId,
            collaboration_id: collaborationId,
            variable_key: "all_variables", // Use a single key to represent all variables
            value: JSON.stringify(variablesMap), // Store all variables as JSON
            contract_html: completeHtmlDocument, // Store complete HTML document with variables replaced
          };

          const { error } = await client
            .from(VARIABLE_OVERRIDE_TABLE)
            .upsert(singleOverrideRecord, { onConflict: "collaboration_id" });

          if (error) {
            console.error("Collaboration: Failed to upsert variable overrides", error);
            toast({
              title: "Failed to save contract",
              description: "Could not save the updated contract to the database.",
              variant: "destructive",
            });
          } else {
            // Log to timeline after successfully saving overrides
            const variableCount = Object.keys(variablesMap).length;
            await logTimelineEntry(
              'contract_updated',
              `Contract updated with ${variableCount} variable${variableCount !== 1 ? 's' : ''}`,
              null,
              null,
              { 
                variable_count: variableCount,
                variable_keys: Object.keys(variablesMap)
              }
            );
            console.log("Collaboration: ✓ Contract and variables saved successfully");
          }
        } catch (overrideErr) {
          console.error("Collaboration: Exception while saving overrides", overrideErr);
          toast({
            title: "Error saving contract",
            description: "An error occurred while saving the contract.",
            variant: "destructive",
          });
        }
      };

      await persistOverrides();
    } catch (error) {
      console.error("Collaboration: failed to build contract preview", error);
      toast({
        title: "Unable to update contract",
        description: "Something went wrong while preparing the contract preview.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  return (
    <>
      <Sheet
        open={isVariableSheetOpen}
        onOpenChange={(open) => {
          setIsVariableSheetOpen(open);
        }}
      >
        <SheetContent side="right" className="flex h-full max-h-screen w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Available Contract Variables</SheetTitle>
            <SheetDescription asChild>
              <div className="space-y-2 text-left">
                <p>
                  {contractMeta?.name
                    ? `These placeholders are currently configured for ${contractMeta.name}.`
                    : "These are the default variables you can use inside the contract template."}
                </p>
                {!contractVariablesLoading && (
                  <p className="text-xs text-slate-500">
                    Found {contractVariableEntries.length} placeholder
                    {contractVariableEntries.length === 1 ? "" : "s"}.
                  </p>
                )}
                </div>
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 flex-1 overflow-hidden">
            <div className="flex h-full flex-col space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Insert these tokens into the contract to auto-fill details from the campaign and platform.
                  </div>
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-3">
                  {contractVariablesLoading ? (
                    <div className="flex items-center justify-center py-6 text-sm text-slate-500">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading contract variables...
                          </div>
                  ) : contractVariablesError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {contractVariablesError}
                        </div>
                  ) : contractVariableEntries.length ? (
                    contractVariableEntries.map((item) => (
                      <div key={item.key} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm space-y-1">
                        <p className="font-semibold text-slate-800">{item.key}</p>
                        {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
                        {item.editable ? (
                          <Input
                            placeholder="Enter replacement text"
                            value={item.inputValue ?? ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              setContractVariableEntries((prev) =>
                                prev.map((entry) =>
                                  entry.key === item.key
                                    ? {
                                        ...entry,
                                        inputValue: value,
                                      }
                                    : entry
                                )
                              );
                            }}
                          />
                        ) : (
                          item.value && <p className="text-xs text-emerald-600">{item.value}</p>
                        )}
                    </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                      No variables are configured yet. You can add placeholders from the contract editor.
                    </div>
                    )}
                  </div>
              </ScrollArea>
                            </div>
                          </div>
          <div className="mt-6 flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setIsVariableSheetOpen(false)}>
              Close
            </Button>
            <Button
              className="bg-primary text-white hover:bg-primary/90"
              onClick={handleGenerateContractPreview}
              disabled={isGeneratingPreview || !contractContent}
            >
              {isGeneratingPreview ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating...
                              </span>
                        ) : (
                "Update Contract"
                        )}
            </Button>
                      </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={isPreviewOpen}
        onOpenChange={(open) => {
          setIsPreviewOpen(open);
          if (!open) {
            setContractPreviewHtml("");
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Updated Contract Preview</DialogTitle>
            <DialogDescription>
              This preview replaces all variables with the latest campaign and influencer data.
            </DialogDescription>
          </DialogHeader>
          {contractPreviewHtml ? (
            <ScrollArea className="contract-preview-container max-h-[70vh] rounded-3xl border border-slatrounded-lg border bg-card text-card-foreground border-none bg-gradient-to-br from-white/95 to-slate-100 shadow-xl backdrop-blure-200 bg-white/95 p-6 ">
              <div
                className="tiptap-rendered"
                dangerouslySetInnerHTML={{ __html: contractPreviewHtml }}
              />
            </ScrollArea>
          ) : (
            <p className="text-sm text-slate-500">No contract content available.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isViewContractOpen}
        onOpenChange={(open) => {
          setIsViewContractOpen(open);
          if (!open) {
            setSavedContractHtml(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <div className="flex items-start justify-between gap-4 mb-4">
            <DialogHeader className="flex-1">
              <DialogTitle>Saved Contract</DialogTitle>
              <DialogDescription>
                View the contract with all variables replaced from the database.
              </DialogDescription>
            </DialogHeader>
            {savedContractHtml && (
                              <Button
                                size="sm"
                                variant="outline"
                onClick={handlePrintContract}
                className="flex items-center gap-2"
              >
                <Printer className="h-4 w-4" />
                Print
                              </Button>
            )}
                            </div>
          {isLoadingSavedContract ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-slate-500">Loading contract...</span>
                          </div>
          ) : savedContractHtml ? (
            <>
              {(() => {
                const { css } = extractStylesFromHtml(savedContractHtml);
                return (
                  css && (
                    <style
                      dangerouslySetInnerHTML={{
                        __html: css,
                      }}
                    />
                  )
                );
              })()}
              <ScrollArea 
                data-contract-print
                className="contract-preview-container max-h-[70vh] rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-inner"
              >
                <div
                  className="tiptap-rendered"
                  dangerouslySetInnerHTML={{
                    __html: extractBodyContent(savedContractHtml),
                  }}
                />
              </ScrollArea>
                            </>
                          ) : (
            <p className="text-sm text-slate-500 py-12 text-center">
              No saved contract found. Please update the contract first.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex min-h-screen bg-gradient-subtle">
        <Sidebar />
        <MobileNav />

        <div className="flex-1 lg:ml-56">
          <Header />
          <main className="mx-auto w-full sm:px-4 sm:py-8">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading collaboration workspace...</span>
                        </div>
                      </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-sm text-destructive">
              {error}
                    </div>
                  ) : (
            <>
              {/* Collaboration Actions Table */}
              <Card className="border-none bg-gradient-to-br from-white/95 to-slate-100 w-full max-w-[320px] mx-auto lg:max-w-none">
                <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
                        Collaboration Actions
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500">
                        Track all collaboration activities and interactions.
                      </p>
                    </div>
                  </div>

                  {/* Search, Filter, Export Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative w-full md:max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={collabSearch}
                        onChange={(event) => setCollabSearch(event.target.value)}
                        placeholder="Search collaborations..."
                        className="pl-9 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 gap-2"
                        onClick={() => setIsFilterDialogOpen(true)}
                      >
                        <Filter className="h-4 w-4" />
                        Filters
                        {(filters.company || filters.influencer || filters.user || filters.isSigned || filters.campaign || filters.contract) && (
                          <span className="ml-1 h-5 w-5 rounded-full bg-primary text-xs text-primary-foreground flex items-center justify-center">
                            {[filters.company, filters.influencer, filters.user, filters.isSigned, filters.campaign, filters.contract].filter(Boolean).length}
                          </span>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 gap-2"
                        onClick={handleExportCollab}
                        disabled={filteredCollaborationActions.length === 0}
                      >
                        <Download className="h-4 w-4" />
                        Export
                      </Button>
                    </div>
                  </div>

                    {collaborationActionsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                          </div>
                    ) : filteredCollaborationActions.length > 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden w-full max-w-[350px] mx-auto lg:max-w-none">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs sm:text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                <th className="px-4 py-3 text-left font-semibold text-slate-700 w-12">
                                  <input
                                    type="checkbox"
                                    checked={
                                      filteredCollaborationActions.length > 0 &&
                                      filteredCollaborationActions.every((action) =>
                                        selectedCollabActions.has(action.id)
                                      )
                                    }
                                    onChange={(e) => handleSelectAllCollab(e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                                  />
                                </th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Campaign</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Company</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Contract</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Influencer</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Collaboration ID</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-700">User Name</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Date & Time</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {filteredCollaborationActions.map((action) => (
                                <tr 
                                  key={action.id} 
                                  className="hover:bg-slate-50 transition-colors"
                                >
                                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={selectedCollabActions.has(action.id)}
                                      onChange={(e) => handleSelectCollab(action.id, e.target.checked)}
                                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                                    />
                                  </td>
                                  <td 
                                    className="px-4 py-3 text-slate-700 font-medium cursor-pointer"
                                    onClick={() => handleRowClick(action)}
                                  >
                                    {action.campaign_name || <span className="text-slate-400">—</span>}
                                  </td>
                                  <td 
                                    className="px-4 py-3 text-slate-600 cursor-pointer"
                                    onClick={() => handleRowClick(action)}
                                  >
                                    {action.company_name || <span className="text-slate-400">—</span>}
                                  </td>
                                  <td 
                                    className="px-4 py-3 text-slate-600 cursor-pointer"
                                    onClick={() => handleRowClick(action)}
                                  >
                                    {action.contract_name || <span className="text-slate-400">—</span>}
                                  </td>
                                  <td 
                                    className="px-4 py-3 text-slate-600 cursor-pointer"
                                    onClick={() => handleRowClick(action)}
                                  >
                                    {action.influencer_name || <span className="text-slate-400">—</span>}
                                  </td>
                                  <td 
                                    className="px-4 py-3 cursor-pointer"
                                    onClick={() => handleRowClick(action)}
                                  >
                                    <Badge variant="outline" className="capitalize">
                                      {action.action ? action.action.replace('_', ' ') : '—'}
                                    </Badge>
                                  </td>
                                  <td 
                                    className="px-4 py-3 text-slate-600 font-mono text-xs cursor-pointer"
                                    onClick={() => handleRowClick(action)}
                                  >
                                    {action.collaboration_id}
                                  </td>
                                  <td 
                                    className="px-4 py-3 text-slate-600 cursor-pointer"
                                    onClick={() => handleRowClick(action)}
                                  >
                                    {action.user_name || <span className="text-slate-400">—</span>}
                                  </td>
                                  <td 
                                    className="px-4 py-3 text-slate-600 cursor-pointer"
                                    onClick={() => handleRowClick(action)}
                                  >
                                    {new Date(action.occurred_at).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                      {/* Contract Fill/View Button */}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          try {
                                            if (action.has_contract_html) {
                                              void handleViewContractFromTable(action.collaboration_id);
                                            } else {
                                              void handleRowClick(action);
                                            }
                                          } catch (err) {
                                            console.error("Collaboration: Error in contract button click", err);
                                          }
                                        }}
                                        title={action.has_contract_html ? "View Contract" : "Fill Contract"}
                                      >
                                        <FileText 
                                          className={`h-4 w-4 ${action.has_contract_html ? 'text-blue-600' : 'text-slate-400'}`} 
                                        />
                                      </Button>

                                      {/* Change User ID Button */}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          try {
                                            setChangingUserId({ 
                                              id: action.id, 
                                              currentUserId: action.user_id,
                                              collaborationId: action.collaboration_id
                                            });
                                          } catch (err) {
                                            console.error("Collaboration: Error setting changingUserId", err);
                                          }
                                        }}
                                        title="Change User ID"
                                      >
                                        <UserCog className="h-4 w-4 text-slate-600" />
                                      </Button>

                                      {/* Delete Button */}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          try {
                                            if (action.collaboration_id) {
                                              setDeletingAction(action.collaboration_id);
                                            } else {
                                              console.error("Collaboration: No collaboration_id found for action row", action);
                                              toast({
                                                title: "Error",
                                                description: "Missing Collaboration ID. Cannot delete.",
                                                variant: "destructive",
                                              });
                                            }
                                          } catch (err) {
                                            console.error("Collaboration: Error setting deletingAction", err);
                                          }
                                        }}
                                        title="Delete Action"
                                      >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>

                                      {/* Signed Status Button */}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          try {
                                            handleToggleSigned(action.id, action.is_signed || false);
                                          } catch (err) {
                                            console.error("Collaboration: Error toggling signed status", err);
                                          }
                                        }}
                                        title={action.is_signed ? "Mark as Unsigned" : "Mark as Signed"}
                                      >
                                        {action.is_signed ? (
                                          <div className="relative inline-flex items-center justify-center">
                                            <div className="h-4 w-4 rounded-full bg-green-600 flex items-center justify-center">
                                              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                              </svg>
                                            </div>
                                          </div>
                                        ) : (
                                          <Circle className="h-4 w-4 text-slate-400" />
                                        )}
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                    </div>
                  </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-3 py-8 text-center text-xs text-slate-400">
                        {collabSearch.trim()
                          ? "No collaboration actions match your search."
                          : "No collaboration actions recorded yet."}
                </div>
                    )}
            </div>
                </Card>
            </>
          )}
        </main>
      </div>
    </div>

    {/* Contract View Dialog from Table */}
    <Dialog open={viewingContractFromTable !== null} onOpenChange={(open) => {
      if (!open) {
        setViewingContractFromTable(null);
        setContractHtmlFromTable(null);
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <DialogHeader className="flex-1">
            <DialogTitle>Contract View</DialogTitle>
            <DialogDescription>
              View the contract with all variables replaced from the database.
            </DialogDescription>
          </DialogHeader>
          {contractHtmlFromTable && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // Print functionality with font preservation
                const printWindow = window.open('', '_blank');
                if (printWindow && contractHtmlFromTable) {
                  // Extract body content
                  let bodyContent = contractHtmlFromTable;
                  if (contractHtmlFromTable.includes('<body>')) {
                    bodyContent = contractHtmlFromTable.split('<body>')[1]?.split('</body>')[0] || contractHtmlFromTable;
                  }

                  // Extract existing styles
                  const styleMatches = contractHtmlFromTable.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
                  const existingStyles = styleMatches.map(match => {
                    const content = match.replace(/<\/?style[^>]*>/gi, '');
                    return content;
                  }).join('\n');

                  // Create complete HTML document with Google Fonts
                  const printHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contract Print</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Roboto:wght@300;400;500;700&family=Open+Sans:wght@300;400;600;700&family=Lato:wght@300;400;700&family=Montserrat:wght@300;400;500;600;700&family=Raleway:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Merriweather:wght@300;400;700&family=Source+Sans+Pro:wght@300;400;600;700&family=Poppins:wght@300;400;500;600;700&family=Nunito:wght@300;400;600;700&family=Ubuntu:wght@300;400;500;700&family=Crimson+Text:wght@400;600;700&family=Lora:wght@400;500;600;700&family=PT+Serif:wght@400;700&family=Dancing+Script:wght@400;500;600;700&family=Great+Vibes&family=Allura&family=Pacifico&family=Satisfy&family=Kalam:wght@300;400;700&family=Caveat:wght@400;500;600;700&family=Permanent+Marker&display=swap" rel="stylesheet">
  <style>
    ${existingStyles}
    /* Ensure signature fonts are preserved in print */
    span[style*="font-family"][style*="Dancing Script"],
    span[style*="font-family"][style*="Great Vibes"],
    span[style*="font-family"][style*="Allura"],
    span[style*="font-family"][style*="Brush Script"],
    span[style*="font-family"][style*="Lucida Handwriting"],
    span[style*="font-family"][style*="Pacifico"],
    span[style*="font-family"][style*="Satisfy"],
    span[style*="font-family"][style*="Kalam"],
    span[style*="font-family"][style*="Caveat"],
    span[style*="font-family"][style*="Permanent Marker"] {
      font-family: 'Dancing Script', 'Great Vibes', 'Allura', 'Brush Script MT', 'Lucida Handwriting', 'Pacifico', 'Satisfy', 'Kalam', 'Caveat', 'Permanent Marker', cursive !important;
    }
    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      body {
        padding: 0;
        margin: 0;
      }
      .contract-preview-container {
        border: none;
        box-shadow: none;
        padding: 0;
      }
      span[style*="font-family"][style*="Dancing Script"],
      span[style*="font-family"][style*="Great Vibes"],
      span[style*="font-family"][style*="Allura"],
      span[style*="font-family"][style*="Brush Script"],
      span[style*="font-family"][style*="Lucida Handwriting"],
      span[style*="font-family"][style*="Pacifico"],
      span[style*="font-family"][style*="Satisfy"],
      span[style*="font-family"][style*="Kalam"],
      span[style*="font-family"][style*="Caveat"],
      span[style*="font-family"][style*="Permanent Marker"] {
        font-family: 'Dancing Script', 'Great Vibes', 'Allura', 'Brush Script MT', 'Lucida Handwriting', 'Pacifico', 'Satisfy', 'Kalam', 'Caveat', 'Permanent Marker', cursive !important;
      }
    }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;

                  printWindow.document.write(printHtml);
                  printWindow.document.close();

                  // Wait for fonts to load before printing
                  printWindow.onload = () => {
                    // Wait a bit for fonts to load
                    setTimeout(() => {
                      printWindow.print();
                    }, 500);
                  };
                }
              }}
              className="flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
          )}
        </div>
        <style>{`
          .contract-preview-container .tiptap-rendered .signature-box,
          .contract-preview-container .tiptap-rendered [data-signature="true"] {
            display: inline-block !important;
            width: 200px !important;
            height: 140px !important;
            border: 1px solid #9ca3af !important;
            background-color: transparent !important;
            border-radius: 3px !important;
            padding: 2px !important;
            text-align: center !important;
            vertical-align: middle !important;
            line-height: 136px !important;
            font-size: 10px !important;
            color: #6b7280 !important;
            box-sizing: border-box !important;
            margin-top: 20px !important;
            margin-bottom: 20px !important;
            margin-left: 25px !important;
            margin-right: 25px !important;
            min-width: 200px !important;
            white-space: nowrap !important;
            flex-shrink: 0 !important;
          }
          .contract-preview-container .tiptap-rendered .signature-box + .signature-box,
          .contract-preview-container .tiptap-rendered [data-signature="true"] + [data-signature="true"] {
            margin-left: 50px !important;
          }
          .contract-preview-container .tiptap-rendered span[style*="font-size: 10px"] {
            white-space: nowrap !important;
            display: inline-block !important;
          }
          .contract-preview-container .tiptap-rendered {
            overflow-x: auto !important;
          }
        `}</style>
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 px-6 pb-6">
          {isLoadingContractFromTable ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-slate-500">Loading contract...</span>
            </div>
          ) : contractHtmlFromTable ? (
            <>
              {(() => {
                const { css } = extractStylesFromHtml(contractHtmlFromTable);
                return (
                  css && (
                    <style
                      dangerouslySetInnerHTML={{
                        __html: css,
                      }}
                    />
                  )
                );
              })()}
              <ScrollArea 
                className="h-full contract-preview-container rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-inner"
                style={{ height: 'calc(90vh - 200px)' }}
              >
                <div
                  className="tiptap-rendered"
                  dangerouslySetInnerHTML={{
                    __html: extractBodyContent(contractHtmlFromTable),
                  }}
                />
              </ScrollArea>
            </>
          ) : (
            <p className="text-sm text-slate-500 py-12 text-center">
              No contract found.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Change User ID Dialog */}
    <Dialog open={changingUserId !== null} onOpenChange={(open) => {
      if (!open) {
        setChangingUserId(null);
        setUsersForPicker([]);
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change User ID</DialogTitle>
          <DialogDescription>
            Select a user assigned to this campaign for this collaboration action.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {loadingCampaignUsers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              <span className="ml-2 text-sm text-slate-500">Loading campaign users...</span>
            </div>
          ) : usersForPicker.length === 0 ? (
            <div className="text-sm text-slate-500 py-4 text-center">
              No users assigned to this campaign.
            </div>
          ) : (
            <Select
              value={changingUserId?.currentUserId || undefined}
              onValueChange={(value) => {
                try {
                  if (changingUserId) {
                    // If value is "__CLEAR__", set it to null/empty
                    const finalValue = value === "__CLEAR__" ? null : value;
                    void handleChangeUserId(changingUserId.id, finalValue || "");
                  }
                } catch (err) {
                  console.error("Collaboration: Error in onValueChange", err);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a user from campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__CLEAR__">No User (Clear)</SelectItem>
                {usersForPicker.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} {user.email ? `(${user.email})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => {
            setChangingUserId(null);
            setUsersForPicker([]);
          }}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={deletingAction !== null} onOpenChange={(open) => {
      if (!open) {
        setDeletingAction(null);
      }
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Collaboration Action</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this collaboration action? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setDeletingAction(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (deletingAction) {
                void handleDeleteAction(deletingAction);
              }
            }}
            className="bg-red-600 hover:bg-red-700"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Filter Dialog */}
    <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filter Collaboration Actions</DialogTitle>
          <DialogDescription>
            Filter collaboration actions by different criteria. Only available values are shown.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Campaign</label>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Company</label>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Contract</label>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Influencer</label>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">User</label>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Signed Status</label>
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
    </>
  );
};

export default Collaboration;

