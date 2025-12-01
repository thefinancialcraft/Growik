import { useEffect, useMemo, useState } from "react";
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
    className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-700 shadow-sm"
  >
    <div className="font-medium leading-tight text-slate-900">{user.name}</div>
    <div className="text-xs text-slate-500 break-all">{user.email}</div>
    {user.employeeId && (
      <div className="mt-1 inline-flex items-center rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
        Employee ID: {user.employeeId}
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
      className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-700 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium leading-tight text-slate-900">{influencer.name}</span>
          {influencer.pid && (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              ID: {influencer.pid}
            </span>
          )}
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusMeta.className}`}
        >
          {statusMeta.label}
        </span>
      </div>
      <div className="mt-1 text-xs text-slate-500 break-all">
        {influencer.email ?? "Email not available"}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {platforms.length > 0 ? (
          platforms.map((platform) => {
            const meta = getPlatformMeta(platform);
            return meta.icon ? (
              <img
                key={`${influencer.id}-${platform}`}
                src={meta.icon}
                alt={meta.label}
                title={meta.label}
                className="h-5 w-5 rounded-full border border-border/50 bg-white p-[2px]"
              />
            ) : (
              <span
                key={`${influencer.id}-${platform}`}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-muted text-muted-foreground text-[10px]"
                title={meta.label}
              >
                {meta.label.charAt(0)}
              </span>
            );
          })
        ) : (
          <span className="text-[11px] text-slate-500">No platforms listed</span>
        )}
      </div>
      {influencer.country && (
        <div className="mt-2 inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
          Country: {influencer.country}
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
    <TableCell className="font-medium text-slate-900">{user.name}</TableCell>
    <TableCell className="text-slate-600 break-all">{user.email}</TableCell>
    <TableCell className="text-slate-600">
      {user.employeeId ? (
        <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
          {user.employeeId}
        </span>
      ) : (
        <span className="text-xs text-slate-400">Not assigned</span>
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
      <TableCell className="font-medium text-slate-900">{influencer.name}</TableCell>
      <TableCell className="text-slate-600">
        {influencer.email ?? <span className="text-xs text-slate-400">Not provided</span>}
      </TableCell>
      <TableCell className="text-slate-600">
        <div className="flex items-center gap-2">
          {platforms.length > 0 ? (
            platforms.map((platform) => {
              const meta = getPlatformMeta(platform);
              return meta.icon ? (
                <img
                  key={`${influencer.id}-${platform}`}
                  src={meta.icon}
                  alt={meta.label}
                  title={meta.label}
                  className="h-5 w-5 rounded-full border border-slate-200 bg-white p-[2px]"
                />
              ) : (
                <span
                  key={`${influencer.id}-${platform}`}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[11px] text-slate-600"
                  title={meta.label}
                >
                  {meta.label.charAt(0)}
                </span>
              );
            })
          ) : (
            <span className="text-xs text-slate-400">No platforms</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-slate-600">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusMeta.className}`}
        >
          {statusMeta.label}
        </span>
      </TableCell>
      <TableCell className="text-slate-600">
        {influencer.country ?? <span className="text-xs text-slate-400">N/A</span>}
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
      if (!campaign?.id) return;

      setLoadingStats(true);
      try {
        // Extract campaign key from campaign ID
        const campaignKey = campaign.id;
        
        // Fetch all collaboration actions for this campaign
        const { data, error: statsError } = await supabase
          .from("collaboration_actions")
          .select("is_signed, collaboration_id")
          .eq("campaign_id", campaignKey);

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
  }, [campaign?.id]);

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

  const [collaboratorTab, setCollaboratorTab] = useState<"users" | "influencers">("influencers");
  const [collaboratorDisplay, setCollaboratorDisplay] = useState<"tile" | "list">("tile");
  const [collaboratorSearch, setCollaboratorSearch] = useState("");

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
  const activeCollaborators = isUserTab ? filteredUsers : filteredInfluencers;

  return (
    <div className="flex min-h-screen bg-gradient-subtle">
      <Sidebar />
      <MobileNav />

      <div className="flex-1 lg:ml-56">
        <Header />
        <main className="container mx-auto w-full px-3 sm:px-6 lg:px-8 py-4 pb-24 lg:pb-12 max-w-none space-y-6">
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              className="flex items-center gap-2 text-sm text-foreground hover:text-primary"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            {campaign && (
              <Badge className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[campaign.status]}`}>
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
              <div className="relative overflow-hidden rounded-3xl bg-primary text-white shadow-lg">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_55%)]" />
                <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
                <div className="relative p-6 sm:p-8 space-y-8">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full border border-white/40 bg-white/20 px-3 py-1 text-xs font-semibold text-white/90">
                          {campaign.brand}
                        </Badge>
                        <Badge className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold text-white/90 capitalize">
                          {campaign.status}
                        </Badge>
                        <span className="text-xs text-white/70">#{campaign.id}</span>
                      </div>
                      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-white">
                        {campaign.name}
                      </h1>
                      <p className="text-sm sm:text-base text-white/80 max-w-2xl">
                        {campaign.objective || "No objective provided for this campaign."}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-white/75">
                        <span>Created {new Date(campaign.createdAt).toLocaleDateString()}</span>
                        <span className="h-1 w-1 rounded-full bg-white/50" />
                        <span>
                          {campaign.isLongTerm
                            ? "Long-term engagement"
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
                    <div className="flex flex-col gap-3 rounded-2xl border border-white/30 bg-white/10 p-5 backdrop-blur-lg text-sm text-white/90 max-w-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Total collaborators</span>
                        <span>{totalCollaborators}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Contract</span>
                        <span>{campaign.contract?.name ?? "Not linked"}</span>
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
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {heroStats.map(({ id, title, value, subtext, icon: Icon, iconBg }) => (
                      <div
                        key={id}
                        className="rounded-2xl border border-white/20 bg-white/10 p-4 text-white/90 backdrop-blur"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5">
                            <p className="text-[11px] uppercase tracking-wide text-white/70">
                              {title}
                            </p>
                            <p className="text-lg font-semibold text-white leading-tight">{value}</p>
                            {subtext && (
                              <p className="text-xs text-white/70 leading-snug">{subtext}</p>
                            )}
                          </div>
                          <span
                            className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${iconBg}`}
                          >
                            <Icon className="h-5 w-5 text-white" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr),1fr] gap-4 lg:gap-6">
                <Card className="border-none bg-white/95 backdrop-blur">
                  <div className="p-5 sm:p-6 space-y-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">Campaign Overview</h2>
                        <p className="text-sm text-slate-500">
                          Timeline checkpoints, objective summary, and legal snapshot.
                        </p>
                      </div>
                      <Badge className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                        #{campaign.id}
                      </Badge>
                    </div>
                    <Separator className="bg-slate-200" />
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <CalendarRange className="h-4 w-4 text-indigo-500" />
                          Timeline
                        </div>
                        <div className="flex-1">
                          {campaign.isLongTerm ? (
                            <div className="space-y-1 text-sm text-slate-600">
                              <p className="font-semibold text-slate-900 leading-tight">
                                Long-term engagement
                              </p>
                              <p className="text-xs text-slate-500">
                                {startDisplay ? `Started on ${startDisplay}` : "Start date not set"}
                              </p>
                              <p className="text-[11px] text-slate-500/80">
                                Running without a scheduled end date.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1 text-sm text-slate-600">
                              <p className="font-semibold text-slate-900 leading-tight">
                                {startDisplay ?? "Start date not set"}
                              </p>
                              <p className="text-xs text-slate-500">
                                {endDisplay ? `Ends ${endDisplay}` : "End date not set"}
                              </p>
                              <p className="text-[11px] text-slate-500/80">
                                Scheduled activation window for this campaign.
                              </p>
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          className="mt-auto w-full justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-purple-500 text-white shadow-sm hover:opacity-90"
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
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <FileText className="h-4 w-4 text-indigo-500" />
                          Contract & Objective
                        </div>
                        <div className="space-y-1 text-sm text-slate-600">
                          <p className="font-semibold text-slate-900 leading-tight">
                            {campaign.contract?.name ?? "No contract linked"}
                          </p>
                          {campaign.contract?.pid && (
                            <p className="text-xs text-slate-500">
                              Contract PID: {campaign.contract?.pid}
                            </p>
                          )}
                          <p className="text-xs text-slate-500 leading-snug">
                            {campaign.contract?.description ??
                              "Attach a contract to keep legal expectations aligned with this campaign."}
                          </p>
                          {campaign.contract?.status && (
                            <span className="inline-flex w-fit rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-[11px] font-medium text-indigo-700 capitalize">
                              {campaign.contract.status}
                            </span>
                          )}
                        </div>
                        <div className="rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-sm text-slate-600 shadow-sm">
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">
                            Objective
                          </p>
                          <p className="mt-1 text-sm text-slate-700 leading-snug">
                            {campaign.objective || "No objective provided for this campaign."}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          className="justify-start gap-2 rounded-xl border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-600"
                          onClick={() => navigate("/contract")}
                        >
                          <FileText className="h-4 w-4" />
                          Open contract workspace
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 text-sm text-emerald-700">
                      <div className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Status insight
                      </div>
                      <p>
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
                  <div className="p-5 sm:p-6 space-y-5">
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold text-slate-900">Collaboration Statistics</h2>
                      <p className="text-sm text-slate-500">
                        Overview of collaboration status for this campaign.
                      </p>
                    </div>
                    {loadingStats ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Total Collaborations */}
                        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-600">Total Collaborations</p>
                            <Users className="h-5 w-5 text-slate-400" />
                          </div>
                          <p className="text-3xl font-bold text-slate-900">{collabStats.total}</p>
                          <p className="text-xs text-slate-500">All collaborations</p>
                        </div>

                        {/* Signed Collaborations */}
                        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-emerald-700">Signed</p>
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          </div>
                          <p className="text-3xl font-bold text-emerald-700">{collabStats.signed}</p>
                          <p className="text-xs text-emerald-600">Contracts signed</p>
                        </div>

                        {/* Pending Collaborations */}
                        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-amber-700">Pending</p>
                            <Clock className="h-5 w-5 text-amber-500" />
                          </div>
                          <p className="text-3xl font-bold text-amber-700">{collabStats.pending}</p>
                          <p className="text-xs text-amber-600">Awaiting signature</p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              <Card className="border-none bg-white/95 backdrop-blur">
                <div className="p-5 sm:p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Collaborator Directory</h2>
                      <p className="text-sm text-slate-500">
                        Toggle between workspace users and influencer partners.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-1">
                      <Button
                        type="button"
                        variant={isUserTab ? "default" : "ghost"}
                        className="h-9 px-4 text-sm"
                        onClick={() => setCollaboratorTab("users")}
                      >
                        Users ({filteredUsers.length})
                      </Button>
                      <Button
                        type="button"
                        variant={!isUserTab ? "default" : "ghost"}
                        className="h-9 px-4 text-sm"
                        onClick={() => setCollaboratorTab("influencers")}
                      >
                        Influencers ({filteredInfluencers.length})
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative w-full md:max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={collaboratorSearch}
                        onChange={(event) => setCollaboratorSearch(event.target.value)}
                        placeholder={`Search ${isUserTab ? "users" : "influencers"}...`}
                        className="pl-9 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                        <Button
                          type="button"
                          variant={collaboratorDisplay === "tile" ? "default" : "ghost"}
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => setCollaboratorDisplay("tile")}
                          title="Tile view"
                        >
                          <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant={collaboratorDisplay === "list" ? "default" : "ghost"}
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => setCollaboratorDisplay("list")}
                          title="List view"
                        >
                          <List className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button type="button" variant="outline" className="h-9 gap-2">
                        <Filter className="h-4 w-4" />
                        Filters
                      </Button>
                    </div>
                  </div>

                  {collaboratorDisplay === "tile" ? (
                    activeCollaborators.length ? (
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                        <Table>
                          <TableHeader className="bg-slate-50/80">
                            <TableRow>
                              <TableHead className="text-slate-500">
                                {isUserTab ? "User" : "Influencer"}
                              </TableHead>
                              <TableHead className="text-slate-500">Email</TableHead>
                              {isUserTab ? (
                                <TableHead className="text-slate-500">Employee ID</TableHead>
                              ) : (
                                <>
                                  <TableHead className="text-slate-500">Platforms</TableHead>
                                  <TableHead className="text-slate-500">Status</TableHead>
                                  <TableHead className="text-slate-500">Country</TableHead>
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
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-12 text-center text-sm text-slate-500">
                      No {isUserTab ? "users" : "influencers"} match your search.
                    </div>
                  )}
                </div>
              </Card>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default CampaignDetail;

