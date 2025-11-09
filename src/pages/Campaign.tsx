import { FormEvent, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  Upload,
  Users,
} from "lucide-react";

type CampaignStatus = "draft" | "scheduled" | "live" | "completed";

interface CampaignRecord {
  id: string;
  name: string;
  brand: string;
  objective: string;
  users: string[];
  influencers: string[];
  contract: string;
  status: CampaignStatus;
  progress: number;
  createdAt: string;
}

interface CompanyOption {
  id: string;
  name: string;
}

const STATUS_STYLES: Record<CampaignStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border border-slate-200",
  scheduled: "bg-amber-100 text-amber-700 border border-amber-200",
  live: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  completed: "bg-indigo-100 text-indigo-700 border border-indigo-200",
};

const CONTRACT_OPTIONS = [
  { label: "Standard Contract", value: "standard" },
  { label: "Premium Contract", value: "premium" },
  { label: "Custom Agreement", value: "custom" },
];

const Campaign = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [newUsersInput, setNewUsersInput] = useState("");
  const [newInfluencersInput, setNewInfluencersInput] = useState("");
  const [selectedContract, setSelectedContract] = useState(CONTRACT_OPTIONS[0].value);
  const [newDescription, setNewDescription] = useState("");
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState<boolean>(false);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [isAddCompanyDialogOpen, setIsAddCompanyDialogOpen] = useState<boolean>(false);
  const [newCompanyName, setNewCompanyName] = useState<string>("");
  const [isSavingCompany, setIsSavingCompany] = useState<boolean>(false);

  const contractLabelMap = useMemo(
    () =>
      CONTRACT_OPTIONS.reduce<Record<string, string>>((acc, item) => {
        acc[item.value] = item.label;
        return acc;
      }, {}),
    []
  );

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
          (data ?? [])
            .map((item) => ({
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

    fetchCompanies();
  }, [toast]);

  const parseList = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const resetCreateForm = () => {
    setNewCampaignName("");
    setNewBrandName("");
    setNewUsersInput("");
    setNewInfluencersInput("");
    setSelectedContract(CONTRACT_OPTIONS[0].value);
    setNewDescription("");
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

  const handleCreateCampaign = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newCampaignName.trim() || !newBrandName.trim()) {
    toast({
      title: "Missing details",
      description: "Please provide a campaign name and select a brand.",
      variant: "destructive",
    });
    return;
    }

    const users = parseList(newUsersInput);
    const influencers = parseList(newInfluencersInput);
    const nextId = `cam${(campaigns.length + 1).toString().padStart(3, "0")}`;

    const newCampaign: CampaignRecord = {
      id: nextId,
      name: newCampaignName.trim(),
      brand: newBrandName.trim(),
      objective: newDescription.trim() || "No description provided.",
      users,
      influencers,
      contract: selectedContract,
      status: "draft",
      progress: 0,
      createdAt: new Date().toISOString(),
    };

    setCampaigns((prev) => [...prev, newCampaign]);
    resetCreateForm();
    setIsCreateDialogOpen(false);
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
        contractLabelMap[campaign.contract]?.toLowerCase().includes(query)
      ) {
        return true;
      }
      return (
        campaign.users.some((user) => user.toLowerCase().includes(query)) ||
        campaign.influencers.some((influencer) => influencer.toLowerCase().includes(query))
      );
    });
  }, [campaigns, contractLabelMap, searchTerm]);

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

  const nextCampaignPreview = useMemo(
    () => `CAM${(campaigns.length + 1).toString().padStart(3, "0")}`,
    [campaigns.length]
  );

  const sortedCompanies = useMemo(
    () => [...companies].sort((a, b) => a.name.localeCompare(b.name)),
    [companies]
  );

  const handleAddCompanySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newCompanyName.trim()) {
      toast({
        title: "Company name required",
        description: "Please enter a company name.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingCompany(true);
    try {
    const { data, error } = await supabase
        .from("companies")
      .insert({ name: newCompanyName.trim() } as any)
        .select("id, name")
        .single();

      if (error) {
        throw error;
      }

      if (data) {
      const createdCompany: CompanyOption = {
        id: (data as any).id as string,
        name: ((data as any).name as string) ?? newCompanyName.trim(),
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
      setNewCompanyName("");
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
                {filteredCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="group rounded-2xl border border-border/50 bg-background/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-300 p-5 flex flex-col gap-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="rounded-full border-primary/40 bg-primary/5 text-xs">
                            {campaign.brand}
                          </Badge>
                          <Badge className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[campaign.status]}`}>
                            {campaign.status}
                          </Badge>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-foreground">{campaign.name}</h3>
                        <p className="text-sm text-muted-foreground">{campaign.objective}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase text-muted-foreground">Campaign ID</p>
                        <p className="text-sm font-semibold text-foreground">{campaign.id}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <p className="text-xs uppercase text-muted-foreground">Users Assigned</p>
                        {campaign.users.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {campaign.users.map((user) => (
                              <span
                                key={`${campaign.id}-user-${user}`}
                                className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                              >
                                {user}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm font-medium text-muted-foreground">No users added</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs uppercase text-muted-foreground">Influencers</p>
                        {campaign.influencers.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {campaign.influencers.map((influencer) => (
                              <span
                                key={`${campaign.id}-influencer-${influencer}`}
                                className="inline-flex items-center rounded-full bg-emerald-100/70 px-2.5 py-1 text-xs font-medium text-emerald-700"
                              >
                                {influencer}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm font-medium text-muted-foreground">No influencers assigned</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs uppercase text-muted-foreground">Contract</p>
                        <p className="text-sm font-semibold text-foreground">
                          {contractLabelMap[campaign.contract] ?? "Not selected"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs uppercase text-muted-foreground">Created</p>
                        <p className="text-sm font-semibold text-foreground">
                          {new Date(campaign.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
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

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        {campaign.status === "completed"
                          ? "Report ready for download"
                          : campaign.status === "live"
                          ? "Content approvals on-track"
                          : "Draft insights auto-saved"}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-9 px-3">
                          View Brief
                        </Button>
                        <Button size="sm" className="h-9 px-3 bg-primary text-white">
                          Manage
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

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
            <div className="space-y-2">
              <Label htmlFor="users">Add Users</Label>
              <Textarea
                id="users"
                value={newUsersInput}
                onChange={(event) => setNewUsersInput(event.target.value)}
                placeholder="Enter user names or emails separated by commas"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">Example: Raj, Priya Sharma, anita@growik.com</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="influencers">Add Influencers</Label>
              <Textarea
                id="influencers"
                value={newInfluencersInput}
                onChange={(event) => setNewInfluencersInput(event.target.value)}
                placeholder="List influencer handles separated by commas"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">Example: @travelwitharya, @foodie_june, @stylebykia</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractSelect">Contract</Label>
              <Select value={selectedContract} onValueChange={setSelectedContract}>
                <SelectTrigger id="contractSelect">
                  <SelectValue placeholder="Select a contract template" />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Button type="submit">Create Campaign</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isAddCompanyDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddCompanyDialogOpen(false);
            setNewCompanyName("");
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
            <div className="space-y-2">
              <Label htmlFor="newCompanyName">Company Name *</Label>
              <Input
                id="newCompanyName"
                value={newCompanyName}
                onChange={(event) => setNewCompanyName(event.target.value)}
                placeholder="Enter company name"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddCompanyDialogOpen(false);
                  setNewCompanyName("");
                }}
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
    </div>
  );
};

export default Campaign;

