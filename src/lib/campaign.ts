export type CampaignStatus = "draft" | "scheduled" | "live" | "completed" | "inactive";

export interface CampaignUserRef {
  id: string;
  name: string;
  email: string;
  employeeId?: string | null;
}

export type SocialHandle = {
  platform: string;
  url: string;
};

export interface CampaignInfluencerRef {
  id: string;
  pid: string | null;
  name: string;
  email: string | null;
  handles: SocialHandle[];
  country?: string | null;
  status?: string | null;
}

export interface CampaignContractRef {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  variables?: Record<string, string> | null;
}

export interface CampaignRecord {
  id: string;
  name: string;
  brand: string;
  objective: string;
  users: CampaignUserRef[];
  influencers: CampaignInfluencerRef[];
  contract?: CampaignContractRef | null;
  startDate: string | null;
  endDate: string | null;
  isLongTerm: boolean;
  status: CampaignStatus;
  progress: number;
  createdAt: string;
}

export interface CompanyOption {
  id: string;
  name: string;
}

export interface UserOption extends CampaignUserRef {
  status?: string | null;
  role?: string | null;
  approvalStatus?: string | null;
}

export interface InfluencerOption extends CampaignInfluencerRef {
  status?: string | null;
}

export interface ContractOption extends CampaignContractRef {}

export const SOCIAL_PLATFORM_OPTIONS: Array<{ value: string; label: string; icon: string }> = [
  { value: "instagram", label: "Instagram", icon: "https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" },
  { value: "facebook", label: "Facebook", icon: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Facebook_icon.svg" },
  { value: "youtube", label: "YouTube", icon: "https://upload.wikimedia.org/wikipedia/commons/b/b8/YouTube_Logo_2017.svg" },
  { value: "twitter", label: "Twitter (X)", icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/X_%28formerly_Twitter%29_logo_late_2025.svg/120px-X_%28formerly_Twitter%29_logo_late_2025.svg.png" },
  { value: "snapchat", label: "Snapchat", icon: "https://upload.wikimedia.org/wikipedia/en/thumb/c/c4/Snapchat_logo.svg/120px-Snapchat_logo.svg.png" },
  { value: "linkedin", label: "LinkedIn", icon: "https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png" },
  { value: "pinterest", label: "Pinterest", icon: "https://upload.wikimedia.org/wikipedia/commons/0/08/Pinterest-logo.png" },
  { value: "threads", label: "Threads", icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Threads_%28app%29.svg/250px-Threads_%28app%29.svg.png" },
  { value: "tiktok", label: "TikTok", icon: "https://www.edigitalagency.com.au/wp-content/uploads/TikTok-icon-glyph.png" },
  { value: "moj", label: "Moj", icon: "https://yt3.googleusercontent.com/cf4RTYDMH_vrpiBoOxmuQ0z9KNRQKp58UtpdbaYTUKZV7SoX_QvjkjzH3pxiPs-ylcpYI-cPmdk=s900-c-k-c0x00ffffff-no-rj" },
  { value: "twitch", label: "Twitch", icon: "https://img.freepik.com/premium-vector/vector-twitch-social-media-logo_1093524-449.jpg?semt=ais_hybrid&w=740&q=80" },
  { value: "other", label: "Other", icon: "" },
];

export const getPlatformMeta = (value: string) =>
  SOCIAL_PLATFORM_OPTIONS.find((option) => option.value.toLowerCase() === value.toLowerCase()) ?? {
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1),
    icon: "",
  };

export const parseHandles = (raw: any, fallbackPlatform?: string): SocialHandle[] => {
  const sanitize = (handle: any): SocialHandle | null => {
    if (!handle) return null;
    if (typeof handle === "string") {
      const trimmed = handle.trim();
      return trimmed ? { platform: fallbackPlatform ?? "other", url: trimmed } : null;
    }
    if (typeof handle === "object") {
      const platform =
        typeof handle.platform === "string" && handle.platform.trim()
          ? handle.platform.trim()
          : fallbackPlatform ?? "other";
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
        return parsed.map(sanitize).filter((item): item is SocialHandle => Boolean(item));
      }
      const single = sanitize(raw);
      return single ? [single] : [];
    } catch {
      const single = sanitize(raw);
      return single ? [single] : [];
    }
  }

  if (Array.isArray(raw)) {
    return raw.map(sanitize).filter((item): item is SocialHandle => Boolean(item));
  }

  const single = sanitize(raw);
  return single ? [single] : [];
};

export const extractCampaignNumber = (code: string): number => {
  const match = `${code}`.match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : -1;
};

const parseContractSnapshot = (row: any): CampaignContractRef | null => {
  const snapshot = row.contract_snapshot;

  const normalize = (source: any): CampaignContractRef | null => {
    if (!source || typeof source !== "object") {
      return null;
    }

    const id = source.id ?? row.contract_id ?? null;
    const name = source.name ?? source.contract_name ?? row.contract_name ?? null;

    if (!id || !name) {
      return null;
    }

    return {
      id,
      name,
      description: source.description ?? source.contract_description ?? row.contract_description ?? null,
      status: source.status ?? source.contract_status ?? row.contract_status ?? null,
      variables: source.variables ?? row.contract_variables ?? null,
    };
  };

  if (snapshot) {
    if (typeof snapshot === "string") {
      try {
        const parsed = JSON.parse(snapshot);
        const normalized = normalize(parsed);
        if (normalized) {
          return normalized;
        }
      } catch {
        // ignore parse errors and fall back to direct mapping
      }
    } else {
      const normalized = normalize(snapshot);
      if (normalized) {
        return normalized;
      }
    }
  }

  if (row.contract_id && row.contract_name) {
    return normalize({
      id: row.contract_id,
      name: row.contract_name,
      description: row.contract_description,
      status: row.contract_status,
      variables: row.contract_variables,
    });
  }

  return null;
};

export const mapCampaignRow = (row: any): CampaignRecord => ({
  id: row.id,
  name: row.name ?? "",
  brand: row.brand ?? "",
  objective: row.objective ?? "",
  users: Array.isArray(row.users) ? row.users : [],
  influencers: Array.isArray(row.influencers) ? row.influencers : [],
  contract: parseContractSnapshot(row),
  startDate: (row.start_date as string | null) ?? null,
  endDate: (row.end_date as string | null) ?? null,
  isLongTerm: Boolean(row.is_long_term),
  status: row.status ?? "draft",
  progress: typeof row.progress === "number" ? row.progress : 0,
  createdAt: row.created_at ?? new Date().toISOString(),
});

export const STATUS_STYLES: Record<CampaignStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border border-slate-200",
  scheduled: "bg-amber-100 text-amber-700 border border-amber-200",
  live: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  completed: "bg-indigo-100 text-indigo-700 border border-indigo-200",
  inactive: "bg-rose-100 text-rose-700 border border-rose-200",
};

