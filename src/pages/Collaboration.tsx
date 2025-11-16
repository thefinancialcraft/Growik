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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Printer } from "lucide-react";

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
    return campaign.influencers[0];
  }, [campaign]);

  const resolvedInfluencerId = useMemo(() => {
    if (isUuid(influencer?.id)) {
      return influencer!.id;
    }
    return null;
  }, [influencer?.id]);

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

  // Fetch timeline entries when collaborationId is available
  useEffect(() => {
    if (collaborationId) {
      void fetchTimelineEntries();
    }
  }, [collaborationId, fetchTimelineEntries]);

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
      
      // CRITICAL: Ensure tiptap-rendered elements have proper spacing
      // Apply inline styles directly to preserve spacing in print
      const tiptapElements = container.querySelectorAll('.tiptap-rendered, [class*="tiptap-rendered"]');
      tiptapElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const currentStyle = htmlEl.getAttribute('style') || '';
        if (!currentStyle.includes('line-height')) {
          htmlEl.setAttribute('style', `${currentStyle}; line-height: 1.7;`.trim());
        }
      });
      
      // Apply paragraph spacing directly
      const paragraphs = container.querySelectorAll('.tiptap-rendered p, [class*="tiptap-rendered"] p');
      paragraphs.forEach((p) => {
        const htmlP = p as HTMLElement;
        const currentStyle = htmlP.getAttribute('style') || '';
        if (!currentStyle.includes('margin-bottom') && !currentStyle.includes('margin:')) {
          htmlP.setAttribute('style', `${currentStyle}; margin: 0 0 14px;`.trim());
        }
      });
      
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
          /* CRITICAL: Preserve line spacing and paragraph margins - HIGHEST PRIORITY */
          #contract-print-container .tiptap-rendered,
          #contract-print-container [class*="tiptap-rendered"],
          #contract-print-container div.tiptap-rendered,
          #contract-print-container div[class*="tiptap-rendered"] {
            line-height: 1.7 !important;
            font-size: 11pt !important;
            color: #111827 !important;
            word-break: break-word !important;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
          }
          /* CRITICAL: Preserve paragraph spacing - FORCE APPLY */
          #contract-print-container .tiptap-rendered p,
          #contract-print-container [class*="tiptap-rendered"] p,
          #contract-print-container div.tiptap-rendered p,
          #contract-print-container div[class*="tiptap-rendered"] p,
          #contract-print-container p {
            margin: 0 0 14px !important;
            margin-top: 0 !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            margin-bottom: 14px !important;
            padding: 0 !important;
            display: block !important;
            visibility: visible !important;
            line-height: 1.7 !important;
          }
          /* Ensure empty paragraphs also have spacing */
          #contract-print-container .tiptap-rendered p:empty,
          #contract-print-container [class*="tiptap-rendered"] p:empty {
            margin: 0 0 14px !important;
            min-height: 1.7em !important;
          }
          /* CRITICAL: Preserve heading spacing */
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
            margin: 26px 0 14px !important;
            line-height: 1.3 !important;
            font-weight: 600 !important;
            display: block !important;
            visibility: visible !important;
          }
          #contract-print-container .tiptap-rendered h1,
          #contract-print-container [class*="tiptap-rendered"] h1 {
            font-size: 30px !important;
          }
          #contract-print-container .tiptap-rendered h2,
          #contract-print-container [class*="tiptap-rendered"] h2 {
            font-size: 24px !important;
          }
          #contract-print-container .tiptap-rendered h3,
          #contract-print-container [class*="tiptap-rendered"] h3 {
            font-size: 20px !important;
          }
          #contract-print-container .tiptap-rendered h4,
          #contract-print-container [class*="tiptap-rendered"] h4 {
            font-size: 18px !important;
          }
          #contract-print-container .tiptap-rendered h5,
          #contract-print-container [class*="tiptap-rendered"] h5 {
            font-size: 16px !important;
          }
          #contract-print-container .tiptap-rendered h6,
          #contract-print-container [class*="tiptap-rendered"] h6 {
            font-size: 14px !important;
          }
          /* CRITICAL: Preserve list spacing */
          #contract-print-container .tiptap-rendered ul,
          #contract-print-container .tiptap-rendered ol,
          #contract-print-container [class*="tiptap-rendered"] ul,
          #contract-print-container [class*="tiptap-rendered"] ol {
            margin: 0 0 14px 26px !important;
            padding: 0 !important;
            display: block !important;
            visibility: visible !important;
          }
          /* CRITICAL: Preserve table spacing */
          #contract-print-container .tiptap-rendered table,
          #contract-print-container [class*="tiptap-rendered"] table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 18px 0 !important;
            font-size: 10.5pt !important;
            display: table !important;
            visibility: visible !important;
          }
          /* CRITICAL: Preserve blockquote spacing */
          #contract-print-container .tiptap-rendered blockquote,
          #contract-print-container [class*="tiptap-rendered"] blockquote {
            margin: 14px 0 !important;
            padding: 0 0 0 20px !important;
            border-left: 3px solid #d1d5db !important;
            display: block !important;
            visibility: visible !important;
          }
          /* CRITICAL: Preserve pre/code spacing */
          #contract-print-container .tiptap-rendered pre,
          #contract-print-container [class*="tiptap-rendered"] pre {
            margin: 14px 0 !important;
            padding: 14px !important;
            display: block !important;
            visibility: visible !important;
          }
          /* CRITICAL: Preserve line breaks and spacing */
          #contract-print-container .tiptap-rendered br,
          #contract-print-container [class*="tiptap-rendered"] br {
            display: inline !important;
            visibility: visible !important;
          }
          /* CRITICAL: Ensure all spacing is preserved - don't reset margins/padding */
          #contract-print-container .tiptap-rendered *,
          #contract-print-container [class*="tiptap-rendered"] * {
            /* Preserve original margins and padding unless explicitly overridden above */
            box-sizing: border-box !important;
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
          <main className="container mx-auto w-full px-4 py-8">
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
          ) : !campaign ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <Card className="border-none bg-gradient-to-br from-white/95 to-slate-100 shadow-xl backdrop-blur">
                <div className="p-6 space-y-4">
                  <h2 className="text-xl font-semibold text-slate-900">No campaign selected</h2>
                  <p className="text-sm text-slate-500">
                    Choose a campaign from the campaigns list to manage collaboration details.
                  </p>
                  <Button size="sm" className="bg-primary text-white hover:bg-primary/90" onClick={() => navigate("/campaign")}>Go to Campaigns</Button>
                </div>
              </Card>
              <Card className="border-none bg-gradient-to-b from-white/95 to-slate-100 shadow-lg backdrop-blur">
                <div className="p-6 space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Timeline</h2>
                    <p className="text-sm text-slate-500">Key steps in the collaboration workflow.</p>
                  </div>
                  {timelineLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <div className="relative pl-4">
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
                  )}
                </div>
              </Card>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <Card className="border-none bg-gradient-to-br from-white/95 to-slate-100 shadow-xl backdrop-blur">
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
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleFillContract}
                              >
                                Fill Contract
                              </Button>
                              <Button
                                size="sm"
                                className="bg-primary text-white hover:bg-primary/90"
                                onClick={async () => {
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
                                  toast({
                                    title: "Contract sent",
                                    description: "Contract has been sent to the influencer.",
                                  });
                                }}
                              >
                                Send Contract
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
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-3 py-12 text-center text-sm text-slate-500">
                      No influencers assigned to this campaign yet.
                    </div>
                  )}
                </div>
              </Card>

              <Card className="border-none bg-gradient-to-b from-white/95 to-slate-100 shadow-lg backdrop-blur">
                <div className="p-6 space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Timeline</h2>
                    <p className="text-sm text-slate-500">Key steps in the collaboration workflow.</p>
                  </div>
                  {timelineLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <div className="relative pl-4">
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
                  )}
                </div>
              </Card>
            </div>
          )}
          </main>
        </div>
      </div>
    </>
  );
};

export default Collaboration;

