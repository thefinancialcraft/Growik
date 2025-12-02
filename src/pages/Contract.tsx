import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SearchBar from "@/components/SearchBar";
import { useToast } from "@/hooks/use-toast";
import { Edit, Trash2, Eye, MoreVertical, RefreshCw, FileText, FolderOpen, PenSquare } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface UserProfile {
  id: string;
  user_name: string;
  email: string;
  contact_no?: string;
  role: 'user' | 'admin' | 'super_admin';
  approval_status: 'pending' | 'approved' | 'rejected';
  status: 'active' | 'hold' | 'suspend';
  employee_id?: string;
  super_admin?: boolean;
  hold_end_time?: string;
  created_at: string;
  updated_at: string;
}

interface Contract {
  id: string;
  pid?: string | null;
  contract_name: string;
  description?: string;
  content?: string;
  status: 'active' | 'inactive' | 'draft';
  created_by: string;
  assigned_to?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  variables?: Record<string, string>;
  creator_name?: string;
  creator_employee_id?: string;
  updater_name?: string;
  updater_employee_id?: string;
}

const TIPTAP_STORAGE_STYLE = `
:root {
  --font-base: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --color-base: #111827;
  --color-muted: #4b5563;
}

.tiptap-rendered {
  font-family: var(--font-base);
  font-size: 11pt;
  line-height: 1.7;
  color: var(--color-base);
  word-break: break-word;
}

.tiptap-rendered p {
  margin: 0 0 12px;
}

.tiptap-rendered h1,
.tiptap-rendered h2,
.tiptap-rendered h3,
.tiptap-rendered h4,
.tiptap-rendered h5,
.tiptap-rendered h6 {
  margin: 24px 0 12px;
  font-weight: 600;
  line-height: 1.25;
}

.tiptap-rendered h1 { font-size: 26px; }
.tiptap-rendered h2 { font-size: 22px; }
.tiptap-rendered h3 { font-size: 19px; }
.tiptap-rendered h4 { font-size: 16px; }
.tiptap-rendered h5 { font-size: 14px; }
.tiptap-rendered h6 { font-size: 12px; }

.tiptap-rendered ul,
.tiptap-rendered ol {
  margin: 0 0 12px 24px;
  padding: 0;
}

.tiptap-rendered li {
  margin: 0 0 8px;
}

.tiptap-rendered blockquote {
  margin: 12px 0;
  padding: 10px 16px;
  border-left: 4px solid #d1d5db;
  background-color: #f9fafb;
  color: var(--color-muted);
}

.tiptap-rendered table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 10pt;
}

.tiptap-rendered table th,
.tiptap-rendered table td {
  border: 1px solid #d1d5db;
  padding: 8px;
  text-align: left;
  vertical-align: top;
}

.tiptap-rendered table thead th {
  background-color: #f3f4f6;
}

.tiptap-rendered pre {
  background-color: #1f2937;
  color: #f9fafb;
  padding: 12px;
  border-radius: 6px;
  margin: 12px 0;
  font-size: 10pt;
  white-space: pre-wrap;
}

.tiptap-rendered code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 10pt;
}

.tiptap-rendered a {
  color: #2563eb;
  text-decoration: underline;
}

.tiptap-rendered hr {
  border: 0;
  border-top: 1px solid #d1d5db;
  margin: 24px 0;
}

.tiptap-rendered .tiptap-image-wrapper {
  display: block;
  margin: 18px 0;
}

.tiptap-rendered .tiptap-image-wrapper[data-alignment="right"] {
  text-align: right;
}

.tiptap-rendered .tiptap-image-wrapper[data-alignment="center"] {
  text-align: center;
}

.tiptap-rendered .tiptap-image-wrapper[data-alignment="left"] {
  text-align: left;
}

.tiptap-rendered .tiptap-image-wrapper img {
  display: inline-block;
  max-width: 100%;
  height: auto;
  margin: 0;
}

.tiptap-rendered img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 18px 0;
}
`;

