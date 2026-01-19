import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Printer, ChevronLeft, ChevronRight, Pen, Type, X, RotateCcw, RefreshCw, Trash2, Mail, CalendarIcon, Plus, Check, CheckCircle2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  CampaignRecord,
  CampaignInfluencerRef,
  CampaignContractRef,
  getPlatformMeta,
  mapCampaignRow,
} from "@/lib/campaign";

type LocationState = {
  campaign?: CampaignRecord;
  influencerId?: string;
  campaignId?: string;
};

type ActionOption = "interested" | "not_interested" | "callback" | "done";

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

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
  originalKey?: string; // For tracking indexed plain_text entries
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

const CollaborationAssignment = () => {
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
  const [currentUserProfile, setCurrentUserProfile] = useState<{
    userName: string;
    email: string;
    employeeId: string;
  } | null>(null);
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
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState<boolean>(false);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
  const [signatureValue, setSignatureValue] = useState<string>('');
  const [signatureFont, setSignatureFont] = useState<string>('Dancing Script');
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentSignatureEntry, setCurrentSignatureEntry] = useState<string | null>(null);
  const [isSigned, setIsSigned] = useState<boolean>(false);
  const [isContractSent, setIsContractSent] = useState<boolean>(false);
  const [updatedCollaborationIds, setUpdatedCollaborationIds] = useState<Set<string>>(new Set());
  const [filledCollaborationIds, setFilledCollaborationIds] = useState<Set<string>>(new Set());
  const [influencerSignedStatus, setInfluencerSignedStatus] = useState<Map<string, boolean>>(new Map());
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userAssignedCollaborationIds, setUserAssignedCollaborationIds] = useState<Set<string>>(new Set());
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState<boolean>(false);
  const [isEditingEmail, setIsEditingEmail] = useState<boolean>(false);
  const [emailViewMode, setEmailViewMode] = useState<'simple' | 'html'>('simple');
  const [emailDetails, setEmailDetails] = useState<{
    to: string;
    subject: string;
    body: string;
    magicLink: string;
  } | null>(null);
  
  // Product Selection State
  const [isProductDialogOpen, setIsProductDialogOpen] = useState<boolean>(false);
  const [currentProductVariableKey, setCurrentProductVariableKey] = useState<string | null>(null);
  const [availableProducts, setAvailableProducts] = useState<Array<{ id: string; name: string; company: string | null }>>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false);

  // Initialize and reset canvas when dialog opens/closes
  useEffect(() => {
    if (!isSignatureDialogOpen) {
      // Reset drawing state when dialog closes
      setIsDrawing(false);
      setSignatureMode('draw');
      setSignatureValue('');
    } else {
      // Initialize canvas when dialog opens - use setTimeout to ensure DOM is ready
      const timer = setTimeout(() => {
        if (signatureCanvasRef.current) {
          const canvas = signatureCanvasRef.current;
          const rect = canvas.getBoundingClientRect();
          const ctx = canvas.getContext('2d');
          if (ctx && rect.width > 0 && rect.height > 0) {
            // Only set dimensions if canvas is empty or dimensions changed
            // Setting width/height clears the canvas, so we check if it's already initialized
            if (canvas.width === 0 || canvas.height === 0 ||
              (canvas.width !== rect.width || canvas.height !== rect.height)) {
              canvas.width = rect.width;
              canvas.height = rect.height;
              // Reconfigure context after resize
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 2;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
            } else {
              // Just update context settings without clearing
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 2;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
            }
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isSignatureDialogOpen]);

  // Attach click handlers to signature placeholders in preview HTML
  useEffect(() => {
    if (!contractPreviewHtml || !isPreviewOpen) return;

    const contractContainer = document.querySelector('.contract-preview-container .tiptap-rendered');
    if (!contractContainer) return;

    const clickableBoxes = contractContainer.querySelectorAll('.signature-box-clickable[data-signature-key]');
    const cleanupFunctions: Array<() => void> = [];

    clickableBoxes.forEach((box) => {
      const signatureKey = (box as HTMLElement).getAttribute('data-signature-key');
      if (!signatureKey) return;

      // Add hover effect
      const handleMouseEnter = () => {
        (box as HTMLElement).style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
      };
      const handleMouseLeave = () => {
        (box as HTMLElement).style.backgroundColor = 'transparent';
      };
      const handleClick = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();

        // Find or create the signature entry
        const existingEntry = contractVariableEntries.find(
          e => (e.originalKey === signatureKey || e.key === signatureKey)
        );

        if (existingEntry) {
          setCurrentSignatureEntry(existingEntry.originalKey || existingEntry.key);
          const existingValue = existingEntry.inputValue || existingEntry.value || '';
          setSignatureValue(existingValue);

          if (existingValue && existingValue.startsWith('data:image')) {
            setSignatureMode('draw');
            setTimeout(() => {
              if (signatureCanvasRef.current && existingValue) {
                const img = new Image();
                img.onload = () => {
                  const ctx = signatureCanvasRef.current?.getContext('2d');
                  if (ctx && signatureCanvasRef.current) {
                    signatureCanvasRef.current.width = signatureCanvasRef.current.offsetWidth;
                    signatureCanvasRef.current.height = signatureCanvasRef.current.offsetHeight;
                    ctx.drawImage(img, 0, 0, signatureCanvasRef.current.width, signatureCanvasRef.current.height);
                  }
                };
                img.src = existingValue;
              }
            }, 100);
          } else {
            setSignatureMode('type');
          }
        } else {
          // Create new entry if it doesn't exist
          setCurrentSignatureEntry(signatureKey);
          setSignatureValue('');
          setSignatureMode('draw');
        }

        setIsSignatureDialogOpen(true);
      };

      box.addEventListener('mouseenter', handleMouseEnter);
      box.addEventListener('mouseleave', handleMouseLeave);
      box.addEventListener('click', handleClick);

      cleanupFunctions.push(() => {
        box.removeEventListener('mouseenter', handleMouseEnter);
        box.removeEventListener('mouseleave', handleMouseLeave);
        box.removeEventListener('click', handleClick);
      });
    });

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [contractPreviewHtml, isPreviewOpen, contractVariableEntries]);

  const isUuid = (value: string | undefined | null): value is string =>
    Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));

  const toDeterministicUuid = (input: string): string => {
    // Simple deterministic UUID v4-like generator
    const hash = input.split("").reduce((acc, char) => {
      const hash = ((acc << 5) - acc) + char.charCodeAt(0);
      return hash & hash;
    }, 0);
    const hex = Math.abs(hash).toString(16).padStart(32, "0");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((Math.abs(hash) % 4) + 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  };

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
    return campaign?.id ?? id ?? state.campaignId ?? null;
  }, [campaign?.id, id, state.campaignId]);

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

  // Sorted influencers list (unsigned first)
  const sortedInfluencers = useMemo(() => {
    if (!campaign || !campaign.influencers.length) {
      return [];
    }
    
    let filtered = [...campaign.influencers];
    
    // If user role is "user", only show influencers with collaboration entries assigned to this user
    if (userRole === 'user' && userAssignedCollaborationIds.size > 0 && campaignKey) {
      filtered = filtered.filter((inf) => {
        const influencerKey = inf.pid ?? inf.id ?? "none";
        // Check if any collaboration_id starts with campaignKey-influencerKey-
        // This matches the format: campaignKey-influencerKey-contractKey
        const prefix = `${campaignKey}-${influencerKey}-`;
        return Array.from(userAssignedCollaborationIds).some((collabId) => 
          collabId.startsWith(prefix)
        );
      });
    }
    
    // Create a copy and sort: unsigned (false/null) first, then signed (true)
    return filtered.sort((a, b) => {
      const aKey = a.id || a.pid || "";
      const bKey = b.id || b.pid || "";
      const aSigned = influencerSignedStatus.get(aKey) ?? false;
      const bSigned = influencerSignedStatus.get(bKey) ?? false;
      // Unsigned (false) comes before signed (true)
      if (aSigned === bSigned) return 0;
      return aSigned ? 1 : -1;
    });
  }, [campaign?.influencers, influencerSignedStatus, userRole, userAssignedCollaborationIds, campaignKey]);

  const influencer: CampaignInfluencerRef | null = useMemo(() => {
    if (!sortedInfluencers.length) {
      return null;
    }
    // If influencerId is provided in state, find that influencer, otherwise use first one (which will be unsigned)
    if (state.influencerId) {
      const found = sortedInfluencers.find(
        (inf) => inf.id === state.influencerId || inf.pid === state.influencerId
      );
      if (found) return found;
    }
    return sortedInfluencers[0];
  }, [sortedInfluencers, state.influencerId]);

  // Get current influencer index and navigation info (using sorted list)
  const influencerNavigation = useMemo(() => {
    if (!sortedInfluencers.length || !influencer) {
      return { currentIndex: -1, hasPrevious: false, hasNext: false, previousInfluencer: null, nextInfluencer: null };
    }
    const currentIndex = sortedInfluencers.findIndex(
      (inf) => inf.id === influencer.id || inf.pid === influencer.pid
    );
    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex < sortedInfluencers.length - 1;
    const previousInfluencer = hasPrevious ? sortedInfluencers[currentIndex - 1] : null;
    const nextInfluencer = hasNext ? sortedInfluencers[currentIndex + 1] : null;
    return { currentIndex, hasPrevious, hasNext, previousInfluencer, nextInfluencer };
  }, [sortedInfluencers, influencer]);

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
    // Scroll to top immediately on click
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Clear action and remark when navigating
    setSelectedAction("");
    setActionRemark("");
    setCallbackDate("");
    setCallbackTime("");
    navigate('/collaborationAssignment', {
      state: {
        campaign,
        influencerId: influencerNavigation.previousInfluencer.id || influencerNavigation.previousInfluencer.pid,
        campaignId: campaign.id,
      },
    });
    // Also scroll after a short delay to ensure it works after navigation
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  }, [influencerNavigation, campaign, navigate]);

  const handleNextInfluencer = useCallback(() => {
    if (!influencerNavigation.hasNext || !influencerNavigation.nextInfluencer || !campaign) {
      return;
    }
    // Scroll to top immediately on click
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Clear action and remark when navigating
    setSelectedAction("");
    setActionRemark("");
    setCallbackDate("");
    setCallbackTime("");
    navigate('/collaborationAssignment', {
      state: {
        campaign,
        influencerId: influencerNavigation.nextInfluencer.id || influencerNavigation.nextInfluencer.pid,
        campaignId: campaign.id,
      },
    });
    // Also scroll after a short delay to ensure it works after navigation
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  }, [influencerNavigation, campaign, navigate]);

  const collaborationId = useMemo(() => {
    if (!campaignKey || !influencer) {
      return null;
    }
    const influencerKey = influencer.pid ?? influencer.id ?? "none";
    const contractKey = resolvedContractPid ?? "none";
    return `${campaignKey}-${influencerKey}-${contractKey}`;
  }, [campaignKey, influencer?.pid, influencer?.id, resolvedContractPid]);

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
        console.error("CollaborationAssignment: Error fetching campaign", fetchErr);
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

        // Fetch user role and assigned collaboration IDs
        if (data?.user?.id) {
          try {
            // Get role from localStorage first for immediate UI update
            let finalRole: string | null = localStorage.getItem('currentUserRole');
            if (finalRole && (finalRole === 'admin' || finalRole === 'super_admin' || finalRole === 'user')) {
              setUserRole(finalRole);
            }

            // Always fetch/refresh profile details from Supabase
            const { data: profileData, error: profileError } = await supabase
              .from("user_profiles")
              .select("role, user_name, email, employee_id")
              .eq("user_id", data.user.id)
              .maybeSingle();

            if (!profileError && profileData) {
              const pData = profileData as any;
              const role = pData.role;
              if (role) {
                finalRole = role;
                setUserRole(role);
                localStorage.setItem('currentUserRole', role);
              }

              setCurrentUserProfile({
                userName: pData.user_name || "Admin",
                email: pData.email || "",
                employeeId: pData.employee_id || "N/A",
              });
            }

            // If role is "user", fetch collaboration IDs assigned to this user
            if (finalRole === 'user' && data.user.id) {
              const { data: actionsData, error: actionsError } = await supabase
                .from("collaboration_actions")
                .select("collaboration_id")
                .eq("user_id", data.user.id);

              if (!actionsError && actionsData) {
                const assignedIds = new Set<string>();
                actionsData.forEach((action: any) => {
                  if (action.collaboration_id) {
                    assignedIds.add(action.collaboration_id);
                  }
                });
                setUserAssignedCollaborationIds(assignedIds);
              }
            }
          } catch (err) {
            console.error("CollaborationAssignment: Error fetching user role/assigned collaborations", err);
          }
        }
      } catch (error) {
        console.error("CollaborationAssignment: Unable to fetch current user", error);
        setCurrentUserId(null);
      }
    };

    fetchUser();
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

        const contractData = data as { pid?: string } | null;
        if (contractData?.pid) {
          setResolvedContractPid(contractData.pid);
        }
      } catch (err) {
        console.error("CollaborationAssignment: Error fetching contract PID", err);
      }
    };

    fetchContractPid();
  }, [contractMeta?.id, contractMeta?.pid]);

  // Load initial action from database
  useEffect(() => {
    if (hasLoadedInitialAction || !collaborationId || !resolvedCampaignId) {
      return;
    }

    let cancelled = false;

    const fetchLatestAction = async () => {
      try {
        const { data, error } = await supabase
          .from("collaboration_actions")
          .select("action, remark, occurred_at, is_contract_sent")
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

        const latestAction = data as { action?: string | null; remark?: string | null; occurred_at?: string | null; is_contract_sent?: boolean | null } | null;
        
        // Set is_contract_sent status
        if (latestAction && latestAction.is_contract_sent !== undefined) {
          setIsContractSent(latestAction.is_contract_sent === true);
        }

        if (latestAction) {
          const actionValue = (latestAction.action ?? "") as ActionOption | "";
          const remarkValue = (latestAction.remark ?? "").trim();

          if (actionValue) {
            setSelectedAction(actionValue);

            if (actionValue === "callback" && latestAction.occurred_at) {
              const occurredDate = new Date(latestAction.occurred_at);
              setCallbackDate(occurredDate.toISOString().split("T")[0]);
              const hours = occurredDate.getHours().toString().padStart(2, "0");
              const minutes = occurredDate.getMinutes().toString().padStart(2, "0");
              setCallbackTime(`${hours}:${minutes}`);
            }

            if (remarkValue) {
              setActionRemark(remarkValue);
            }

            setActionBaseline({
              action: actionValue,
              callbackDate: actionValue === "callback" ? (latestAction.occurred_at ? new Date(latestAction.occurred_at).toISOString().split("T")[0] : "") : "",
              callbackTime: actionValue === "callback" ? (latestAction.occurred_at ? `${new Date(latestAction.occurred_at).getHours().toString().padStart(2, "0")}:${new Date(latestAction.occurred_at).getMinutes().toString().padStart(2, "0")}` : "") : "",
              remark: remarkValue,
            });
          }
        }

        setHasLoadedInitialAction(true);
      } catch (err) {
        console.error("CollaborationAssignment: Error fetching latest action", err);
        setHasLoadedInitialAction(true);
      }
    };

    fetchLatestAction();

    return () => {
      cancelled = true;
    };
  }, [hasLoadedInitialAction, collaborationId, resolvedCampaignId]);

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
      console.error("CollaborationAssignment: Failed to fetch timeline entries", err);
      setTimelineEntries([]);
    } finally {
      setTimelineLoading(false);
    }
  }, [collaborationId]);

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
        console.error("CollaborationAssignment: Failed to log timeline entry", error);
      } else {
        // Refresh timeline after logging
        void fetchTimelineEntries();
      }
    } catch (err) {
      console.error("CollaborationAssignment: Error logging timeline entry", err);
    }
  }, [collaborationId, currentUserId, fetchTimelineEntries]);

  // Function to clear timeline entries
  const clearTimelineEntries = useCallback(async () => {
    if (!collaborationId) {
      toast({
        title: "Error",
        description: "Collaboration ID is missing.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("CollaborationAssignment: Attempting to delete timeline entries for collaboration_id:", collaborationId);

      const client = supabase as any;
      const { data, error } = await client
        .from("collaboration_timeline")
        .delete()
        .eq("collaboration_id", collaborationId)
        .select();

      if (error) {
        console.error("CollaborationAssignment: Delete error:", error);
        throw error;
      }

      console.log("CollaborationAssignment: Deleted timeline entries:", data);

      // Refresh timeline to ensure UI is in sync
      await fetchTimelineEntries();

      toast({
        title: "Timeline cleared",
        description: "All timeline entries have been removed.",
      });
    } catch (err: any) {
      console.error("CollaborationAssignment: Failed to clear timeline entries", err);
      toast({
        title: "Error clearing timeline",
        description: err?.message || "An error occurred while clearing the timeline. Please check RLS policies.",
        variant: "destructive",
      });
    }
  }, [collaborationId, toast, fetchTimelineEntries]);

  // Fetch timeline entries when collaborationId is available
  useEffect(() => {
    if (collaborationId) {
      void fetchTimelineEntries();
    }
  }, [collaborationId, fetchTimelineEntries]);

  // Fetch is_contract_sent status from collaboration_actions
  useEffect(() => {
    const fetchContractSentStatus = async () => {
      if (!collaborationId) {
        setIsContractSent(false);
        return;
      }

      try {
        const { data, error } = await (supabase as any)
          .from("collaboration_actions")
          .select("is_contract_sent")
          .eq("collaboration_id", collaborationId)
          .order("occurred_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("Error fetching contract sent status:", error);
          return;
        }

        if (data && (data as any).is_contract_sent !== undefined) {
          setIsContractSent((data as any).is_contract_sent === true);
        }
      } catch (err) {
        console.error("Error fetching contract sent status:", err);
      }
    };

    fetchContractSentStatus();
  }, [collaborationId]);

  // Fetch is_signed status from collaboration_actions
  useEffect(() => {
    const fetchSignedStatus = async () => {
      if (!collaborationId) {
        setIsSigned(false);
        return;
      }

      try {
        const { data, error } = await (supabase as any)
          .from("collaboration_actions")
          .select("is_signed")
          .eq("collaboration_id", collaborationId)
          .maybeSingle();

        if (!error && data) {
          setIsSigned(data.is_signed === true);
        } else {
          setIsSigned(false);
        }
      } catch (err) {
        console.error("Error fetching signed status:", err);
        setIsSigned(false);
      }
    };

    fetchSignedStatus();
  }, [collaborationId]);

  // Fetch signed status for all influencers in the campaign
  useEffect(() => {
    const fetchAllSignedStatus = async () => {
      if (!campaign || !campaign.influencers.length || !campaignKey || !resolvedContractPid) {
        return;
      }

      try {
        const influencerKeys = campaign.influencers.map(inf => inf.pid || inf.id || "none");
        const collabIds = influencerKeys.map(infKey => `${campaignKey}-${infKey}-${resolvedContractPid}`);
        
        const { data, error } = await (supabase as any)
          .from("collaboration_actions")
          .select("collaboration_id, is_signed")
          .in("collaboration_id", collabIds);

        if (error) throw error;

        const statusMap = new Map<string, boolean>();
        const results = data || [];
        
        campaign.influencers.forEach(inf => {
          const influencerKey = inf.pid || inf.id || "none";
          const collabId = `${campaignKey}-${influencerKey}-${resolvedContractPid}`;
          const infKey = inf.id || inf.pid || "";
          
          const matchingAction = results.find(r => r.collaboration_id === collabId);
          statusMap.set(infKey, matchingAction?.is_signed === true);
        });

        setInfluencerSignedStatus(statusMap);
      } catch (err) {
        console.error("Error fetching all signed statuses:", err);
      }
    };

    fetchAllSignedStatus();
  }, [campaign?.influencers, campaignKey, resolvedContractPid]);


  const handleActionSubmit = async () => {
    if (!selectedAction || !resolvedCampaignId || !resolvedInfluencerId || !currentUserId || !collaborationId) {
      toast({
        title: "Missing information",
        description: "Please ensure campaign and influencer are assigned.",
        variant: "destructive",
      });
      return;
    }

    try {
      const timestamp = new Date().toLocaleString();
      let label = ACTION_LABELS[selectedAction] || "Action recorded";

      const finalRemark = selectedAction === "callback" && callbackDate && callbackTime
        ? `Callback scheduled for ${new Date(`${callbackDate}T${callbackTime}`).toLocaleString()}. ${actionRemark.trim()}`.trim()
        : actionRemark.trim();

      if (finalRemark) {
        label += `: ${finalRemark}`;
      }

      const collabId = collaborationId;

      const baseData: {
        campaign_id: string | null;
        influencer_id: string | null;
        user_id: string | null;
        action: string;
        remark: string | null;
        occurred_at: string;
        collaboration_id: string;
      } = {
        campaign_id: resolvedCampaignId,
        influencer_id: resolvedInfluencerId,
        user_id: currentUserId,
        action: selectedAction,
        remark: finalRemark || null,
        occurred_at: new Date().toISOString(),
        collaboration_id: collabId,
      };

      const client = supabase as any;

      const { data: resultData, error: upsertError } = await client
        .from("collaboration_actions")
        .upsert(baseData, {
          onConflict: "collaboration_id",
        })
        .select();

      if (upsertError) {
        console.error("CollaborationAssignment: Failed to upsert action", upsertError);
        throw upsertError;
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

      toast({
        title: "Action saved",
        description: label,
      });

      const snapshotToPersist: ActionSnapshot = {
        action: selectedAction,
        callbackDate: selectedAction === "callback" ? callbackDate : "",
        callbackTime: selectedAction === "callback" ? callbackTime : "",
        remark: actionRemark.trim(),
      };

      setActionBaseline({ ...snapshotToPersist });
      setActionRemark(snapshotToPersist.remark);
      setCallbackDate(snapshotToPersist.callbackDate);
      setCallbackTime(snapshotToPersist.callbackTime);
    } catch (error: any) {
      console.error("CollaborationAssignment: Error while saving action", error);
      toast({
        title: "Unable to save action",
        description: error?.message ?? "An unexpected error occurred while saving the action.",
        variant: "destructive",
      });
    }
  };

  // Helper function to map display names back to actual keys
  const getActualKeyFromDisplayName = (displayName: string): string => {
    const lower = displayName.toLowerCase().trim();
    if (lower === 'influencer name') return 'name.influencer';
    if (lower === 'product name') return 'name.product';
    if (lower === 'companies name') return 'name.companies';
    if (lower === 'user name') return 'name.user';
    if (lower === 'plain text' || lower === 'plaintext') return 'plain_text';
    
    // Handle signature display names (case-insensitive)
    if (lower === 'signature.user' || lower.includes('signature.user')) return 'signature.user';
    if (lower === 'signature.influencer' || lower.includes('signature.influencer')) return 'signature.influencer';
    if (lower === 'signature') return 'signature';
    
    return displayName;
  };

  // Helper function to get display name from actual key
  const getDisplayNameFromKey = (key: string): string => {
    if (key === 'name.influencer') return 'Influencer Name';
    if (key === 'name.product') return 'Product Name';
    if (key === 'name.companies') return 'Companies Name';
    if (key === 'name.user') return 'User Name';
    if (key === 'plain_text') return 'Plain Text';
    return key;
  };

  const normalizeVariableKey = (rawKey: string | null | undefined): string => {
    if (!rawKey) {
      return "";
    }
    let cleaned = rawKey
      .replace(/var\[\s*/i, "")
      .replace(/\s*\]/, "")
      .replace(/^\{\{/, "")
      .replace(/\}\}$/, "")
      .trim();
    
    // Remove index part like [1], [2], etc. from the new format
    cleaned = cleaned.replace(/\s*\[\s*\d+\s*\]\s*$/, "").trim();
    
    // Map display names to actual keys
    return getActualKeyFromDisplayName(cleaned);
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

  const VARIABLE_OVERRIDE_TABLE = "collaboration_variable_overrides";

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

        setOriginalContractContent(contractData.content);
        setContractContent(extractRenderedHtml(contractData.content));

        const collected = new Map<
          string,
          {
            description?: string;
            descriptors: string[];
          }
        >();

        // Track which base keys already have indexed entries to avoid duplicates
        // Track both display names and normalized keys
        const indexedBaseKeys = new Set<string>();
        const indexedNormalizedKeys = new Set<string>();
        
        if (contractData.variables && typeof contractData.variables === "object") {
          Object.entries(contractData.variables).forEach(([rawKey, rawValue]) => {
            // Check if this is already an indexed key (e.g., "User Name_1", "User Name_2")
            const indexedMatch = rawKey.match(/^(.+)_(\d+)$/);
            if (indexedMatch) {
              // This is an indexed entry - process it directly
              const baseKey = indexedMatch[1];
              const index = parseInt(indexedMatch[2], 10);
              
              // Track both display name and normalized key
              indexedBaseKeys.add(baseKey);
              const normalizedBaseKey = getActualKeyFromDisplayName(baseKey);
              if (normalizedBaseKey !== baseKey) {
                indexedNormalizedKeys.add(normalizedBaseKey);
              } else {
                indexedNormalizedKeys.add(baseKey);
              }
              
              if (rawValue && typeof rawValue === "object" && rawValue !== null) {
                const entry = rawValue as { 
                  descriptors?: unknown; 
                  descriptions?: unknown;
                  index?: unknown;
                };
                
                let descriptors: string[] = [];
                let descriptions: string[] = [];
                
                if (Array.isArray(entry.descriptors)) {
                  descriptors = entry.descriptors
                    .map((item) => (typeof item === "string" ? item : ""))
                    .map((item) => item.trim())
                    .filter(Boolean);
                }
                
                if (Array.isArray(entry.descriptions)) {
                  descriptions = entry.descriptions
                    .map((item) => (typeof item === "string" ? item : ""))
                    .map((item) => item.trim());
                }
                
                // Ensure arrays have at least one element
                if (descriptors.length === 0) {
                  descriptors = [""];
                }
                if (descriptions.length === 0) {
                  descriptions = [""];
                }
                
                // Use the first descriptor and description for this indexed entry
                const descriptor = descriptors[0] || "";
                const description = descriptions[0] || "";
                
                // Build description for display
                const descriptionParts: string[] = [];
                if (descriptor) {
                  descriptionParts.push(descriptor);
                }
                if (description) {
                  descriptionParts.push(description);
                }
                
                // Store with the indexed key
                collected.set(rawKey, {
                  description: descriptionParts.length > 0 ? descriptionParts.join(" • ") : undefined,
                  descriptors: descriptor ? [descriptor] : [],
                });
              }
              return; // Skip further processing for indexed entries
            }
            
            const normalizedKey = normalizeVariableKey(rawKey);
            if (!normalizedKey) {
              return;
            }

            // Skip base "signature", "plain_text", and "date" entries - they will be handled by occurrence tracking
            if (normalizedKey === "signature" || normalizedKey === "plain_text" || normalizedKey === "date") {
              return;
            }
            
            // Skip if this base key already has indexed entries
            // Check both normalized key and display name
            const displayName = getDisplayNameFromKey(normalizedKey);
            if (indexedNormalizedKeys.has(normalizedKey) || indexedBaseKeys.has(displayName) || indexedBaseKeys.has(normalizedKey)) {
              return;
            }

            let descriptors: string[] = [];
            let descriptions: string[] = [];
            let occurrences: number | undefined;
            let variableDescription: string | undefined;

            if (rawValue && typeof rawValue === "object" && rawValue !== null) {
              const entry = rawValue as { 
                descriptor?: string; 
                descriptors?: unknown; 
                occurrences?: number; 
                description?: string;
                descriptions?: unknown;
              };
              
              // Handle new format with descriptions array
              if (Array.isArray(entry.descriptions)) {
                descriptions = entry.descriptions
                  .map((item) => (typeof item === "string" ? item : ""))
                  .map((item) => item.trim());
              } else if (typeof entry.description === "string" && entry.description.trim().length) {
                // Legacy format: single description
                descriptions = [entry.description.trim()];
              }
              
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
              descriptions = [""];
            }

            // Ensure descriptors and descriptions arrays match in length
            const maxLength = Math.max(descriptors.length, descriptions.length, 1);
            while (descriptors.length < maxLength) {
              descriptors.push("");
            }
            while (descriptions.length < maxLength) {
              descriptions.push("");
            }

            // Auto-add source descriptor for name variables if not already present
            if (descriptors.length === 0 || descriptors.every(d => !d || d.trim() === "")) {
              if (normalizedKey === 'name.influencer') {
                descriptors = Array(maxLength).fill('source:public.influencers.name');
              } else if (normalizedKey === 'name.user') {
                descriptors = Array(maxLength).fill('source:public.user_profiles.user_name');
              } else if (normalizedKey === 'name.product') {
                descriptors = Array(maxLength).fill('source:public.products.name');
              } else if (normalizedKey === 'name.companies') {
                descriptors = Array(maxLength).fill('source:public.companies.name');
              }
            }

            // If we have multiple occurrences (descriptors/descriptions arrays with length > 1),
            // create separate indexed entries for each occurrence
            if (maxLength > 1) {
              for (let i = 0; i < maxLength; i++) {
                const indexedKey = `${normalizedKey}_${i}`;
                const occurrenceDescriptor = descriptors[i] || "";
                const occurrenceDescription = descriptions[i] || "";
                
                // Build description for this occurrence
                const descriptionParts: string[] = [];
                if (occurrenceDescriptor) {
                  descriptionParts.push(occurrenceDescriptor);
                }
                if (occurrenceDescription) {
                  descriptionParts.push(occurrenceDescription);
                }
                descriptionParts.push(`(occurrence ${i + 1})`);
                
                collected.set(indexedKey, {
                  description: descriptionParts.join(" • "),
                  descriptors: occurrenceDescriptor ? [occurrenceDescriptor] : [],
                });
              }
            } else {
              // Single occurrence - use original logic
              const uniqueDescriptors = Array.from(new Set(descriptors)).filter(Boolean);
              const descriptionParts: string[] = [];

              if (uniqueDescriptors.length === 1) {
                descriptionParts.push(uniqueDescriptors[0]);
              } else if (uniqueDescriptors.length > 1) {
                descriptionParts.push(uniqueDescriptors.join(" • "));
              }

              if (descriptions[0] && descriptions[0].trim()) {
                descriptionParts.push(descriptions[0].trim());
              }

              const combinedDescription = descriptionParts.length ? descriptionParts.join(" • ") : undefined;

              const existing = collected.get(normalizedKey);
              
              // Preserve order: keep existing descriptors first, then add new ones (avoiding duplicates)
              const mergedDescriptors = existing
                ? (() => {
                  const existingSet = new Set(existing.descriptors);
                  const newUnique = uniqueDescriptors.filter(d => !existingSet.has(d));
                  return [...existing.descriptors, ...newUnique];
                })()
                : uniqueDescriptors;

              collected.set(normalizedKey, {
                description: combinedDescription || existing?.description,
                descriptors: mergedDescriptors,
              });
            }
          });
        }

        // First, try to extract keys from data-variable-key attributes
        if (typeof contractData.content === "string" && contractData.content.trim().length) {
          const dataKeyRegex = /data-variable-key=["']([^"']+)["']/gi;
          let dataKeyMatch: RegExpExecArray | null;
          while ((dataKeyMatch = dataKeyRegex.exec(contractData.content)) !== null) {
            const actualKey = dataKeyMatch[1].trim();
            if (actualKey && !collected.has(actualKey)) {
              // Skip if this key already has indexed entries
              const displayName = getDisplayNameFromKey(actualKey);
              if (indexedNormalizedKeys.has(actualKey) || indexedBaseKeys.has(displayName) || indexedBaseKeys.has(actualKey)) {
                continue; // Skip if indexed entries already exist
              }
              
              // Auto-add source descriptor for name variables
              let descriptors: string[] = [];
              if (actualKey === 'name.influencer') {
                descriptors = ['source:public.influencers.name'];
              } else if (actualKey === 'name.user') {
                descriptors = ['source:public.user_profiles.user_name'];
              } else if (actualKey === 'name.product') {
                descriptors = ['source:public.products.name'];
              } else if (actualKey === 'name.companies') {
                descriptors = ['source:public.companies.name'];
              }
              
              collected.set(actualKey, { 
                description: undefined, 
                descriptors: descriptors 
              });
            }
          }
        }

        if (typeof contractData.content === "string" && contractData.content.trim().length) {
          // Updated regex to match both old format: var[{{User Name}}] and new format: var[{{User Name [1]}}]
          const regex = /var\[\s*\{\{\s*([^}\[]+?)(?:\s*\[\s*\d+\s*\])?\s*\}\}\s*\]/gi;
          let match: RegExpExecArray | null;

          // Track occurrences of plain_text, signature, date, and name variables separately
          const plainTextOccurrences = new Map<string, number>();
          const signatureOccurrences = new Map<string, number>();
          const dateOccurrences = new Map<string, number>();
          const nameVariableOccurrences = new Map<string, number>();

          while ((match = regex.exec(contractData.content)) !== null) {
            const rawKey = match[1]?.trim();
            const normalizedKey = normalizeVariableKey(rawKey);
            if (normalizedKey) {
              // Check if this variable already has indexed entries (check both raw key and normalized key)
              const rawKeyDisplayName = rawKey; // Raw key might be display name like "User Name"
              const normalizedDisplayName = getDisplayNameFromKey(normalizedKey);
              
              // Skip if indexed entries exist for this variable
              if (indexedBaseKeys.has(rawKeyDisplayName) || 
                  indexedBaseKeys.has(normalizedDisplayName) || 
                  indexedNormalizedKeys.has(normalizedKey)) {
                continue; // Skip processing from content if indexed entries already exist
              }
              
              // For plain_text, create separate entries for each occurrence
              if (normalizedKey === "plain_text") {
                const currentCount = plainTextOccurrences.get("plain_text") ?? 0;
                const indexedKey = `plain_text_${currentCount}`;
                plainTextOccurrences.set("plain_text", currentCount + 1);

                if (!collected.has(indexedKey)) {
                  collected.set(indexedKey, {
                    description: `Manual text placeholder (occurrence ${currentCount + 1})`,
                    descriptors: []
                  });
                }
              } else if (normalizedKey === "signature" || normalizedKey === "signature.user" || normalizedKey === "signature.influencer") {
                // For signature, create separate entries for each occurrence
                // Handle signature.user and signature.influencer separately
                let signatureType = "signature";
                if (normalizedKey === "signature.user") {
                  signatureType = "signature.user";
                } else if (normalizedKey === "signature.influencer") {
                  signatureType = "signature.influencer";
                }
                
                const currentCount = signatureOccurrences.get(signatureType) ?? 0;
                const indexedKey = signatureType === "signature" 
                  ? `signature_${currentCount}`
                  : `${signatureType}_${currentCount}`;
                signatureOccurrences.set(signatureType, currentCount + 1);

                if (!collected.has(indexedKey)) {
                  const typeLabel = signatureType === "signature.user" ? "User" : signatureType === "signature.influencer" ? "Influencer" : "";
                  collected.set(indexedKey, {
                    description: typeLabel ? `${typeLabel} Signature placeholder (occurrence ${currentCount + 1})` : `Signature placeholder (occurrence ${currentCount + 1})`,
                    descriptors: []
                  });
                }
              } else if (normalizedKey === "date" || normalizedKey.toLowerCase().includes("date")) {
                // For date, create separate entries for each occurrence
                const currentCount = dateOccurrences.get("date") ?? 0;
                const indexedKey = `date_${currentCount}`;
                dateOccurrences.set("date", currentCount + 1);

                if (!collected.has(indexedKey)) {
                  // Get the descriptors and descriptions from the variables object if available
                  const variableData = contractData.variables?.[normalizedKey];
                  let allDescriptors: string[] = [];
                  let allDescriptions: string[] = [];
                  
                  if (variableData && typeof variableData === "object" && variableData !== null) {
                    const entry = variableData as { 
                      descriptor?: string; 
                      descriptors?: unknown;
                      description?: string;
                      descriptions?: unknown;
                    };
                    
                    if (Array.isArray(entry.descriptors)) {
                      allDescriptors = entry.descriptors
                        .map((item) => (typeof item === "string" ? item : ""))
                        .map((item) => item.trim())
                        .filter(Boolean);
                    } else if (typeof entry.descriptor === "string" && entry.descriptor.trim().length) {
                      allDescriptors = [entry.descriptor.trim()];
                    }
                    
                    if (Array.isArray(entry.descriptions)) {
                      allDescriptions = entry.descriptions
                        .map((item) => (typeof item === "string" ? item : ""))
                        .map((item) => item.trim());
                    } else if (typeof entry.description === "string" && entry.description.trim().length) {
                      allDescriptions = [entry.description.trim()];
                    }
                  }
                  
                  // Ensure arrays match length
                  const maxLen = Math.max(allDescriptors.length, allDescriptions.length, 1);
                  while (allDescriptors.length < maxLen) {
                    allDescriptors.push(allDescriptors[0] || "");
                  }
                  while (allDescriptions.length < maxLen) {
                    allDescriptions.push("");
                  }
                  
                  // Assign descriptor and description for this occurrence
                  const descriptorIndex = currentCount % maxLen;
                  const occurrenceDescriptors = allDescriptors.length > 0 && allDescriptors[descriptorIndex]
                    ? [allDescriptors[descriptorIndex]] 
                    : [];
                  const occurrenceDescription = allDescriptions[descriptorIndex] || "";
                  
                  const descriptionParts: string[] = [];
                  if (occurrenceDescriptors.length > 0) {
                    descriptionParts.push(occurrenceDescriptors.join(" • "));
                  }
                  if (occurrenceDescription) {
                    descriptionParts.push(occurrenceDescription);
                  }
                  descriptionParts.push(`(occurrence ${currentCount + 1})`);
                  
                  collected.set(indexedKey, {
                    description: descriptionParts.join(" • "),
                    descriptors: occurrenceDescriptors
                  });
                }
              } else if (normalizedKey.startsWith('name.')) {
                // For name variables (name.product, name.influencer, etc.), create separate entries for each occurrence
                // (Note: We already checked for indexed entries at the top of the loop)
                const currentCount = nameVariableOccurrences.get(normalizedKey) ?? 0;
                nameVariableOccurrences.set(normalizedKey, currentCount + 1);

                // Get the descriptors and descriptions from the variables object if available
                const variableData = contractData.variables?.[normalizedKey];
                let allDescriptors: string[] = [];
                let allDescriptions: string[] = [];
                
                if (variableData && typeof variableData === "object" && variableData !== null) {
                  const entry = variableData as { 
                    descriptor?: string; 
                    descriptors?: unknown;
                    description?: string;
                    descriptions?: unknown;
                  };
                  
                  if (Array.isArray(entry.descriptors)) {
                    allDescriptors = entry.descriptors
                      .map((item) => (typeof item === "string" ? item : ""))
                      .map((item) => item.trim())
                      .filter(Boolean);
                  } else if (typeof entry.descriptor === "string" && entry.descriptor.trim().length) {
                    allDescriptors = [entry.descriptor.trim()];
                  }
                  
                  if (Array.isArray(entry.descriptions)) {
                    allDescriptions = entry.descriptions
                      .map((item) => (typeof item === "string" ? item : ""))
                      .map((item) => item.trim());
                  } else if (typeof entry.description === "string" && entry.description.trim().length) {
                    allDescriptions = [entry.description.trim()];
                  }
                }
                
                // Auto-add source descriptor if not present
                if (allDescriptors.length === 0 || allDescriptors.every(d => !d || d.trim() === "")) {
                  if (normalizedKey === 'name.influencer') {
                    allDescriptors = ['source:public.influencers.name'];
                  } else if (normalizedKey === 'name.user') {
                    allDescriptors = ['source:public.user_profiles.user_name'];
                  } else if (normalizedKey === 'name.product') {
                    allDescriptors = ['source:public.products.name'];
                  } else if (normalizedKey === 'name.companies') {
                    allDescriptors = ['source:public.companies.name'];
                  }
                }
                
                // Ensure arrays match length
                const maxLen = Math.max(allDescriptors.length, allDescriptions.length, 1);
                while (allDescriptors.length < maxLen) {
                  allDescriptors.push(allDescriptors[0] || "");
                }
                while (allDescriptions.length < maxLen) {
                  allDescriptions.push("");
                }
                
                // Assign descriptor and description for this occurrence
                const descriptorIndex = currentCount % maxLen;
                const occurrenceDescriptors = allDescriptors.length > 0 && allDescriptors[descriptorIndex]
                  ? [allDescriptors[descriptorIndex]] 
                  : [];
                const occurrenceDescription = allDescriptions[descriptorIndex] || "";
                
                // Always use indexed key during processing, we'll clean up single occurrences later
                const indexedKey = `${normalizedKey}_${currentCount}`;
                
                if (!collected.has(indexedKey)) {
                  const descriptionParts: string[] = [];
                  if (occurrenceDescriptors.length > 0) {
                    descriptionParts.push(occurrenceDescriptors.join(" • "));
                  }
                  if (occurrenceDescription) {
                    descriptionParts.push(occurrenceDescription);
                  }
                  descriptionParts.push(`(occurrence ${currentCount + 1})`);
                  
                  collected.set(indexedKey, {
                    description: descriptionParts.join(" • "),
                    descriptors: occurrenceDescriptors
                  });
                }
              } else {
                // For other variables, use the original logic
                const existing = collected.get(normalizedKey);
                
                if (!existing) {
                  // Auto-add source descriptor for name variables if creating new entry
                  let descriptors: string[] = [];
                  if (normalizedKey === 'name.influencer') {
                    descriptors = ['source:public.influencers.name'];
                  } else if (normalizedKey === 'name.user') {
                    descriptors = ['source:public.user_profiles.user_name'];
                  } else if (normalizedKey === 'name.product') {
                    descriptors = ['source:public.products.name'];
                  } else if (normalizedKey === 'name.companies') {
                    descriptors = ['source:public.companies.name'];
                  }
                  
                  collected.set(normalizedKey, { 
                    description: undefined, 
                    descriptors: descriptors 
                  });
                } else {
                  // If key already exists, preserve its description and merge descriptors if needed
                  // Auto-add source descriptor for name variables if not already present
                  let descriptorsToAdd: string[] = [];
                  if (normalizedKey === 'name.influencer' && !existing.descriptors.some(d => d.includes('influencers.name'))) {
                    descriptorsToAdd = ['source:public.influencers.name'];
                  } else if (normalizedKey === 'name.user' && !existing.descriptors.some(d => d.includes('user_profiles.user_name'))) {
                    descriptorsToAdd = ['source:public.user_profiles.user_name'];
                  } else if (normalizedKey === 'name.product' && !existing.descriptors.some(d => d.includes('products.name'))) {
                    descriptorsToAdd = ['source:public.products.name'];
                  } else if (normalizedKey === 'name.companies' && !existing.descriptors.some(d => d.includes('companies.name'))) {
                    descriptorsToAdd = ['source:public.companies.name'];
                  }
                  
                  if (descriptorsToAdd.length > 0) {
                    const mergedDescriptors = [...existing.descriptors, ...descriptorsToAdd];
                    collected.set(normalizedKey, {
                      description: existing.description, // Preserve existing description
                      descriptors: mergedDescriptors
                    });
                  }
                  // If no descriptors to add, just preserve the existing entry (description is already there)
                }
              }
            }
          }
        }

        // Cleanup: Convert single-occurrence indexed name variables to base entries (remove "(occurrence 1)" suffix)
        const nameVariableBaseKeys = ['name.influencer', 'name.user', 'name.product', 'name.companies'];
        nameVariableBaseKeys.forEach(baseKey => {
          const indexedEntries = Array.from(collected.entries()).filter(([key]) => 
            key.startsWith(`${baseKey}_`)
          );
          
          if (indexedEntries.length === 1) {
            // Only one occurrence - convert to base entry
            const [indexedKey, indexedValue] = indexedEntries[0];
            let description = indexedValue.description || "";
            
            // Remove "(occurrence 1)" or "• (occurrence 1)" from description if present
            description = description
              .replace(/\s*•\s*\(occurrence\s+1\)\s*$/i, '')
              .replace(/\s*\(occurrence\s+1\)\s*$/i, '')
              .trim();
            
            // Check if base entry already exists (from variables object processing)
            const existingBase = collected.get(baseKey);
            if (existingBase) {
              // Merge: prefer the description with more information (longer or non-empty)
              const existingDesc = existingBase.description || "";
              const newDesc = description || "";
              const finalDescription = newDesc.length > existingDesc.length ? newDesc : (existingDesc || newDesc);
              
              collected.set(baseKey, {
                description: finalDescription,
                descriptors: existingBase.descriptors.length > 0 ? existingBase.descriptors : indexedValue.descriptors
              });
            } else {
              collected.set(baseKey, {
                description: description,
                descriptors: indexedValue.descriptors
              });
            }
            
            collected.delete(indexedKey);
          }
        });

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
            console.error(`CollaborationAssignment: failed to fetch ${fromName}`, err);
          }

          rowCache.set(cacheKey, row);
          return row;
        };

        const formatResolvedValue = (rawValue: any): string => {
          if (rawValue === undefined || rawValue === null) {
            return ""; // Return empty string instead of "--" for blank values
          }
          if (typeof rawValue === "string") {
            const trimmed = rawValue.trim();
            // Treat "--" as blank value - return empty string
            if (trimmed === "--") {
              return "";
            }
            return trimmed.length ? trimmed : ""; // Return empty string instead of "--" for blank values
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
              // Don't add anything to rendered if row is not found (skip blank values)
              continue;
            }

            const rawValue = resolveColumnValue(row, parsed.column);
            const valueText = formatResolvedValue(rawValue);
            
            // Always add to rawValues (even if empty) so we can detect "--" values
            // But only add to rendered if valueText is not empty (not blank)
            if (valueText && valueText.trim().length > 0) {
              rendered.push(`${columnLabel}: ${valueText}`);
            }
            // Always push to rawValues, even if empty, so we know the field exists
            // This helps us detect "--" values that should be replaced with blank
            rawValues.push(valueText || "");
            }

          // Filter out empty values and values containing "--"
          const displayParts = rendered.filter((value) => {
            if (!value || !value.trim()) return false;
            // Remove values that end with ": --" or are just "--"
            const trimmed = value.trim();
            return trimmed !== "--" && !trimmed.endsWith(": --") && trimmed.length > 0;
          });

          // Clean up display string - remove any remaining "--" patterns
          let displayString = displayParts.length ? displayParts.join(" • ") : undefined;
          if (displayString) {
            // Remove patterns like "columnLabel: --" from the display string
            displayString = displayString.replace(/\w+:\s*--/g, '').replace(/\s*•\s*•/g, ' • ').trim();
            if (displayString.length === 0) {
              displayString = undefined;
            }
          }

          return {
            display: displayString,
            rawValues,
          };
        };

        // Filter out base "signature", "plain_text", "date", and name variables if we have indexed versions
        const hasIndexedSignatures = Array.from(collected.keys()).some(k => k.startsWith("signature_"));
        const hasIndexedPlainText = Array.from(collected.keys()).some(k => k.startsWith("plain_text_"));
        const hasIndexedDates = Array.from(collected.keys()).some(k => k.startsWith("date_"));
        const hasIndexedNameVariables = Array.from(collected.keys()).some(k => {
          const parts = k.split('_');
          return parts.length > 1 && parts[0].startsWith('name.') && !isNaN(Number(parts[parts.length - 1]));
        });

        const filteredCollected = new Map(collected);
        if (hasIndexedSignatures && filteredCollected.has("signature")) {
          filteredCollected.delete("signature");
        }
        if (hasIndexedPlainText && filteredCollected.has("plain_text")) {
          filteredCollected.delete("plain_text");
        }
        if (hasIndexedDates && filteredCollected.has("date")) {
          filteredCollected.delete("date");
        }
        // Filter out base name variables if we have indexed versions
        if (hasIndexedNameVariables) {
          ['name.influencer', 'name.user', 'name.product', 'name.companies'].forEach(baseKey => {
            if (filteredCollected.has(baseKey)) {
              const hasIndexed = Array.from(filteredCollected.keys()).some(k => k.startsWith(`${baseKey}_`));
              if (hasIndexed) {
                filteredCollected.delete(baseKey);
              }
            }
          });
        }

        // Helper function to check if a variable is a date variable
        const isDateVariable = (key: string): boolean => {
          const normalizedKey = key.toLowerCase();
          return normalizedKey === "date" || normalizedKey.includes("date") || normalizedKey.includes("_date");
        };

        // Extract actual date indices from content for correct mapping
        const dateIndicesFromContent: number[] = [];
        if (contractData.content) {
          const dateIndexRegex = /var\[\s*\{\{\s*date\s*\[\s*(\d+)\s*\]\s*\}\}\s*\]/gi;
          let dateMatch: RegExpExecArray | null;
          while ((dateMatch = dateIndexRegex.exec(contractData.content)) !== null) {
            const contentIndex = parseInt(dateMatch[1], 10);
            if (!dateIndicesFromContent.includes(contentIndex)) {
              dateIndicesFromContent.push(contentIndex);
            }
          }
          dateIndicesFromContent.sort((a, b) => a - b);
        }

        // Track date entries for sequential indexing
        const dateEntryMap = new Map<string, number>(); // Maps originalKey to sequential display index
        let dateEntryCounter = 0;

        const preparedEntries = await Promise.all(
          Array.from(filteredCollected.entries()).map(async ([key, info]) => {
            const resolved = await resolveDescriptorsToValue(info.descriptors);
            // Check if this is a plain_text entry (with or without index)
            const keyLower = key.toLowerCase();
            const isPlainText = keyLower === "plain_text" || 
                               keyLower.startsWith("plain_text_") || 
                               keyLower === "plain text" || 
                               keyLower.startsWith("plain text_");
            // Check if this is a signature entry (with or without index, case-insensitive)
            const isSignature = keyLower === "signature" || 
                               keyLower.startsWith("signature_") || 
                               keyLower === "signature.user" || 
                               keyLower === "signature.influencer" ||
                               keyLower.startsWith("signature.user_") ||
                               keyLower.startsWith("signature.influencer_");
            // Check if this is a date variable
            const isDate = isDateVariable(key);
            // Check if this is a product variable (including name.product and indexed versions)
            // Check key, descriptors, and description for mention of "product"
            const hasProductInDescriptors = info.descriptors.some(d => d.toLowerCase().includes("product"));
            const isProduct = keyLower.includes("product") || 
                             keyLower.includes("products") || 
                             hasProductInDescriptors || 
                             (info.description?.toLowerCase().includes("product") ?? false);
            const isEditable = isPlainText || isSignature || isDate || isProduct;

            // Normalize key for placeholder (remove index suffix, case-insensitive)
            let placeholderKey = key;
            const keyLowerForPlaceholder = key.toLowerCase();
            if (keyLowerForPlaceholder.startsWith("plain_text_")) {
              placeholderKey = "plain_text";
            } else if (keyLowerForPlaceholder.startsWith("signature_")) {
              placeholderKey = "signature";
            } else if (keyLowerForPlaceholder.startsWith("signature.user_")) {
              placeholderKey = "signature.user";
            } else if (keyLowerForPlaceholder.startsWith("signature.influencer_")) {
              placeholderKey = "signature.influencer";
            } else if (keyLowerForPlaceholder.startsWith("date_")) {
              placeholderKey = "date";
            } else if (keyLowerForPlaceholder.startsWith("product_")) {
              placeholderKey = "product";
            } else if (keyLowerForPlaceholder.startsWith("name.product_")) {
              placeholderKey = "name.product";
            } else if (keyLowerForPlaceholder.startsWith("name.influencer_")) {
              placeholderKey = "name.influencer";
            } else if (keyLowerForPlaceholder.startsWith("name.user_")) {
              placeholderKey = "name.user";
            } else if (keyLowerForPlaceholder.startsWith("name.companies_")) {
              placeholderKey = "name.companies";
            }

            // Get display name for name variables
            const displayName = getDisplayNameFromKey(placeholderKey);
            const displayKey = displayName !== placeholderKey ? displayName : placeholderKey;

            // Check if this is an indexed entry (e.g., User Name_1, User Name_2, date_0, date_1)
            const indexedMatch = key.match(/^(.+)_(\d+)$/);
            let finalKey = `var[{{${displayKey}}}]`;
            
            if (indexedMatch) {
              // Extract the index from the key (e.g., "User Name_1" -> index 1, "date_0" -> index 0)
              let index = parseInt(indexedMatch[2], 10);
              
              // For date variables, use sequential display index (1, 2, 3...) for UI
              // but we'll store the actual content index separately for replacement
              if (key.startsWith("date_")) {
                // Assign sequential display index
                dateEntryCounter++;
                dateEntryMap.set(key, dateEntryCounter);
                index = dateEntryCounter; // Use sequential index for display (1, 2, 3...)
              } else if (keyLower.startsWith("plain_text_") || keyLower.startsWith("signature_") || keyLower.startsWith("signature.user_") || keyLower.startsWith("signature.influencer_")) {
                // For plain_text and signature, convert 0-indexed to 1-indexed
                index = index + 1;
              }
              
              // Create key with index: var[{{User Name [1]}}] or var[{{date [1]}}]
              finalKey = `var[{{${displayKey} [${index}]}}]`;
            }

            return {
              key: finalKey, // Use display name with index if applicable
              originalKey: key, // Store original key for tracking (e.g., signature_0, signature_1, name.product_0, name.product_1, User Name_1, User Name_2)
              description: info.description,
              value: resolved.display,
              rawValues: resolved.rawValues,
              editable: isEditable,
              inputValue: isEditable ? "" : undefined,
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
              .select("variable_key,value,contract_html,magic_link");

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
              console.error("CollaborationAssignment: override query error", error);
              return [];
            }
            return Array.isArray(data) ? data : [];
          };

          const overrides = await loadOverrides(collaborationId ?? null);
          let loadedMagicLink: string | null = null;
          overrides.forEach((override: any) => {
            // Load magic_link from the column if available
            if (override.magic_link) {
              loadedMagicLink = override.magic_link;
            }
            
            if (override.variable_key && override.value) {
              // If it's "all_variables", parse the JSON to get individual variable values
              if (override.variable_key === "all_variables") {
                try {
                  const variablesObj = typeof override.value === 'string'
                    ? JSON.parse(override.value)
                    : override.value;
                  Object.entries(variablesObj).forEach(([key, value]) => {
                    // Only add non-empty values that are not "--"
                    const stringValue = String(value).trim();
                    if (stringValue && stringValue !== "--" && stringValue.length > 0) {
                      overrideMap.set(key, stringValue);
                    }
                  });
                } catch (e) {
                  console.error("Failed to parse all_variables", e);
                }
              } else {
                // Only add non-empty values that are not "--"
                const stringValue = String(override.value).trim();
                if (stringValue && stringValue !== "--" && stringValue.length > 0) {
                  overrideMap.set(override.variable_key, stringValue);
                }
              }
            }
          });
          
          // Add magic_link to overrideMap if found in column
          if (loadedMagicLink && collaborationId) {
            overrideMap.set("magic_link", loadedMagicLink);
            // If magic link exists for this collaboration ID, mark it as updated
            setUpdatedCollaborationIds(prev => new Set(prev).add(collaborationId));
          }
        } catch (overrideErr) {
          console.error("CollaborationAssignment: failed to load overrides", overrideErr);
        }

        const finalEntries = preparedEntries.map((entry) => {
          // Check for override using multiple key formats to handle all cases
          let overrideValue: string | undefined = undefined;
          
          // Try originalKey first (most specific, e.g., "Address Line 1_1")
          if (entry.originalKey) {
            overrideValue = overrideMap.get(entry.originalKey);
          }
          
          // Try key if originalKey didn't match (e.g., "var[{{Address Line 1 [1]}}]")
          if (overrideValue === undefined && entry.key) {
            overrideValue = overrideMap.get(entry.key);
          }
          
          // Try extracting display name from key and matching (e.g., "Address Line 1" from "var[{{Address Line 1 [1]}}]")
          if (overrideValue === undefined && entry.key) {
            const keyMatch = entry.key.match(/var\[\s*\{\{\s*([^}\[]+?)(?:\s*\[\s*\d+\s*\])?\s*\}\}\s*\]/);
            if (keyMatch && keyMatch[1]) {
              const displayName = keyMatch[1].trim();
              // Try matching with display name
              overrideValue = overrideMap.get(displayName);
              // Try matching with indexed format (e.g., "Address Line 1_1")
              if (overrideValue === undefined && entry.originalKey) {
                const indexedMatch = entry.originalKey.match(/^(.+)_(\d+)$/);
                if (indexedMatch) {
                  const baseKey = indexedMatch[1];
                  overrideValue = overrideMap.get(baseKey);
                }
              }
            }
          }
          
          // Try matching with base key if originalKey is indexed
          if (overrideValue === undefined && entry.originalKey) {
            const indexedMatch = entry.originalKey.match(/^(.+)_(\d+)$/);
            if (indexedMatch) {
              const baseKey = indexedMatch[1];
              overrideValue = overrideMap.get(baseKey);
            }
          }
          
          if (overrideValue !== undefined) {
            // Clean up overrideValue - remove "--" and empty values
            const cleanedValue = overrideValue && overrideValue.trim() !== "--" && overrideValue.trim().length > 0
              ? overrideValue.trim()
              : undefined;
            
            return {
              ...entry,
              value: cleanedValue,
              rawValues: cleanedValue ? [cleanedValue] : [],
              // For editable entries (plain_text, signature, address fields, etc.), also set inputValue
              inputValue: entry.editable ? cleanedValue : entry.inputValue,
            };
          }
          return entry;
        });

        setContractVariableEntries(finalEntries);
        
        // Check if all variables are filled for this collaboration ID after loading
        if (collaborationId) {
          const editableEntries = finalEntries.filter(entry => {
            const key = entry.originalKey || entry.key || '';
            if (key === 'magic_link' || key.includes('signature.influencer')) {
              return false;
            }
            return entry.editable;
          });

          if (editableEntries.length > 0) {
            const allFilled = editableEntries.every(entry => {
              const hasInputValue = entry.inputValue && entry.inputValue.trim().length > 0;
              const hasValue = entry.value && entry.value.trim().length > 0 && entry.value !== '--';
              const hasRawValues = entry.rawValues && entry.rawValues.length > 0 && entry.rawValues.some(v => v && v.trim().length > 0 && v !== '--');
              return hasInputValue || hasValue || hasRawValues;
            });

            if (allFilled) {
              setFilledCollaborationIds(prev => new Set(prev).add(collaborationId));
            } else {
              setFilledCollaborationIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(collaborationId);
                return newSet;
              });
            }
          }
        }
      } catch (err: any) {
        console.error("CollaborationAssignment: Error loading contract variables", err);
        setContractVariablesError(err?.message || "Failed to load contract variables.");
        setContractVariableEntries(DEFAULT_CONTRACT_VARIABLE_HINTS.map((entry) => ({ ...entry })));
      } finally {
        setContractVariablesLoading(false);
      }
    },
    [campaign, resolvedCampaignId, resolvedInfluencerId, influencer, collaborationId]
  );

  // Load contract variables when contractMeta changes
  useEffect(() => {
    if (contractMeta?.id && isVariableSheetOpen) {
      void loadContractVariables(contractMeta.id);
    }
  }, [contractMeta?.id, isVariableSheetOpen, loadContractVariables]);

  // Check if all editable variables are filled for current collaboration ID from Supabase
  useEffect(() => {
    const checkVariablesFilled = async () => {
      if (!collaborationId || !contractMeta?.id) return;

      try {
        // Get contract variables structure from contracts table
        const { data: contractData, error: contractError } = await (supabase as any)
          .from("contracts")
          .select("variables")
          .eq("id", contractMeta.id)
          .maybeSingle();

        if (contractError || !contractData?.variables) {
          return;
        }

        const contractVariables = contractData.variables as Record<string, any>;
        if (!contractVariables || typeof contractVariables !== 'object') {
          return;
        }

        // Get saved values from collaboration_variable_overrides
        const { data: overrideData, error: overrideError } = await (supabase as any)
          .from(VARIABLE_OVERRIDE_TABLE)
          .select("value")
          .eq("collaboration_id", collaborationId)
          .eq("variable_key", "all_variables")
          .maybeSingle();

        if (overrideError || !overrideData?.value) {
          // No saved values, mark as not filled
          setFilledCollaborationIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(collaborationId);
            return newSet;
          });
          return;
        }

        // Parse the saved values
        let savedValues: Record<string, any> = {};
        try {
          savedValues = typeof overrideData.value === 'string' 
            ? JSON.parse(overrideData.value) 
            : overrideData.value;
        } catch (e) {
          console.error("Error parsing saved values", e);
          return;
        }

        // Get all variable keys from contract structure (excluding signature.influencer)
        const requiredVariableKeys = Object.keys(contractVariables).filter(key => {
          // Exclude signature.influencer from check
          return key !== 'signature.influencer';
        });

        if (requiredVariableKeys.length === 0) {
          return;
        }

        // Helper function to normalize saved key to match contract key
        const normalizeSavedKey = (savedKey: string, contractKey: string): string | null => {
          // Direct match
          if (savedKey === contractKey) {
            return savedKey;
          }
          
          // Handle indexed keys (date_0, date_1, etc.) - check if starts with contractKey
          if (savedKey.startsWith(contractKey + '_')) {
            return savedKey;
          }
          
          // Handle placeholder format var[{{key}}] - extract the key
          const placeholderMatch = savedKey.match(/var\[\{\{([^}]+)\}\}\]/);
          if (placeholderMatch) {
            const extractedKey = placeholderMatch[1].trim();
            if (extractedKey === contractKey) {
              return savedKey;
            }
          }
          
          return null;
        };

        // Helper function to find saved value for a contract key
        const findSavedValue = (contractKey: string): any => {
          // Try direct match first
          if (savedValues[contractKey] !== undefined) {
            return savedValues[contractKey];
          }
          
          // Try to find indexed version (date_0, date_1, etc.)
          const indexedKeys = Object.keys(savedValues).filter(key => 
            key.startsWith(contractKey + '_')
          );
          if (indexedKeys.length > 0) {
            // Return the first indexed value found
            return savedValues[indexedKeys[0]];
          }
          
          // Try placeholder format var[{{key}}]
          const placeholderKey = `var[{{${contractKey}}}]`;
          if (savedValues[placeholderKey] !== undefined) {
            return savedValues[placeholderKey];
          }
          
          return undefined;
        };

        // Check if all required variables have values in savedValues
        const allFilled = requiredVariableKeys.every(contractKey => {
          const savedValue = findSavedValue(contractKey);
          
          // Check if value exists and is not null/empty
          if (savedValue === null || savedValue === undefined) {
            return false;
          }
          
          // For string values, check if not empty
          if (typeof savedValue === 'string') {
            return savedValue.trim().length > 0 && savedValue !== '--';
          }
          
          // For other types, just check if exists
          return true;
        });

        // Update filled status for this collaboration ID
        if (allFilled) {
          setFilledCollaborationIds(prev => new Set(prev).add(collaborationId));
        } else {
          setFilledCollaborationIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(collaborationId);
            return newSet;
          });
        }
      } catch (err) {
        console.error("Error checking variables filled status", err);
      }
    };

    checkVariablesFilled();
  }, [collaborationId, contractMeta?.id]);

  // Check if all editable variables are filled for current collaboration ID
  const areAllVariablesFilled = useMemo(() => {
    if (!collaborationId) return false;
    
    // Check if this collaboration ID is marked as filled
    return filledCollaborationIds.has(collaborationId);
  }, [collaborationId, filledCollaborationIds]);

  // Contract handling functions
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

      // First, extract the actual HTML content and normalize placeholders
      // Remove HTML wrapper tags around placeholders to make replacement easier
      let previewHtml = contractContent || "";
      
      // Normalize placeholders wrapped in span tags: <span ...>var[{{...}}]</span> -> var[{{...}}]
      // This helps ensure our regex patterns can match placeholders regardless of HTML wrapping
      // Handle both data-variable-key and style-based spans
      previewHtml = previewHtml
        .replace(/<span[^>]*data-variable-key[^>]*>([^<]*var\[\s*\{\{[^}]+\}\}\s*\][^<]*)<\/span>/gi, '$1')
        .replace(/<span[^>]*style[^>]*background-color[^>]*#fef3c7[^>]*>([^<]*var\[\s*\{\{[^}]+\}\}\s*\][^<]*)<\/span>/gi, '$1');
      
      // Track which placeholders have been replaced to avoid final cleanup replacing them
      const replacedPlaceholders = new Set<string>();
      const variablesMap: Record<string, string | null> = {};

      // Helper function to replace placeholders that might be wrapped in HTML tags
      const replaceWithHtmlWrapping = (pattern: string, replacement: string): boolean => {
        // First try direct replacement
        const directRegex = new RegExp(pattern, "gi");
        const before = previewHtml;
        previewHtml = previewHtml.replace(directRegex, (match) => {
          replacedPlaceholders.add(match);
          return replacement;
        });
        if (previewHtml !== before) {
          return true;
        }
        
        // If direct replacement didn't work, try with HTML wrapper
        // Pattern: <span[^>]*>var[{{...}}]</span>
        const wrappedPattern = `<span[^>]*>${pattern}</span>`;
        const wrappedRegex = new RegExp(wrappedPattern, "gi");
        const beforeWrapped = previewHtml;
        previewHtml = previewHtml.replace(wrappedRegex, (match) => {
          replacedPlaceholders.add(match);
          return replacement;
        });
        if (previewHtml !== beforeWrapped) {
          return true;
        }
        
        // Also try with data-variable-key attribute
        const dataKeyPattern = `<span[^>]*data-variable-key=["'][^"']*["'][^>]*>${pattern}</span>`;
        const dataKeyRegex = new RegExp(dataKeyPattern, "gi");
        const beforeDataKey = previewHtml;
        previewHtml = previewHtml.replace(dataKeyRegex, (match) => {
          replacedPlaceholders.add(match);
          return replacement;
        });
        return previewHtml !== beforeDataKey;
      };

      // Group plain_text entries by their index for sequential replacement
      const plainTextEntries = contractVariableEntries
        .filter(e => e.originalKey?.startsWith("plain_text_"))
        .sort((a, b) => {
          // Sort by index: plain_text_0, plain_text_1, etc.
          const aIndex = parseInt(a.originalKey?.replace("plain_text_", "") || "0", 10);
          const bIndex = parseInt(b.originalKey?.replace("plain_text_", "") || "0", 10);
          return aIndex - bIndex;
        });


      // Group date entries by their index for sequential replacement
      const dateEntries = contractVariableEntries
        .filter(e => {
          const originalKey = e.originalKey || '';
          const key = e.key || '';
          // Check if it's a date variable (date_0, date_1, etc. or key contains date)
          return originalKey.startsWith("date_") || 
                 (originalKey.toLowerCase().includes("date") && !originalKey.startsWith("name.")) ||
                 (key.toLowerCase().includes("date") && key.includes("var[{{"));
        })
        .sort((a, b) => {
          // Sort by index: date_0, date_1, etc.
          const aKey = a.originalKey || '';
          const bKey = b.originalKey || '';
          const aIndex = aKey.startsWith("date_") 
            ? parseInt(aKey.replace("date_", "") || "0", 10)
            : 0;
          const bIndex = bKey.startsWith("date_")
            ? parseInt(bKey.replace("date_", "") || "0", 10)
            : 0;
          return aIndex - bIndex;
        });
      // Process date entries sequentially - replace each occurrence with its corresponding value
      if (dateEntries.length > 0) {
        // Format date values for display (YYYY-MM-DD to readable format)
        const formatValueForDisplay = (value: string): string => {
          if (!value) return "--";
          try {
            // Try to parse and format the date
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              return format(date, "MMMM d, yyyy");
            }
          } catch (e) {
            // If parsing fails, return original value
          }
          return value;
        };

        // Collect all date values in order
        // Extract actual indices from content to match correctly
        const dateIndexMap = new Map<string, number>(); // Maps entry.originalKey to actual content index
        if (contractContent) {
          // Extract all date indices from content: var[{{date [1]}}], var[{{date [2]}}], etc.
          const dateIndexRegex = /var\[\s*\{\{\s*date\s*\[\s*(\d+)\s*\]\s*\}\}\s*\]/gi;
          let dateMatch: RegExpExecArray | null;
          const foundIndices: number[] = [];
          while ((dateMatch = dateIndexRegex.exec(contractContent)) !== null) {
            const contentIndex = parseInt(dateMatch[1], 10);
            foundIndices.push(contentIndex);
          }
          // Sort found indices
          foundIndices.sort((a, b) => a - b);
          
          // Map date entries to content indices based on their order (sorted by originalKey index)
          dateEntries.forEach((entry, idx) => {
            if (idx < foundIndices.length) {
              dateIndexMap.set(entry.originalKey || entry.key, foundIndices[idx]);
            } else {
              // If more entries than indices in content, use sequential based on entryIndex
              const originalKey = entry.originalKey || '';
              let entryIndex = 0;
              if (originalKey.startsWith("date_")) {
                entryIndex = parseInt(originalKey.replace("date_", "") || "0", 10);
              }
              dateIndexMap.set(originalKey, entryIndex + 1);
            }
          });
        }
        
        const matches: Array<{ index: number; value: string; contentIndex: number }> = [];
        dateEntries.forEach((entry) => {
          // Get input value - check both inputValue and value fields
          let input = entry.inputValue?.trim() ?? "";
          if (!input && entry.value) {
            input = entry.value.trim();
          }
          
          const formattedValue = formatValueForDisplay(input);
          const sanitizedValue = formattedValue ? escapeHtml(formattedValue) : "";
          
          // Extract index from originalKey (date_0, date_1, etc.)
          const originalKey = entry.originalKey || '';
          let entryIndex = 0;
          if (originalKey.startsWith("date_")) {
            entryIndex = parseInt(originalKey.replace("date_", "") || "0", 10);
          }
          
          // Get actual content index from map, or calculate from entryIndex
          let contentIndex = dateIndexMap.get(originalKey);
          if (contentIndex === undefined) {
            // Fallback: use entryIndex + 1 (0-indexed to 1-indexed conversion)
            contentIndex = entryIndex + 1;
          }
          
          matches.push({ index: entryIndex, contentIndex, value: sanitizedValue });

          // Store value for this specific occurrence (keep YYYY-MM-DD format for storage)
          variablesMap[entry.originalKey || entry.key] = input || null;
        });
        
        // Sort matches by contentIndex to ensure correct order
        matches.sort((a, b) => a.contentIndex - b.contentIndex);

        // Try indexed format first: var[{{date [1]}}], var[{{date [2]}}], etc.
        // Match: var[{{date [1]}}], var[{{date [2]}}], etc. (case insensitive, with flexible spacing)
        const indexedPlaceholderPattern = `var\\[\\s*\\{\\{\\s*date\\s*\\[\\s*(\\d+)\\s*\\]\\s*\\}\\}\\s*\\]`;
        const indexedRegex = new RegExp(indexedPlaceholderPattern, "gi");
        
        // Replace indexed format occurrences (content uses 1-indexed format)
        previewHtml = previewHtml.replace(indexedRegex, (match, capturedIndex) => {
          const placeholderIndex = parseInt(capturedIndex, 10); // This is 1-indexed from content
          const foundMatch = matches.find(m => m.contentIndex === placeholderIndex);
          if (foundMatch) {
            replacedPlaceholders.add(match);
            return foundMatch.value;
          }
          // If no match found, return "--"
          return "--";
        });

        // Also handle old format: var[{{date}}] (for backward compatibility)
        const oldPlaceholder = "var[{{date}}]";
        const escapedPlaceholder = oldPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const oldRegex = new RegExp(escapedPlaceholder, "g");
        let occurrenceIndex = 0;
        previewHtml = previewHtml.replace(oldRegex, (match) => {
          const foundMatch = matches.find(m => m.index === occurrenceIndex);
          occurrenceIndex++;
          if (foundMatch) {
            replacedPlaceholders.add(match);
            return foundMatch.value;
          }
          return "--";
        });
      }

      // Process indexed name variables (User Name_1, User Name_2, Influencer Name_1, etc.) sequentially
      const indexedNameEntries = contractVariableEntries
        .filter(e => {
          const originalKey = e.originalKey || '';
          // Check if it's an indexed name variable (e.g., User Name_1, Influencer Name_2, etc.)
          // but not name.product (which is handled separately)
          const indexedMatch = originalKey.match(/^(.+)_(\d+)$/);
          if (!indexedMatch) return false;
          
          const baseKey = indexedMatch[1];
          // Check if it's a name variable (User Name, Influencer Name, Companies Name)
          // but exclude name.product which is handled separately
          return (baseKey === 'User Name' || baseKey === 'Influencer Name' || baseKey === 'Companies Name') &&
                 !originalKey.startsWith('name.product');
        })
        .sort((a, b) => {
          // Sort by base key first, then by index
          const aMatch = (a.originalKey || '').match(/^(.+)_(\d+)$/);
          const bMatch = (b.originalKey || '').match(/^(.+)_(\d+)$/);
          
          if (!aMatch || !bMatch) return 0;
          
          const aBase = aMatch[1];
          const bBase = bMatch[1];
          const aIndex = parseInt(aMatch[2], 10);
          const bIndex = parseInt(bMatch[2], 10);
          
          if (aBase !== bBase) {
            return aBase.localeCompare(bBase);
          }
          return aIndex - bIndex;
        });

      // Process each group of indexed name variables separately
      const nameVariableGroups = new Map<string, typeof indexedNameEntries>();
      indexedNameEntries.forEach(entry => {
        const match = (entry.originalKey || '').match(/^(.+)_(\d+)$/);
        if (match) {
          const baseKey = match[1];
          if (!nameVariableGroups.has(baseKey)) {
            nameVariableGroups.set(baseKey, []);
          }
          nameVariableGroups.get(baseKey)!.push(entry);
        }
      });

      // Process each group
      nameVariableGroups.forEach((entries, baseKey) => {
        // Get display name for this base key
        const displayName = baseKey; // Already a display name like "User Name"
        
        // Create regex to match indexed format: var[{{User Name [1]}}], var[{{User Name [2]}}], etc.
        // The regex should match: var[{{User Name [1]}}], var[{{User Name [2]}}], etc.
        // Escape special regex characters in displayName
        const escapedDisplayName = displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Pattern: var[{{DisplayName [number]}}]
        const placeholderPattern = `var\\[\\s*\\{\\{\\s*${escapedDisplayName}\\s*\\[\\s*(\\d+)\\s*\\]\\s*\\}\\}\\s*\\]`;
        const regex = new RegExp(placeholderPattern, "gi");
        const matches: Array<{ index: number; value: string }> = [];

        // Collect all values in order
        entries.forEach((entry) => {
          const match = (entry.originalKey || '').match(/^(.+)_(\d+)$/);
          if (match) {
            const entryIndex = parseInt(match[2], 10);
            let value = "";
            
            if (entry.editable) {
              value = entry.inputValue?.trim() ?? "";
            } else if (entry.rawValues && entry.rawValues.length) {
              value = entry.rawValues[0];
            } else if (entry.value) {
              value = entry.value;
            }
            
            const sanitizedValue = value ? escapeHtml(value) : "";
            matches.push({ index: entryIndex, value: sanitizedValue });
            variablesMap[entry.originalKey || entry.key] = value || null;
          }
        });

        // Replace occurrences sequentially by matching the index in the placeholder
        previewHtml = previewHtml.replace(regex, (match, capturedIndex) => {
          // Use the captured index from the regex (capture group 1)
          const placeholderIndex = parseInt(capturedIndex, 10);
          const foundMatch = matches.find(m => m.index === placeholderIndex);
          if (foundMatch) {
            replacedPlaceholders.add(match);
            return foundMatch.value;
          }
          return "--";
        });
      });

      const otherEntries = contractVariableEntries.filter(e =>
        !e.originalKey?.startsWith("plain_text_") && 
        !e.originalKey?.startsWith("date_") && 
        !e.key.includes("signature") &&
        !(e.originalKey || e.key).toLowerCase().includes('product') &&
        // Exclude indexed name variables (already processed above)
        !(() => {
          const originalKey = e.originalKey || '';
          const indexedMatch = originalKey.match(/^(.+)_(\d+)$/);
          if (!indexedMatch) return false;
          const baseKey = indexedMatch[1];
          return (baseKey === 'User Name' || baseKey === 'Influencer Name' || baseKey === 'Companies Name') &&
                 !originalKey.startsWith('name.product');
        })()
      );
      
      // Process all product-related entries (indexed name.product_0, name.product_1 and non-indexed name.product, product)
      const allProductEntries = contractVariableEntries.filter(e =>
        (e.originalKey || e.key).toLowerCase().includes('product')
      ).sort((a, b) => {
        // Sort by index if present (name.product_0, name.product_1, etc.)
        const aKey = a.originalKey || '';
        const bKey = b.originalKey || '';
        const aMatch = aKey.match(/_(\d+)$/);
        const bMatch = bKey.match(/_(\d+)$/);
        
        if (aMatch && bMatch) {
          return parseInt(aMatch[1], 10) - parseInt(bMatch[1], 10);
        }
        if (aMatch) return 1;
        if (bMatch) return -1;
        return 0;
      });

      if (allProductEntries.length > 0) {
        const productMatches: Array<{ index: number; value: string; originalKey: string; key: string }> = [];

        allProductEntries.forEach((entry) => {
          const input = entry.inputValue?.trim() ?? "";
          let sanitizedValue = "";
          if (input) {
            const products = input.split(',').map(p => p.trim()).filter(Boolean);
            if (products.length > 0) {
              const listItems = products.map(product => {
                const escapedProduct = escapeHtml(product);
                // Using a literal bullet character with a non-breaking space for maximum compatibility
                return `<p style="margin: 0 0 2px 0; padding: 0; display: block; line-height: 1.4;">•&nbsp;${escapedProduct}</p>`;
              }).join('');
              
              // Structured with a bold header and the list, ensuring one clear line gap
              sanitizedValue = `<div style="margin: 12px 0;"><p style="margin-bottom: 12px; font-weight: bold; display: block;">Selected:</p>${listItems}</div>`;
            }
          }
          
          let index = -1;
          const match = (entry.originalKey || '').match(/_(\d+)$/);
          if (match) {
            index = parseInt(match[1], 10);
          }
          
          productMatches.push({ 
            index, 
            value: sanitizedValue, 
            originalKey: entry.originalKey || '', 
            key: entry.key 
          });
          variablesMap[entry.originalKey || entry.key] = input || null;
        });

        // 1. First, handle indexed placeholders in content: var[{{Product Name [1]}}], var[{{product [1]}}]
        productMatches.forEach(m => {
          if (m.index !== -1) {
            const indexedPattern = `var\\[\\s*\\{\\{\\s*(Product Name|product)\\s*\\[\\s*${m.index + 1}\\s*\\]\\s*\\}\\}\\s*\\]`;
            replaceWithHtmlWrapping(indexedPattern, m.value);
          }
        });

        // 2. Second, handle specific full keys found in entries
        productMatches.forEach(m => {
          if (m.key) {
            const escaped = m.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            replaceWithHtmlWrapping(escaped, m.value);
          }
        });

        // 3. Finally, handle legacy/repeated placeholders
        const commonPattern = `var\\[\\s*\\{\\{\\s*(Product Name|product)\\s*\\}\\}\\s*\\]`;
        const commonRegex = new RegExp(commonPattern, "gi");
        
        let occurrenceIndex = 0;
        previewHtml = previewHtml.replace(commonRegex, (match) => {
          const m = productMatches[occurrenceIndex] || productMatches[0];
          occurrenceIndex++;
          if (m) {
            replacedPlaceholders.add(match);
            return m.value;
          }
          return match;
        });
      }

      // Process plain_text entries sequentially - replace each occurrence with its corresponding value
      if (plainTextEntries.length > 0) {
        const matches: Array<{ index: number; contentIndex: number; value: string }> = [];

        // Collect all plain_text values in order
        // Note: plain_text_0, plain_text_1 are 0-indexed in variables, but content uses plain_text [1], plain_text [2] (1-indexed)
        plainTextEntries.forEach((entry) => {
          const input = entry.inputValue?.trim() ?? "";
          let sanitizedValue = input ? escapeHtml(input).replace(/\r?\n/g, "<br />") : "";
          const entryIndex = parseInt(entry.originalKey?.replace("plain_text_", "") || "0", 10);
          // contentIndex is 1-indexed (for matching with var[{{plain_text [1]}}])
          const contentIndex = entryIndex + 1;
          matches.push({ index: entryIndex, contentIndex, value: sanitizedValue });

          // Store value for this specific occurrence
          variablesMap[entry.originalKey || entry.key] = input || null;
        });

        // Try indexed format first: var[{{plain_text [1]}}], var[{{plain_text [2]}}], etc.
        const indexedPlaceholderPattern = `var\\[\\s*\\{\\{\\s*plain_text\\s*\\[\\s*(\\d+)\\s*\\]\\s*\\}\\}\\s*\\]`;
        const indexedRegex = new RegExp(indexedPlaceholderPattern, "gi");
        
        // Replace indexed format occurrences (content uses 1-indexed format)
        previewHtml = previewHtml.replace(indexedRegex, (match, capturedIndex) => {
          const placeholderIndex = parseInt(capturedIndex, 10); // This is 1-indexed from content
          const foundMatch = matches.find(m => m.contentIndex === placeholderIndex);
          if (foundMatch) {
            replacedPlaceholders.add(match);
            return foundMatch.value;
          }
          return "--";
        });

        // Also handle old format: var[{{plain_text}}] (for backward compatibility)
        const oldPlaceholder = "var[{{plain_text}}]";
        const escapedPlaceholder = oldPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const oldRegex = new RegExp(escapedPlaceholder, "g");
        let occurrenceIndex = 0;
        previewHtml = previewHtml.replace(oldRegex, (match) => {
          const foundMatch = matches.find(m => m.index === occurrenceIndex);
          occurrenceIndex++;
          if (foundMatch) {
            replacedPlaceholders.add(match);
            return foundMatch.value;
          }
          return "--";
        });
      }

      // Process signature entries separately - display as image or styled text
      // First, remove existing signature boxes and replace them with placeholders
      // This ensures we start with a clean template
      previewHtml = previewHtml
        // Restore signature.user placeholders from existing images/spans
        .replace(/<img[^>]*data-signature-key=["']signature\.user["'][^>]*>/gi, 'var[{{signature.user}}]')
        .replace(/<span[^>]*data-signature-key=["']signature\.user["'][^>]*>.*?<\/span>/gi, 'var[{{signature.user}}]')
        // Restore signature.influencer placeholders from existing images/spans
        .replace(/<img[^>]*data-signature-key=["']signature\.influencer["'][^>]*>/gi, 'var[{{signature.influencer}}]')
        .replace(/<span[^>]*data-signature-key=["']signature\.influencer["'][^>]*>.*?<\/span>/gi, 'var[{{signature.influencer}}]')
        // Remove existing signature images (generic fallback)
        .replace(/<img[^>]*alt=["']Signature["'][^>]*>/gi, 'var[{{signature}}]')
        // Remove existing signature text spans (with signature fonts)
        .replace(/<span[^>]*style[^>]*font-family[^>]*['"]Dancing Script['"][^>]*>.*?<\/span>/gi, 'var[{{signature}}]')
        .replace(/<span[^>]*style[^>]*font-family[^>]*['"]Great Vibes['"][^>]*>.*?<\/span>/gi, 'var[{{signature}}]')
        .replace(/<span[^>]*style[^>]*font-family[^>]*['"]Allura['"][^>]*>.*?<\/span>/gi, 'var[{{signature}}]')
        .replace(/<span[^>]*style[^>]*font-family[^>]*['"]Brush Script MT['"][^>]*>.*?<\/span>/gi, 'var[{{signature}}]')
        .replace(/<span[^>]*style[^>]*font-family[^>]*['"]Lucida Handwriting['"][^>]*>.*?<\/span>/gi, 'var[{{signature}}]')
        .replace(/<span[^>]*style[^>]*font-family[^>]*['"]Pacifico['"][^>]*>.*?<\/span>/gi, 'var[{{signature}}]')
        .replace(/<span[^>]*style[^>]*font-family[^>]*['"]Satisfy['"][^>]*>.*?<\/span>/gi, 'var[{{signature}}]')
        .replace(/<span[^>]*style[^>]*font-family[^>]*['"]Kalam['"][^>]*>.*?<\/span>/gi, 'var[{{signature}}]')
        .replace(/<span[^>]*style[^>]*font-family[^>]*['"]Caveat['"][^>]*>.*?<\/span>/gi, 'var[{{signature}}]')
        .replace(/<span[^>]*style[^>]*font-family[^>]*['"]Permanent Marker['"][^>]*>.*?<\/span>/gi, 'var[{{signature}}]')
        // Remove existing signature box containers (keep only the placeholder)
        .replace(/<span[^>]*class=["'][^"']*signature-box[^"']*["'][^>]*>(.*?)<\/span>/gi, (match, content) => {
          if (content.match(/signature\.user/i)) return 'var[{{signature.user}}]';
          if (content.match(/signature\.influencer/i)) return 'var[{{signature.influencer}}]';
          return 'var[{{signature}}]';
        })
        .replace(/<span[^>]*data-signature=["']true["'][^>]*>(.*?)<\/span>/gi, (match, content) => {
          if (content.match(/signature\.user/i)) return 'var[{{signature.user}}]';
          if (content.match(/signature\.influencer/i)) return 'var[{{signature.influencer}}]';
          return 'var[{{signature}}]';
        });

      // Handle signature.user and signature.influencer placeholders separately
      // First, handle signature.user (including indexed versions like signature.user_0, signature.user_1)
      const signatureUserEntries = contractVariableEntries.filter(
        e => {
          const originalKey = (e.originalKey || '').toLowerCase();
          const key = (e.key || '').toLowerCase();
          return (originalKey === 'signature.user' || 
                  originalKey.startsWith('signature.user_') ||
                  key === 'signature.user' ||
                  key.includes('signature.user')) && 
                 !e.originalKey?.startsWith("plain_text_");
        }
      )
      .sort((a, b) => {
        // Sort by index: signature.user_0, signature.user_1, etc.
        const aKey = (a.originalKey || '').toLowerCase();
        const bKey = (b.originalKey || '').toLowerCase();
        const aIndex = aKey.startsWith('signature.user_') 
          ? parseInt(aKey.replace('signature.user_', '') || '0', 10)
          : -1; // Non-indexed entries come first
        const bIndex = bKey.startsWith('signature.user_') 
          ? parseInt(bKey.replace('signature.user_', '') || '0', 10)
          : -1;
        return aIndex - bIndex;
      });

      if (signatureUserEntries.length > 0) {
        // First, handle indexed format: var[{{signature.user [1]}}], var[{{signature.user [2]}}], etc.
        const indexedRegex = /var\[\s*\{\{\s*signature\.user\s*\[\s*(\d+)\s*\]\s*\}\}\s*\]/gi;
        let indexedOccurrence = 0;
        
        previewHtml = previewHtml.replace(indexedRegex, (match, capturedIndex) => {
          const placeholderIndex = parseInt(capturedIndex, 10); // This is 1-indexed from content
          const entryIndex = placeholderIndex - 1; // Convert to 0-indexed for array access
          const entry = signatureUserEntries[entryIndex] || signatureUserEntries[0];
          
          // Mark this placeholder as replaced
          replacedPlaceholders.add(match);
          
          let signatureValue: string | null = null;

          if (entry.editable) {
            signatureValue = entry.inputValue?.startsWith('data:image') ? entry.inputValue : (entry.inputValue?.trim() ?? null);
          } else if (entry.rawValues && entry.rawValues.length) {
            signatureValue = entry.rawValues[0];
          } else if (entry.value) {
            signatureValue = entry.value;
          }

          let displayHtml = "";

          if (signatureValue && signatureValue !== "--") {
            if (signatureValue.startsWith("data:image")) {
              displayHtml = `<img src="${signatureValue}" alt="Signature" data-signature-key="signature.user" style="display: inline-block; max-width: 200px; max-height: 80px; margin-top: 20px; margin-bottom: 20px; vertical-align: middle;" />`;
            } else {
              const sanitizedText = escapeHtml(signatureValue);
              displayHtml = `<span style="display: inline-block; font-family: 'Dancing Script', 'Great Vibes', 'Allura', 'Brush Script MT', 'Lucida Handwriting', 'Pacifico', 'Satisfy', 'Kalam', 'Caveat', 'Permanent Marker', cursive; font-size: 24px; margin-top: 20px; margin-bottom: 20px; vertical-align: middle;">${sanitizedText}</span>`;
            }
          } else {
            // Show placeholder with index number: var[{{signature.user [1]}}], var[{{signature.user [2]}}], etc.
            displayHtml = `<span class="signature-box signature-box-clickable" data-signature="true" data-signature-key="signature.user" style="cursor: pointer; transition: all 0.2s;">var[{{signature.user [${placeholderIndex}]}}]</span>`;
          }

          // Store signature value in variablesMap using indexed key (1-indexed for Supabase)
          let storedValue = entry.editable
            ? (entry.inputValue?.startsWith('data:image') ? entry.inputValue : (entry.inputValue?.trim() ?? null))
            : entry.rawValues && entry.rawValues.length
              ? entry.rawValues.join("\n")
              : entry.value ?? null;

          // Convert null or "null" string to empty string
          if (storedValue === null || storedValue === "null" || storedValue === "") {
            storedValue = "";
          }

          // Store with indexed key matching the placeholder (1-indexed: Signature.User_1, Signature.User_2, etc.)
          const indexedKey = `Signature.User_${placeholderIndex}`;
          variablesMap[indexedKey] = storedValue;
          // Also store with originalKey for backward compatibility
          if (entry.originalKey) {
            variablesMap[entry.originalKey] = storedValue;
          }

          return displayHtml;
        });

        // Then, handle non-indexed format: var[{{signature.user}}] (sequential replacement)
        const regex = /var\[\s*\{\{\s*signature\.user\s*\}\}\s*\]/gi;
        let occurrenceIndex = 0;

        previewHtml = previewHtml.replace(regex, (match) => {
          const entry = signatureUserEntries[occurrenceIndex] || signatureUserEntries[0];
          occurrenceIndex++;
          
          // Mark this placeholder as replaced
          replacedPlaceholders.add(match);
          
          let signatureValue: string | null = null;

          if (entry.editable) {
            signatureValue = entry.inputValue?.trim() ?? null;
          } else if (entry.rawValues && entry.rawValues.length) {
            signatureValue = entry.rawValues[0];
          } else if (entry.value) {
            signatureValue = entry.value;
          }

          let displayHtml = "";

          if (signatureValue && signatureValue !== "--") {
            if (signatureValue.startsWith("data:image")) {
              displayHtml = `<img src="${signatureValue}" alt="Signature" data-signature-key="signature.user" style="display: inline-block; max-width: 200px; max-height: 80px; margin-top: 20px; margin-bottom: 20px; vertical-align: middle;" />`;
            } else {
              const sanitizedText = escapeHtml(signatureValue);
              displayHtml = `<span style="display: inline-block; font-family: 'Dancing Script', 'Great Vibes', 'Allura', 'Brush Script MT', 'Lucida Handwriting', 'Pacifico', 'Satisfy', 'Kalam', 'Caveat', 'Permanent Marker', cursive; font-size: 24px; margin-top: 20px; margin-bottom: 20px; vertical-align: middle;">${sanitizedText}</span>`;
            }
          } else {
            // Show placeholder with index number: var[{{signature.user [1]}}], var[{{signature.user [2]}}], etc.
            displayHtml = `<span class="signature-box signature-box-clickable" data-signature="true" data-signature-key="signature.user" style="cursor: pointer; transition: all 0.2s;">var[{{signature.user [${occurrenceIndex}]}}]</span>`;
          }

          // For signature images (data:image), don't trim as it might break the data URL
          let storedValue = entry.editable
            ? (entry.inputValue?.startsWith('data:image') ? entry.inputValue : (entry.inputValue?.trim() ?? null))
            : entry.rawValues && entry.rawValues.length
              ? entry.rawValues.join("\n")
              : entry.value ?? null;

          // Convert null or "null" string to empty string
          if (storedValue === null || storedValue === "null" || storedValue === "") {
            storedValue = "";
          }

          // Store signature value in variablesMap using indexed key (1-indexed for Supabase)
          // occurrenceIndex is already incremented, so use it directly (1-indexed)
          const indexedKey = `Signature.User_${occurrenceIndex}`;
          variablesMap[indexedKey] = storedValue;
          // Also store with originalKey for backward compatibility
          if (entry.originalKey) {
            variablesMap[entry.originalKey] = storedValue;
          }

          return displayHtml;
        });
      } else {
        // If no entry exists, make placeholder clickable
        const placeholder = "var[{{signature.user}}]";
        const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escapedPlaceholder, "g");
        previewHtml = previewHtml.replace(regex, () => {
          return `<span class="signature-box signature-box-clickable" data-signature="true" data-signature-key="signature.user" style="cursor: pointer; transition: all 0.2s;">var[{{signature.user}}]</span>`;
        });
      }

      // Handle signature.influencer (including indexed versions like signature.influencer_0, signature.influencer_1)
      const signatureInfluencerEntries = contractVariableEntries.filter(
        e => {
          const originalKey = (e.originalKey || '').toLowerCase();
          const key = (e.key || '').toLowerCase();
          return (originalKey === 'signature.influencer' || 
                  originalKey.startsWith('signature.influencer_') ||
                  key === 'signature.influencer' ||
                  key.includes('signature.influencer')) && 
                 !e.originalKey?.startsWith("plain_text_");
        }
      )
      .sort((a, b) => {
        // Sort by index: signature.influencer_0, signature.influencer_1, etc.
        const aKey = (a.originalKey || '').toLowerCase();
        const bKey = (b.originalKey || '').toLowerCase();
        const aIndex = aKey.startsWith('signature.influencer_') 
          ? parseInt(aKey.replace('signature.influencer_', '') || '0', 10)
          : -1; // Non-indexed entries come first
        const bIndex = bKey.startsWith('signature.influencer_') 
          ? parseInt(bKey.replace('signature.influencer_', '') || '0', 10)
          : -1;
        return aIndex - bIndex;
      });

      if (signatureInfluencerEntries.length > 0) {
        // First, handle indexed format: var[{{signature.influencer [1]}}], var[{{signature.influencer [2]}}], etc.
        const indexedRegex = /var\[\s*\{\{\s*signature\.influencer\s*\[\s*(\d+)\s*\]\s*\}\}\s*\]/gi;
        
        previewHtml = previewHtml.replace(indexedRegex, (match, capturedIndex) => {
          const placeholderIndex = parseInt(capturedIndex, 10); // This is 1-indexed from content
          const entryIndex = placeholderIndex - 1; // Convert to 0-indexed for array access
          const entry = signatureInfluencerEntries[entryIndex] || signatureInfluencerEntries[0];
          
          // Mark this placeholder as replaced
          replacedPlaceholders.add(match);
          
          let signatureValue: string | null = null;

          if (entry.editable) {
            signatureValue = entry.inputValue?.startsWith('data:image') ? entry.inputValue : (entry.inputValue?.trim() ?? null);
          } else if (entry.rawValues && entry.rawValues.length) {
            signatureValue = entry.rawValues[0];
          } else if (entry.value) {
            signatureValue = entry.value;
          }

          let displayHtml = "";

          if (signatureValue && signatureValue !== "--" && signatureValue.length > 0) {
            if (signatureValue.startsWith("data:image")) {
              displayHtml = `<img src="${signatureValue}" alt="Signature" style="display: inline-block; max-width: 200px; max-height: 80px; margin-top: 20px; margin-bottom: 20px; vertical-align: middle;" />`;
            } else {
              const sanitizedText = escapeHtml(signatureValue);
              displayHtml = `<span style="display: inline-block; font-family: 'Dancing Script', 'Great Vibes', 'Allura', 'Brush Script MT', 'Lucida Handwriting', 'Pacifico', 'Satisfy', 'Kalam', 'Caveat', 'Permanent Marker', cursive; font-size: 24px; margin-top: 20px; margin-bottom: 20px; vertical-align: middle;">${sanitizedText}</span>`;
            }
          } else {
            // Show placeholder with index number: var[{{signature.influencer [2]}}], var[{{signature.influencer [3]}}], etc.
            displayHtml = `<span class="signature-box signature-box-clickable" data-signature="true" data-signature-key="signature.influencer" style="cursor: pointer; transition: all 0.2s;">var[{{signature.influencer [${placeholderIndex}]}}]</span>`;
          }

          // Store signature value in variablesMap using indexed key (1-indexed for Supabase)
          let storedValue = entry.editable
            ? (entry.inputValue?.startsWith('data:image') ? entry.inputValue : (entry.inputValue?.trim() ?? null))
            : entry.rawValues && entry.rawValues.length
              ? entry.rawValues.join("\n")
              : entry.value ?? null;

          // Convert null or "null" string to empty string
          if (storedValue === null || storedValue === "null" || storedValue === "") {
            storedValue = "";
          }

          // Store with indexed key matching the placeholder (1-indexed: Signature.Influencer_1, Signature.Influencer_2, etc.)
          const indexedKey = `Signature.Influencer_${placeholderIndex}`;
          variablesMap[indexedKey] = storedValue;
          // Also store with originalKey for backward compatibility
          if (entry.originalKey) {
            variablesMap[entry.originalKey] = storedValue;
          }

          return displayHtml;
        });

        // Then, handle non-indexed format: var[{{signature.influencer}}] (sequential replacement)
        const placeholder = "var[{{signature.influencer}}]";
        const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escapedPlaceholder, "g");
        let occurrenceIndex = 0;

        previewHtml = previewHtml.replace(regex, (match) => {
          const entry = signatureInfluencerEntries[occurrenceIndex] || signatureInfluencerEntries[0];
          occurrenceIndex++;
          
          // Mark this placeholder as replaced
          replacedPlaceholders.add(match);
          
          let signatureValue: string | null = null;

          if (entry.editable) {
            signatureValue = entry.inputValue?.startsWith('data:image') ? entry.inputValue : (entry.inputValue?.trim() ?? null);
          } else if (entry.rawValues && entry.rawValues.length) {
            signatureValue = entry.rawValues[0];
          } else if (entry.value) {
            signatureValue = entry.value;
          }

          let displayHtml = "";

          if (signatureValue && signatureValue !== "--" && signatureValue.length > 0) {
            if (signatureValue.startsWith("data:image")) {
              displayHtml = `<img src="${signatureValue}" alt="Signature" style="display: inline-block; max-width: 200px; max-height: 80px; margin-top: 20px; margin-bottom: 20px; vertical-align: middle;" />`;
            } else {
              const sanitizedText = escapeHtml(signatureValue);
              displayHtml = `<span style="display: inline-block; font-family: 'Dancing Script', 'Great Vibes', 'Allura', 'Brush Script MT', 'Lucida Handwriting', 'Pacifico', 'Satisfy', 'Kalam', 'Caveat', 'Permanent Marker', cursive; font-size: 24px; margin-top: 20px; margin-bottom: 20px; vertical-align: middle;">${sanitizedText}</span>`;
            }
          } else {
            // Show placeholder with index number: var[{{signature.influencer [1]}}], var[{{signature.influencer [2]}}], etc.
            displayHtml = `<span class="signature-box signature-box-clickable" data-signature="true" data-signature-key="signature.influencer" style="cursor: pointer; transition: all 0.2s;">var[{{signature.influencer [${occurrenceIndex}]}}]</span>`;
          }

          // For signature images (data:image), don't trim as it might break the data URL
          let storedValue = entry.editable
            ? (entry.inputValue?.startsWith('data:image') ? entry.inputValue : (entry.inputValue?.trim() ?? null))
            : entry.rawValues && entry.rawValues.length
              ? entry.rawValues.join("\n")
              : entry.value ?? null;

          // Convert null or "null" string to empty string
          if (storedValue === null || storedValue === "null" || storedValue === "") {
            storedValue = "";
          }

          // Store signature value in variablesMap using indexed key (1-indexed for Supabase)
          // occurrenceIndex is already incremented, so use it directly (1-indexed)
          const indexedKey = `Signature.Influencer_${occurrenceIndex}`;
          variablesMap[indexedKey] = storedValue;
          // Also store with originalKey for backward compatibility
          if (entry.originalKey) {
            variablesMap[entry.originalKey] = storedValue;
          }

          return displayHtml;
        });
      } else {
        // If no entry exists, make placeholder clickable
        const placeholder = "var[{{signature.influencer}}]";
        const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escapedPlaceholder, "g");
        previewHtml = previewHtml.replace(regex, () => {
          return `<span class="signature-box signature-box-clickable" data-signature="true" data-signature-key="signature.influencer" style="cursor: pointer; transition: all 0.2s;">var[{{signature.influencer}}]</span>`;
        });
      }

      // Sort signature entries by index for sequential replacement (legacy signature_0, signature_1, etc.)
      const signatureEntries = contractVariableEntries
        .filter(e => (e.originalKey?.startsWith("signature_") || (e.key.includes("signature") && !e.key.includes("signature.user") && !e.key.includes("signature.influencer"))) && !e.originalKey?.startsWith("plain_text_"))
        .sort((a, b) => {
          // Sort by index: signature_0, signature_1, etc.
          const aIndex = a.originalKey?.startsWith("signature_")
            ? parseInt(a.originalKey.replace("signature_", "") || "0", 10)
            : 0;
          const bIndex = b.originalKey?.startsWith("signature_")
            ? parseInt(b.originalKey.replace("signature_", "") || "0", 10)
            : 0;
          return aIndex - bIndex;
        });

      if (signatureEntries.length > 0) {
        const placeholder = "var[{{signature}}]";
        const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escapedPlaceholder, "g");
        let occurrenceIndex = 0;

        // Replace each signature occurrence sequentially
        previewHtml = previewHtml.replace(regex, () => {
          const entry = signatureEntries[occurrenceIndex] || signatureEntries[0];
          occurrenceIndex++;

          let signatureValue: string | null = null;

          if (entry.editable) {
            signatureValue = entry.inputValue?.trim() ?? null;
          } else if (entry.rawValues && entry.rawValues.length) {
            signatureValue = entry.rawValues[0];
          } else if (entry.value) {
            signatureValue = entry.value;
          }

          let displayHtml = "";

          if (signatureValue && signatureValue !== "--") {
            // Check if it's an image data URL (drawn signature)
            if (signatureValue.startsWith("data:image")) {
              // Display as image
              displayHtml = `<img src="${signatureValue}" alt="Signature" style="display: inline-block; max-width: 200px; max-height: 80px; margin-top: 20px; margin-bottom: 20px; vertical-align: middle;" />`;
            } else {
              // Display as text with signature font styling
              const sanitizedText = escapeHtml(signatureValue);
              displayHtml = `<span style="display: inline-block; font-family: 'Dancing Script', 'Great Vibes', 'Allura', 'Brush Script MT', 'Lucida Handwriting', 'Pacifico', 'Satisfy', 'Kalam', 'Caveat', 'Permanent Marker', cursive; font-size: 24px; margin-top: 20px; margin-bottom: 20px; vertical-align: middle;">${sanitizedText}</span>`;
            }
          } else {
            // Show placeholder box with signature box styling - keep var[{{signature}}] as is
            // Use only class, let CSS handle all styling to avoid nested boxes
            displayHtml = `<span class="signature-box" data-signature="true">var[{{signature}}]</span>`;
          }

          // Store variable value for saving
          // For signature images (data:image), don't trim as it might break the data URL
          let storedValue = entry.editable
            ? (entry.inputValue?.startsWith('data:image') ? entry.inputValue : (entry.inputValue?.trim() ?? null))
            : entry.rawValues && entry.rawValues.length
              ? entry.rawValues.join("\n")
              : entry.value ?? null;

          // Convert null or "null" string to empty string
          if (storedValue === null || storedValue === "null" || storedValue === "") {
            storedValue = "";
          }

          if (entry.originalKey) {
            variablesMap[entry.originalKey] = storedValue;
            console.log('Storing signature_* in variablesMap:', { 
              key: entry.originalKey, 
              hasValue: !!storedValue,
              isImage: storedValue?.startsWith('data:image'),
              valueLength: storedValue?.length 
            });
          }

          return displayHtml;
        });
      }

      // Process other entries (non-plain_text)
      otherEntries.forEach((entry) => {
        const placeholder = entry.key;
        let values: string[] = [];

        if (entry.editable) {
          // For editable entries, prioritize inputValue (user input), fallback to value
          const input = (entry.inputValue?.trim() ?? entry.value?.trim() ?? "");
          if (input.length > 0) {
            values = [input];
          }
        } else {
          // For non-editable entries, check rawValues first, then value
          if (entry.rawValues && entry.rawValues.length > 0) {
            // Convert "--" to empty string, filter out null/undefined
            // Also handle format "key: value" or "key: --"
            const processedRawValues = entry.rawValues.map(v => {
              if (!v) return "";
              let trimmed = String(v).trim();
              
              // Handle cases where value might be in format "key: value" or "key: --"
              const colonMatch = trimmed.match(/^[^:]+:\s*(.+)$/);
              if (colonMatch) {
                trimmed = colonMatch[1].trim();
              }
              
              // Convert "--" to empty string
              return trimmed === "--" ? "" : trimmed;
            }).filter(v => v !== null && v !== undefined);
            
            // Only use if we have at least one non-empty value
            const nonEmptyValues = processedRawValues.filter(v => v && v.length > 0);
            if (nonEmptyValues.length > 0) {
              values = nonEmptyValues;
            } else if (processedRawValues.some(v => v === "")) {
              // If we have empty strings (from "--"), use them to replace with blank
              values = [""];
            }
          }
          
          // If no rawValues, check value field
          if (values.length === 0 && entry.value) {
            let valueStr = String(entry.value).trim();
            
            // Handle cases where value might be in format "key: value" or "key: --"
            // Also handle format like "value1 • value2 • key: --" (multiple values joined)
            // Extract just the value part if it's in that format
            const colonMatch = valueStr.match(/^[^:]+:\s*(.+)$/);
            if (colonMatch) {
              valueStr = colonMatch[1].trim();
            } else {
              // Check if value contains " • " (multiple values) and one of them is "key: --"
              // Extract the last part after " • " if it matches "key: --"
              const parts = valueStr.split(" • ");
              if (parts.length > 1) {
                const lastPart = parts[parts.length - 1].trim();
                const lastColonMatch = lastPart.match(/^[^:]+:\s*(.+)$/);
                if (lastColonMatch && lastColonMatch[1].trim() === "--") {
                  // If the last part is "key: --", use empty string
                  valueStr = "";
                } else {
                  // Otherwise, try to extract from the full string
                  const fullColonMatch = valueStr.match(/[^•]+:\s*(--)\s*$/);
                  if (fullColonMatch) {
                    valueStr = "--";
                  }
                }
              }
            }
            
            // If value is "--", treat it as empty (will result in blank replacement)
            if (valueStr === "--") {
              values = [""]; // Empty string to replace placeholder with blank
            } else if (valueStr.length > 0 && valueStr !== "--") {
              values = [valueStr];
            }
          }
        }
        
        // Debug logging for address fields
        if ((entry.originalKey?.includes('Address') || entry.key?.includes('Address'))) {
          console.log('[Address Field] Processing:', {
            originalKey: entry.originalKey,
            key: entry.key,
            placeholder: placeholder,
            inputValue: entry.inputValue,
            value: entry.value,
            editable: entry.editable,
            rawValues: entry.rawValues,
            values: values,
            hasValues: values.length > 0
          });
        }
        
        // If no values but we have an entry, check if value was "--" - if so, replace with blank
        if (values.length === 0) {
          // Check if the value was explicitly "--" - if so, replace with blank
          let hasDashDashValue = false;
          
          // Check entry.value
          if (entry.value) {
            let valueStr = String(entry.value).trim();
            // Handle "key: --" format
            const colonMatch = valueStr.match(/^[^:]+:\s*(.+)$/);
            if (colonMatch) {
              valueStr = colonMatch[1].trim();
            }
            hasDashDashValue = valueStr === "--";
          }
          
          // Check rawValues
          if (!hasDashDashValue && entry.rawValues && entry.rawValues.length > 0) {
            hasDashDashValue = entry.rawValues.some(v => {
              let val = String(v).trim();
              const colonMatch = val.match(/^[^:]+:\s*(.+)$/);
              if (colonMatch) {
                val = colonMatch[1].trim();
              }
              return val === "--";
            });
          }
          
          if (hasDashDashValue) {
            values = [""]; // Replace "--" with blank in preview
          } else {
            // For truly empty values, skip replacement (will be handled by final cleanup)
            if ((entry.originalKey?.includes('Address') || entry.key?.includes('Address'))) {
              console.warn('[Address] Skipping - no values:', {
                originalKey: entry.originalKey,
                inputValue: entry.inputValue,
                value: entry.value,
                rawValues: entry.rawValues
              });
            }
            return;
          }
        }

        // Check if this is a date variable
        const normalizedKey = (entry.originalKey || entry.key).toLowerCase();
        const isDate = normalizedKey === "date" || normalizedKey.includes("date") || normalizedKey.includes("_date");

        // Format date values for display (YYYY-MM-DD to readable format)
        const formatValueForDisplay = (value: string): string => {
          if (isDate) {
            try {
              // Try to parse and format the date
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                return format(date, "MMMM d, yyyy");
              }
            } catch (e) {
              // If parsing fails, return original value
            }
          }
          return value;
        };

        // Extract base key and index from originalKey if it's indexed (e.g., "Address Line 1_1" -> base: "Address Line 1", index: 1)
        const originalKey = entry.originalKey || '';
        const indexedMatch = originalKey.match(/^(.+)_(\d+)$/);
        const baseKey = indexedMatch ? indexedMatch[1] : (entry.originalKey || entry.key.replace(/var\[\{\{|\}\}\]/g, '').trim());
        const variableIndex = indexedMatch ? parseInt(indexedMatch[2], 10) : null;
        
        // Extract display name from placeholder (e.g., "var[{{Address Line 1 [1]}}]" -> "Address Line 1")
        // Handle both formats: var[{{Address Line 1 [1]}}] and var[{{Address Line 1}}]
        const placeholderMatch = placeholder.match(/var\[\s*\{\{\s*([^}\[]+?)(?:\s*\[\s*\d+\s*\])?\s*\}\}\s*\]/);
        let displayName = placeholderMatch ? placeholderMatch[1].trim() : baseKey;
        
        // Clean up display name - remove any trailing index brackets
        displayName = displayName.replace(/\s*\[\s*\d+\s*\]\s*$/, '').trim();
        
        // Also try to match with the originalKey format (e.g., "Address City_1" -> try "Address City" and "Address City_1")
        // This handles cases where the HTML has "Address City [1]" but originalKey is "Address City_1"
        const possibleDisplayNames = [displayName, baseKey];
        if (indexedMatch) {
          // If indexed, also try without the index suffix
          possibleDisplayNames.push(indexedMatch[1]);
        }
        
        // Create regex patterns for both indexed and non-indexed formats
        // Pattern 1: var[{{Address Line 1 [1]}}] (indexed format)
        // Pattern 2: var[{{Address Line 1}}] (non-indexed format)
        const indexedPlaceholderPattern = variableIndex !== null 
          ? `var\\[\\s*\\{\\{\\s*${displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\[\\s*${variableIndex}\\s*\\]\\s*\\}\\}\\s*\\]`
          : null;
        const nonIndexedPlaceholderPattern = `var\\[\\s*\\{\\{\\s*${displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}\\s*\\]`;

        // Also create regex for actual key format (if different from display name)
        const actualKey = entry.originalKey || entry.key.replace(/var\[\{\{|\}\}\]/g, '').trim();
        let actualKeyPlaceholder: string | null = null;
        let actualKeyRegex: RegExp | null = null;
        if (actualKey !== displayName && !indexedMatch) {
          // If originalKey is different (e.g., name.influencer vs Influencer Name), create regex for both
          actualKeyPlaceholder = `var[{{${actualKey}}}]`;
          const escapedActualPlaceholder = actualKeyPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          actualKeyRegex = new RegExp(escapedActualPlaceholder, "gi");
        }

        // If multiple values exist, replace occurrences sequentially
        // First occurrence gets first value, second gets second, etc.
        if (values.length > 1) {
          const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(escapedPlaceholder, "gi");
          let occurrenceIndex = 0;

          previewHtml = previewHtml.replace(regex, () => {
            const valueIndex = occurrenceIndex % values.length; // Cycle through values if more occurrences than values
            const selectedValue = values[valueIndex];
            const formattedValue = formatValueForDisplay(selectedValue);
            occurrenceIndex++;
            return escapeHtml(formattedValue).replace(/\r?\n/g, "<br />");
          });
          
          // Also replace indexed format if applicable
          if (indexedPlaceholderPattern) {
            const indexedRegex = new RegExp(indexedPlaceholderPattern, "gi");
            previewHtml = previewHtml.replace(indexedRegex, () => {
              const selectedValue = values[0] || "";
              const formattedValue = formatValueForDisplay(selectedValue);
              return escapeHtml(formattedValue).replace(/\r?\n/g, "<br />");
            });
          }
          
          // Also replace actual key format if different
          if (actualKeyRegex) {
            let actualOccurrenceIndex = 0;
            previewHtml = previewHtml.replace(actualKeyRegex, () => {
              const valueIndex = actualOccurrenceIndex % values.length;
              const selectedValue = values[valueIndex];
              const formattedValue = formatValueForDisplay(selectedValue);
              actualOccurrenceIndex++;
              return escapeHtml(formattedValue).replace(/\r?\n/g, "<br />");
            });
          }
        } else {
          // Single value: replace all occurrences with the same value
          const displayValue = values.length ? formatValueForDisplay(values[0]) : "";
          const sanitizedValue = displayValue
            ? escapeHtml(displayValue).replace(/\r?\n/g, "<br />")
            : "";

          // Always replace - if value was "--", sanitizedValue will be empty string (blank)
          // This ensures "--" values show as blank in preview instead of "--"
          if (sanitizedValue !== undefined) {
            let replaced = false;
            
            // Try multiple placeholder formats to ensure we catch all variations
            // 1. Replace indexed format first (e.g., var[{{Address Line 1 [1]}}])
            if (indexedPlaceholderPattern) {
              if (replaceWithHtmlWrapping(indexedPlaceholderPattern, sanitizedValue)) {
                replaced = true;
                if ((entry.originalKey?.includes('Address') || entry.key?.includes('Address'))) {
                  console.log('[Address] ✓ Replaced indexed format:', indexedPlaceholderPattern, 'with:', sanitizedValue);
                }
              }
            }
            
            // 2. Replace exact placeholder match (from entry.key)
          const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            if (replaceWithHtmlWrapping(escapedPlaceholder, sanitizedValue)) {
              replaced = true;
              if ((entry.originalKey?.includes('Address') || entry.key?.includes('Address'))) {
                console.log('[Address] ✓ Replaced exact placeholder:', escapedPlaceholder, 'with:', sanitizedValue);
              }
            }
            
            // 3. Try all possible display name variations
            for (const name of possibleDisplayNames) {
              if (!name || name === displayName) continue; // Skip if already tried
              
              // Try indexed format with this name
              if (variableIndex !== null) {
                const altIndexedPattern = `var\\[\\s*\\{\\{\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\[\\s*${variableIndex}\\s*\\]\\s*\\}\\}\\s*\\]`;
                if (replaceWithHtmlWrapping(altIndexedPattern, sanitizedValue)) {
                  replaced = true;
                  if ((entry.originalKey?.includes('Address') || entry.key?.includes('Address'))) {
                    console.log('[Address] ✓ Replaced alt indexed format:', altIndexedPattern, 'with:', sanitizedValue);
                  }
                }
              }
              
              // Try non-indexed format with this name
              const altNonIndexedPattern = `var\\[\\s*\\{\\{\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}\\s*\\]`;
              if (replaceWithHtmlWrapping(altNonIndexedPattern, sanitizedValue)) {
                replaced = true;
                if ((entry.originalKey?.includes('Address') || entry.key?.includes('Address'))) {
                  console.log('[Address] ✓ Replaced alt display name format:', altNonIndexedPattern, 'with:', sanitizedValue);
                }
              }
            }
            
            // 4. Replace non-indexed display name format (e.g., var[{{Address Line 1}}])
            if (replaceWithHtmlWrapping(nonIndexedPlaceholderPattern, sanitizedValue)) {
              replaced = true;
              if ((entry.originalKey?.includes('Address') || entry.key?.includes('Address'))) {
                console.log('[Address] ✓ Replaced display name format:', nonIndexedPlaceholderPattern, 'with:', sanitizedValue);
              }
            }
            
            // 5. Replace actual key format if different (e.g., var[{{address.user.address_line1}}])
          if (actualKeyRegex) {
              const actualKeyPattern = actualKeyRegex.source;
              if (replaceWithHtmlWrapping(actualKeyPattern, sanitizedValue)) {
                replaced = true;
                if ((entry.originalKey?.includes('Address') || entry.key?.includes('Address'))) {
                  console.log('[Address] ✓ Replaced actual key format with:', sanitizedValue);
                }
              }
            }
            
            if (!replaced && (entry.originalKey?.includes('Address') || entry.key?.includes('Address'))) {
              console.warn('[Address] No replacement made for:', {
                originalKey: entry.originalKey,
                key: entry.key,
                placeholder: placeholder,
                indexedPattern: indexedPlaceholderPattern,
                nonIndexedPattern: nonIndexedPlaceholderPattern,
                displayName: displayName,
                sanitizedValue: sanitizedValue
              });
            }
          } else if ((entry.originalKey?.includes('Address') || entry.key?.includes('Address'))) {
            console.warn('[Address] No value to replace:', {
              originalKey: entry.originalKey,
              key: entry.key,
              inputValue: entry.inputValue,
              value: entry.value,
              editable: entry.editable
            });
          }
        }

        // Store variable value for saving (all values joined)
        const storedValue = entry.editable
          ? entry.inputValue?.trim() ?? null
          : entry.rawValues && entry.rawValues.length
            ? entry.rawValues.join("\n")
            : entry.value ?? null;

        // Use originalKey if available (for proper key format), otherwise use key
        // This ensures indexed variables (like Address Line 1_1) are stored correctly
        const keyToUse = entry.originalKey || entry.key;
        variablesMap[keyToUse] = storedValue && storedValue.length ? storedValue : null;
        
        // Also store using the display key format for backward compatibility
        if (entry.originalKey && entry.originalKey !== entry.key) {
        variablesMap[entry.key] = storedValue && storedValue.length ? storedValue : null;
        }
      });

      // Replace remaining placeholders with empty string, but keep signature placeholders as var[{{signature}}]
      // Also skip placeholders that have already been replaced
      previewHtml = previewHtml.replace(/var\[\s*\{\{([^}]+)\}\}\s*\]/g, (match, variableName) => {
        const trimmedName = variableName.trim().toLowerCase();
        // Keep signature placeholders as is (handle both lowercase and capitalized formats)
        // Check for: signature, signature.user, signature.influencer, Signature.User, Signature.Influencer, etc.
        if (trimmedName === "signature" || 
            trimmedName.includes("signature.") || 
            trimmedName.includes("signature.user") ||
            trimmedName.includes("signature.influencer") ||
            trimmedName.match(/signature\s*\[\s*\d+\s*\]/i) ||
            trimmedName.match(/signature\.(user|influencer)\s*\[\s*\d+\s*\]/i)) {
          return match; // Keep var[{{signature}}] as is
        }
        // Skip if this placeholder was already replaced
        if (replacedPlaceholders.has(match)) {
          return match; // Keep the replaced value
        }
        // Replace other placeholders with empty string instead of "--"
        return "";
      });
      
      // Also handle placeholders that might still be wrapped in HTML tags
      previewHtml = previewHtml.replace(/<span[^>]*>var\[\s*\{\{([^}]+)\}\}\s*\]<\/span>/gi, (match, variableName) => {
        const trimmedName = variableName.trim().toLowerCase();
        // Keep signature placeholders as is (handle both lowercase and capitalized formats)
        // Check for: signature, signature.user, signature.influencer, Signature.User, Signature.Influencer, etc.
        if (trimmedName === "signature" || 
            trimmedName.includes("signature.") || 
            trimmedName.includes("signature.user") ||
            trimmedName.includes("signature.influencer") ||
            trimmedName.match(/signature\s*\[\s*\d+\s*\]/i) ||
            trimmedName.match(/signature\.(user|influencer)\s*\[\s*\d+\s*\]/i)) {
          return match;
        }
        // Skip if this placeholder was already replaced
        if (replacedPlaceholders.has(match)) {
          return match;
        }
        // Replace other placeholders with empty string instead of "--"
        return "";
      });

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
    
    /* Prevent signature boxes from wrapping to new line - match editor styling */
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
    
    /* Ensure spacing between adjacent signature boxes */
    .contract-preview-container .tiptap-rendered .signature-box + .signature-box,
    .contract-preview-container .tiptap-rendered [data-signature="true"] + [data-signature="true"] {
      margin-left: 50px !important;
    }
    
    /* Prevent parent containers from wrapping signature boxes - allow inline flow */
    .contract-preview-container .tiptap-rendered p {
      white-space: pre-wrap !important;
      overflow-wrap: break-word;
      word-wrap: break-word;
    }
    
    /* Force signature boxes to stay on same line by preventing wrapping */
    .contract-preview-container .tiptap-rendered span.signature-box,
    .contract-preview-container .tiptap-rendered span[data-signature="true"] {
      float: none !important;
      clear: none !important;
      display: inline-block !important;
    }
    
    /* Ensure parent paragraphs with signature boxes don't wrap them */
    .contract-preview-container .tiptap-rendered p {
      display: block !important;
      line-height: 1.7 !important;
    }
    
    /* Prevent wrapping of signature boxes - use nowrap on parent when it contains signature boxes */
    .contract-preview-container .tiptap-rendered span:has(.signature-box),
    .contract-preview-container .tiptap-rendered span:has([data-signature="true"]) {
      white-space: nowrap !important;
      display: inline-block !important;
    }
    
    /* Alternative: prevent wrapping by ensuring parent span doesn't break */
    .contract-preview-container .tiptap-rendered span[style*="font-size: 10px"] {
      white-space: nowrap !important;
      display: inline-block !important;
    }
    
    /* Ensure signature boxes don't wrap by making parent container wider if needed */
    .contract-preview-container {
      min-width: 0 !important;
      overflow-x: auto !important;
    }
    
    /* Ensure parent divs don't break signature boxes */
    .contract-preview-container .tiptap-rendered div {
      white-space: normal !important;
    }
    
    /* Reduce spacing between all paragraphs */
    .contract-preview-container .tiptap-rendered p {
      margin: 0 0 4px 0 !important;
      line-height: 1.4 !important;
    }
    
    /* Further reduce spacing for paragraphs containing address fields */
    .contract-preview-container .tiptap-rendered p:has(span[data-variable-key*="address"]) {
      margin-bottom: 1px !important;
      margin-top: 0 !important;
      line-height: 1.2 !important;
      padding: 0 !important;
    }
    
    /* Reduce spacing between consecutive paragraphs that contain address fields */
    .contract-preview-container .tiptap-rendered p:has(span[data-variable-key*="address"]) + p:has(span[data-variable-key*="address"]) {
      margin-top: 0 !important;
      margin-bottom: 1px !important;
    }
    
    /* Target address field spans directly to reduce their spacing */
    .contract-preview-container .tiptap-rendered span[data-variable-key*="address"] {
      line-height: 1.2 !important;
      display: inline !important;
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

      // --- Magic Link Generation ---
      // Step 1: Check collaboration_variable_overrides table for existing magic_link column for THIS collaboration_id
      let magicLinkToken: string | null = null;
      
      if (!collaborationId) {
        console.error("[Magic Link] ERROR: collaborationId is required!");
        throw new Error("collaborationId is required for magic link generation");
      }
      
      // Check Supabase collaboration_variable_overrides table for magic_link column
      try {
        console.log(`[Magic Link] Checking collaboration_variable_overrides table for magic_link column for collaboration_id: ${collaborationId}`);
        
        const { data: existingRecord, error: queryError } = await (supabase as any)
          .from(VARIABLE_OVERRIDE_TABLE) // collaboration_variable_overrides
          .select("magic_link, collaboration_id")
          .eq("collaboration_id", collaborationId) // Filter by same collaboration_id
          .not("magic_link", "is", null) // Ensure magic_link is not null
          .limit(1)
          .maybeSingle();
        
        if (queryError) {
          console.error(`[Magic Link] Query error for collaboration_id ${collaborationId}:`, queryError);
        }
        
        // If magic_link exists in database for this collaboration_id, use it
        if (existingRecord?.magic_link && existingRecord.collaboration_id === collaborationId) {
          magicLinkToken = existingRecord.magic_link;
          console.log(`[Magic Link] ✓ Found existing magic_link in collaboration_variable_overrides for collaboration_id ${collaborationId}: ${magicLinkToken.substring(0, 8)}...`);
        } else {
          console.log(`[Magic Link] ✗ No existing magic_link found in collaboration_variable_overrides for collaboration_id ${collaborationId}`);
        }
      } catch (err) {
        console.error("[Magic Link] Error checking collaboration_variable_overrides table:", err);
      }

      // Step 2: If magic_link not present, generate new one
      const isNewMagicLink = !magicLinkToken;
      if (!magicLinkToken) {
        // Generate new unique UUID for this collaboration
        magicLinkToken = generateUUID();
        console.log(`[Magic Link] ✓ Generated NEW unique magic_link for collaboration_id ${collaborationId}: ${magicLinkToken.substring(0, 8)}...`);
      }

      // Add to variables map to be saved (for backwards compatibility)
      variablesMap["magic_link"] = magicLinkToken;
      // -----------------------------

      setContractPreviewHtml(previewHtml);
      setIsPreviewOpen(true);

      // Save all variables in a single entry with complete HTML
      const persistOverrides = async () => {
        try {
          const client = supabase as any;

          // Create a single record with all variables, contract_html, and magic_link
          // CRITICAL: Ensure collaboration_id is set correctly
          if (!collaborationId) {
            console.error("[Magic Link] ERROR: Cannot save - collaborationId is missing!");
            throw new Error("collaborationId is required to save magic_link");
          }
          
          console.log(`[Magic Link] Preparing to save for collaboration_id: ${collaborationId}, magic_link: ${magicLinkToken.substring(0, 8)}...`);
          
          const contractRecord = {
            campaign_id: resolvedCampaignId,
            influencer_id: resolvedInfluencerId,
            collaboration_id: collaborationId, // CRITICAL: This must be unique per collaboration
            variable_key: "all_variables",
            value: JSON.stringify(variablesMap),
            contract_html: completeHtmlDocument,
            magic_link: magicLinkToken // Save magic_link in the dedicated column
          };

          // First, delete any existing rows for this collaboration_id to avoid duplicates
          try {
            await (supabase as any)
              .from(VARIABLE_OVERRIDE_TABLE)
              .delete()
              .eq("collaboration_id", collaborationId);
          } catch (deleteErr) {
            console.warn("Failed to delete existing entries, will try to upsert anyway:", deleteErr);
          }

          // Step 3: Update Supabase collaboration_variable_overrides table with magic_link
          console.log(`[Magic Link] Updating collaboration_variable_overrides table with magic_link ${magicLinkToken.substring(0, 8)}... for collaboration_id: ${collaborationId}`);
          const { error: contractError } = await (supabase as any)
            .from(VARIABLE_OVERRIDE_TABLE) // collaboration_variable_overrides
            .upsert(contractRecord, { 
              onConflict: 'collaboration_id,variable_key'
            });
          
          if (!contractError) {
            console.log(`[Magic Link] ✓ Successfully updated collaboration_variable_overrides table with magic_link for collaboration_id ${collaborationId}`);
            
            // Show toast notification when new magic link is generated
            if (isNewMagicLink) {
              toast({
                title: "Magic Link Generated",
                description: `A new magic link has been generated and saved to collaboration_variable_overrides.`,
                variant: "default",
              });
            } else {
              toast({
                title: "Contract Updated",
                description: `Contract updated with existing magic link.`,
                variant: "default",
              });
            }
          }

          if (contractError) {
            const errorDetails = contractError;
            console.error("Failed to save contract - Error:", contractError);
            console.error("Error details:", JSON.stringify(errorDetails, null, 2));
            
            const errorMessage = errorDetails?.message || errorDetails?.code || "Unknown error";
            toast({
              title: "Warning",
              description: `Failed to save contract variables: ${errorMessage}. Preview generated successfully.`,
              variant: "destructive",
            });
          } else {
            // Update local state for magic link if it was newly generated
            if (!contractVariableEntries.find(e => e.key === "magic_link")) {
              setContractVariableEntries(prev => [...prev, {
                key: "magic_link",
                value: magicLinkToken,
                editable: false
              }]);
            }

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
            console.log("CollaborationAssignment: ✓ Contract and variables saved successfully");
            // Mark this collaboration ID as updated so Copy Magic Link button can be shown
            if (collaborationId) {
              setUpdatedCollaborationIds(prev => new Set(prev).add(collaborationId));
              
              // Check if all variables are filled and update filled status
              if (contractMeta?.id) {
                try {
                  // Get contract variables structure from contracts table
                  const { data: contractData } = await (supabase as any)
                    .from("contracts")
                    .select("variables")
                    .eq("id", contractMeta.id)
                    .maybeSingle();

                  if (contractData?.variables) {
                    const contractVariables = contractData.variables as Record<string, any>;
                    
                    if (contractVariables && typeof contractVariables === 'object') {
                      // Get all variable keys from contract structure (excluding signature.influencer)
                      const requiredVariableKeys = Object.keys(contractVariables).filter(key => {
                        return key !== 'signature.influencer';
                      });

                      if (requiredVariableKeys.length > 0) {
                        // Helper function to find saved value for a contract key
                        const findSavedValue = (contractKey: string): any => {
                          // Try direct match first
                          if (variablesMap[contractKey] !== undefined) {
                            return variablesMap[contractKey];
                          }
                          
                          // Try to find indexed version (date_0, date_1, etc.)
                          const indexedKeys = Object.keys(variablesMap).filter(key => 
                            key.startsWith(contractKey + '_')
                          );
                          if (indexedKeys.length > 0) {
                            return variablesMap[indexedKeys[0]];
                          }
                          
                          // Try placeholder format var[{{key}}]
                          const placeholderKey = `var[{{${contractKey}}}]`;
                          if (variablesMap[placeholderKey] !== undefined) {
                            return variablesMap[placeholderKey];
                          }
                          
                          return undefined;
                        };

                        // Check if all required variables have values in variablesMap
                        const allFilled = requiredVariableKeys.every(contractKey => {
                          const savedValue = findSavedValue(contractKey);
                          
                          // Check if value exists and is not null/empty
                          if (savedValue === null || savedValue === undefined) {
                            return false;
                          }
                          
                          // For string values, check if not empty
                          if (typeof savedValue === 'string') {
                            return savedValue.trim().length > 0 && savedValue !== '--';
                          }
                          
                          // For other types, just check if exists
                          return true;
                        });

                        // Update filled status for this collaboration ID
                        if (allFilled) {
                          setFilledCollaborationIds(prev => new Set(prev).add(collaborationId));
                        } else {
                          setFilledCollaborationIds(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(collaborationId);
                            return newSet;
                          });
                        }
                      }
                    }
                  }
                } catch (checkErr) {
                  console.error("Error checking variables filled status after update", checkErr);
                }
              }
            }
          }
        } catch (overrideErr) {
          console.error("CollaborationAssignment: Exception while saving overrides", overrideErr);
          toast({
            title: "Error saving contract",
            description: "An error occurred while saving the contract.",
            variant: "destructive",
          });
        }
      };

      await persistOverrides();
    } catch (error) {
      console.error("CollaborationAssignment: failed to build contract preview", error);
      toast({
        title: "Unable to update contract",
        description: "Something went wrong while preparing the contract preview.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleViewContract = async () => {
    if (!collaborationId) {
      toast({
        title: "No collaboration ID",
        description: "Collaboration ID is required to view contract.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingSavedContract(true);
    setIsViewContractOpen(true);
    try {
      // Query with variable_key filter to get the record with "all_variables"
      // Also fetch value field which contains signature data URLs
      const { data, error } = await (supabase as any)
        .from("collaboration_variable_overrides")
        .select("contract_html, value")
        .eq("collaboration_id", collaborationId)
        .eq("variable_key", "all_variables")
        .maybeSingle();

      if (error) {
        console.error("Error fetching contract with all_variables:", error);
        throw error;
      }

      const overrideData = data as { contract_html?: string | null; value?: string | null } | null;
      if (overrideData?.contract_html) {
        console.log("Found contract_html with all_variables");
        let html = overrideData.contract_html;
        
        // If we have the value field with signature data, ensure signatures are properly embedded
        if (overrideData.value) {
          try {
            const variablesObj = typeof overrideData.value === 'string' 
              ? JSON.parse(overrideData.value) 
              : overrideData.value;
            
            // Check if there are any signatures in the variables
            Object.entries(variablesObj).forEach(([key, val]) => {
              if (key.includes('signature') && val && String(val).startsWith('data:image')) {
                const signatureDataUrl = String(val);
                const placeholder = `var[{{${key}}}]`;
                
                // Check if signature is already in HTML, if not add it
                if (!html.includes(signatureDataUrl.substring(0, 50))) {
                  // Replace placeholder with signature image
                  const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                  const regex = new RegExp(escapedPlaceholder, "g");
                  const replacement = `<img src="${signatureDataUrl}" alt="Signature" data-signature-key="${key}" style="display: inline-block; max-width: 200px; max-height: 80px; margin-top: 20px; margin-bottom: 20px; vertical-align: middle;" />`;
                  html = html.replace(regex, replacement);
                }
              }
            });
          } catch (parseErr) {
            console.error("Error parsing value field:", parseErr);
          }
        }
        
        setSavedContractHtml(html);
      } else {
        console.log("No contract_html found with all_variables, trying fallback...");
        // Fallback: Try to get any record with contract_html for this collaboration_id
        const { data: fallbackData, error: fallbackError } = await (supabase as any)
          .from("collaboration_variable_overrides")
          .select("contract_html, value")
          .eq("collaboration_id", collaborationId)
          .not("contract_html", "is", null)
          .maybeSingle();

        if (!fallbackError && fallbackData?.contract_html) {
          console.log("Found contract_html in fallback query");
          let html = fallbackData.contract_html;
          
          // Also check for signatures in fallback data
          if (fallbackData.value) {
            try {
              const variablesObj = typeof fallbackData.value === 'string' 
                ? JSON.parse(fallbackData.value) 
                : fallbackData.value;
              
              Object.entries(variablesObj).forEach(([key, val]) => {
                if (key.includes('signature') && val && String(val).startsWith('data:image')) {
                  const signatureDataUrl = String(val);
                  const placeholder = `var[{{${key}}}]`;
                  const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                  const regex = new RegExp(escapedPlaceholder, "g");
                  const replacement = `<img src="${signatureDataUrl}" alt="Signature" data-signature-key="${key}" style="display: inline-block; max-width: 200px; max-height: 80px; margin-top: 20px; margin-bottom: 20px; vertical-align: middle;" />`;
                  html = html.replace(regex, replacement);
                }
              });
            } catch (parseErr) {
              console.error("Error parsing value field in fallback:", parseErr);
            }
          }
          
          setSavedContractHtml(html);
        } else {
          console.error("No contract_html found:", { fallbackError, fallbackData });
          setSavedContractHtml(null);
          toast({
            title: "No saved contract",
            description: "Please update the contract first to view it.",
            variant: "destructive",
          });
        }
      }
    } catch (err: any) {
      console.error("CollaborationAssignment: Error fetching saved contract", err);
      console.error("Error details:", JSON.stringify(err, null, 2));
      toast({
        title: "Unable to load contract",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
      setSavedContractHtml(null);
    } finally {
      setIsLoadingSavedContract(false);
    }
  };

  const handleSendContract = async () => {
    if (!collaborationId) {
      toast({
        title: "Error",
        description: "Collaboration ID not found.",
        variant: "destructive",
      });
      return;
    }

    if (!influencer) {
      toast({
        title: "Error",
        description: "Influencer information not found.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get magic link token
      let magicLinkToken = contractVariableEntries.find(e => e.key === "magic_link")?.value;

      if (!magicLinkToken && collaborationId) {
        try {
          const { data: magicLinkData } = await (supabase as any)
            .from("collaboration_variable_overrides")
            .select("magic_link")
            .eq("collaboration_id", collaborationId)
            .not("magic_link", "is", null)
            .limit(1)
            .maybeSingle();
          
          if (magicLinkData?.magic_link) {
            magicLinkToken = magicLinkData.magic_link;
          }
        } catch (err) {
          console.error("Error fetching magic_link from database", err);
        }
      }

      if (!magicLinkToken) {
        toast({
          title: "Magic Link Not Ready",
          description: "Please click 'Update Contract' to generate the magic link first.",
          variant: "destructive"
        });
        return;
      }

      // Update is_contract_sent flag in collaboration_actions
      const { error: updateError } = await (supabase as any)
        .from("collaboration_actions")
        .update({ is_contract_sent: true })
        .eq("collaboration_id", collaborationId);

      if (updateError) {
        console.error("Error updating is_contract_sent:", updateError);
        throw updateError;
      }

      // Update local state
      setIsContractSent(true);

      const timestamp = new Date().toLocaleString();
      setLastAction({
        label: "Contract sent",
        timestamp,
      });
      await logTimelineEntry(
        'contract_sent',
        'Contract sent to influencer',
        null,
        null,
        { timestamp }
      );

      // Create email body and open Zoho Mail 
      

      const magicLink = `${window.location.origin}/share/contract/${magicLinkToken}`;
      const influencerName = influencer.name || "Influencer";
      const influencerEmail = influencer.email || "";

      if (!influencerEmail) {
        toast({
          title: "Error",
          description: "Influencer email not found.",
          variant: "destructive",
        });
        return;
      }

      // Create email body
      const companyName = campaign?.brand || campaign?.name || "Company";
      const collabId = collaborationId || "N/A";
      const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      
      const processorName = currentUserProfile?.userName || "Yuvraj Pandey";
      const processorEmail = currentUserProfile?.email || "Yuvraj@growwik.com";
      const processorCode = currentUserProfile?.employeeId || "GRWK-001";

      const emailBody = `Hi ${influencerName},\n\nWe hope you're doing well!\n\nYour collaboration has been successfully initiated with ${companyName}.\n\nBelow is your secure contract signing magic link for Collaboration ID: ${collabId}.\n\nPlease click the link below to open and sign your contract:\n\n${magicLink}\n\nOnce the contract is signed, your onboarding for this collaboration will be completed.\n\nIf you face any issue while accessing the link or signing the contract, feel free to contact us anytime.\n\nProcessed By:\n\n• Name: ${processorName}\n• Email: ${processorEmail}\n• Employee Code: ${processorCode}\n• Date: ${currentDate}\n\nBest regards,\nGrowwik Media`;
      const emailSubject = `${companyName} - Contract Sign | ${collabId}`;
      
      // Store email details and show dialog instead of opening mail directly
      setEmailDetails({
        to: influencerEmail,
        subject: emailSubject,
        body: emailBody,
        magicLink: magicLink,
      });
      setIsEmailDialogOpen(true);
      
          toast({
        title: "Email Ready",
        description: "Email details are ready. Click 'Open' in the dialog to open Zoho Mail.",
      });
    } catch (error: any) {
      console.error("Error sending contract:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to send contract.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="flex min-h-screen bg-gradient-subtle">
        <Sidebar />
        <MobileNav />

        <div className="flex-1 lg:ml-56">
          <Header />
          <main className="container mx-auto w-full px-3 sm:px-4 py-4 sm:py-8 pb-24 lg:pb-8">
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-xs sm:text-sm">Loading collaboration assignment...</span>
                </div>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-xs sm:text-sm text-destructive">
                {error}
              </div>
            ) : !campaign ? (
              <Card className="border-none bg-gradient-to-br from-white/95 to-slate-100">
                <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                  <h2 className="text-lg sm:text-xl font-semibold text-slate-900">No campaign selected</h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Choose a campaign from the campaigns list to manage collaboration details.
                  </p>
                  <Button size="sm" className="bg-primary text-white hover:bg-primary/90 text-xs sm:text-sm h-8 sm:h-9" onClick={() => navigate("/campaign")}>
                    Go to Campaigns
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                <Card className="border-none to-slate-100">
                  <div className=" sm:p-6 space-y-4 sm:space-y-5 w-full">
                    <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Assigned Influencer</h2>
                        <p className="text-xs sm:text-sm text-slate-500 hidden sm:block">
                          Showing the first collaborator assigned to this campaign.
                        </p>
                        <div className="mt-2 sm:mt-3 grid gap-2 text-xs text-slate-500 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-lg border border-slate-200 bg-white px-2 sm:px-3 py-1.5 sm:py-2 shadow-sm">
                            <p className="font-semibold text-slate-700 text-[10px] sm:text-xs">Campaign ID</p>
                            <p className="text-[9px] sm:text-[11px] text-slate-500 break-all line-clamp-2">
                              {campaignKey ?? resolvedCampaignId ?? "Unknown"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white px-2 sm:px-3 py-1.5 sm:py-2 shadow-sm">
                            <p className="font-semibold text-slate-700 text-[10px] sm:text-xs">Collaboration ID</p>
                            <p className="text-[9px] sm:text-[11px] text-slate-500 break-all line-clamp-2">
                              {collaborationId ?? "Not generated"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white px-2 sm:px-3 py-1.5 sm:py-2 shadow-sm">
                            <p className="font-semibold text-slate-700 text-[10px] sm:text-xs">Influencer PID</p>
                            <p className="text-[9px] sm:text-[11px] text-slate-500 break-all line-clamp-2">
                              {influencer?.pid ?? influencer?.id ?? "Not assigned"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white px-2 sm:px-3 py-1.5 sm:py-2 shadow-sm">
                            <p className="font-semibold text-slate-700 text-[10px] sm:text-xs">Contract PID</p>
                            <p className="text-[9px] sm:text-[11px] text-slate-500 break-all line-clamp-2">
                              {resolvedContractPid ?? (contractMeta?.id ? "Fetching..." : "No contract linked")}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white px-2 sm:px-3 py-1.5 sm:py-2 shadow-sm">
                            <p className="font-semibold text-slate-700 text-[10px] sm:text-xs">Employee ID</p>
                            <p className="text-[9px] sm:text-[11px] text-slate-500 break-all line-clamp-2">
                              {campaign?.users?.[0]?.employeeId ?? "Not assigned"}
                            </p>
                          </div>
                        </div>
                      </div>
                      {influencer && (
                        <Badge className="rounded-full bg-emerald-100 text-emerald-700 border-emerald-200 capitalize text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1 shrink-0">
                          Status: {influencer.status ?? "--"}
                        </Badge>
                      )}
                    </div>

                    {influencer ? (
                      <div className="space-y-3 sm:space-y-4 rounded-2xl sm:rounded-3xl border border-slate-200 bg-white/90 p-3 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
                          <div className="space-y-1.5 sm:space-y-2 min-w-0 flex-1">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <span className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary/10 text-primary shadow shrink-0">
                                {influencer.name.charAt(0).toUpperCase()}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-base sm:text-lg font-semibold text-slate-900 truncate">{influencer.name}</p>
                                <p className="text-xs sm:text-sm text-slate-500 truncate">
                                  Influencer PID: {influencer.pid ?? influencer.id ?? "Not provided"}
                                </p>
                              </div>
                            </div>
                            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-600 shadow-sm">
                              <p className="text-[10px] sm:text-xs">
                                Email:{" "}
                                {influencer.email ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const email = influencer.email || "";
                                      const mailtoLink = `mailto:${email}`;
                                      const zohoMailUrl = `https://mail.zoho.in/zm/comp.do?ct=${encodeURIComponent(mailtoLink)}`;
                                      window.open(zohoMailUrl, '_blank', 'noopener,noreferrer');
                                    }}
                                    className="font-medium text-primary hover:underline cursor-pointer bg-transparent border-none p-0 text-left truncate max-w-[200px] sm:max-w-none"
                                    title={influencer.email}
                                  >
                                    {influencer.email}
                                  </button>
                                ) : (
                                  <span className="font-medium">Not provided</span>
                                )}
                              </p>
                              <p className="text-[10px] sm:text-xs text-slate-500">
                                Contact:{" "}
                                {influencer.handles.length ? (
                                  <a
                                    href={influencer.handles[0].url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline cursor-pointer break-all line-clamp-1"
                                  >
                                    {influencer.handles[0].url}
                                  </a>
                                ) : (
                                  "Not available"
                                )}
                              </p>
                            </div>
                          </div>
                          {influencer.country && (
                            <Badge className="rounded-full bg-primary/10 text-primary border-primary/20 text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1 shrink-0">
                              {influencer.country}
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-slate-500">
                          <span className="uppercase tracking-wide text-slate-400">Platforms</span>
                          {influencer.handles.length ? (
                            influencer.handles.map((handle) => {
                              const meta = getPlatformMeta(handle.platform);
                              return meta.icon ? (
                                <img
                                  key={`${influencer.id}-${handle.platform}`}
                                  src={meta.icon}
                                  alt={meta.label}
                                  title={meta.label}
                                  className="h-5 w-5 sm:h-6 sm:w-6 rounded-full border border-slate-200 bg-white p-[2px] shadow-sm"
                                />
                              ) : (
                                <span
                                  key={`${influencer.id}-${handle.platform}`}
                                  className="rounded-full border border-slate-200 bg-white px-2 sm:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[11px] capitalize shadow-sm"
                                >
                                  {meta.label}
                                </span>
                              );
                            })
                          ) : (
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] sm:text-[11px]">
                              No platforms
                            </span>
                          )}
                        </div>

                        <div className="grid gap-2 sm:gap-3 grid-cols-1 md:grid-cols-2">
                          <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white/95 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-700 shadow-sm">
                            <p className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-400">Latest update</p>
                            <p className="mt-1 sm:mt-2 leading-snug text-[10px] sm:text-xs">
                              {influencer.status === "pending"
                                ? "Awaiting contract confirmation"
                                : "No recent updates"}
                            </p>
                          </div>
                          <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white/95 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-700 shadow-sm">
                            <p className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-400">Internal notes</p>
                            <p className="mt-1 sm:mt-2 leading-snug text-[10px] sm:text-xs">
                              Capture outreach notes and next steps here once CRM sync is connected.
                            </p>
                          </div>
                        </div>

                        <div className="rounded-xl sm:rounded-2xl  bg-white/95 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm text-slate-700 shadow-sm space-y-2 sm:space-y-3">
                          <p className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-400">Actions</p>
                          <div className="space-y-3 sm:space-y-4">
                            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2 sm:py-3 space-y-2 sm:space-y-3">
                              <Select value={selectedAction || undefined} onValueChange={(value) => setSelectedAction(value as ActionOption)}>
                                <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                                  <SelectValue placeholder="Select an action" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="interested" className="text-xs sm:text-sm">Interested</SelectItem>
                                  <SelectItem value="not_interested" className="text-xs sm:text-sm">Not Interested</SelectItem>
                                  <SelectItem value="callback" className="text-xs sm:text-sm">Callback</SelectItem>
                                  <SelectItem value="done" className="text-xs sm:text-sm">Done</SelectItem>
                                </SelectContent>
                              </Select>
                              {selectedAction === "callback" && (
                                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                                  <Input
                                    type="date"
                                    value={callbackDate}
                                    onChange={(event) => setCallbackDate(event.target.value)}
                                    className="w-full text-xs sm:text-sm h-8 sm:h-10"
                                    aria-label="Select callback date"
                                  />
                                  <Input
                                    type="time"
                                    value={callbackTime}
                                    onChange={(event) => setCallbackTime(event.target.value)}
                                    className="w-full text-xs sm:text-sm h-8 sm:h-10"
                                    aria-label="Select callback time"
                                  />
                                </div>
                              )}
                              <Textarea
                                rows={2}
                                placeholder="Add remarks..."
                                value={actionRemark}
                                onChange={(event) => setActionRemark(event.target.value)}
                                className="text-xs sm:text-sm min-h-[60px] sm:min-h-[80px]"
                              />
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                  className="bg-primary text-white hover:bg-primary/90 text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4"
                                  onClick={handleActionSubmit}
                                  disabled={
                                    !selectedAction ||
                                    !isActionDirty ||
                                    (selectedAction === "callback" && (!callbackDate || !callbackTime))
                                  }
                                >
                                  Save Action
                                </Button>
                              </div>
                            </div>
                            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2 sm:py-3 space-y-2 sm:space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-2">
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                  <Button
                                    size="sm"
                                    className="bg-primary text-white hover:bg-primary/90 text-[10px] sm:text-sm h-7 sm:h-9 px-2 sm:px-3"
                                    onClick={handleSendContract}
                                  >
                                    {isContractSent ? "Resend" : "Send Contract"}
                                  </Button>
                                  {!isSigned && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={handleFillContract}
                                      className={`text-[10px] sm:text-sm h-7 sm:h-9 px-2 sm:px-3 ${areAllVariablesFilled ? "border-green-500 text-green-700 hover:bg-green-50" : ""}`}
                                    >
                                      {areAllVariablesFilled && (
                                        <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-green-600" />
                                      )}
                                      Fill Contract
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      await handleViewContract();
                                      await logTimelineEntry(
                                        'contract_viewed',
                                        'Contract viewed',
                                        null,
                                        null
                                      );
                                    }}
                                    disabled={!collaborationId}
                                    className="text-[10px] sm:text-sm h-7 sm:h-9 px-2 sm:px-3"
                                  >
                                    View Contract
                                  </Button>
                                  {isSigned && (
                                    <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-green-100 text-green-800 rounded-md">
                                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      <span className="text-[10px] sm:text-sm font-semibold">Contract Signed</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handlePreviousInfluencer}
                                    disabled={!influencerNavigation.hasPrevious}
                                    title="Previous Influencer"
                                    className="text-[10px] sm:text-sm h-7 sm:h-9 px-2 sm:px-3"
                                  >
                                    <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                                    Previous
                                  </Button>
                                  {collaborationId && (updatedCollaborationIds.has(collaborationId) || isSigned || filledCollaborationIds.has(collaborationId)) && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-[10px] sm:text-sm h-7 sm:h-9 px-2 sm:px-3"
                                      onClick={async () => {
                                        if (!collaborationId) {
                                          toast({
                                            title: "Error",
                                            description: "Collaboration ID is missing.",
                                            variant: "destructive"
                                          });
                                          return;
                                        }

                                        let magicLinkToken: string | null = null;

                                        // Step 1: ALWAYS fetch from Supabase collaboration_variable_overrides table first
                                        try {
                                          console.log(`[Copy Magic Link] Fetching from collaboration_variable_overrides for collaboration_id: ${collaborationId}`);
                                          const { data: magicLinkData, error: fetchError } = await (supabase as any)
                                            .from(VARIABLE_OVERRIDE_TABLE) // collaboration_variable_overrides
                                            .select("magic_link, collaboration_id")
                                            .eq("collaboration_id", collaborationId)
                                            .not("magic_link", "is", null)
                                            .limit(1)
                                            .maybeSingle();
                                          
                                          if (fetchError) {
                                            console.error(`[Copy Magic Link] Error fetching from Supabase:`, fetchError);
                                          }
                                          
                                          // Verify the returned record matches our collaboration_id
                                          if (magicLinkData?.magic_link && magicLinkData.collaboration_id === collaborationId) {
                                            magicLinkToken = magicLinkData.magic_link;
                                            console.log(`[Copy Magic Link] ✓ Found magic_link in Supabase for collaboration_id ${collaborationId}: ${magicLinkToken.substring(0, 8)}...`);
                                            
                                            // Update local state with latest from Supabase
                                            setContractVariableEntries(prev => {
                                              const existing = prev.find(e => e.key === "magic_link");
                                              if (existing) {
                                                return prev.map(e => e.key === "magic_link" ? { ...e, value: magicLinkToken } : e);
                                              }
                                              return [...prev, {
                                                key: "magic_link",
                                                value: magicLinkToken,
                                                editable: false
                                              }];
                                            });
                                          } else {
                                            console.log(`[Copy Magic Link] ✗ No magic_link found in Supabase for collaboration_id ${collaborationId}`);
                                          }
                                        } catch (err) {
                                          console.error("[Copy Magic Link] Error fetching magic_link from Supabase:", err);
                                        }

                                        // Step 2: If not found in Supabase, generate NEW unique link for this collaboration_id
                                        if (!magicLinkToken) {
                                          console.log(`[Copy Magic Link] Generating NEW unique magic_link for collaboration_id ${collaborationId}`);
                                          magicLinkToken = generateUUID();
                                          
                                          // Step 3: Save the new magic_link to Supabase collaboration_variable_overrides
                                          try {
                                            // First, get existing record to preserve other data
                                            const { data: existingRecord } = await (supabase as any)
                                              .from(VARIABLE_OVERRIDE_TABLE)
                                              .select("*")
                                              .eq("collaboration_id", collaborationId)
                                              .eq("variable_key", "all_variables")
                                              .maybeSingle();

                                            const recordToSave = {
                                              collaboration_id: collaborationId,
                                              variable_key: "all_variables",
                                              magic_link: magicLinkToken,
                                              campaign_id: existingRecord?.campaign_id || resolvedCampaignId,
                                              influencer_id: existingRecord?.influencer_id || resolvedInfluencerId,
                                              value: existingRecord?.value || JSON.stringify({ magic_link: magicLinkToken }),
                                              contract_html: existingRecord?.contract_html || null
                                            };

                                            const { error: saveError } = await (supabase as any)
                                              .from(VARIABLE_OVERRIDE_TABLE)
                                              .upsert(recordToSave, {
                                                onConflict: 'collaboration_id,variable_key'
                                              });

                                            if (saveError) {
                                              console.error(`[Copy Magic Link] Error saving new magic_link to Supabase:`, saveError);
                                              toast({
                                                title: "Error",
                                                description: "Failed to save magic link. Please try again.",
                                                variant: "destructive"
                                              });
                                              return;
                                            }

                                            console.log(`[Copy Magic Link] ✓ Successfully saved NEW magic_link to Supabase for collaboration_id ${collaborationId}`);
                                            
                                            // Update local state
                                            setContractVariableEntries(prev => {
                                              const existing = prev.find(e => e.key === "magic_link");
                                              if (existing) {
                                                return prev.map(e => e.key === "magic_link" ? { ...e, value: magicLinkToken } : e);
                                              }
                                              return [...prev, {
                                                key: "magic_link",
                                                value: magicLinkToken,
                                                editable: false
                                              }];
                                            });

                                            // Mark this collaboration as updated
                                            setUpdatedCollaborationIds(prev => new Set(prev).add(collaborationId));

                                            toast({
                                              title: "Magic Link Generated",
                                              description: "A new magic link has been generated and saved.",
                                              variant: "default"
                                            });
                                          } catch (err) {
                                            console.error("[Copy Magic Link] Error saving new magic_link:", err);
                                            toast({
                                              title: "Error",
                                              description: "Failed to save magic link. Please try again.",
                                              variant: "destructive"
                                            });
                                            return;
                                          }
                                        }

                                        // Step 4: Copy the magic link to clipboard
                                        if (magicLinkToken) {
                                          const link = `${window.location.origin}/share/contract/${magicLinkToken}`;
                                          navigator.clipboard.writeText(link);
                                          toast({
                                            title: "Link Copied",
                                            description: "Magic link copied to clipboard.",
                                          });
                                        } else {
                                          toast({
                                            title: "Error",
                                            description: "Failed to generate magic link. Please try again.",
                                            variant: "destructive"
                                          });
                                        }
                                      }}
                                    >
                                      Copy Magic Link
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleNextInfluencer}
                                    disabled={!influencerNavigation.hasNext}
                                    title="Next Influencer"
                                    className="text-[10px] sm:text-sm h-7 sm:h-9 px-2 sm:px-3"
                                  >
                                    Next
                                    <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 ml-0.5 sm:ml-1" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-slate-500">
                          {lastAction ? (
                            <>
                              <p className="font-semibold text-slate-700 text-[10px] sm:text-xs">{lastAction.label}</p>
                              <p className="text-[9px] sm:text-xs">{lastAction.timestamp}</p>
                              {lastAction.remark && (
                                <p className="mt-0.5 sm:mt-1 text-slate-500 text-[9px] sm:text-xs">Remark: {lastAction.remark}</p>
                              )}
                            </>
                          ) : (
                            <p className="text-[9px] sm:text-xs">No recent actions recorded.</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl sm:rounded-2xl border border-dashed border-slate-200 bg-white/80 px-3 py-8 sm:py-12 text-center text-xs sm:text-sm text-slate-500">
                        No influencers assigned to this campaign yet.
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="border-none bg-gradient-to-b from-white/95 to-slate-100">
                  <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 flex flex-col h-full">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Timeline</h2>
                        <p className="text-xs sm:text-sm text-slate-500 hidden sm:block">Key steps in the collaboration workflow.</p>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            void fetchTimelineEntries();
                          }}
                          disabled={timelineLoading}
                          title="Refresh Timeline"
                          className="h-7 w-7 sm:h-9 sm:w-9 p-0"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${timelineLoading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm("Are you sure you want to clear all timeline entries? This action cannot be undone.")) {
                              void clearTimelineEntries();
                            }
                          }}
                          disabled={timelineLoading || timelineEntries.length === 0}
                          title="Clear Timeline"
                          className="h-7 w-7 sm:h-9 sm:w-9 p-0"
                        >
                          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </div>
                    {timelineLoading ? (
                      <div className="flex items-center justify-center py-6 sm:py-8">
                        <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-slate-400" />
                      </div>
                    ) : (
                      <ScrollArea className="flex-1 h-[calc(100vh-280px)] min-h-[300px] sm:min-h-[400px] max-h-[500px] sm:max-h-[600px]">
                        <div className="relative pl-3 sm:pl-4 pr-2 sm:pr-4">
                          <span className="absolute left-0 top-2 bottom-2 w-px bg-slate-200" />
                          <div className="space-y-3 sm:space-y-5">
                            {timelineEntries.length > 0 ? (
                              timelineEntries.map((entry) => {
                                const timestamp = new Date(entry.occurred_at).toLocaleString();
                                const getActionIcon = () => {
                                  switch (entry.action_type) {
                                    case 'action_taken':
                                      return '✓';
                                    case 'contract_sent':
                                      return '📄';
                                    case 'contract_viewed':
                                      return '👁️';
                                    case 'contract_updated':
                                      return '🔄';
                                    case 'remark_added':
                                      return '💬';
                                    default:
                                      return '•';
                                  }
                                };
                                return (
                                  <div key={entry.id} className="relative rounded-xl sm:rounded-2xl border border-slate-200 bg-white/90 p-2.5 sm:p-4 shadow-sm">
                                    <span className="absolute -left-[7px] sm:-left-[9px] top-3 sm:top-4 h-3 w-3 sm:h-4 sm:w-4 rounded-full border border-white bg-primary shadow flex items-center justify-center text-[8px] sm:text-[10px] text-white">
                                      {getActionIcon()}
                                    </span>
                                    <div className="ml-1.5 sm:ml-2 space-y-0.5 sm:space-y-1">
                                      <h3 className="text-xs sm:text-sm font-semibold text-slate-900 line-clamp-2">{entry.description}</h3>
                                      {entry.remark && (
                                        <p className="text-[10px] sm:text-xs text-slate-500 leading-snug line-clamp-2">Remark: {entry.remark}</p>
                                      )}
                                      {entry.action && (
                                        <p className="text-[10px] sm:text-xs text-slate-500 leading-snug">Action: {entry.action.replace('_', ' ')}</p>
                                      )}
                                      <p className="text-[9px] sm:text-xs text-slate-400">{timestamp}</p>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="rounded-xl sm:rounded-2xl border border-dashed border-slate-200 bg-white/80 px-3 py-6 sm:py-8 text-center text-[10px] sm:text-xs text-slate-400">
                                No timeline entries yet. Actions and updates will appear here.
                              </div>
                            )}
                          </div>
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </main>
        </div>
      </div>

      <Sheet
        open={isVariableSheetOpen}
        onOpenChange={(open) => {
          setIsVariableSheetOpen(open);
        }}
      >

      {/* sheetcontent for variables */}
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
                    Found {contractVariableEntries.filter((item) => {
                      const key = item.originalKey || item.key || '';
                      return !key.includes('signature.influencer');
                    }).length} placeholder
                    {contractVariableEntries.filter((item) => {
                      const key = item.originalKey || item.key || '';
                      return !key.includes('signature.influencer');
                    }).length === 1 ? "" : "s"}.
                  </p>
                )}
              </div>
            </SheetDescription>
          </SheetHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleGenerateContractPreview();
            }}
            className="mt-6 flex-1 overflow-hidden flex flex-col"
          >
            <div className="flex flex-1 flex-col space-y-4 overflow-hidden">
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
                    ((): React.ReactNode => {
                      // Group address fields together
                      const addressFieldPatterns = [
                        'Address Line 1',
                        'Address Line 2',
                        'Address Landmark',
                        'Address City',
                        'Address Pincode',
                        'Address Country'
                      ];
                      
                      // Separate address fields from other variables
                      const addressGroups = new Map<string, ContractVariableEntry[]>();
                      const nonAddressEntries: ContractVariableEntry[] = [];
                      
                    contractVariableEntries
                      .filter((item) => {
                        // Show all signature variables (both user and influencer) - don't filter any out
                        return true;
                      })
                        .forEach((item) => {
                          const originalKey = item.originalKey || '';
                          const displayKey = item.key || '';
                          
                          // Check if this is an address field
                          const isAddressField = addressFieldPatterns.some(pattern => {
                            return originalKey.includes(pattern) || displayKey.includes(pattern);
                          });
                          
                          if (isAddressField) {
                            // Extract address type and index from originalKey (e.g., "Address City_1" -> type: "influencer", index: "1")
                            // or from descriptors/rawValues
                            let addressType = 'user'; // default
                            let index = '1'; // default
                            
                            // Try to extract from originalKey (e.g., "Address City_1")
                            const indexMatch = originalKey.match(/_(\d+)$/);
                            if (indexMatch) {
                              index = indexMatch[1];
                            }
                            
                            // Try to determine address type from source/descriptors
                            const description = item.description || '';
                            const rawValues = item.rawValues || [];
                            const allText = [description, ...rawValues].join(' ');
                            
                            if (allText.includes('influencers.address') || allText.includes('influencer')) {
                              addressType = 'influencer';
                            } else if (allText.includes('user_profiles.address') || allText.includes('user')) {
                              addressType = 'user';
                            } else if (allText.includes('companies.address') || allText.includes('company')) {
                              addressType = 'companies';
                            }
                            
                            const groupKey = `${addressType}_${index}`;
                            if (!addressGroups.has(groupKey)) {
                              addressGroups.set(groupKey, []);
                            }
                            addressGroups.get(groupKey)!.push(item);
                          } else {
                            nonAddressEntries.push(item);
                          }
                        });
                      
                      // Convert address groups to display format
                      const groupedAddressEntries: Array<{
                        type: 'address';
                        addressType: string;
                        index: string;
                        fields: ContractVariableEntry[];
                        source: string;
                      }> = [];
                      
                      addressGroups.forEach((fields, groupKey) => {
                        const [addressType, index] = groupKey.split('_');
                        // Get source from first field's description or rawValues
                        const firstField = fields[0];
                        let source = '';
                        
                        // Try to extract source from description (e.g., "source:public.influencers.address_line1")
                        if (firstField.description) {
                          const sourceMatch = firstField.description.match(/source:([^\s|]+)/);
                          if (sourceMatch) {
                            source = sourceMatch[1];
                          } else {
                            source = firstField.description;
                          }
                        }
                        
                        // If no source found, try rawValues
                        if (!source && firstField.rawValues && firstField.rawValues.length > 0) {
                          const rawValue = firstField.rawValues[0];
                          const sourceMatch = String(rawValue).match(/source:([^\s|]+)/);
                          if (sourceMatch) {
                            source = sourceMatch[1];
                          }
                        }
                        
                        groupedAddressEntries.push({
                          type: 'address',
                          addressType,
                          index,
                          fields,
                          source
                        });
                      });
                      
                      // Sort grouped addresses by type and index
                      groupedAddressEntries.sort((a, b) => {
                        if (a.addressType !== b.addressType) {
                          return a.addressType.localeCompare(b.addressType);
                        }
                        return parseInt(a.index) - parseInt(b.index);
                      });
                      
                      // Combine non-address entries with grouped address entries
                      const allEntries: Array<ContractVariableEntry | { type: 'address'; addressType: string; index: string; fields: ContractVariableEntry[]; source: string }> = [
                        ...nonAddressEntries,
                        ...groupedAddressEntries
                      ];
                      
                      return allEntries.map((entry, idx) => {
                        // Handle grouped address entry
                        if (typeof entry === 'object' && 'type' in entry && entry.type === 'address') {
                          const { addressType, fields, source } = entry;
                          const addressTypeLabel = addressType === 'user' ? 'User' : addressType === 'influencer' ? 'Influencer' : 'Company';
                          
                          // Order fields: Line 1, Line 2, Landmark, City, Pincode, Country
                          const fieldOrder = ['Address Line 1', 'Address Line 2', 'Address Landmark', 'Address City', 'Address Pincode', 'Address Country'];
                          const orderedFields = fieldOrder.map(fieldName => 
                            fields.find(f => {
                              const key = f.originalKey || f.key || '';
                              return key.includes(fieldName);
                      })
                          ).filter(Boolean) as ContractVariableEntry[];
                          
                          // Format source for display
                          const displaySource = source ? (source.startsWith('source:') ? source : `source:${source}`) : '';
                          
                          return (
                            <div key={`address-${addressType}-${entry.index}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm space-y-2">
                              <div>
                                <p className="font-semibold text-slate-800">{addressTypeLabel} Address:</p>
                                {displaySource && (
                                  <p className="text-xs text-slate-500 mt-0.5">{displaySource}</p>
                                )}
                              </div>
                              <div className="space-y-1">
                                {orderedFields.map((field, fieldIdx) => {
                                  const fieldValue = field.inputValue || field.value || '';
                                  // Remove "key: " prefix if present (e.g., "address_landmark: --" -> "--")
                                  let cleanValue = fieldValue.replace(/^[^:]+:\s*/, '').trim();
                                  // Convert "--" to empty string
                                  if (cleanValue === '--' || cleanValue.trim() === '') {
                                    cleanValue = '';
                                  }
                                  
                                  return (
                                    <div key={fieldIdx} className="text-xs text-slate-600">
                                      {cleanValue || <span className="text-slate-400 italic">(blank)</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }
                        
                        // Handle regular entry
                        const item = entry as ContractVariableEntry;
                      const uniqueKey = item.originalKey || item.key || `var-${idx}`;
                      // Extract display name from key (e.g., "var[{{Influencer Name}}]" -> "Influencer Name")
                      const extractDisplayName = (key: string): string => {
                        const match = key.match(/var\[\{\{([^}]+)\}\}\]/);
                        if (match && match[1]) {
                          return match[1].trim();
                        }
                        return key;
                      };
                      const displayName = extractDisplayName(item.key);
                      // Check if this is a signature variable (check both key and originalKey, case-insensitive)
                      const keyLower = item.key.toLowerCase();
                      const originalKeyLower = (item.originalKey || '').toLowerCase();
                      const displayNameLower = displayName.toLowerCase();
                      const isSignature = keyLower.includes('signature') || 
                                         originalKeyLower.includes('signature') || 
                                         displayNameLower.includes('signature') ||
                                         originalKeyLower === 'signature.user' ||
                                         originalKeyLower === 'signature.influencer' ||
                                         originalKeyLower.startsWith('signature_') ||
                                         originalKeyLower.startsWith('signature.user_') ||
                                         originalKeyLower.startsWith('signature.influencer_') ||
                                         /^signature\.(user|influencer)_\d+$/i.test(originalKeyLower) ||
                                         /^signature_\d+$/i.test(originalKeyLower);
                      
                      // Debug log to see what's happening
                      if (displayNameLower.includes('signature') || originalKeyLower.includes('signature')) {
                        console.log('Signature variable detected:', {
                          displayName,
                          key: item.key,
                          originalKey: item.originalKey,
                          editable: item.editable,
                          isSignature,
                          uniqueKey
                        });
                      }
                      
                      return (
                        <div key={uniqueKey} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm space-y-1">
                          <p className="font-semibold text-slate-800">{displayName}</p>
                          {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
                          {item.editable ? (
                            isSignature ? (
                              <div
                                className="cursor-pointer rounded border-2 border-dashed border-slate-300 bg-transparent px-2 py-2 text-center text-xs text-slate-600 hover:bg-slate-50 hover:border-slate-400 transition-colors"
                                style={{
                                  width: '200px',
                                  height: '140px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minHeight: '140px',
                                  position: 'relative',
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Use originalKey for signature entry tracking, fallback to key if originalKey doesn't exist
                                  const signatureKey = item.originalKey || item.key || uniqueKey;
                                  console.log('Signature box clicked:', { uniqueKey, originalKey: item.originalKey, key: item.key, signatureKey });
                                  setCurrentSignatureEntry(signatureKey);
                                  const existingValue = item.inputValue || item.value || '';
                                  setSignatureValue(existingValue);
                                  // If value is a data URL (image), switch to draw mode and load it
                                  if (existingValue && existingValue.startsWith('data:image')) {
                                    setSignatureMode('draw');
                                    // Load image to canvas after dialog opens
                                    setTimeout(() => {
                                      if (signatureCanvasRef.current && existingValue) {
                                        const img = new Image();
                                        img.onload = () => {
                                          const ctx = signatureCanvasRef.current?.getContext('2d');
                                          if (ctx && signatureCanvasRef.current) {
                                            signatureCanvasRef.current.width = signatureCanvasRef.current.offsetWidth;
                                            signatureCanvasRef.current.height = signatureCanvasRef.current.offsetHeight;
                                            ctx.drawImage(img, 0, 0, signatureCanvasRef.current.width, signatureCanvasRef.current.height);
                                          }
                                        };
                                        img.src = existingValue;
                                      }
                                    }, 100);
                                  } else {
                                    setSignatureMode('type');
                                  }
                                  console.log('Opening signature dialog');
                                  setIsSignatureDialogOpen(true);
                                }}
                              >
                                {item.inputValue && item.inputValue.startsWith('data:image') ? (
                                  <img 
                                    src={item.inputValue} 
                                    alt="Signature" 
                                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                  />
                                ) : item.inputValue ? (
                                  <span className="text-green-600 font-semibold">✓ Signed</span>
                                ) : (
                                  <div className="flex flex-col items-center justify-center h-full">
                                    <span className="text-slate-500 mb-1">Click to sign</span>
                                    <span className="text-[10px] text-slate-400">Signature</span>
                                  </div>
                                )}
                              </div>
                            ) : (() => {
                              // Check if this is a date variable
                              const dateKey = (item.originalKey || item.key).toLowerCase();
                              const isDate = dateKey === "date" || dateKey.includes("date") || dateKey.includes("_date");
                              
                              if (isDate) {
                                // Parse the date value if it exists
                                const dateValue = item.inputValue || item.value || '';
                                let selectedDate: Date | undefined = undefined;
                                if (dateValue) {
                                  try {
                                    // Try to parse the date (could be YYYY-MM-DD or other formats)
                                    const parsed = new Date(dateValue);
                                    if (!isNaN(parsed.getTime())) {
                                      selectedDate = parsed;
                                    }
                                  } catch (e) {
                                    // If parsing fails, leave undefined
                                  }
                                }
                                
                                return (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        className="w-full justify-start text-left font-normal"
                                      >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {selectedDate ? (
                                          format(selectedDate, "PPP")
                                        ) : (
                                          <span className="text-muted-foreground">Pick a date</span>
                                        )}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                      <Calendar
                                        mode="single"
                                        selected={selectedDate}
                                        onSelect={(date) => {
                                          if (date) {
                                            // Format date as YYYY-MM-DD for storage
                                            const formattedDate = format(date, "yyyy-MM-dd");
                                            setContractVariableEntries((prev) =>
                                              prev.map((entry) =>
                                                (entry.originalKey || entry.key) === uniqueKey
                                                  ? {
                                                      ...entry,
                                                      inputValue: formattedDate,
                                                    }
                                                  : entry
                                              )
                                            );
                                          } else {
                                            // Clear the date if deselected
                                            setContractVariableEntries((prev) =>
                                              prev.map((entry) =>
                                                (entry.originalKey || entry.key) === uniqueKey
                                                  ? {
                                                      ...entry,
                                                      inputValue: "",
                                                    }
                                                  : entry
                                              )
                                            );
                                          }
                                        }}
                                        initialFocus
                                      />
                                    </PopoverContent>
                                  </Popover>
                                );
                              }
                              
                              // Check if this is a product variable
                              // Check both originalKey and key to handle all cases
                              const originalKey = item.originalKey || '';
                              const displayKey = item.key || '';
                              const originalKeyLower = originalKey.toLowerCase();
                              const displayKeyLower = displayKey.toLowerCase();
                              
                              // Check for product variable: name.product, product, or any key containing 'product'
                              // Also check original key and description for "product"
                              const isProduct = originalKeyLower.includes('product')
                                || displayKeyLower.includes('product')
                                || (item.description?.toLowerCase().includes('product') ?? false)
                                || (item.value?.toLowerCase().includes('product') ?? false);
                              
                              if (isProduct) {
                                const currentSelected = item.inputValue 
                                  ? item.inputValue.split(',').map(s => s.trim()).filter(Boolean) 
                                  : [];
                                return (
                                  <div className="space-y-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="w-full justify-start"
                                      onClick={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('Product Selection Button Clicked', { uniqueKey, currentSelected });
                                        setCurrentProductVariableKey(uniqueKey);
                                        setSelectedProducts(currentSelected);
                                        
                                        // Fetch products for the company
                                        const companyName = campaign?.brand || campaign?.name || "";
                                        if (companyName) {
                                          console.log(`Fetching products for company: "${companyName}"`);
                                          setIsLoadingProducts(true);
                                          try {
                                            const { data: productsData, error: productsError } = await supabase
                                              .from('products')
                                              .select('id, name, company')
                                              .ilike('company', companyName.trim())
                                              .eq('status', 'active')
                                              .order('name', { ascending: true });
                                            
                                            if (productsError) {
                                              throw productsError;
                                            }
                                            
                                            console.log(`Found ${productsData?.length || 0} products for "${companyName}"`);
                                            setAvailableProducts(productsData || []);
                                          } catch (err: any) {
                                            console.error("Error fetching products:", err);
                                            toast({
                                              title: "Error",
                                              description: err?.message || "Failed to load products.",
                                              variant: "destructive",
                                            });
                                          } finally {
                                            setIsLoadingProducts(false);
                                          }
                                        } else {
                                          console.warn("Product selection clicked but no company name found in campaign.");
                                          setAvailableProducts([]); // Clear any previous products
                                          toast({
                                            title: "Product Selection Unavailable",
                                            description: "We couldn't determine the company name for this campaign. Please ensure the campaign has a brand or name assigned.",
                                            variant: "destructive",
                                          });
                                        }
                                        
                                        setIsProductDialogOpen(true);
                                      }}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      {currentSelected.length > 0 
                                        ? `${currentSelected.length} product${currentSelected.length > 1 ? 's' : ''} selected`
                                        : 'Select Products'}
                                    </Button>
                                    {currentSelected.length > 0 && (
                                      <div className="text-xs text-slate-500 space-y-1">
                                        <p className="font-medium">Selected:</p>
                                        <div className="space-y-0.5">
                                          {currentSelected.map((product, idx) => (
                                            <div key={idx} className="pl-2">
                                              • {product.trim()}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              
                              const isPlainText = uniqueKey.toLowerCase().includes('plain_text') || 
                                                  uniqueKey.toLowerCase().includes('plain text') || 
                                                  uniqueKey.toLowerCase().includes('remark') || 
                                                  uniqueKey.toLowerCase().includes('manual');
                              
                              if (isPlainText) {
                                return (
                                  <Textarea
                                    placeholder="Enter replacement text (Shift+Enter for newline)"
                                    value={item.inputValue ?? ""}
                                    className="min-h-[80px] text-xs sm:text-sm resize-none"
                                    onKeyDown={(e) => {
                                      // Support Enter to submit for Textarea too if Ctrl/Meta is pressed
                                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                        e.preventDefault();
                                        void handleGenerateContractPreview();
                                      }
                                    }}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      setContractVariableEntries((prev) =>
                                        prev.map((entry) =>
                                          (entry.originalKey || entry.key) === uniqueKey
                                            ? {
                                              ...entry,
                                              inputValue: value,
                                            }
                                            : entry
                                        )
                                      );
                                    }}
                                  />
                                );
                              }
                              
                              return (
                              <Input
                                placeholder="Enter replacement text"
                                value={item.inputValue ?? ""}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setContractVariableEntries((prev) =>
                                    prev.map((entry) =>
                                      (entry.originalKey || entry.key) === uniqueKey
                                        ? {
                                          ...entry,
                                          inputValue: value,
                                        }
                                        : entry
                                    )
                                  );
                                }}
                              />
                              );
                            })()
                          ) : (
                            item.value && item.value !== "--" && item.value.trim() !== "--" && (
                              <p className="text-xs text-emerald-600">{item.value}</p>
                            )
                          )}
                        </div>
                      );
                      });
                    })()
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                      No variables are configured yet. You can add placeholders from the contract editor.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
            <div className="mt-6 flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setIsVariableSheetOpen(false)}>
                Close
              </Button>
              <Button
                type="submit"
                className="bg-primary text-white hover:bg-primary/90"
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
          </form>
        </SheetContent>
      </Sheet>

      {/* Product Selection Dialog */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select Products</DialogTitle>
            <DialogDescription>
              Select products for {campaign?.brand || campaign?.name || "this company"}. You can select multiple products.
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingProducts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : availableProducts.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              No products found for this company.
            </div>
          ) : (
            <ScrollArea className="max-h-[400px] pr-4">
              <div className="space-y-2">
                {availableProducts.map((product) => {
                  const isSelected = selectedProducts.includes(product.name);
                  return (
                    <div
                      key={product.id}
                      className={`flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        isSelected 
                          ? 'border-primary bg-primary/5' 
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedProducts(selectedProducts.filter(name => name !== product.name));
                        } else {
                          setSelectedProducts([...selectedProducts, product.name]);
                        }
                      }}
                    >
                      <div className={`flex h-5 w-5 items-center justify-center rounded border ${
                        isSelected 
                          ? 'border-primary bg-primary' 
                          : 'border-slate-300'
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{product.name}</p>
                        {product.company && (
                          <p className="text-xs text-slate-500">{product.company}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
          
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsProductDialogOpen(false);
                setSelectedProducts([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (currentProductVariableKey) {
                  const selectedProductNames = selectedProducts.join(', ');
                  
                  setContractVariableEntries((prev) =>
                    prev.map((entry) =>
                      (entry.originalKey || entry.key) === currentProductVariableKey
                        ? {
                            ...entry,
                            inputValue: selectedProductNames,
                          }
                        : entry
                    )
                  );
                }
                setIsProductDialogOpen(false);
                setSelectedProducts([]);
                setCurrentProductVariableKey(null);
              }}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
            .contract-preview-container .tiptap-rendered .signature-box-clickable:hover {
              background-color: rgba(59, 130, 246, 0.1) !important;
              border-color: #3b82f6 !important;
            }
            /* Reduce spacing between all paragraphs */
            .contract-preview-container .tiptap-rendered p {
              margin: 0 0 4px 0 !important;
              line-height: 1.4 !important;
            }
            /* Further reduce spacing for paragraphs containing address fields */
            .contract-preview-container .tiptap-rendered p:has(span[data-variable-key*="address"]) {
              margin-bottom: 1px !important;
              margin-top: 0 !important;
              line-height: 1.2 !important;
              padding: 0 !important;
            }
            /* Reduce spacing between consecutive paragraphs that contain address fields */
            .contract-preview-container .tiptap-rendered p:has(span[data-variable-key*="address"]) + p:has(span[data-variable-key*="address"]) {
              margin-top: 0 !important;
              margin-bottom: 1px !important;
            }
            /* Target address field spans directly to reduce their spacing */
            .contract-preview-container .tiptap-rendered span[data-variable-key*="address"] {
              line-height: 1.2 !important;
              display: inline !important;
            }
          `}</style>
          {contractPreviewHtml ? (
            <ScrollArea className="contract-preview-container max-h-[70vh] rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-inner">
              <div
                className="tiptap-rendered"
                dangerouslySetInnerHTML={{ __html: contractPreviewHtml }}
              />
            </ScrollArea>
          ) : (
            <p className="text-sm text-slate-500">No contract content available.</p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => {
              setIsPreviewOpen(false);
              setIsVariableSheetOpen(false);
            }}>
              Ok
            </Button>
            <Button
              className="bg-primary text-white hover:bg-primary/90"
              onClick={() => {
                handleSendContract();
                setIsPreviewOpen(false);
                setIsVariableSheetOpen(false);
              }}
            >
              {isContractSent ? "Resend" : "Send Contract"}
            </Button>
          </div>
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
              white-space: pre-wrap !important; /* Preserve whitespace and line breaks from original contract */
            }
            /* Preserve spacing in paragraphs */
            .contract-preview-container .tiptap-rendered p {
              white-space: pre-wrap !important;
              margin: 0 0 14px 0;
            }
            /* Reduce spacing for paragraphs containing address fields */
            .contract-preview-container .tiptap-rendered p:has(span[data-variable-key*="address"]) {
              margin-bottom: 2px !important;
              line-height: 1.3 !important;
            }
            /* Reduce spacing between consecutive address field paragraphs */
            .contract-preview-container .tiptap-rendered p:has(span[data-variable-key*="address"]) + p:has(span[data-variable-key*="address"]) {
              margin-top: 0 !important;
              margin-bottom: 1px !important;
            }
            /* Target address field spans directly to reduce their spacing */
            .contract-preview-container .tiptap-rendered span[data-variable-key*="address"] {
              line-height: 1.2 !important;
              display: inline !important;
            }
            /* Preserve spacing in divs */
            .contract-preview-container .tiptap-rendered div {
              white-space: pre-wrap !important;
            }
            /* Preserve line breaks */
            .contract-preview-container .tiptap-rendered br {
              display: block !important;
              margin: 0 !important;
            }
          `}</style>
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
                onClick={() => {
                  // Print functionality with font preservation
                  const printWindow = window.open('', '_blank');
                  if (printWindow && savedContractHtml) {
                    // Extract body content
                    let bodyContent = savedContractHtml;
                    if (savedContractHtml.includes('<body>')) {
                      bodyContent = savedContractHtml.split('<body>')[1]?.split('</body>')[0] || savedContractHtml;
                    }

                    // Extract existing styles
                    const styleMatches = savedContractHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
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
          {isLoadingSavedContract ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-slate-500">Loading contract...</span>
            </div>
          ) : savedContractHtml ? (
            <ScrollArea
              className="contract-preview-container max-h-[70vh] rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-inner"
            >
              <div
                className="tiptap-rendered"
                dangerouslySetInnerHTML={{
                  __html: (() => {
                    let html = savedContractHtml || '';
                    console.log("Extracting HTML, original length:", html.length);
                    
                    // Extract content from body tag if it's a full HTML document
                    // Use greedy matching to preserve all content including signature images
                    if (html.includes('<body')) {
                      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                      if (bodyMatch && bodyMatch[1]) {
                        html = bodyMatch[1].trim();
                        console.log("Extracted from body, length:", html.length, "Contains signature:", html.includes('data:image'));
                      }
                    }
                    
                    // Extract content from .tiptap-rendered if present (this is the actual content)
                    // Use greedy matching to preserve signature images
                    if (html.includes('tiptap-rendered')) {
                      // Try greedy match first to get all content including signatures
                      const tiptapMatch = html.match(/<div[^>]*class=["'][^"']*tiptap-rendered[^"']*["'][^>]*>([\s\S]*)<\/div>/i);
                      if (tiptapMatch && tiptapMatch[1]) {
                        html = tiptapMatch[1].trim();
                        console.log("Extracted from tiptap-rendered (greedy), length:", html.length, "Contains signature:", html.includes('data:image'));
                      }
                    }
                    
                    // Extract content from .contract-preview-container if tiptap-rendered not found
                    if (html.includes('contract-preview-container') && !html.includes('tiptap-rendered')) {
                      const containerMatch = html.match(/<div[^>]*class=["'][^"']*contract-preview-container[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
                      if (containerMatch && containerMatch[1]) {
                        html = containerMatch[1].trim();
                        console.log("Extracted from contract-preview-container, length:", html.length);
                      }
                    }
                    
                    // If still no content found, try to extract any div content
                    if (html.length < 50 && savedContractHtml) {
                      console.warn("HTML extraction may have failed, trying direct content");
                      // Try to get content between body tags more aggressively
                      const bodyContent = savedContractHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                      if (bodyContent && bodyContent[1]) {
                        html = bodyContent[1].trim();
                        console.log("Fallback extraction, length:", html.length);
                      }
                    }
                    
                    console.log("Final HTML to render, length:", html.length);
                    return html || savedContractHtml || '';
                  })()
                }}
              />
            </ScrollArea>
          ) : (
            <p className="text-sm text-slate-500 py-12 text-center">
              No saved contract found. Please update the contract first.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Signature Dialog */}
      {/* Product Selection Dialog */}


      <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Signature</DialogTitle>
            <DialogDescription>
              Choose how you want to add your signature: draw it or type it.
            </DialogDescription>
          </DialogHeader>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              
              let finalValue = signatureValue;

              if (signatureMode === 'draw') {
                const canvas = signatureCanvasRef.current;
                if (canvas) {
                  finalValue = canvas.toDataURL('image/png');
                }
              } else if (signatureMode === 'type') {
                // Convert typed text to image using a temporary canvas
                const canvas = document.createElement('canvas');
                canvas.width = 600;
                canvas.height = 200;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                  ctx.font = `60px "${signatureFont}"`;
                  ctx.fillStyle = '#000000';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(signatureValue, canvas.width / 2, canvas.height / 2);
                  finalValue = canvas.toDataURL('image/png');
                }
              }

              if (currentSignatureEntry && finalValue) {
                console.log('Saving signature:', { currentSignatureEntry, finalValueLength: finalValue.length });
                setContractVariableEntries((prev) => {
                  const existingIndex = prev.findIndex((entry) => {
                    const entryOriginalKey = entry.originalKey || '';
                    const entryKey = entry.key || '';
                    const currentKey = currentSignatureEntry || '';
                    
                    if (entryOriginalKey === currentKey || entryKey === currentKey) return true;
                    if (entryOriginalKey.toLowerCase() === currentKey.toLowerCase() || 
                        entryKey.toLowerCase() === currentKey.toLowerCase()) return true;
                    
                    const varMatch = currentKey.match(/var\[\{\{([^}]+)\}\}\]/);
                    if (varMatch) {
                      const extractedKey = varMatch[1].trim().replace(/\s*\[\s*\d+\s*\]\s*$/, '');
                      if (entryOriginalKey.toLowerCase().includes(extractedKey.toLowerCase()) ||
                          entryKey.toLowerCase().includes(extractedKey.toLowerCase())) return true;
                    }
                    
                    if (currentKey.toLowerCase().includes('signature') && 
                        (entryOriginalKey.toLowerCase().includes('signature') || entryKey.toLowerCase().includes('signature'))) {
                      const currentBase = currentKey.toLowerCase().replace(/[_\d\[\]]/g, '').replace(/var.*?signature/, 'signature');
                      const entryBase = (entryOriginalKey || entryKey).toLowerCase().replace(/[_\d\[\]]/g, '').replace(/var.*?signature/, 'signature');
                      if (currentBase === entryBase || 
                          (currentBase.includes('signature.user') && entryBase.includes('signature.user')) ||
                          (currentBase.includes('signature.influencer') && entryBase.includes('signature.influencer'))) return true;
                    }
                    return false;
                  });

                  if (existingIndex !== -1) {
                    return prev.map((entry) => {
                      const entryOriginalKey = entry.originalKey || '';
                      const entryKey = entry.key || '';
                      const currentKey = currentSignatureEntry || '';
                      
                      const matches = entryOriginalKey === currentKey || 
                                     entryKey === currentKey ||
                                     entryOriginalKey.toLowerCase() === currentKey.toLowerCase() ||
                                     entryKey.toLowerCase() === currentKey.toLowerCase() ||
                                     (currentKey.match(/var\[\{\{([^}]+)\}\}\]/) && 
                                      (entryOriginalKey.toLowerCase().includes('signature') || entryKey.toLowerCase().includes('signature')));
                      
                      if (matches) return { ...entry, inputValue: finalValue };
                      return entry;
                    });
                  } else {
                    return [
                      ...prev,
                      {
                        key: currentSignatureEntry,
                        originalKey: currentSignatureEntry,
                        editable: true,
                        inputValue: finalValue,
                        value: null,
                        rawValues: [],
                        description: currentSignatureEntry.toLowerCase().includes('signature.user')
                          ? 'User signature'
                          : currentSignatureEntry.toLowerCase().includes('signature.influencer')
                            ? 'Influencer signature'
                            : 'Signature',
                      },
                    ];
                  }
                });
              }
              setIsSignatureDialogOpen(false);
            }}
            className="space-y-4 py-4"
          >
            {/* Mode Selection */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={signatureMode === 'draw' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setSignatureMode('draw')}
              >
                <Pen className="mr-2 h-4 w-4" />
                Draw
              </Button>
              <Button
                type="button"
                variant={signatureMode === 'type' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setSignatureMode('type')}
              >
                <Type className="mr-2 h-4 w-4" />
                Type
              </Button>
            </div>

            {/* Draw Mode */}
            {signatureMode === 'draw' && (
              <div className="space-y-3">
                <div className="relative border-2 border-slate-300 rounded-lg bg-white" style={{ height: '200px' }}>
                  <canvas
                    ref={(canvas) => {
                      signatureCanvasRef.current = canvas;
                    }}
                    className="absolute inset-0 w-full h-full cursor-crosshair"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const canvas = signatureCanvasRef.current;
                      if (!canvas) return;
                      const ctx = canvas.getContext('2d');
                      if (!ctx) return;
                      const rect = canvas.getBoundingClientRect();
                      const scaleX = canvas.width / rect.width;
                      const scaleY = canvas.height / rect.height;
                      ctx.beginPath();
                      ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
                      setIsDrawing(true);
                    }}
                    onMouseMove={(e) => {
                      e.preventDefault();
                      if (!isDrawing) return;
                      const canvas = signatureCanvasRef.current;
                      if (!canvas) return;
                      const ctx = canvas.getContext('2d');
                      if (!ctx) return;
                      const rect = canvas.getBoundingClientRect();
                      const scaleX = canvas.width / rect.width;
                      const scaleY = canvas.height / rect.height;
                      ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
                      ctx.stroke();
                    }}
                    onMouseUp={() => setIsDrawing(false)}
                    onMouseLeave={() => setIsDrawing(false)}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      const canvas = signatureCanvasRef.current;
                      if (!canvas) return;
                      const ctx = canvas.getContext('2d');
                      if (!ctx) return;
                      const rect = canvas.getBoundingClientRect();
                      const touch = e.touches[0];
                      const scaleX = canvas.width / rect.width;
                      const scaleY = canvas.height / rect.height;
                      ctx.beginPath();
                      ctx.moveTo((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY);
                      setIsDrawing(true);
                    }}
                    onTouchMove={(e) => {
                      e.preventDefault();
                      if (!isDrawing) return;
                      const canvas = signatureCanvasRef.current;
                      if (!canvas) return;
                      const ctx = canvas.getContext('2d');
                      if (!ctx) return;
                      const rect = canvas.getBoundingClientRect();
                      const touch = e.touches[0];
                      const scaleX = canvas.width / rect.width;
                      const scaleY = canvas.height / rect.height;
                      ctx.lineTo((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY);
                      ctx.stroke();
                    }}
                    onTouchEnd={() => setIsDrawing(false)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const canvas = signatureCanvasRef.current;
                      if (canvas) {
                        const ctx = canvas.getContext('2d');
                        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
                      }
                    }}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </div>
              </div>
            )}

            {/* Type Mode */}
            {signatureMode === 'type' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Signature Font</label>
                  <Select value={signatureFont} onValueChange={setSignatureFont}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dancing Script">Dancing Script</SelectItem>
                      <SelectItem value="Great Vibes">Great Vibes</SelectItem>
                      <SelectItem value="Allura">Allura</SelectItem>
                      <SelectItem value="Brush Script MT">Brush Script MT</SelectItem>
                      <SelectItem value="Lucida Handwriting">Lucida Handwriting</SelectItem>
                      <SelectItem value="Pacifico">Pacifico</SelectItem>
                      <SelectItem value="Satisfy">Satisfy</SelectItem>
                      <SelectItem value="Kalam">Kalam</SelectItem>
                      <SelectItem value="Caveat">Caveat</SelectItem>
                      <SelectItem value="Permanent Marker">Permanent Marker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Signature Text</label>
                  <Input
                    placeholder="Enter your signature"
                    value={signatureValue}
                    onChange={(e) => setSignatureValue(e.target.value)}
                    style={{
                      fontFamily: signatureFont,
                      fontSize: '24px',
                      fontWeight: 'normal',
                    }}
                  />
                  <p className="text-xs text-slate-500 mt-2" style={{ fontFamily: signatureFont, fontSize: '20px' }}>
                    Preview: {signatureValue || 'Your signature will appear here'}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="outline" onClick={() => setIsSignatureDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={signatureMode === 'type' && !signatureValue}
              >
                Save Signature
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={(open) => {
        setIsEmailDialogOpen(open);
        if (!open) {
          setIsEditingEmail(false);
          setEmailViewMode('simple');
        }
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Send Contract Email</DialogTitle>
            <DialogDescription>
              Email details are ready. Click "Open" to open Zoho Mail with pre-filled details.
            </DialogDescription>
          </DialogHeader>

          {emailDetails && (() => {
            // Convert plain text to HTML format
            const convertToHtml = (text: string, magicLink: string, influencerName: string, companyName: string, collabId: string, currentDate: string) => {
              // First, replace values with bold versions
              let processedText = text;
              
              // Bold influencer name
              if (influencerName) {
                processedText = processedText.replace(new RegExp(influencerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<strong style="font-weight: 600;">${influencerName}</strong>`);
              }
              
              // Bold company name
              if (companyName) {
                processedText = processedText.replace(new RegExp(companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<strong style="font-weight: 600;">${companyName}</strong>`);
              }
              
              // Bold collaboration ID
              if (collabId) {
                processedText = processedText.replace(new RegExp(collabId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<strong style="font-weight: 600;">${collabId}</strong>`);
              }
              
              // Bold current date
              if (currentDate) {
                processedText = processedText.replace(new RegExp(currentDate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<strong style="font-weight: 600;">${currentDate}</strong>`);
              }
              
              // Split by magic link and convert to HTML
              const parts = processedText.split(magicLink);
              let htmlContent = '';
              let inBulletList = false;
              
              parts.forEach((part, partIndex) => {
                const lines = part.split('\n');
                
                lines.forEach((line, lineIndex) => {
                  const trimmed = line.trim();
                  
                  // Check for bullet points
                  if (trimmed.startsWith('•')) {
                    if (!inBulletList) {
                      htmlContent += '<ul style="margin: 10px 0; padding-left: 20px; list-style: none;">';
                      inBulletList = true;
                    }
                    htmlContent += `<li style="margin: 5px 0; font-size: 14px; line-height: 1.6; color: #374151;">${trimmed.substring(1).trim()}</li>`;
                  } else {
                    // Close bullet list if we were in one
                    if (inBulletList) {
                      htmlContent += '</ul>';
                      inBulletList = false;
                    }
                    
                    // Check for headings (Processed By:, Best regards, etc.)
                    if (trimmed.endsWith(':') && trimmed.length < 30 && trimmed.length > 0) {
                      htmlContent += `<p style="margin: 20px 0 10px 0; font-size: 16px; font-weight: 600; color: #111827;">${trimmed}</p>`;
                    } 
                    // Check for "Best regards," line
                    else if (trimmed.toLowerCase().startsWith('best regards')) {
                      htmlContent += `<p style="margin: 20px 0 5px 0; font-size: 14px; line-height: 1.6; color: #374151;">${trimmed}</p>`;
                    }
                    // Regular paragraphs
                    else if (trimmed) {
                      htmlContent += `<p style="margin: 0 0 15px 0; font-size: 14px; line-height: 1.6; color: #374151;">${trimmed}</p>`;
                    }
                  }
                });
                
                // Close bullet list if still open
                if (inBulletList) {
                  htmlContent += '</ul>';
                  inBulletList = false;
                }
                
                // Add Sign Now button between parts
                if (partIndex < parts.length - 1) {
                  htmlContent += `
                    <div style="margin: 30px 0; text-align: center;">
                      <a href="${magicLink}" 
                         style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                        Sign Now
                      </a>
                    </div>
                  `;
                }
              });
              
              return htmlContent;
            };

            // Extract values from email body for bolding
            const influencerName = emailDetails.body.match(/Hi (.+?),/)?.[1] || '';
            const companyName = campaign?.brand || campaign?.name || "Company";
            const collabId = collaborationId || "N/A";
            const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            
            const htmlBody = convertToHtml(emailDetails.body, emailDetails.magicLink, influencerName, companyName, collabId, currentDate);
            const signifyLogoUrl = `${window.location.origin}/signature.png`;
            const growwikLogoUrl = `${window.location.origin}/growiik.png`;
            
            const fullHtmlEmail = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailDetails.subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header with Logos -->
          <tr>
            <td style="padding: 30px 40px 20px; text-align: center; border-bottom: 2px solid #f0f0f0; background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 0 15px; vertical-align: middle; text-align: center;">
                          <img src="${signifyLogoUrl}" alt="Signify Logo" style="height: 35px; width: auto; max-width: 100px; display: block; border: 0;" onerror="this.style.display='none';">
                        </td>
                        <td style="padding: 0 8px; vertical-align: middle; text-align: center;">
                          <span style="font-size: 20px; color: #9ca3af;">•</span>
                        </td>
                        <td style="padding: 0 15px; vertical-align: middle;">
                          <img src="${growwikLogoUrl}" alt="Growwik Media Logo" style="height: 50px; width: auto; max-width: 150px; display: block; border: 0;" onerror="this.style.display='none';">
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              ${htmlBody}
            </td>
          </tr>
          <!-- Footer with Social Media -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <p style="margin: 0; font-size: 14px; font-weight: 600; color: #333; margin-bottom: 15px;">Connect with us</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 0 8px;">
                          <a href="https://www.facebook.com/growwikmedia" target="_blank" style="display: inline-block; width: 44px; height: 44px; background-color: #1877f2; border-radius: 50%; text-align: center; line-height: 44px; text-decoration: none; transition: transform 0.2s;">
                            <img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" alt="Facebook" style="width: 24px; height: 24px; vertical-align: middle; filter: brightness(0) invert(1);" onerror="this.style.display='none';">
                          </a>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="https://twitter.com/growwikmedia" target="_blank" style="display: inline-block; width: 44px; height: 44px; background-color: #1da1f2; border-radius: 50%; text-align: center; line-height: 44px; text-decoration: none; transition: transform 0.2s;">
                            <img src="https://cdn-icons-png.flaticon.com/512/124/124021.png" alt="Twitter" style="width: 24px; height: 24px; vertical-align: middle; filter: brightness(0) invert(1);" onerror="this.style.display='none';">
                          </a>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="https://www.instagram.com/growwikmedia" target="_blank" style="display: inline-block; width: 44px; height: 44px; background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); border-radius: 50%; text-align: center; line-height: 44px; text-decoration: none; transition: transform 0.2s;">
                            <img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" alt="Instagram" style="width: 24px; height: 24px; vertical-align: middle; filter: brightness(0) invert(1);" onerror="this.style.display='none';">
                          </a>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="https://www.linkedin.com/company/growwikmedia" target="_blank" style="display: inline-block; width: 44px; height: 44px; background-color: #0077b5; border-radius: 50%; text-align: center; line-height: 44px; text-decoration: none; transition: transform 0.2s;">
                            <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="LinkedIn" style="width: 24px; height: 24px; vertical-align: middle; filter: brightness(0) invert(1);" onerror="this.style.display='none';">
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #666; line-height: 1.6;">
                      <strong style="color: #333;">Growwik Media</strong><br>
                      Email: <a href="mailto:contact@growwik.com" style="color: #2563eb; text-decoration: none;">contact@growwik.com</a><br>
                      <span style="color: #999;">© ${new Date().getFullYear()} Growwik Media. All rights reserved.</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

            return (
              <div className="py-4 space-y-3">
                {isEditingEmail ? (
                  <Textarea
                    value={emailDetails.body}
                    onChange={(e) => {
                      setEmailDetails({
                        ...emailDetails,
                        body: e.target.value,
                      });
                    }}
                    className="min-h-[200px] text-sm"
                    placeholder="Enter email body..."
                  />
                ) : emailViewMode === 'html' ? (
                  <div className="rounded-md border border-slate-200 bg-white overflow-hidden min-h-[400px] max-h-[600px]">
                    <iframe
                      srcDoc={fullHtmlEmail}
                      className="w-full h-full border-0"
                      style={{ minHeight: '500px', maxHeight: '600px' }}
                      title="Email HTML Preview"
                    />
                  </div>
                ) : (
                  <div className="rounded-md border border-slate-200 bg-white px-4 py-4 text-sm whitespace-pre-wrap min-h-[200px] max-h-[400px] overflow-y-auto">
                    {emailDetails.body.split(emailDetails.magicLink).map((part, index, array) => (
                      <span key={index}>
                        {part}
                        {index < array.length - 1 && (
                          <a
                            href={emailDetails.magicLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-medium"
                          >
                            Sign Now
                          </a>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditingEmail(!isEditingEmail);
                  if (isEditingEmail && emailDetails) {
                    // When saving, ensure magic link is preserved
                    if (!emailDetails.body.includes(emailDetails.magicLink)) {
                      setEmailDetails({
                        ...emailDetails,
                        body: `${emailDetails.body}\n\n${emailDetails.magicLink}`,
                      });
                    }
                  }
                }}
              >
                {isEditingEmail ? "Save" : "Edit"}
              </Button>
              {!isEditingEmail && (
                <Button
                  variant="outline"
                  onClick={() => setEmailViewMode(emailViewMode === 'simple' ? 'html' : 'simple')}
                >
                  {emailViewMode === 'simple' ? 'HTML View' : 'Simple Mail'}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  if (emailDetails) {
                    try {
                      let contentToCopy = '';
                      
                      if (emailViewMode === 'html') {
                        // Generate HTML email for copying
                        const convertToHtml = (text: string, magicLink: string, influencerName: string, companyName: string, collabId: string, currentDate: string) => {
                          // First, replace values with bold versions
                          let processedText = text;
                          
                          // Bold influencer name
                          if (influencerName) {
                            processedText = processedText.replace(new RegExp(influencerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<strong style="font-weight: 600;">${influencerName}</strong>`);
                          }
                          
                          // Bold company name
                          if (companyName) {
                            processedText = processedText.replace(new RegExp(companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<strong style="font-weight: 600;">${companyName}</strong>`);
                          }
                          
                          // Bold collaboration ID
                          if (collabId) {
                            processedText = processedText.replace(new RegExp(collabId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<strong style="font-weight: 600;">${collabId}</strong>`);
                          }
                          
                          // Bold current date
                          if (currentDate) {
                            processedText = processedText.replace(new RegExp(currentDate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<strong style="font-weight: 600;">${currentDate}</strong>`);
                          }
                          
                          const parts = processedText.split(magicLink);
                          let htmlContent = '';
                          let inBulletList = false;
                          
                          parts.forEach((part, partIndex) => {
                            const lines = part.split('\n');
                            
                            lines.forEach((line) => {
                              const trimmed = line.trim();
                              
                              if (trimmed.startsWith('•')) {
                                if (!inBulletList) {
                                  htmlContent += '<ul style="margin: 10px 0; padding-left: 20px; list-style: none;">';
                                  inBulletList = true;
                                }
                                htmlContent += `<li style="margin: 5px 0; font-size: 14px; line-height: 1.6; color: #374151;">${trimmed.substring(1).trim()}</li>`;
                              } else {
                                if (inBulletList) {
                                  htmlContent += '</ul>';
                                  inBulletList = false;
                                }
                                
                                if (trimmed.endsWith(':') && trimmed.length < 30 && trimmed.length > 0) {
                                  htmlContent += `<p style="margin: 20px 0 10px 0; font-size: 16px; font-weight: 600; color: #111827;">${trimmed}</p>`;
                                } else if (trimmed.toLowerCase().startsWith('best regards')) {
                                  htmlContent += `<p style="margin: 20px 0 5px 0; font-size: 14px; line-height: 1.6; color: #374151;">${trimmed}</p>`;
                                } else if (trimmed) {
                                  htmlContent += `<p style="margin: 0 0 15px 0; font-size: 14px; line-height: 1.6; color: #374151;">${trimmed}</p>`;
                                }
                              }
                            });
                            
                            if (inBulletList) {
                              htmlContent += '</ul>';
                              inBulletList = false;
                            }
                            
                            if (partIndex < parts.length - 1) {
                              htmlContent += `
                                <div style="margin: 30px 0; text-align: center;">
                                  <a href="${magicLink}" 
                                     style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                                    Sign Now
                                  </a>
                                </div>
                              `;
                            }
                          });
                          
                          return htmlContent;
                        };

                        // Extract values from email body for bolding
                        const influencerName = emailDetails.body.match(/Hi (.+?),/)?.[1] || '';
                        const companyName = campaign?.brand || campaign?.name || "Company";
                        const collabId = collaborationId || "N/A";
                        const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                        
                        const htmlBody = convertToHtml(emailDetails.body, emailDetails.magicLink, influencerName, companyName, collabId, currentDate);
                        const signifyLogoUrl = `${window.location.origin}/signature.png`;
                        const growwikLogoUrl = `${window.location.origin}/growiik.png`;
                        
                        contentToCopy = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailDetails.subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header with Logos -->
          <tr>
            <td style="padding: 30px 40px 20px; text-align: center; border-bottom: 2px solid #f0f0f0; background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 0 15px; vertical-align: middle; text-align: center;">
                          <img src="${signifyLogoUrl}" alt="Signify Logo" style="height: 35px; width: auto; max-width: 100px; display: block; border: 0;" onerror="this.style.display='none';">
                        </td>
                        <td style="padding: 0 8px; vertical-align: middle; text-align: center;">
                          <span style="font-size: 20px; color: #9ca3af;">•</span>
                        </td>
                        <td style="padding: 0 15px; vertical-align: middle;">
                          <img src="${growwikLogoUrl}" alt="Growwik Media Logo" style="height: 50px; width: auto; max-width: 150px; display: block; border: 0;" onerror="this.style.display='none';">
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              ${htmlBody}
            </td>
          </tr>
          <!-- Footer with Social Media -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <p style="margin: 0; font-size: 14px; font-weight: 600; color: #333; margin-bottom: 15px;">Connect with us</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 0 8px;">
                          <a href="https://www.facebook.com/growwikmedia" target="_blank" style="display: inline-block; width: 44px; height: 44px; background-color: #1877f2; border-radius: 50%; text-align: center; line-height: 44px; text-decoration: none; transition: transform 0.2s;">
                            <img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" alt="Facebook" style="width: 24px; height: 24px; vertical-align: middle; filter: brightness(0) invert(1);" onerror="this.style.display='none';">
                          </a>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="https://twitter.com/growwikmedia" target="_blank" style="display: inline-block; width: 44px; height: 44px; background-color: #1da1f2; border-radius: 50%; text-align: center; line-height: 44px; text-decoration: none; transition: transform 0.2s;">
                            <img src="https://cdn-icons-png.flaticon.com/512/124/124021.png" alt="Twitter" style="width: 24px; height: 24px; vertical-align: middle; filter: brightness(0) invert(1);" onerror="this.style.display='none';">
                          </a>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="https://www.instagram.com/growwikmedia" target="_blank" style="display: inline-block; width: 44px; height: 44px; background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); border-radius: 50%; text-align: center; line-height: 44px; text-decoration: none; transition: transform 0.2s;">
                            <img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" alt="Instagram" style="width: 24px; height: 24px; vertical-align: middle; filter: brightness(0) invert(1);" onerror="this.style.display='none';">
                          </a>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="https://www.linkedin.com/company/growwikmedia" target="_blank" style="display: inline-block; width: 44px; height: 44px; background-color: #0077b5; border-radius: 50%; text-align: center; line-height: 44px; text-decoration: none; transition: transform 0.2s;">
                            <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="LinkedIn" style="width: 24px; height: 24px; vertical-align: middle; filter: brightness(0) invert(1);" onerror="this.style.display='none';">
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #666; line-height: 1.6;">
                      <strong style="color: #333;">Growwik Media</strong><br>
                      Email: <a href="mailto:contact@growwik.com" style="color: #2563eb; text-decoration: none;">contact@growwik.com</a><br>
                      <span style="color: #999;">© ${new Date().getFullYear()} Growwik Media. All rights reserved.</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
                      } else {
                        // Plain text format
                        contentToCopy = `To: ${emailDetails.to}\nSubject: ${emailDetails.subject}\n\n${emailDetails.body}`;
                      }
                      
                      await navigator.clipboard.writeText(contentToCopy);
                      toast({
                        title: "Copied",
                        description: emailViewMode === 'html' 
                          ? "HTML email copied to clipboard." 
                          : "Email content copied to clipboard.",
                      });
                    } catch (error) {
                      console.error('Failed to copy:', error);
                      toast({
                        title: "Error",
                        description: "Failed to copy to clipboard.",
                        variant: "destructive",
                      });
                    }
                  }
                }}
              >
                Copy
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEmailDialogOpen(false);
                  setIsEditingEmail(false);
                }}
              >
                Close
              </Button>
              <Button
                className="bg-primary text-white hover:bg-primary/90"
                onClick={() => {
                  if (!emailDetails) return;

                  const encodedBody = encodeURIComponent(emailDetails.body);
                  const encodedSubject = encodeURIComponent(emailDetails.subject);
                  const encodedTo = encodeURIComponent(emailDetails.to);

                  // Zoho Mail compose URL format
                  // Format: https://mail.zoho.in/zm/comp.do?ct=mailto:EMAIL?subject=SUBJECT&body=BODY
                  const mailtoLink = `mailto:${emailDetails.to}?subject=${encodedSubject}&body=${encodedBody}`;
                  const zohoMailUrl = `https://mail.zoho.in/zm/comp.do?ct=${encodeURIComponent(mailtoLink)}`;
                  
                  // Open Zoho Mail compose page in new tab with pre-filled data
                  window.open(zohoMailUrl, '_blank', 'noopener,noreferrer');

                  toast({
                    title: "Opening Zoho Mail",
                    description: "Redirecting to Zoho Mail compose window with all details pre-filled.",
                  });
                  
                  // Close dialog after redirect
                  setTimeout(() => {
                    setIsEmailDialogOpen(false);
                    setIsEditingEmail(false);
                  }, 100);
                }}
              >
                Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CollaborationAssignment;

