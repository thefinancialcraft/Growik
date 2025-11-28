import { useCallback, useEffect, useMemo, useState, useRef } from "react";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Printer, ChevronLeft, ChevronRight, Pen, Type, X, RotateCcw, RefreshCw, Trash2, Mail } from "lucide-react";

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

        if (contractData.variables && typeof contractData.variables === "object") {
          Object.entries(contractData.variables).forEach(([rawKey, rawValue]) => {
            const normalizedKey = normalizeVariableKey(rawKey);
            if (!normalizedKey) {
              return;
            }

            // Skip base "signature" and "plain_text" entries - they will be handled by occurrence tracking
            if (normalizedKey === "signature" || normalizedKey === "plain_text") {
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
            // Preserve order: keep existing descriptors first, then add new ones (avoiding duplicates)
            const mergedDescriptors = existing
              ? (() => {
                const existingSet = new Set(existing.descriptors);
                const newUnique = uniqueDescriptors.filter(d => !existingSet.has(d));
                return [...existing.descriptors, ...newUnique];
              })()
              : uniqueDescriptors;
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

          // Track occurrences of plain_text and signature separately
          const plainTextOccurrences = new Map<string, number>();
          const signatureOccurrences = new Map<string, number>();

          while ((match = regex.exec(contractData.content)) !== null) {
            const normalizedKey = normalizeVariableKey(match[1]);
            if (normalizedKey) {
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
              } else if (normalizedKey === "signature") {
                // For signature, create separate entries for each occurrence
                const currentCount = signatureOccurrences.get("signature") ?? 0;
                const indexedKey = `signature_${currentCount}`;
                signatureOccurrences.set("signature", currentCount + 1);

                if (!collected.has(indexedKey)) {
                  collected.set(indexedKey, {
                    description: `Signature placeholder (occurrence ${currentCount + 1})`,
                    descriptors: []
                  });
                }
              } else {
                // For other variables, use the original logic
                if (!collected.has(normalizedKey)) {
                  collected.set(normalizedKey, { description: undefined, descriptors: [] });
                }
              }
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
            console.error(`CollaborationAssignment: failed to fetch ${fromName}`, err);
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

        // Filter out base "signature" and "plain_text" entries if we have indexed versions
        const hasIndexedSignatures = Array.from(collected.keys()).some(k => k.startsWith("signature_"));
        const hasIndexedPlainText = Array.from(collected.keys()).some(k => k.startsWith("plain_text_"));

        const filteredCollected = new Map(collected);
        if (hasIndexedSignatures && filteredCollected.has("signature")) {
          filteredCollected.delete("signature");
        }
        if (hasIndexedPlainText && filteredCollected.has("plain_text")) {
          filteredCollected.delete("plain_text");
        }

        const preparedEntries = await Promise.all(
          Array.from(filteredCollected.entries()).map(async ([key, info]) => {
            const resolved = await resolveDescriptorsToValue(info.descriptors);
            // Check if this is a plain_text entry (with or without index)
            const isPlainText = key === "plain_text" || key.startsWith("plain_text_");
            // Check if this is a signature entry (with or without index)
            const isSignature = key === "signature" || key.startsWith("signature_") || key === "signature.user" || key === "signature.influencer";
            const isEditable = isPlainText || isSignature;

            // Normalize key for placeholder (remove index suffix)
            let placeholderKey = key;
            if (key.startsWith("plain_text_")) {
              placeholderKey = "plain_text";
            } else if (key.startsWith("signature_")) {
              placeholderKey = "signature";
            }

            return {
              key: `var[{{${placeholderKey}}}]`, // Use base key in placeholder, but keep indexed key for tracking
              originalKey: key, // Store original key for tracking (e.g., signature_0, signature_1)
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
                    if (value) {
                      overrideMap.set(key, String(value));
                    }
                  });
                } catch (e) {
                  console.error("Failed to parse all_variables", e);
                }
              } else {
                overrideMap.set(override.variable_key, override.value);
              }
            }
          });
          
          // Add magic_link to overrideMap if found in column
          if (loadedMagicLink) {
            overrideMap.set("magic_link", loadedMagicLink);
          }
        } catch (overrideErr) {
          console.error("CollaborationAssignment: failed to load overrides", overrideErr);
        }

        const finalEntries = preparedEntries.map((entry) => {
          // Check for override using both key and originalKey
          const overrideValue = overrideMap.get(entry.originalKey || entry.key) || overrideMap.get(entry.key);
          if (overrideValue !== undefined) {
            return {
              ...entry,
              value: overrideValue,
              rawValues: overrideValue ? [overrideValue] : [],
              // For editable entries (plain_text, signature), also set inputValue
              inputValue: entry.editable ? overrideValue : entry.inputValue,
            };
          }
          return entry;
        });

        setContractVariableEntries(finalEntries);
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

      let previewHtml = contractContent;
      const variablesMap: Record<string, string | null> = {};

      // Group plain_text entries by their index for sequential replacement
      const plainTextEntries = contractVariableEntries
        .filter(e => e.originalKey?.startsWith("plain_text_"))
        .sort((a, b) => {
          // Sort by index: plain_text_0, plain_text_1, etc.
          const aIndex = parseInt(a.originalKey?.replace("plain_text_", "") || "0", 10);
          const bIndex = parseInt(b.originalKey?.replace("plain_text_", "") || "0", 10);
          return aIndex - bIndex;
        });
      const otherEntries = contractVariableEntries.filter(e =>
        !e.originalKey?.startsWith("plain_text_") && !e.key.includes("signature")
      );

      // Process plain_text entries sequentially - replace each occurrence with its corresponding value
      if (plainTextEntries.length > 0) {
        const placeholder = "var[{{plain_text}}]";
        const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escapedPlaceholder, "g");
        const matches: Array<{ index: number; value: string }> = [];

        // Collect all plain_text values in order
        plainTextEntries.forEach((entry) => {
          const input = entry.inputValue?.trim() ?? "";
          let sanitizedValue = input ? escapeHtml(input).replace(/\r?\n/g, "<br />") : "--";
          const entryIndex = parseInt(entry.originalKey?.replace("plain_text_", "") || "0", 10);
          matches.push({ index: entryIndex, value: sanitizedValue });

          // Store value for this specific occurrence
          variablesMap[entry.originalKey || entry.key] = input || null;
        });

        // Replace occurrences sequentially
        let occurrenceIndex = 0;
        previewHtml = previewHtml.replace(regex, () => {
          const match = matches.find(m => m.index === occurrenceIndex);
          occurrenceIndex++;
          return match ? match.value : "--";
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
      // First, handle signature.user
      const signatureUserEntries = contractVariableEntries.filter(
        e => (e.originalKey === 'signature.user' || e.key === 'signature.user') && !e.originalKey?.startsWith("plain_text_")
      );

      if (signatureUserEntries.length > 0) {
        // Use flexible regex to match var[{{signature.user}}] with optional spaces
        const regex = /var\[\s*\{\{\s*signature\.user\s*\}\}\s*\]/gi;

        previewHtml = previewHtml.replace(regex, (match) => {
          const entry = signatureUserEntries[0];
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
            // Make clickable placeholder with data attribute
            displayHtml = `<span class="signature-box signature-box-clickable" data-signature="true" data-signature-key="signature.user" style="cursor: pointer; transition: all 0.2s;">var[{{signature.user}}]</span>`;
          }

          const storedValue = entry.editable
            ? entry.inputValue?.trim() ?? null
            : entry.rawValues && entry.rawValues.length
              ? entry.rawValues.join("\n")
              : entry.value ?? null;

          if (entry.originalKey) {
            variablesMap[entry.originalKey] = storedValue && storedValue.length ? storedValue : null;
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

      // Handle signature.influencer
      const signatureInfluencerEntries = contractVariableEntries.filter(
        e => (e.originalKey === 'signature.influencer' || e.key === 'signature.influencer') && !e.originalKey?.startsWith("plain_text_")
      );

      if (signatureInfluencerEntries.length > 0) {
        const placeholder = "var[{{signature.influencer}}]";
        const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escapedPlaceholder, "g");

        previewHtml = previewHtml.replace(regex, (match) => {
          const entry = signatureInfluencerEntries[0];
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
              displayHtml = `<img src="${signatureValue}" alt="Signature" style="display: inline-block; max-width: 200px; max-height: 80px; margin-top: 20px; margin-bottom: 20px; vertical-align: middle;" />`;
            } else {
              const sanitizedText = escapeHtml(signatureValue);
              displayHtml = `<span style="display: inline-block; font-family: 'Dancing Script', 'Great Vibes', 'Allura', 'Brush Script MT', 'Lucida Handwriting', 'Pacifico', 'Satisfy', 'Kalam', 'Caveat', 'Permanent Marker', cursive; font-size: 24px; margin-top: 20px; margin-bottom: 20px; vertical-align: middle;">${sanitizedText}</span>`;
            }
          } else {
            // Make clickable placeholder with data attribute
            displayHtml = `<span class="signature-box signature-box-clickable" data-signature="true" data-signature-key="signature.influencer" style="cursor: pointer; transition: all 0.2s;">var[{{signature.influencer}}]</span>`;
          }

          const storedValue = entry.editable
            ? entry.inputValue?.trim() ?? null
            : entry.rawValues && entry.rawValues.length
              ? entry.rawValues.join("\n")
              : entry.value ?? null;

          if (entry.originalKey) {
            variablesMap[entry.originalKey] = storedValue && storedValue.length ? storedValue : null;
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
          const storedValue = entry.editable
            ? entry.inputValue?.trim() ?? null
            : entry.rawValues && entry.rawValues.length
              ? entry.rawValues.join("\n")
              : entry.value ?? null;

          if (entry.originalKey) {
            variablesMap[entry.originalKey] = storedValue && storedValue.length ? storedValue : null;
          }

          return displayHtml;
        });
      }

      // Process other entries (non-plain_text)
      otherEntries.forEach((entry) => {
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

        // If multiple values exist, replace occurrences sequentially
        // First occurrence gets first value, second gets second, etc.
        if (values.length > 1) {
          const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(escapedPlaceholder, "g");
          let occurrenceIndex = 0;

          previewHtml = previewHtml.replace(regex, () => {
            const valueIndex = occurrenceIndex % values.length; // Cycle through values if more occurrences than values
            const selectedValue = values[valueIndex];
            occurrenceIndex++;
            return escapeHtml(selectedValue).replace(/\r?\n/g, "<br />");
          });
        } else {
          // Single value: replace all occurrences with the same value
          const sanitizedValue = values.length
            ? escapeHtml(values[0]).replace(/\r?\n/g, "<br />")
            : "--";

          const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          previewHtml = previewHtml.replace(new RegExp(escapedPlaceholder, "g"), sanitizedValue);
        }

        // Store variable value for saving (all values joined)
        const storedValue = entry.editable
          ? entry.inputValue?.trim() ?? null
          : entry.rawValues && entry.rawValues.length
            ? entry.rawValues.join("\n")
            : entry.value ?? null;

        variablesMap[entry.key] = storedValue && storedValue.length ? storedValue : null;
      });

      // Replace remaining placeholders with --, but keep signature placeholders as var[{{signature}}]
      previewHtml = previewHtml.replace(/var\[\s*\{\{([^}]+)\}\}\s*\]/g, (match, variableName) => {
        // Keep signature placeholders as is
        if (variableName.trim() === "signature") {
          return match; // Keep var[{{signature}}] as is
        }
        // Replace other placeholders with --
        return "--";
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
      // Check if we already have a magic link token from loaded overrides
      let magicLinkToken = contractVariableEntries.find(e => e.key === "magic_link")?.value;

      if (!magicLinkToken) {
        // Try to load existing magic_link from database column
        try {
          const { data: existingMagicLink } = await (supabase as any)
            .from(VARIABLE_OVERRIDE_TABLE)
            .select("magic_link")
            .eq("collaboration_id", collaborationId)
            .not("magic_link", "is", null)
            .limit(1)
            .maybeSingle();
          
          if (existingMagicLink?.magic_link) {
            magicLinkToken = existingMagicLink.magic_link;
          }
        } catch (err) {
          console.error("Error loading existing magic_link", err);
        }
      }

      if (!magicLinkToken) {
        // Generate new token if not exists
        magicLinkToken = crypto.randomUUID();
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
          const contractRecord = {
            campaign_id: resolvedCampaignId,
            influencer_id: resolvedInfluencerId,
            collaboration_id: collaborationId,
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

          // Upsert the single contract record with all data
          const { error: contractError } = await (supabase as any)
            .from(VARIABLE_OVERRIDE_TABLE)
            .upsert(contractRecord, { 
              onConflict: 'collaboration_id,variable_key'
            });

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
      const { data, error } = await (supabase as any)
        .from("collaboration_variable_overrides")
        .select("contract_html")
        .eq("collaboration_id", collaborationId)
        .eq("variable_key", "all_variables")
        .maybeSingle();

      if (error) {
        throw error;
      }

      const overrideData = data as { contract_html?: string | null } | null;
      if (overrideData?.contract_html) {
        setSavedContractHtml(overrideData.contract_html);
      } else {
        // Fallback: Try to get any record with contract_html for this collaboration_id
        const { data: fallbackData, error: fallbackError } = await (supabase as any)
          .from("collaboration_variable_overrides")
          .select("contract_html")
          .eq("collaboration_id", collaborationId)
          .not("contract_html", "is", null)
          .maybeSingle();

        if (!fallbackError && fallbackData?.contract_html) {
          setSavedContractHtml(fallbackData.contract_html);
        } else {
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

      // Send email via Zoho SMTP
      const magicLink = `${window.location.origin}/share/contract/${magicLinkToken}`;
      const influencerName = influencer.name || "Influencer";
      const influencerEmail = influencer.email || "";

      if (!influencerEmail) {
        toast({
          title: "Error",
          description: "Influencer email address not found.",
          variant: "destructive",
        });
        return;
      }

      // Fetch current user profile for email signature
      let userProfile: { user_name?: string; email?: string; employee_id?: string } | null = null;
      if (currentUserId) {
        try {
          const { data: profileData } = await supabase
            .from("user_profiles")
            .select("user_name, email, employee_id")
            .eq("user_id", currentUserId)
            .maybeSingle();
          
          if (profileData) {
            userProfile = profileData;
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
        }
      }

      // Get company name from campaign
      const companyName = campaign?.brand || "Company";
      
      // Format current date
      const currentDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      // Create email subject with company name and collaboration ID
      const emailSubject = `Contract Signing Link – Action Required | ${companyName} | ${collaborationId}`;

      // Create email body with new template
      const emailBody = `Hi ${influencerName},

We hope you're doing great!

As discussed during our onboarding, we are sharing your secure contract signing link.

Please use the magic link below to review and digitally sign your contract:

🔗 Contract Signing Link:

${magicLink}

Simply click the link, complete the signature, and your onboarding process will be finalized.

If you face any issues while opening or signing the contract, feel free to reach out to us — we're here to help.

Best regards,

Growwik Media

---
Collaboration ID: ${collaborationId}
${userProfile?.user_name ? `Sent by: ${userProfile.user_name}` : ''}
${userProfile?.email ? `Email: ${userProfile.email}` : ''}
${userProfile?.employee_id ? `Employee Code: ${userProfile.employee_id}` : ''}
Date: ${currentDate}`;

      // Call email API to send email via Zoho SMTP
      try {
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: influencerEmail,
            subject: emailSubject,
            body: emailBody,
            influencerName: influencerName,
            collaborationId: collaborationId,
            companyName: companyName,
            userName: userProfile?.user_name || null,
            userEmail: userProfile?.email || null,
            employeeId: userProfile?.employee_id || null,
            date: currentDate,
          }),
        });

        // Check if response has content before parsing
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          throw new Error(`Invalid response from server: ${text || 'Empty response'}`);
        }

        // Check if response body is empty
        const text = await response.text();
        if (!text) {
          throw new Error('Empty response from server. Make sure the API endpoint is deployed.');
        }

        let result;
        try {
          result = JSON.parse(text);
        } catch (parseError) {
          throw new Error(`Failed to parse response: ${text}`);
        }

        if (!response.ok) {
          throw new Error(result.error || result.details || 'Failed to send email');
        }

        toast({
          title: "Email Sent Successfully",
          description: `Contract link has been sent to ${influencerEmail}`,
        });
      } catch (emailError: any) {
        console.error("Error sending email:", emailError);
        
        // Provide more helpful error messages
        let errorMessage = emailError.message || 'Failed to send email';
        
        if (emailError.message?.includes('fetch')) {
          errorMessage = 'Unable to reach email server. Please check your connection or ensure the API is deployed.';
        } else if (emailError.message?.includes('Empty response')) {
          errorMessage = 'Email API endpoint not available. Please deploy the API or use "vercel dev" for local development.';
        }
        
        throw new Error(`Failed to send email: ${errorMessage}`);
      }
    } catch (error: any) {
      console.error("Error sending contract:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to send contract.",
        variant: "destructive",
      });
    }
  };

  const handleCreateDraftEmail = async () => {
    if (!influencer) {
      toast({
        title: "Error",
        description: "Influencer information not found.",
        variant: "destructive",
      });
      return;
    }

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

    const magicLink = `${window.location.origin}/share/contract/${magicLinkToken}`;
    const influencerName = influencer.name || "Influencer";
    const influencerEmail = influencer.email || "";

    // Create email body
    const emailBody = `hii ${influencerName}\n\nthis is your magic link\n\n${magicLink}`;
    
    // Encode for URL
    const encodedBody = encodeURIComponent(emailBody);
    const encodedSubject = encodeURIComponent("Contract Signing Link");

    // Try Zoho Mail compose URL first, then fallback to mailto
    const zohoMailUrl1 = `https://mail.zoho.in/zm/#compose?to=${encodeURIComponent(influencerEmail)}&subject=${encodedSubject}&body=${encodedBody}`;
    const zohoMailUrl2 = `https://mail.zoho.in/zm/#compose/to=${encodeURIComponent(influencerEmail)}/subject=${encodedSubject}/body=${encodedBody}`;
    const mailtoLink = `mailto:${encodeURIComponent(influencerEmail)}?subject=${encodedSubject}&body=${encodedBody}`;
    
    // Open Zoho Mail in new tab
    // Using setTimeout to ensure it's a direct user action (helps with popup blockers)
    setTimeout(() => {
      // Try first format
      let newWindow = window.open(zohoMailUrl1, '_blank', 'noopener,noreferrer');
      
      if (!newWindow) {
        // Popup blocked, use mailto as fallback
        window.location.href = mailtoLink;
        toast({
          title: "Opening Email Client",
          description: "Your default email client is opening with the draft email.",
        });
      } else {
        toast({
          title: "Opening Zoho Mail",
          description: "Zoho Mail compose window opened. If it shows inbox, the compose window should appear.",
        });
      }
    }, 100);
  };

  return (
    <>
      <div className="flex min-h-screen bg-gradient-subtle">
        <Sidebar />
        <MobileNav />

        <div className="flex-1 lg:ml-56">
          <Header />
          <main className="container mx-auto w-full px-4 py-8">
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading collaboration assignment...</span>
                </div>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-sm text-destructive">
                {error}
              </div>
            ) : !campaign ? (
              <Card className="border-none bg-gradient-to-br from-white/95 to-slate-100">
                <div className="p-6 space-y-4">
                  <h2 className="text-xl font-semibold text-slate-900">No campaign selected</h2>
                  <p className="text-sm text-slate-500">
                    Choose a campaign from the campaigns list to manage collaboration details.
                  </p>
                  <Button size="sm" className="bg-primary text-white hover:bg-primary/90" onClick={() => navigate("/campaign")}>
                    Go to Campaigns
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                <Card className="border-none bg-gradient-to-br from-white/95 to-slate-100">
                  <div className="p-6 space-y-5">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h2 className="text-xl font-semibold text-slate-900">Assigned Influencer</h2>
                        <p className="text-sm text-slate-500">
                          Showing the first collaborator assigned to this campaign.
                        </p>
                        <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                            <p className="font-semibold text-slate-700">Campaign ID</p>
                            <p className="text-[11px] text-slate-500 break-all">
                              {campaignKey ?? resolvedCampaignId ?? "Unknown"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                            <p className="font-semibold text-slate-700">Collaboration ID</p>
                            <p className="text-[11px] text-slate-500 break-all">
                              {collaborationId ?? "Not generated"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                            <p className="font-semibold text-slate-700">Influencer PID</p>
                            <p className="text-[11px] text-slate-500 break-all">
                              {influencer?.pid ?? influencer?.id ?? "Not assigned"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                            <p className="font-semibold text-slate-700">Contract PID</p>
                            <p className="text-[11px] text-slate-500 break-all">
                              {resolvedContractPid ?? (contractMeta?.id ? "Fetching..." : "No contract linked")}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                            <p className="font-semibold text-slate-700">Employee ID</p>
                            <p className="text-[11px] text-slate-500 break-all">
                              {campaign?.users?.[0]?.employeeId ?? "Not assigned"}
                            </p>
                          </div>
                        </div>
                      </div>
                      {influencer && (
                        <Badge className="rounded-full bg-emerald-100 text-emerald-700 border-emerald-200 capitalize">
                          Status: {influencer.status ?? "--"}
                        </Badge>
                      )}
                    </div>

                    {influencer ? (
                      <div className="space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary shadow">
                                {influencer.name.charAt(0).toUpperCase()}
                              </span>
                              <div>
                                <p className="text-lg font-semibold text-slate-900">{influencer.name}</p>
                                <p className="text-sm text-slate-500">
                                  Influencer PID: {influencer.pid ?? influencer.id ?? "Not provided"}
                                </p>
                              </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 shadow-sm">
                              <p>Email: <span className="font-medium">{influencer.email ?? "Not provided"}</span></p>
                              <p className="text-xs text-slate-500">
                                Contact: {influencer.handles.length ? influencer.handles[0].url : "Not available"}
                              </p>
                            </div>
                          </div>
                          {influencer.country && (
                            <Badge className="rounded-full bg-primary/10 text-primary border-primary/20 text-xs px-3 py-1">
                              {influencer.country}
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
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
                                  className="h-6 w-6 rounded-full border border-slate-200 bg-white p-[2px] shadow-sm"
                                />
                              ) : (
                                <span
                                  key={`${influencer.id}-${handle.platform}`}
                                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] capitalize shadow-sm"
                                >
                                  {meta.label}
                                </span>
                              );
                            })
                          ) : (
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px]">
                              No platforms
                            </span>
                          )}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-700 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Latest update</p>
                            <p className="mt-2 leading-snug">
                              {influencer.status === "pending"
                                ? "Awaiting contract confirmation"
                                : "No recent updates"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-700 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Internal notes</p>
                            <p className="mt-2 leading-snug">
                              Capture outreach notes and next steps here once CRM sync is connected.
                            </p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-4 text-sm text-slate-700 shadow-sm space-y-3">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Actions</p>
                          <div className="space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-3">
                              <Select value={selectedAction || undefined} onValueChange={(value) => setSelectedAction(value as ActionOption)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select an action" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="interested">Interested</SelectItem>
                                  <SelectItem value="not_interested">Not Interested</SelectItem>
                                  <SelectItem value="callback">Callback</SelectItem>
                                  <SelectItem value="done">Done</SelectItem>
                                </SelectContent>
                              </Select>
                              {selectedAction === "callback" && (
                                <div className="grid gap-2 md:grid-cols-2">
                                  <Input
                                    type="date"
                                    value={callbackDate}
                                    onChange={(event) => setCallbackDate(event.target.value)}
                                    className="w-full"
                                    aria-label="Select callback date"
                                  />
                                  <Input
                                    type="time"
                                    value={callbackTime}
                                    onChange={(event) => setCallbackTime(event.target.value)}
                                    className="w-full"
                                    aria-label="Select callback time"
                                  />
                                </div>
                              )}
                              <Textarea
                                rows={2}
                                placeholder="Add remarks..."
                                value={actionRemark}
                                onChange={(event) => setActionRemark(event.target.value)}
                              />
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                  className="bg-primary text-white hover:bg-primary/90"
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
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    size="sm"
                                    className="bg-primary text-white hover:bg-primary/90"
                                    onClick={handleSendContract}
                                  >
                                    {isContractSent ? "Resend" : "Send Contract"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleFillContract}
                                  >
                                    Fill Contract
                                  </Button>
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
                                  >
                                    View Contract
                                  </Button>
                                  {isSigned && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-800 rounded-md">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      <span className="text-sm font-semibold">Contract Signed</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handlePreviousInfluencer}
                                    disabled={!influencerNavigation.hasPrevious}
                                    title="Previous Influencer"
                                  >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Previous
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      // Find magic link token from loaded entries
                                      let magicLinkToken = contractVariableEntries.find(e => e.key === "magic_link")?.value;

                                      // If not found locally, try to fetch from database column
                                      if (!magicLinkToken && collaborationId) {
                                        try {
                                          const { data: magicLinkData } = await (supabase as any)
                                            .from(VARIABLE_OVERRIDE_TABLE)
                                            .select("magic_link")
                                            .eq("collaboration_id", collaborationId)
                                            .not("magic_link", "is", null)
                                            .limit(1)
                                            .maybeSingle();
                                          
                                          if (magicLinkData?.magic_link) {
                                            magicLinkToken = magicLinkData.magic_link;
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

                                      const link = `${window.location.origin}/share/contract/${magicLinkToken}`;
                                      navigator.clipboard.writeText(link);
                                      toast({
                                        title: "Link Copied",
                                        description: "Magic link copied to clipboard.",
                                      });
                                    }}
                                  >
                                    Copy Magic Link
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleCreateDraftEmail();
                                    }}
                                    title="Create draft email in Zoho Mail"
                                  >
                                    <Mail className="h-4 w-4 mr-2" />
                                    Create Draft Email
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleNextInfluencer}
                                    disabled={!influencerNavigation.hasNext}
                                    title="Next Influencer"
                                  >
                                    Next
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                          {lastAction ? (
                            <>
                              <p className="font-semibold text-slate-700">{lastAction.label}</p>
                              <p>{lastAction.timestamp}</p>
                              {lastAction.remark && (
                                <p className="mt-1 text-slate-500">Remark: {lastAction.remark}</p>
                              )}
                            </>
                          ) : (
                            <p>No recent actions recorded.</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-3 py-12 text-center text-sm text-slate-500">
                        No influencers assigned to this campaign yet.
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="border-none bg-gradient-to-b from-white/95 to-slate-100">
                  <div className="p-6 space-y-4 flex flex-col h-full">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-xl font-semibold text-slate-900">Timeline</h2>
                        <p className="text-sm text-slate-500">Key steps in the collaboration workflow.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            void fetchTimelineEntries();
                          }}
                          disabled={timelineLoading}
                          title="Refresh Timeline"
                        >
                          <RefreshCw className={`h-4 w-4 ${timelineLoading ? 'animate-spin' : ''}`} />
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
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {timelineLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                      </div>
                    ) : (
                      <ScrollArea className="flex-1 h-[calc(100vh-280px)] min-h-[400px] max-h-[600px]">
                        <div className="relative pl-4 pr-4">
                          <span className="absolute left-0 top-2 bottom-2 w-px bg-slate-200" />
                          <div className="space-y-5">
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
                                  <div key={entry.id} className="relative rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                                    <span className="absolute -left-[9px] top-4 h-4 w-4 rounded-full border border-white bg-primary shadow flex items-center justify-center text-[10px] text-white">
                                      {getActionIcon()}
                                    </span>
                                    <div className="ml-2 space-y-1">
                                      <h3 className="text-sm font-semibold text-slate-900">{entry.description}</h3>
                                      {entry.remark && (
                                        <p className="text-xs text-slate-500 leading-snug">Remark: {entry.remark}</p>
                                      )}
                                      {entry.action && (
                                        <p className="text-xs text-slate-500 leading-snug">Action: {entry.action.replace('_', ' ')}</p>
                                      )}
                                      <p className="text-xs text-slate-400">{timestamp}</p>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-3 py-8 text-center text-xs text-slate-400">
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
                    contractVariableEntries.map((item, idx) => {
                      const uniqueKey = item.originalKey || item.key || `var-${idx}`;
                      return (
                        <div key={uniqueKey} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm space-y-1">
                          <p className="font-semibold text-slate-800">{item.key}</p>
                          {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
                          {item.editable ? (
                            item.key.includes('signature') ? (
                              <div
                                className="cursor-pointer rounded border border-slate-300 bg-transparent px-2 py-2 text-center text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                                style={{
                                  width: '200px',
                                  height: '140px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                onClick={() => {
                                  setCurrentSignatureEntry(uniqueKey);
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
                                  setIsSignatureDialogOpen(true);
                                }}
                              >
                                {item.inputValue ? '✓' : `var[{{${item.key}}}]`}
                              </div>
                            ) : (
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
                            )
                          ) : (
                            item.value && <p className="text-xs text-emerald-600">{item.value}</p>
                          )}
                        </div>
                      );
                    })
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
                  __html: savedContractHtml.includes('<body>')
                    ? savedContractHtml.split('<body>')[1]?.split('</body>')[0] || savedContractHtml
                    : savedContractHtml
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
      <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Signature</DialogTitle>
            <DialogDescription>
              Choose how you want to add your signature: draw it or type it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Mode Selection */}
            <div className="flex gap-2">
              <Button
                variant={signatureMode === 'draw' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setSignatureMode('draw')}
              >
                <Pen className="mr-2 h-4 w-4" />
                Draw
              </Button>
              <Button
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
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const canvas = signatureCanvasRef.current;
                      if (canvas) {
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.clearRect(0, 0, canvas.width, canvas.height);
                        }
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
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsSignatureDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                let finalValue = signatureValue;

                if (signatureMode === 'draw') {
                  const canvas = signatureCanvasRef.current;
                  if (canvas) {
                    // Convert canvas to data URL
                    finalValue = canvas.toDataURL('image/png');
                  }
                } else if (signatureMode === 'type') {
                  // Convert typed text to image using a temporary canvas
                  const canvas = document.createElement('canvas');
                  // Set dimensions - large enough for high quality
                  canvas.width = 600;
                  canvas.height = 200;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    // Transparent background
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    // Configure text style
                    // Use a large font size for better resolution
                    ctx.font = `60px "${signatureFont}"`;
                    ctx.fillStyle = '#000000';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    // Draw text in the center
                    ctx.fillText(signatureValue, canvas.width / 2, canvas.height / 2);

                    finalValue = canvas.toDataURL('image/png');
                  }
                }

                if (currentSignatureEntry && finalValue) {
                  setContractVariableEntries((prev) => {
                    const existingIndex = prev.findIndex(
                      (entry) => (entry.originalKey || entry.key) === currentSignatureEntry
                    );

                    if (existingIndex !== -1) {
                      // Update existing entry
                      return prev.map((entry) =>
                        (entry.originalKey || entry.key) === currentSignatureEntry
                          ? {
                            ...entry,
                            inputValue: finalValue,
                          }
                          : entry
                      );
                    } else {
                      // Create new entry for signature.user or signature.influencer
                      return [
                        ...prev,
                        {
                          key: currentSignatureEntry,
                          originalKey: currentSignatureEntry,
                          editable: true,
                          inputValue: finalValue,
                          value: null,
                          rawValues: [],
                          description: currentSignatureEntry === 'signature.user'
                            ? 'User signature'
                            : currentSignatureEntry === 'signature.influencer'
                              ? 'Influencer signature'
                              : 'Signature',
                        },
                      ];
                    }
                  });
                }
                setIsSignatureDialogOpen(false);
              }}
              disabled={signatureMode === 'draw' ? !signatureCanvasRef.current : !signatureValue}
            >
              Save Signature
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CollaborationAssignment;