const Contract = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [displayName, setDisplayName] = useState<string>("User");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeContracts, setActiveContracts] = useState<number>(0);
  const [inactiveContracts, setInactiveContracts] = useState<number>(0);
  const [draftContracts, setDraftContracts] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);
  const [assignedCampaignContractIds, setAssignedCampaignContractIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/");
      return;
    }

    // Update last_seen timestamp for current user (only when tab is visible and user is active)
    let activityTimeout: NodeJS.Timeout | null = null;
    let isActive = true; // Track if user is active (has interacted in last 1 minute)

    const updateLastSeen = async () => {
      // Only update if tab is visible AND user is active
      if (document.visibilityState === 'hidden' || !isActive) {
        return;
      }

      if (!user?.id) return;
      try {
        await supabase
          .from('user_profiles')
          // @ts-ignore - last_seen column may not be in types
          .update({ last_seen: new Date().toISOString() })
          .eq('user_id', user.id);
      } catch (error) {
        console.error('Contract: Error updating last_seen:', error);
      }
    };

    // Reset activity flag and update timestamp
    const resetActivity = () => {
      isActive = true;
      if (document.visibilityState === 'visible') {
        updateLastSeen();
      }
      
      // Clear existing timeout
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      
      // Set new timeout - mark as inactive after 1 minute
      activityTimeout = setTimeout(() => {
        isActive = false;
        console.log('Contract: User inactive for 1 minute, stopping last_seen updates');
      }, 1 * 60 * 1000); // 1 minute
    };

    // Track mouse movements
    const handleMouseMove = () => {
      resetActivity();
    };

    // Track keyboard activity
    const handleKeyPress = () => {
      resetActivity();
    };

    // Track clicks
    const handleClick = () => {
      resetActivity();
    };

    // Track scroll
    const handleScroll = () => {
      resetActivity();
    };

    // Initial activity reset
    resetActivity();

    // Update every 30 seconds (only when tab is visible and user is active)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && isActive) {
        updateLastSeen();
      }
    }, 30000);

    // Listen for visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Reset activity when tab becomes visible
        resetActivity();
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeyPress);
    document.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll);

    const fetchProfile = async () => {
      if (!user?.id) return;

      // Prefer auth metadata full_name if available
      const metaName = (user as any)?.user_metadata?.full_name as string | undefined;
      if (metaName && metaName.trim()) {
        setDisplayName(metaName.trim());
      }

      // Try cached sidebar profile first
      const cache = localStorage.getItem(`profile_sidebar_${user.id}`);
      if (cache) {
        try {
          const parsed = JSON.parse(cache);
          if (parsed?.user_name) setDisplayName(parsed.user_name);
        } catch {}
      }

      try {
        console.log('Contract: Fetching profile for user:', user.id);
        const { data, error } = await supabase
          .from('user_profiles')
          .select('user_name, email, role, super_admin, approval_status, status, employee_id, updated_at, hold_end_time')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Contract: Error fetching profile:', error);
          // If error indicates user not found or account deleted, redirect to login
          if (error.code === 'PGRST116' || error.message?.toLowerCase().includes('not found') || error.message?.toLowerCase().includes('does not exist')) {
            console.log('Contract: User profile not found (error), redirecting to login');
            // Sign out the user
            try {
              await signOut();
            } catch (signOutError) {
              console.error('Contract: Error signing out:', signOutError);
            }
            // Clear all caches
            try {
              localStorage.removeItem(`profile_sidebar_${user.id}`);
              localStorage.removeItem(`profile_${user.id}`);
              localStorage.removeItem('currentUserRole');
              localStorage.removeItem('isSuperAdmin');
              localStorage.removeItem('isAuthenticated');
            } catch (e) {
              console.error('Error clearing cache:', e);
            }
            // Redirect to login with error message
            window.location.href = '/login?error=account_deleted';
            return;
          }
          return;
        }

        if (data) {
          const userProfile = data as UserProfile;
          
          // Check if hold period expired and auto-update status (only for role='user')
          if (userProfile.status === 'hold' && userProfile.role === 'user' && userProfile.hold_end_time) {
            const now = new Date().getTime();
            const endTime = new Date(userProfile.hold_end_time).getTime();
            if (endTime <= now) {
              console.log('Contract: Hold period expired, auto-updating status to active');
              try {
                const { error: updateError } = await supabase
                  .from('user_profiles')
                  // @ts-ignore - Supabase type inference issue
                  .update({
                    status: 'active',
                    status_reason: 'hold expired account active by system',
                    hold_end_time: null,
                    hold_duration_days: null
                  })
                  .eq('user_id', user.id);

                if (!updateError) {
                  // Refresh profile after update
                  const { data: updatedData } = await supabase
                    .from('user_profiles')
                    .select('user_name, email, role, super_admin, approval_status, status, employee_id, updated_at, hold_end_time')
                    .eq('user_id', user.id)
                    .maybeSingle();
                  
                  if (updatedData) {
                    const updatedProfile = updatedData as UserProfile;
                    setProfile(updatedProfile);
                    setDisplayName(updatedProfile.user_name || metaName || updatedProfile.email?.split('@')[0] || 'User');
                    
                    // Update cache
                    try {
                      localStorage.setItem(`profile_sidebar_${user.id}`, JSON.stringify({
                        employee_id: updatedProfile.employee_id,
                        updated_at: updatedProfile.updated_at,
                        user_name: updatedProfile.user_name,
                        email: updatedProfile.email,
                        role: updatedProfile.role,
                        super_admin: updatedProfile.super_admin,
                        approval_status: updatedProfile.approval_status,
                        status: updatedProfile.status,
                        hold_end_time: updatedProfile.hold_end_time
                      }));
                    } catch (e) {
                      console.error('Error updating cache:', e);
                    }
                  }
                }
              } catch (updateErr) {
                console.error('Contract: Error updating status:', updateErr);
              }
            }
          }

          setProfile(userProfile);
          setDisplayName(userProfile.user_name || metaName || userProfile.email?.split('@')[0] || 'User');

          // Update cache
          try {
            localStorage.setItem(`profile_sidebar_${user.id}`, JSON.stringify({
              employee_id: userProfile.employee_id,
              updated_at: userProfile.updated_at,
              user_name: userProfile.user_name,
              email: userProfile.email,
              role: userProfile.role,
              super_admin: userProfile.super_admin,
              approval_status: userProfile.approval_status,
              status: userProfile.status,
              hold_end_time: userProfile.hold_end_time
            }));
          } catch (e) {
            console.error('Error updating cache:', e);
          }

          // Check if user should be redirected (only for non-admin users)
          const isAdminOrSuperAdmin = userProfile.role === 'admin' || userProfile.role === 'super_admin' || userProfile.super_admin === true;
          
          if (!isAdminOrSuperAdmin) {
            const currentPath = location.pathname;
            
            if (userProfile.approval_status === 'rejected') {
              console.log('Contract: User rejected, redirecting to rejected page');
              navigate('/rejected');
              return;
            }
            
            if (userProfile.status === 'suspend') {
              console.log('Contract: User suspended, redirecting to suspended page');
              navigate('/suspended');
              return;
            }
            
            if (userProfile.status === 'hold') {
              console.log('Contract: User on hold, redirecting to hold page');
              navigate('/hold');
              return;
            }
            
            if (userProfile.approval_status !== 'approved') {
              console.log('Contract: User not approved, redirecting to approval pending page');
              navigate('/approval-pending');
              return;
            }
          }
        } else {
          // Profile not found - user may have been deleted
          console.log('Contract: User profile not found (data is null), redirecting to login');
          // Sign out the user
          try {
            await signOut();
          } catch (signOutError) {
            console.error('Contract: Error signing out:', signOutError);
          }
          // Clear all caches
          try {
            localStorage.removeItem(`profile_sidebar_${user.id}`);
            localStorage.removeItem(`profile_${user.id}`);
            localStorage.removeItem('currentUserRole');
            localStorage.removeItem('isSuperAdmin');
            localStorage.removeItem('isAuthenticated');
          } catch (e) {
            console.error('Error clearing cache:', e);
          }
          // Redirect to login with error message
          window.location.href = '/login?error=account_deleted';
          return;
        }
      } catch (error: any) {
        console.error('Contract: Exception fetching profile:', error);
        // If exception indicates user not found or account deleted, redirect to login
        if (error?.code === 'PGRST116' || error?.message?.toLowerCase().includes('not found') || error?.message?.toLowerCase().includes('does not exist')) {
          console.log('Contract: User profile not found (exception), redirecting to login');
          // Sign out the user
          try {
            await signOut();
          } catch (signOutError) {
            console.error('Contract: Error signing out:', signOutError);
          }
          // Clear all caches
          try {
            localStorage.removeItem(`profile_sidebar_${user.id}`);
            localStorage.removeItem(`profile_${user.id}`);
            localStorage.removeItem('currentUserRole');
            localStorage.removeItem('isSuperAdmin');
            localStorage.removeItem('isAuthenticated');
          } catch (e) {
            console.error('Error clearing cache:', e);
          }
          // Redirect to login with error message
          window.location.href = '/login?error=account_deleted';
          return;
        }
        if (user.email) setDisplayName(user.email.split('@')[0]);
      }
    };

    fetchProfile();

    return () => {
      if (interval) clearInterval(interval);
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [user?.id, authLoading, navigate, signOut, location.pathname]);

  // Fetch assigned campaign contract IDs for role "user"
  useEffect(() => {
    const fetchAssignedCampaignContracts = async () => {
      if (!user?.id || !profile) return;

      try {
        // Get role from profile
        const finalRole = profile.role;

        // If role is "user", fetch contract IDs from assigned active campaigns
        if (finalRole === 'user') {
          // Fetch all campaigns where user is assigned and status is "live" (active)
          const { data: campaignsData, error: campaignsError } = await supabase
            .from("campaigns")
            .select("id, users, status, contract_id")
            .eq("status", "live")
            .order("created_at", { ascending: false });

          if (!campaignsError && campaignsData) {
            const contractIds = new Set<string>();
            campaignsData.forEach((campaign: any) => {
              const users = campaign.users;
              if (Array.isArray(users)) {
                const isAssigned = users.some((userItem: any) => 
                  userItem.id === user.id || userItem.user_id === user.id
                );
                // Only add contract_id if user is assigned AND campaign is active AND contract_id exists
                if (isAssigned && campaign.status === "live" && campaign.contract_id) {
                  contractIds.add(campaign.contract_id);
                }
              }
            });
            setAssignedCampaignContractIds(contractIds);
          }
        } else {
          // For admin/super_admin, clear the filter (show all contracts)
          setAssignedCampaignContractIds(new Set());
        }
      } catch (err) {
        console.error('Contract: Error fetching assigned campaign contracts', err);
      }
    };

    fetchAssignedCampaignContracts();
  }, [user?.id, profile]);

  // Fetch contract counts when profile is available
  useEffect(() => {
    if (!user?.id || !profile) return;

    const fetchContractCounts = async () => {
      try {
        // Check if user is admin or super_admin to show all contracts or just their own
        const isAdminOrSuperAdmin = profile.role === 'admin' || profile.role === 'super_admin' || profile.super_admin === true;

        // Build query based on user role
        let activeQuery = supabase
          .from('contracts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        let inactiveQuery = supabase
          .from('contracts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'inactive');

        let draftQuery = supabase
          .from('contracts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'draft');

        // For role "user", filter by assigned campaign contract IDs
        if (profile.role === 'user' && assignedCampaignContractIds.size > 0) {
          const contractIdsArray = Array.from(assignedCampaignContractIds);
          activeQuery = activeQuery.in('id', contractIdsArray);
          inactiveQuery = inactiveQuery.in('id', contractIdsArray);
          draftQuery = draftQuery.in('id', contractIdsArray);
        }

        const [activeResult, inactiveResult, draftResult] = await Promise.all([
          activeQuery,
          inactiveQuery,
          draftQuery
        ]);

        setActiveContracts(activeResult.count || 0);
        setInactiveContracts(inactiveResult.count || 0);
        setDraftContracts(draftResult.count || 0);
      } catch (error) {
        console.error('Contract: Error fetching contract counts:', error);
        setActiveContracts(0);
        setInactiveContracts(0);
        setDraftContracts(0);
      }
    };

    fetchContractCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.role, profile?.super_admin, assignedCampaignContractIds]);

  // Fetch contracts list
  useEffect(() => {
    if (!user?.id || !profile) return;

    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    const fetchContracts = async () => {
      if (!isMounted) return;
      
      setIsLoading(true);
      try {
        const isAdminOrSuperAdmin = profile.role === 'admin' || profile.role === 'super_admin' || profile.super_admin === true;

        let query = supabase
          .from('contracts')
          .select('*')
          .order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
          console.error('Contract: Error fetching contracts:', error);
          
          // Retry logic for network errors
          if (retryCount < maxRetries && (error.code === 'PGRST301' || error.message?.includes('fetch'))) {
            retryCount++;
            console.log(`Contract: Retrying fetch (attempt ${retryCount}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay * retryCount));
            return fetchContracts();
          }
          
          throw error;
        }

        // Fetch user profiles for created_by and updated_by
        if (isMounted && data && data.length > 0) {
          const userIds = new Set<string>();
          data.forEach((contract: any) => {
            if (contract.created_by) userIds.add(contract.created_by);
            if (contract.updated_by) userIds.add(contract.updated_by);
          });

          const userIdsArray = Array.from(userIds);
          if (userIdsArray.length > 0) {
            try {
              const { data: profiles, error: profilesError } = await supabase
                .from('user_profiles')
                .select('user_id, user_name, employee_id')
                .in('user_id', userIdsArray);

              if (profilesError) {
                console.error('Contract: Error fetching user profiles:', profilesError);
                // Continue without profiles if fetch fails
              }

              if (profiles && profiles.length > 0) {
                const profilesMap = new Map(
                  profiles.map((p: any) => [p.user_id, { name: p.user_name, employee_id: p.employee_id }])
                );

                // Enrich contracts with user info
                const enrichedContracts = data.map((contract: any) => ({
                  ...contract,
                  creator_name: profilesMap.get(contract.created_by)?.name || 'Unknown',
                  creator_employee_id: profilesMap.get(contract.created_by)?.employee_id || null,
                  updater_name: contract.updated_by 
                    ? (profilesMap.get(contract.updated_by)?.name || 'Unknown')
                    : (profilesMap.get(contract.created_by)?.name || 'Unknown'),
                  updater_employee_id: contract.updated_by
                    ? (profilesMap.get(contract.updated_by)?.employee_id || null)
                    : (profilesMap.get(contract.created_by)?.employee_id || null),
                }));

                if (isMounted) {
                  setContracts(enrichedContracts);
                }
              } else {
                // Set contracts without enrichment if profiles fetch fails
                if (isMounted) {
                  setContracts(data || []);
                }
              }
            } catch (profileError) {
              console.error('Contract: Error in profile enrichment:', profileError);
              // Set contracts without enrichment
              if (isMounted) {
                setContracts(data || []);
              }
            }
          } else {
            if (isMounted) {
              setContracts(data || []);
            }
          }
        } else if (isMounted) {
          setContracts([]);
        }
      } catch (error: any) {
        console.error('Contract: Error fetching contracts:', error);
        if (isMounted) {
          // Only show error toast if all retries failed
          if (retryCount >= maxRetries) {
            toast({
              title: "Error",
              description: error.message || "Failed to fetch contracts. Please refresh the page.",
              variant: "destructive",
            });
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchContracts();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.role, profile?.super_admin]);

  // Refresh contracts data
  const handleRefresh = async () => {
    if (!user?.id || !profile || isRefreshing) return;

    setIsRefreshing(true);
    try {
      // Fetch contracts
      const isAdminOrSuperAdmin = profile.role === 'admin' || profile.role === 'super_admin' || profile.super_admin === true;

      let query = supabase
        .from('contracts')
        .select('*')
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Fetch user profiles for created_by and updated_by
      if (data && data.length > 0) {
        const userIds = new Set<string>();
        data.forEach((contract: any) => {
          if (contract.created_by) userIds.add(contract.created_by);
          if (contract.updated_by) userIds.add(contract.updated_by);
        });

        const userIdsArray = Array.from(userIds);
        if (userIdsArray.length > 0) {
          try {
            const { data: profiles } = await supabase
              .from('user_profiles')
              .select('user_id, user_name, employee_id')
              .in('user_id', userIdsArray);

            if (profiles && profiles.length > 0) {
              const profilesMap = new Map(
                profiles.map((p: any) => [p.user_id, { name: p.user_name, employee_id: p.employee_id }])
              );

              const enrichedContracts = data.map((contract: any) => ({
                ...contract,
                creator_name: profilesMap.get(contract.created_by)?.name || 'Unknown',
                creator_employee_id: profilesMap.get(contract.created_by)?.employee_id || null,
                updater_name: contract.updated_by 
                  ? (profilesMap.get(contract.updated_by)?.name || 'Unknown')
                  : (profilesMap.get(contract.created_by)?.name || 'Unknown'),
                updater_employee_id: contract.updated_by
                  ? (profilesMap.get(contract.updated_by)?.employee_id || null)
                  : (profilesMap.get(contract.created_by)?.employee_id || null),
              }));

              setContracts(enrichedContracts);
            } else {
              setContracts(data || []);
            }
          } catch (profileError) {
            console.error('Contract: Error in profile enrichment:', profileError);
            setContracts(data || []);
          }
        } else {
          setContracts(data || []);
        }
      } else {
        setContracts([]);
      }

      // Fetch counts
      let activeQuery = supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'active');
      let inactiveQuery = supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'inactive');
      let draftQuery = supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'draft');

      // For role "user", filter by assigned campaign contract IDs
      if (profile && profile.role === 'user' && assignedCampaignContractIds.size > 0) {
        const contractIdsArray = Array.from(assignedCampaignContractIds);
        activeQuery = activeQuery.in('id', contractIdsArray);
        inactiveQuery = inactiveQuery.in('id', contractIdsArray);
        draftQuery = draftQuery.in('id', contractIdsArray);
      }

      const [activeResult, inactiveResult, draftResult] = await Promise.all([
        activeQuery,
        inactiveQuery,
        draftQuery
      ]);

      setActiveContracts(activeResult.count || 0);
      setInactiveContracts(inactiveResult.count || 0);
      setDraftContracts(draftResult.count || 0);

      toast({
        title: "Data Refreshed",
        description: "Contract data has been synced successfully.",
      });
    } catch (error: any) {
      console.error('Contract: Error refreshing data:', error);
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter contracts based on search query and user role
  const filteredContracts = useMemo(() => {
    let filtered = contracts;

    // If user role is "user", only show contracts from assigned active campaigns
    if (profile && profile.role === 'user' && assignedCampaignContractIds.size > 0) {
      filtered = filtered.filter((contract) => {
        // Only show contracts if id matches assigned campaign contract IDs
        return assignedCampaignContractIds.has(contract.id);
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(contract => {
        return contract.contract_name.toLowerCase().includes(query) ||
               (contract.description && contract.description.toLowerCase().includes(query)) ||
               ((contract.pid ?? "").toLowerCase().includes(query));
      });
    }

    return filtered;
  }, [contracts, searchQuery, profile, assignedCampaignContractIds]);

  // Handle delete contract
  const handleDeleteContract = async () => {
    if (!contractToDelete) return;

    try {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', contractToDelete.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Contract Deleted",
        description: `Contract "${contractToDelete.contract_name}" has been deleted.`,
      });

      // Refresh contracts list
      setContracts(contracts.filter(c => c.id !== contractToDelete.id));
      
      // Update counts
      if (contractToDelete.status === 'active') {
        setActiveContracts(prev => Math.max(0, prev - 1));
      } else if (contractToDelete.status === 'inactive') {
        setInactiveContracts(prev => Math.max(0, prev - 1));
      } else if (contractToDelete.status === 'draft') {
        setDraftContracts(prev => Math.max(0, prev - 1));
      }

      setDeleteDialogOpen(false);
      setContractToDelete(null);
    } catch (error: any) {
      console.error('Error deleting contract:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete contract.",
        variant: "destructive",
      });
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Truncate text to max words
  const truncateWords = (text: string, maxWords: number) => {
    if (!text) return '';
    const words = text.trim().split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ') + '...';
  };

  // Generate PDF from contract content
  const handleViewContract = async (contract: Contract) => {
    let container: HTMLDivElement | null = null;
    let style: HTMLStyleElement | null = null;
    try {
      toast({
        title: "Generating PDF",
        description: "Please wait while we generate the contract PDF...",
      });

      // Create a temporary container for the contract content
      container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '210mm'; // A4 width
      container.style.padding = '20mm';
      container.style.backgroundColor = '#fff';
      
      // Add Quill editor styles to preserve formatting
      style = document.createElement('style');
      style.textContent = TIPTAP_STORAGE_STYLE;
      document.head.appendChild(style);
      
      // Add contract header
      const header = document.createElement('div');
      header.style.marginBottom = '20px';
      header.style.borderBottom = '2px solid #000';
      header.style.paddingBottom = '10px';
      header.innerHTML = `
        <h1 style="margin: 0; font-size: 24px; font-weight: bold;">${contract.contract_name}</h1>
        <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">
          PID: ${contract.pid ?? "N/A"} | 
          Status: ${contract.status.charAt(0).toUpperCase() + contract.status.slice(1)} | 
          Created: ${formatDate(contract.created_at)} | 
          ${contract.updated_at !== contract.created_at ? `Updated: ${formatDate(contract.updated_at)}` : ''}
        </p>
      `;
      container.appendChild(header);

      const contentWrapper = document.createElement('div');
      contentWrapper.style.padding = '0';
      contentWrapper.style.backgroundColor = '#ffffff';

      const rawHtml = contract.content && contract.content.trim().length
        ? contract.content
        : `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${TIPTAP_STORAGE_STYLE}</style></head><body><div class="tiptap-rendered"><p>No content available.</p></div></body></html>`;

      try {
        const parser = new DOMParser();
        const parsedDoc = parser.parseFromString(rawHtml, 'text/html');
        const styles = parsedDoc.head ? Array.from(parsedDoc.head.querySelectorAll('style, link[rel="stylesheet"]')) : [];
        styles.forEach((styleNode) => {
          container!.appendChild(styleNode.cloneNode(true));
        });
        const bodyContent = parsedDoc.body ? parsedDoc.body.innerHTML : rawHtml;
        contentWrapper.innerHTML = bodyContent;
      } catch {
        contentWrapper.innerHTML = rawHtml;
      }

      container.appendChild(contentWrapper);

      const images = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
      await Promise.all(
        images.map(async (img) => {
          const src = img.getAttribute('src');
          if (src && !src.startsWith('data:')) {
            try {
              const response = await fetch(src, { mode: 'cors' });
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
              img.src = dataUrl;
            } catch (error) {
              console.warn('Contract: unable to inline image for PDF rendering', error);
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

      // Add footer with creator/updater info
      const footer = document.createElement('div');
      footer.style.marginTop = '30px';
      footer.style.paddingTop = '10px';
      footer.style.borderTop = '1px solid #ccc';
      footer.style.fontSize = '10px';
      footer.style.color = '#666';
      footer.innerHTML = `
        <p style="margin: 5px 0;">
          Created by: ${contract.creator_name || 'Unknown'}${contract.creator_employee_id ? ` (${contract.creator_employee_id})` : ''}
        </p>
        ${contract.updated_at !== contract.created_at ? `
          <p style="margin: 5px 0;">
            Updated by: ${contract.updater_name || 'Unknown'}${contract.updater_employee_id ? ` (${contract.updater_employee_id})` : ''}
          </p>
        ` : ''}
      `;
      container.appendChild(footer);

      document.body.appendChild(container);

      // Generate PDF
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const safePid = contract.pid ? `${contract.pid.replace(/[^a-z0-9]/gi, '_')}_` : '';
      pdf.save(`${safePid}${contract.contract_name.replace(/[^a-z0-9]/gi, '_')}_${new Date().getTime()}.pdf`);

      toast({
        title: "PDF Generated",
        description: "Contract PDF has been downloaded successfully.",
      });
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      if (container && container.parentNode) {
        document.body.removeChild(container);
      }
      if (style && document.head.contains(style)) {
        document.head.removeChild(style);
      }
    }
  };

  // Handle status change
  const handleStatusChange = async (contractId: string, newStatus: 'active' | 'inactive' | 'draft') => {
    try {
      const { error } = await supabase
        .from('contracts')
        // @ts-ignore - Supabase type inference issue
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq('id', contractId);

      if (error) {
        throw error;
      }

      // Update local state
      setContracts(prev => prev.map(c => {
        if (c.id === contractId) {
          const oldStatus = c.status;
          // Update counts
          if (oldStatus === 'active') {
            setActiveContracts(prevCount => Math.max(0, prevCount - 1));
          } else if (oldStatus === 'inactive') {
            setInactiveContracts(prevCount => Math.max(0, prevCount - 1));
          } else if (oldStatus === 'draft') {
            setDraftContracts(prevCount => Math.max(0, prevCount - 1));
          }

          if (newStatus === 'active') {
            setActiveContracts(prevCount => prevCount + 1);
          } else if (newStatus === 'inactive') {
            setInactiveContracts(prevCount => prevCount + 1);
          } else if (newStatus === 'draft') {
            setDraftContracts(prevCount => prevCount + 1);
          }

          return { ...c, status: newStatus };
        }
        return c;
      }));

      toast({
        title: "Status Updated",
        description: `Contract status has been changed to ${newStatus}.`,
      });
    } catch (error: any) {
      console.error('Error updating contract status:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update contract status.",
        variant: "destructive",
      });
    }
  };

  const contractStats = useMemo(
    () => [
      {
        id: "active",
        title: "Active",
        value: activeContracts,
        subtext: "Currently live agreements",
        accent: "from-emerald-500/90 to-teal-500/60",
        icon: FileText,
      },
      {
        id: "inactive",
        title: "Inactive",
        value: inactiveContracts,
        subtext: "Shelved or completed",
        accent: "from-slate-500/90 to-slate-800/60",
        icon: FolderOpen,
      },
      {
        id: "draft",
        title: "Drafts",
        value: draftContracts,
        subtext: "Work in progress",
        accent: "from-amber-500/90 to-orange-500/60",
        icon: PenSquare,
      },
    ],
    [activeContracts, inactiveContracts, draftContracts]
  );

  return (
    <div className="flex min-h-screen bg-gradient-subtle">
      <Sidebar />
      
      <div className="flex-1 lg:ml-56">
        <Header />
        <main className="container mx-auto px-3 sm:px-4 py-4 space-y-6 pb-24 lg:pb-8 animate-fade-in max-w-7xl">
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-2xl lg:rounded-3xl bg-primary text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.28),transparent_55%)]" />
              <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="relative p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8">
                <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2 sm:space-y-3">
                    <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.25em] sm:tracking-[0.35em] text-white/70">Contracts</p>
                    <h1 className="text-xl sm:text-2xl lg:text-4xl font-bold leading-tight">Contract Management Hub</h1>
                    <p className="text-xs sm:text-sm lg:text-base text-white/80 max-w-2xl mb-4 sm:mb-0">
                      Keep every agreement aligned. Monitor statuses, flip drafts into live contracts, and export polished PDFs in seconds.
                    </p>
                    {profile && (profile.role === 'admin' || profile.role === 'super_admin' || profile.super_admin === true) && (
                      <Button
                        onClick={() => navigate('/contract/editor')}
                        className="hidden lg:flex bg-white text-indigo-600 hover:bg-white/90 h-9 sm:h-11 px-4 sm:px-5 rounded-full text-xs sm:text-sm font-semibold items-center gap-2 w-full sm:w-auto"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Contract
                      </Button>
                    )}
                  </div>
                  <div className="hidden lg:flex flex-col gap-3 rounded-2xl border border-white/30 bg-white/10 p-5 backdrop-blur-lg text-sm text-white/90 min-w-[240px]">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Total Contracts</span>
                      <span>{activeContracts + inactiveContracts + draftContracts}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-white/80">
                      <span>Active</span>
                      <span>{activeContracts}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-white/80">
                      <span>Inactive</span>
                      <span>{inactiveContracts}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-white/80">
                      <span>Drafts</span>
                      <span>{draftContracts}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-white/70 border-t border-white/20 pt-3 mt-2">
                      <span>Filters applied</span>
                      <span>{searchQuery ? 'Search' : 'None'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
                  {contractStats.map(({ id, title, value, subtext, accent, icon: Icon }) => (
                    <Card
                      key={id}
                      className="relative overflow-hidden px-2 py-2.5 sm:px-4 sm:py-4 lg:p-6 bg-white/90 border border-white/20 backdrop-blur transition-transform duration-200 hover:-translate-y-1"
                    >
                      <div className={`absolute inset-0 opacity-[0.08] pointer-events-none bg-gradient-to-br ${accent}`} />
                      <div className="relative flex items-start justify-between gap-2 sm:gap-3">
                        <div className="space-y-0.5 sm:space-y-2 flex-1 min-w-0">
                          <p className="text-[9px] sm:text-[11px] uppercase tracking-wide text-slate-500 truncate">{title}</p>
                          <p className="text-sm sm:text-2xl font-semibold text-slate-900">{value}</p>
                          <p className="text-[9px] sm:text-[11px] text-slate-500 line-clamp-1 hidden sm:block">{subtext}</p>
                        </div>
                        <div className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl text-white bg-gradient-to-br ${accent}`}>
                          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                {/* Mobile: Desktop Only Message */}
                {profile && (profile.role === 'admin' || profile.role === 'super_admin' || profile.super_admin === true) && (
                  <div className="lg:hidden">
                    <div className="flex flex-col gap-3 rounded-2xl border border-white/30 bg-white/10 p-5 backdrop-blur-lg text-sm text-white/90">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <p className="text-xs sm:text-sm font-semibold text-white/90 text-center">
                          Contract creation available only on desktop
                        </p>
                      </div>
                      <p className="text-xs text-white/70 text-center">
                        Please use a desktop or laptop to create new contracts
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Card className="border outline-indigo-200 bg-white/95 backdrop-blur">
              <div className="p-5 sm:p-6 space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="w-full lg:max-w-xl">
                    <SearchBar
                      value={searchQuery}
                      onChange={setSearchQuery}
                      placeholder="Search contracts by name or description..."
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefresh}
                      disabled={isRefreshing || isLoading}
                      className="flex items-center gap-2 shrink-0"
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Badge className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm">
                      Showing {filteredContracts.length} of {activeContracts + inactiveContracts + draftContracts} contracts
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          </div>
 
          {/* Contracts List */}
          {isLoading ? (
            <div className="bg-card rounded-lg p-8 border border-border/50">
              <p className="text-muted-foreground text-center">Loading contracts...</p>
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="bg-card rounded-lg p-8 border border-border/50">
              <p className="text-muted-foreground text-center">
                {searchQuery ? 'No contracts found matching your search.' : 'No contracts found. Create your first contract!'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContracts.map((contract) => (
                <Card
                  key={contract.id}
                  className="p-4 bg-card hover:shadow-lg transition-all duration-300 border-border/50 hover:scale-[1.02] flex flex-col"
                >
                  {/* Header with status badge */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base text-foreground line-clamp-1">
                          {contract.contract_name}
                        </h3>
                        {contract.status === 'draft' && (
                          <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                            Draft
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mb-1">
                        PID: {contract.pid ?? "Pending assignment"}
                      </p>
                      {contract.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {truncateWords(contract.description, 50)}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            contract.status === 'active'
                              ? 'bg-green-500/10 text-green-600 border-green-500/20'
                              : contract.status === 'inactive'
                              ? 'bg-gray-500/10 text-gray-600 border-gray-500/20'
                              : 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                          }`}
                        >
                          {contract.status === 'active' ? 'Active' : contract.status === 'inactive' ? 'Inactive' : 'Draft'}
                        </Badge>
                      </div>
                    </div>
                    {profile && (profile.role === 'admin' || profile.role === 'super_admin' || profile.super_admin === true) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => navigate(`/contract/editor?id=${contract.id}`)}
                            className="cursor-pointer"
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleViewContract(contract)}
                            className="cursor-pointer"
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View as PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setContractToDelete(contract);
                              setDeleteDialogOpen(true);
                            }}
                            className="cursor-pointer text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* Contract Info */}
                  <div className="flex-1 space-y-2 mb-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Created: {formatDate(contract.created_at)}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>By:</span>
                        <span className="font-medium text-foreground">{contract.creator_name || 'Unknown'}</span>
                        {contract.creator_employee_id && (
                          <>
                            <span className="text-muted-foreground">•</span>
                            <Badge variant="outline" className="text-xs h-4 px-1.5">
                              {contract.creator_employee_id}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    {contract.updated_at !== contract.created_at && (
                      <div className="space-y-1 pt-1 border-t border-border/30">
                        <p className="text-xs text-muted-foreground">
                          Updated: {formatDate(contract.updated_at)}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span>By:</span>
                          <span className="font-medium text-foreground">{contract.updater_name || 'Unknown'}</span>
                          {contract.updater_employee_id && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <Badge variant="outline" className="text-xs h-4 px-1.5">
                                {contract.updater_employee_id}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-3 border-t border-border/50">
                    {/* Primary Actions */}
                    <div className="flex gap-2">
                      {profile && (profile.role === 'admin' || profile.role === 'super_admin' || profile.super_admin === true) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => navigate(`/contract/editor?id=${contract.id}`)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleViewContract(contract)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View PDF
                      </Button>
                    </div>
                    
                    {/* Status Change Buttons - Only for admin/super_admin */}
                    {profile && (profile.role === 'admin' || profile.role === 'super_admin' || profile.super_admin === true) && (
                      <div className="flex gap-2">
                        <Button
                          variant={contract.status === 'active' ? 'default' : 'outline'}
                          size="sm"
                          className={`flex-1 text-xs ${
                            contract.status === 'active'
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'hover:bg-green-500/10 hover:text-green-600'
                          }`}
                          onClick={() => handleStatusChange(contract.id, 'active')}
                          disabled={contract.status === 'active'}
                        >
                          Active
                        </Button>
                        <Button
                          variant={contract.status === 'inactive' ? 'default' : 'outline'}
                          size="sm"
                          className={`flex-1 text-xs ${
                            contract.status === 'inactive'
                              ? 'bg-gray-600 hover:bg-gray-700 text-white'
                              : 'hover:bg-gray-500/10 hover:text-gray-600'
                          }`}
                          onClick={() => handleStatusChange(contract.id, 'inactive')}
                          disabled={contract.status === 'inactive'}
                        >
                          Inactive
                        </Button>
                        <Button
                          variant={contract.status === 'draft' ? 'default' : 'outline'}
                          size="sm"
                          className={`flex-1 text-xs ${
                            contract.status === 'draft'
                              ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                              : 'hover:bg-yellow-500/10 hover:text-yellow-600'
                          }`}
                          onClick={() => handleStatusChange(contract.id, 'draft')}
                          disabled={contract.status === 'draft'}
                        >
                          Draft
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Contract</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{contractToDelete?.contract_name}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setContractToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteContract}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </main>
      </div>

      <MobileNav />
    </div>
  );
};

export default Contract;

