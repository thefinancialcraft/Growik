import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  CampaignRecord,
  CampaignInfluencerRef,
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

  const influencer: CampaignInfluencerRef | null = useMemo(() => {
    if (!campaign || !campaign.influencers.length) {
      return null;
    }
    return campaign.influencers[0];
  }, [campaign]);

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

  const handleActionSubmit = () => {
    if (!selectedAction) {
      toast({
        title: "No action selected",
        description: "Choose one of the available options before saving.",
        variant: "destructive",
      });
      return;
    }

    if (selectedAction === "callback" && !callbackTime) {
      toast({
        title: "Callback time required",
        description: "Please select a time for the callback.",
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

    if (selectedAction === "callback" && callbackTime) {
      remarkParts.push(`Callback time: ${formatCallbackTime(callbackTime)}`);
    }

    if (actionRemark.trim()) {
      remarkParts.push(actionRemark.trim());
    }

    const finalRemark = remarkParts.length ? remarkParts.join(" | ") : undefined;

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
    setActionRemark("");
  };

  return (
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
                    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-inner">
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
                              <Input
                                type="time"
                                value={callbackTime}
                                onChange={(event) => setCallbackTime(event.target.value)}
                                className="w-full"
                                aria-label="Select callback time"
                              />
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
                                disabled={!selectedAction || (selectedAction === "callback" && !callbackTime)}
                              >
                                Save Action
                              </Button>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-3">
                            <div className="flex flex-wrap gap-2">
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
  );
};

export default Collaboration;

