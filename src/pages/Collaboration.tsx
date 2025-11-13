import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Loader2 } from "lucide-react";

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
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [contractPreviewHtml, setContractPreviewHtml] = useState<string>("");
  const [isGeneratingPreview, setIsGeneratingPreview] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const isUuid = (value: string | undefined | null): value is string =>
    Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));

  const resolvedCampaignId = useMemo(() => {
    if (isUuid(campaign?.id)) {
      return campaign!.id;
    }
    if (isUuid(id ?? null)) {
      return id as string;
    }
    return null;
  }, [campaign?.id, id]);

  const campaignKey = useMemo(() => {
    return campaign?.id ?? id ?? null;
  }, [campaign?.id, id]);

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
            "id, name, brand, objective, users, influencers, contract_id, contract_name, contract_description, contract_status, contract_snapshot, start_date, end_date, is_long_term, status, progress, created_at"
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

  const collaborationKey = useMemo(() => {
    if (!campaignKey) {
      return null;
    }
    return `${campaignKey}:${influencer?.id ?? "none"}`;
  }, [campaignKey, influencer?.id]);

  const collaborationId = useMemo(() => {
    if (!collaborationKey) {
      return null;
    }
    if (isUuid(collaborationKey)) {
      return collaborationKey;
    }
    return toDeterministicUuid(collaborationKey);
  }, [collaborationKey]);

  const contractMeta: CampaignContractRef | null = useMemo(() => {
    if (!campaign?.contract || typeof campaign.contract !== "object") {
      return null;
    }

    const candidate = campaign.contract as Partial<CampaignContractRef>;
    return candidate.id ? (candidate as CampaignContractRef) : null;
  }, [campaign]);

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
          setContractVariableEntries(DEFAULT_CONTRACT_VARIABLE_HINTS.map((entry) => ({ ...entry })));
          return;
        }

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
              .select("variable_key,value");

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
            overrideData.forEach((row: any) => {
              if (row?.variable_key && typeof row.value === "string") {
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

  const handleViewContract = () => {
    if (!contractMeta?.id) {
      toast({
        title: "No contract available",
        description: "Fill or link a contract before trying to view it.",
        variant: "destructive",
      });
      return;
    }

    navigate(`/contract/editor?id=${contractMeta.id}`, {
      state: {
        campaignId: campaign?.id,
        campaignName: campaign?.name,
        mode: "view",
        readOnly: true,
      },
    });
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
    let label: string;

    switch (selectedAction) {
      case "interested":
        label = "Influencer interested";
        break;
      case "not_interested":
        label = "Influencer not interested";
        break;
      case "callback":
        label = "Callback scheduled";
        break;
      case "done":
        label = "Collaboration marked done";
        break;
      default:
        label = "Action recorded";
    }

    const remarkParts: string[] = [];

    if (selectedAction === "callback" && callbackDate && callbackTime) {
      remarkParts.push(
        `Callback scheduled for ${formatCallbackDate(callbackDate)} at ${formatCallbackTime(callbackTime)}`
      );
    }

    if (actionRemark.trim()) {
      remarkParts.push(actionRemark.trim());
    }

    const finalRemark = remarkParts.length ? remarkParts.join(" | ") : undefined;

    if (!campaignKey || !influencer?.id) {
      toast({
        title: "Missing data",
        description: "Campaign or influencer context is missing. Reload and try again.",
        variant: "destructive",
      });
      return;
    }

    const collabId = toDeterministicUuid(`${campaignKey}:${influencer.id}`);

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

      const baseData = {
        campaign_id: resolvedCampaignId ?? null,
        influencer_id: resolvedInfluencerId,
        user_id: effectiveUserId,
        action: selectedAction,
        remark: finalRemark ?? null,
        occurred_at: new Date().toISOString(),
        collaboration_id: collabId,
      };

      const client = supabase as any;
      const { error: upsertError } = await client
        .from("collaboration_actions")
        .upsert(baseData, {
          onConflict: "collaboration_id",
        });
      if (upsertError) {
        console.error("Collaboration: Failed to upsert action", upsertError);
        throw upsertError;
      }

      setLastAction({
        label,
        timestamp,
        remark: finalRemark,
      });

      toast({
        title: "Action saved",
        description: label,
      });

      setSelectedAction("");
      setCallbackTime("");
      setCallbackDate("");
      setActionRemark("");
    } catch (error: any) {
      console.error("Collaboration: Error while saving action", error);
      toast({
        title: "Unable to save action",
        description: error?.message ?? "An unexpected error occurred while saving the action.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateContractPreview = () => {
    if (!contractContent) {
      toast({
        title: "No contract content",
        description: "This contract does not have any content to preview.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPreview(true);
    try {
      let previewHtml = contractContent;
      const overrideRecords: Array<{
        campaign_id: string | null;
        influencer_id: string | null;
        variable_key: string;
        value: string | null;
        collaboration_id: string;
      }> = [];

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

        if (collaborationId) {
          const storedValue = entry.editable
            ? entry.inputValue?.trim() ?? null
            : entry.rawValues && entry.rawValues.length
            ? entry.rawValues.join("\n")
            : entry.value ?? null;
          overrideRecords.push({
            campaign_id: resolvedCampaignId ?? null,
            influencer_id: resolvedInfluencerId,
            variable_key: entry.key,
            value: storedValue && storedValue.length ? storedValue : null,
            collaboration_id: collaborationId,
          });
        }
      });

      previewHtml = previewHtml.replace(/var\[\s*\{\{[^}]+\}\}\s*\]/g, "--");

      setContractPreviewHtml(previewHtml);
      setIsPreviewOpen(true);

      if (overrideRecords.length) {
        const persistOverrides = async () => {
          try {
            const client = supabase as any;
            const { error } = await client
              .from(VARIABLE_OVERRIDE_TABLE)
              .upsert(overrideRecords, { onConflict: "campaign_id,influencer_id,variable_key" });

            if (error) {
              console.error("Collaboration: Failed to upsert variable overrides", error);
            }
          } catch (overrideErr) {
            console.error("Collaboration: Exception while saving overrides", overrideErr);
          }
        };

        void persistOverrides();
      }
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
            <ScrollArea className="contract-preview-container max-h-[70vh] rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-inner">
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
                  <div className="relative pl-4">
                    <span className="absolute left-0 top-2 bottom-2 w-px bg-slate-200" />
                    <div className="space-y-5">
                      {TIMELINE_ITEMS.map((item) => (
                        <div key={item.id} className="relative rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                          <span className="absolute -left-[9px] top-4 h-4 w-4 rounded-full border border-white bg-primary shadow" />
                          <div className="ml-2 space-y-1">
                            <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                            <p className="text-xs text-slate-500 leading-snug">{item.description}</p>
                            <p className="text-xs text-slate-400">{item.timestamp}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
                              <p className="text-sm text-slate-500">Influencer ID: {influencer.pid ?? influencer.id}</p>
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
                                onClick={() =>
                                  setLastAction({
                                    label: "Contract sent",
                                    timestamp: new Date().toLocaleString(),
                                  })
                                }
                              >
                                Send Contract
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleViewContract}
                                disabled={!contractMeta?.id}
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
                  <div className="relative pl-4">
                    <span className="absolute left-0 top-2 bottom-2 w-px bg-slate-200" />
                    <div className="space-y-5">
                      {TIMELINE_ITEMS.map((item) => (
                        <div key={item.id} className="relative rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                          <span className="absolute -left-[9px] top-4 h-4 w-4 rounded-full border border-white bg-primary shadow" />
                          <div className="ml-2 space-y-1">
                            <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                            <p className="text-xs text-slate-500 leading-snug">{item.description}</p>
                            <p className="text-xs text-slate-400">{item.timestamp}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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

