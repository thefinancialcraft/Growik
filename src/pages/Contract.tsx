import { useState, useEffect } from "react";
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
import { Edit, Trash2, Eye, MoreVertical, RefreshCw } from "lucide-react";
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

    // Set up real-time subscription for profile updates and deletions
    if (user?.id) {
      const channel = supabase
      .channel(`contract_profile_updates_${user.id}`)
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const updatedProfile = payload.new as UserProfile;
          setProfile(updatedProfile);
          setDisplayName(updatedProfile.user_name || updatedProfile.email?.split('@')[0] || 'User');

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

          // Check if user should be redirected (only for non-admin users)
          const isAdminOrSuperAdmin = updatedProfile.role === 'admin' || updatedProfile.role === 'super_admin' || updatedProfile.super_admin === true;
          
          if (!isAdminOrSuperAdmin) {
            const currentPath = window.location.pathname;
            
            if (updatedProfile.approval_status === 'rejected' && currentPath !== '/rejected') {
              console.log('Contract: Status changed to rejected, redirecting to rejected page');
              navigate('/rejected');
              return;
            }
            
            if (updatedProfile.status === 'suspend' && currentPath !== '/suspended') {
              console.log('Contract: Status changed to suspend, redirecting to suspended page');
              navigate('/suspended');
              return;
            }
            
            if (updatedProfile.status === 'hold' && currentPath !== '/hold') {
              console.log('Contract: Status changed to hold, redirecting to hold page');
              navigate('/hold');
              return;
            }
            
            if (updatedProfile.approval_status !== 'approved' && currentPath !== '/approval-pending') {
              console.log('Contract: Approval status changed, redirecting to approval pending page');
              navigate('/approval-pending');
              return;
            }
          }
        }
      )
      .on('postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'user_profiles',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Profile deleted:', payload.old);
          console.log('User ID:', user.id);
          
          // Profile was deleted - redirect to login immediately
          console.log('Contract: Profile deleted in real-time, redirecting to login');
          
          // Sign out the user
          const handleDelete = async () => {
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
          };
          
          handleDelete();
        }
      )
      .subscribe((status) => {
        console.log('Contract realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Contract: Successfully subscribed to profile updates and deletions');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Contract: Error subscribing to profile updates');
        }
      });

      return () => {
        supabase.removeChannel(channel);
      };
    }

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

        // RLS policy allows all authenticated users to view all contracts
        // No need for explicit filtering - all users can see all contracts

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
  }, [user?.id, profile?.role, profile?.super_admin]);

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

    // Set up real-time subscription for contracts
    if (user?.id) {
      const isAdminOrSuperAdmin = profile.role === 'admin' || profile.role === 'super_admin' || profile.super_admin === true;
      
      // Remove any existing channel first to prevent duplicates
      const channelName = `contracts_updates_${user.id}`;
      try {
        // Get all channels and remove if exists
        const channels = supabase.getChannels();
        const existingChannel = channels.find(ch => ch.topic === channelName);
        if (existingChannel) {
          supabase.removeChannel(existingChannel);
        }
      } catch (e) {
        // Ignore if channel doesn't exist
      }
      
      const channel = supabase
        .channel(channelName)
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'contracts',
          },
          async (payload) => {
            if (!isMounted) return;
            
            try {
              if (payload.eventType === 'INSERT' && payload.new) {
                const newContract = payload.new as any;
                const hasAccess = isAdminOrSuperAdmin || 
                  newContract.created_by === user.id || 
                  newContract.assigned_to === user.id;
                
                if (hasAccess) {
                  // Fetch user profiles for the new contract
                  try {
                    const userIds = [newContract.created_by];
                    if (newContract.updated_by) userIds.push(newContract.updated_by);
                    
                    const { data: profiles } = await supabase
                      .from('user_profiles')
                      .select('user_id, user_name, employee_id')
                      .in('user_id', userIds);

                    if (profiles && profiles.length > 0) {
                      const profilesMap = new Map(
                        profiles.map((p: any) => [p.user_id, { name: p.user_name, employee_id: p.employee_id }])
                      );

                      const enrichedContract = {
                        ...newContract,
                        creator_name: profilesMap.get(newContract.created_by)?.name || 'Unknown',
                        creator_employee_id: profilesMap.get(newContract.created_by)?.employee_id || null,
                        updater_name: newContract.updated_by 
                          ? (profilesMap.get(newContract.updated_by)?.name || 'Unknown')
                          : (profilesMap.get(newContract.created_by)?.name || 'Unknown'),
                        updater_employee_id: newContract.updated_by
                          ? (profilesMap.get(newContract.updated_by)?.employee_id || null)
                          : (profilesMap.get(newContract.created_by)?.employee_id || null),
                      };

                      if (isMounted) {
                        setContracts(prev => {
                          // Check if contract already exists to prevent duplicates
                          const exists = prev.some(c => c.id === enrichedContract.id);
                          if (exists) return prev;
                          return [enrichedContract, ...prev];
                        });
                      }
                    } else {
                      if (isMounted) {
                        setContracts(prev => {
                          const exists = prev.some(c => c.id === newContract.id);
                          if (exists) return prev;
                          return [newContract, ...prev];
                        });
                      }
                    }
                    
                    // Update counts
                    if (isMounted) {
                      if (newContract.status === 'active') {
                        setActiveContracts(prev => prev + 1);
                      } else if (newContract.status === 'inactive') {
                        setInactiveContracts(prev => prev + 1);
                      } else if (newContract.status === 'draft') {
                        setDraftContracts(prev => prev + 1);
                      }
                    }
                  } catch (error) {
                    console.error('Contract: Error enriching new contract:', error);
                    // Still add contract without enrichment
                    if (isMounted) {
                      setContracts(prev => {
                        const exists = prev.some(c => c.id === newContract.id);
                        if (exists) return prev;
                        return [newContract, ...prev];
                      });
                    }
                  }
                }
              } else if (payload.eventType === 'UPDATE' && payload.new) {
                const newContract = payload.new as any;
                const hasAccess = isAdminOrSuperAdmin || 
                  newContract.created_by === user.id || 
                  newContract.assigned_to === user.id;
                
                if (hasAccess) {
                  // Fetch user profiles for the updated contract
                  try {
                    const userIds = [newContract.created_by];
                    if (newContract.updated_by) userIds.push(newContract.updated_by);
                    
                    const { data: profiles } = await supabase
                      .from('user_profiles')
                      .select('user_id, user_name, employee_id')
                      .in('user_id', userIds);

                    if (profiles && profiles.length > 0) {
                      const profilesMap = new Map(
                        profiles.map((p: any) => [p.user_id, { name: p.user_name, employee_id: p.employee_id }])
                      );

                      const enrichedContract = {
                        ...newContract,
                        creator_name: profilesMap.get(newContract.created_by)?.name || 'Unknown',
                        creator_employee_id: profilesMap.get(newContract.created_by)?.employee_id || null,
                        updater_name: newContract.updated_by 
                          ? (profilesMap.get(newContract.updated_by)?.name || 'Unknown')
                          : (profilesMap.get(newContract.created_by)?.name || 'Unknown'),
                        updater_employee_id: newContract.updated_by
                          ? (profilesMap.get(newContract.updated_by)?.employee_id || null)
                          : (profilesMap.get(newContract.created_by)?.employee_id || null),
                      };

                      if (isMounted) {
                        setContracts(prev => prev.map(c => 
                          c.id === enrichedContract.id ? enrichedContract : c
                        ));
                      }
                    } else {
                      if (isMounted) {
                        setContracts(prev => prev.map(c => 
                          c.id === newContract.id ? newContract : c
                        ));
                      }
                    }
                    
                    // Update counts if status changed
                    if (isMounted && payload.old) {
                      const oldContract = payload.old as any;
                      if (oldContract.status !== newContract.status) {
                        // Decrease old status count
                        if (oldContract.status === 'active') {
                          setActiveContracts(prev => Math.max(0, prev - 1));
                        } else if (oldContract.status === 'inactive') {
                          setInactiveContracts(prev => Math.max(0, prev - 1));
                        } else if (oldContract.status === 'draft') {
                          setDraftContracts(prev => Math.max(0, prev - 1));
                        }
                        // Increase new status count
                        if (newContract.status === 'active') {
                          setActiveContracts(prev => prev + 1);
                        } else if (newContract.status === 'inactive') {
                          setInactiveContracts(prev => prev + 1);
                        } else if (newContract.status === 'draft') {
                          setDraftContracts(prev => prev + 1);
                        }
                      }
                    }
                  } catch (error) {
                    console.error('Contract: Error enriching updated contract:', error);
                    // Still update contract without enrichment
                    if (isMounted) {
                      setContracts(prev => prev.map(c => 
                        c.id === newContract.id ? newContract : c
                      ));
                    }
                  }
                }
              } else if (payload.eventType === 'DELETE' && payload.old) {
                const deletedContract = payload.old as any;
                if (isMounted) {
                  setContracts(prev => prev.filter(c => c.id !== deletedContract.id));
                  
                  // Update counts
                  if (deletedContract.status === 'active') {
                    setActiveContracts(prev => Math.max(0, prev - 1));
                  } else if (deletedContract.status === 'inactive') {
                    setInactiveContracts(prev => Math.max(0, prev - 1));
                  } else if (deletedContract.status === 'draft') {
                    setDraftContracts(prev => Math.max(0, prev - 1));
                  }
                }
              }
            } catch (error) {
              console.error('Contract: Error processing realtime update:', error);
            }
          }
        )
        .subscribe((status) => {
          console.log('Contract: Realtime subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('Contract: Successfully subscribed to contract updates');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Contract: Channel subscription error');
          }
        });

      return () => {
        if (isMounted) {
          try {
            supabase.removeChannel(channel);
          } catch (e) {
            console.error('Contract: Error removing channel:', e);
          }
        }
      };
    }

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
      const [activeResult, inactiveResult, draftResult] = await Promise.all([
        supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'inactive'),
        supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'draft')
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

  // Filter contracts based on search query
  const filteredContracts = contracts.filter(contract => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return contract.contract_name.toLowerCase().includes(query) ||
           (contract.description && contract.description.toLowerCase().includes(query));
  });

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
    try {
      toast({
        title: "Generating PDF",
        description: "Please wait while we generate the contract PDF...",
      });

      // Create a temporary container for the contract content
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '210mm'; // A4 width
      container.style.padding = '20mm';
      container.style.backgroundColor = '#fff';
      
      // Add Quill editor styles to preserve formatting
      const style = document.createElement('style');
      style.textContent = `
        .ql-editor {
          box-sizing: border-box;
          line-height: 1.42;
          height: 100%;
          outline: none;
          overflow-y: auto;
          padding: 12px 15px;
          tab-size: 4;
          -moz-tab-size: 4;
          text-align: left;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        .ql-editor p,
        .ql-editor ol,
        .ql-editor ul,
        .ql-editor pre,
        .ql-editor blockquote,
        .ql-editor h1,
        .ql-editor h2,
        .ql-editor h3,
        .ql-editor h4,
        .ql-editor h5,
        .ql-editor h6 {
          margin: 0;
          padding: 0;
          counter-reset: list-1 list-2 list-3 list-4 list-5 list-6 list-7 list-8 list-9;
        }
        .ql-editor ol,
        .ql-editor ul {
          padding-left: 1.5em;
        }
        .ql-editor ol > li,
        .ql-editor ul > li {
          list-style-type: none;
        }
        .ql-editor ol > li::before {
          counter-increment: list-1;
          content: counter(list-1, decimal) '. ';
        }
        .ql-editor ul > li::before {
          content: '\\2022';
        }
        .ql-editor h1 { font-size: 2em; font-weight: bold; }
        .ql-editor h2 { font-size: 1.5em; font-weight: bold; }
        .ql-editor h3 { font-size: 1.17em; font-weight: bold; }
        .ql-editor h4 { font-size: 1em; font-weight: bold; }
        .ql-editor h5 { font-size: 0.83em; font-weight: bold; }
        .ql-editor h6 { font-size: 0.67em; font-weight: bold; }
        .ql-editor a { color: #06c; text-decoration: underline; }
        .ql-editor blockquote {
          border-left: 4px solid #ccc;
          margin-bottom: 5px;
          margin-top: 5px;
          padding-left: 16px;
        }
        .ql-editor code,
        .ql-editor pre {
          background-color: #f0f0f0;
          border-radius: 3px;
        }
        .ql-editor pre {
          white-space: pre-wrap;
          margin-bottom: 5px;
          margin-top: 5px;
          padding: 5px 10px;
        }
        .ql-editor code {
          font-size: 85%;
          padding: 2px 4px;
        }
        .ql-editor pre.ql-syntax {
          background-color: #23241f;
          color: #f8f8f2;
          overflow: visible;
        }
        .ql-editor img {
          max-width: 100%;
          height: auto;
        }
        /* Quill Font Styles */
        .ql-font-roboto { font-family: 'Roboto', sans-serif; }
        .ql-font-open-sans { font-family: 'Open Sans', sans-serif; }
        .ql-font-lato { font-family: 'Lato', sans-serif; }
        .ql-font-montserrat { font-family: 'Montserrat', sans-serif; }
        .ql-font-raleway { font-family: 'Raleway', sans-serif; }
        .ql-font-playfair-display { font-family: 'Playfair Display', serif; }
        .ql-font-merriweather { font-family: 'Merriweather', serif; }
        .ql-font-source-sans-pro { font-family: 'Source Sans Pro', sans-serif; }
        .ql-font-poppins { font-family: 'Poppins', sans-serif; }
        .ql-font-nunito { font-family: 'Nunito', sans-serif; }
        .ql-font-inter { font-family: 'Inter', sans-serif; }
        .ql-font-ubuntu { font-family: 'Ubuntu', sans-serif; }
        .ql-font-crimson-text { font-family: 'Crimson Text', serif; }
        .ql-font-lora { font-family: 'Lora', serif; }
        .ql-font-pt-serif { font-family: 'PT Serif', serif; }
      `;
      document.head.appendChild(style);
      
      // Add contract header
      const header = document.createElement('div');
      header.style.marginBottom = '20px';
      header.style.borderBottom = '2px solid #000';
      header.style.paddingBottom = '10px';
      header.innerHTML = `
        <h1 style="margin: 0; font-size: 24px; font-weight: bold;">${contract.contract_name}</h1>
        <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">
          Status: ${contract.status.charAt(0).toUpperCase() + contract.status.slice(1)} | 
          Created: ${formatDate(contract.created_at)} | 
          ${contract.updated_at !== contract.created_at ? `Updated: ${formatDate(contract.updated_at)}` : ''}
        </p>
      `;
      container.appendChild(header);

      // Add contract content with Quill editor class to preserve styling
      const content = document.createElement('div');
      content.className = 'ql-editor';
      content.innerHTML = contract.content || '<p>No content available.</p>';
      container.appendChild(content);

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

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Clean up
      document.body.removeChild(container);
      document.head.removeChild(style);

      // Save PDF
      pdf.save(`${contract.contract_name.replace(/[^a-z0-9]/gi, '_')}_${new Date().getTime()}.pdf`);

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

  return (
    <div className="flex min-h-screen bg-gradient-subtle">
      <Sidebar />
      
      <div className="flex-1 lg:ml-56">
        <Header />
        <main className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 lg:pb-6 animate-fade-in max-w-7xl">
          <div className="bg-gradient-primary rounded-xl p-4 md:p-6 text-white shadow-glow mb-6">
            <h2 className="text-xl md:text-2xl font-bold mb-1">Contract Management</h2>
            <p className="text-white/80 text-sm">Manage all contracts and agreements</p>
          </div>

          {/* Contract Stats Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {/* Active Contracts Tile */}
            <Card className="p-4 md:p-6 bg-card hover:shadow-lg transition-all duration-300 border-border/50 hover:scale-[1.02] cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Active Contracts</p>
                  <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{activeContracts}</h3>
                  <p className="text-xs text-muted-foreground">Currently active</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </Card>

            {/* Inactive Contracts Tile */}
            <Card className="p-4 md:p-6 bg-card hover:shadow-lg transition-all duration-300 border-border/50 hover:scale-[1.02] cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Inactive Contracts</p>
                  <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{inactiveContracts}</h3>
                  <p className="text-xs text-muted-foreground">Not currently active</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gray-500/10 text-gray-500 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </Card>

            {/* Draft Contracts Tile */}
            <Card className="p-4 md:p-6 bg-card hover:shadow-lg transition-all duration-300 border-border/50 hover:scale-[1.02] cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Draft Contracts</p>
                  <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{draftContracts}</h3>
                  <p className="text-xs text-muted-foreground">In draft stage</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-yellow-500/10 text-yellow-500 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </Card>
          </div>

          {/* Search Bar, Refresh Button and Create Button */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 flex items-center gap-3">
              <div className="flex-1">
                <SearchBar 
                  value={searchQuery} 
                  onChange={setSearchQuery}
                  placeholder="Search contracts..."
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
                className="flex items-center gap-2 shrink-0"
                title="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
            {profile && (profile.role === 'admin' || profile.role === 'super_admin' || profile.super_admin === true) && (
              <Button 
                className="w-full sm:w-auto bg-gradient-primary hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-lg"
                onClick={() => {
                  navigate('/contract/editor');
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Contract
              </Button>
            )}
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

