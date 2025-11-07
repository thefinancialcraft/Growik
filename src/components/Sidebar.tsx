import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface UserProfile {
  employee_id?: string;
  updated_at?: string;
  user_name?: string;
  email?: string;
  role?: string;
  super_admin?: boolean;
  approval_status?: string;
  status?: string;
  hold_end_time?: string;
}

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [totalPendingCount, setTotalPendingCount] = useState<number>(0);
  const [widgetActiveUserId, setWidgetActiveUserId] = useState<string | null>(null);
  const userEmail = localStorage.getItem("userEmail") || "";
  
  // Get initials from name (first letter) or email (first 2 letters) as fallback
  // This will recalculate when profile changes
  const getInitials = (profileData: UserProfile | null) => {
    if (profileData?.user_name) {
      const name = profileData.user_name.trim();
      if (name) return name.charAt(0).toUpperCase();
    }
    const emailSource = user?.email || userEmail;
    if (emailSource) return emailSource.slice(0, 2).toUpperCase();
    return "U";
  };
  
  const initials = getInitials(profile);

  useEffect(() => {
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
        console.error('Sidebar: Error updating last_seen:', error);
      }
    };

    // Reset activity flag and update timestamp (only on click)
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
        console.log('Sidebar: User inactive for 1 minute, stopping last_seen updates');
      }, 1 * 60 * 1000); // 1 minute
    };

    // Track clicks only (no hover/mousemove)
    const handleClick = () => {
      resetActivity();
    };

    if (user?.id) {
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

      // Add event listeners (only click, no hover/mousemove)
      document.addEventListener('visibilitychange', handleVisibilityChange);
      document.addEventListener('click', handleClick);

      return () => {
        clearInterval(interval);
        if (activityTimeout) {
          clearTimeout(activityTimeout);
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        document.removeEventListener('click', handleClick);
      };
    }
  }, [user?.id]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user?.id) {
        // Check cache first
        const cacheKey = `profile_sidebar_${user.id}`;
        const cached = localStorage.getItem(cacheKey);
        let shouldFetch = true;
        
        if (cached) {
          try {
            const cachedData = JSON.parse(cached);
            // Clear old cache if role is missing
            if (cachedData.role === undefined || cachedData.role === null) {
              localStorage.removeItem(cacheKey);
            } else {
              // Use cached data immediately for faster UI
              if (cachedData.user_name && cachedData.email) {
                setProfile(cachedData);
              }
            }
            // Always fetch fresh to ensure role is up to date (especially for admin)
            shouldFetch = true;
          } catch (e) {
            // Invalid cache, continue to fetch
            localStorage.removeItem(cacheKey);
          }
        }

        if (shouldFetch) {
          try {
            console.log('Sidebar: Fetching profile for user:', user.id);
            console.log('Sidebar: Query: SELECT employee_id, updated_at, user_name, email, role, super_admin FROM user_profiles WHERE user_id =', user.id);
            
            const { data, error } = await supabase
              .from('user_profiles')
              .select('employee_id, updated_at, user_name, email, role, super_admin, approval_status, status, hold_end_time')
              .eq('user_id', user.id)
              .maybeSingle();
            
            console.log('Sidebar: Query response - data:', data, 'error:', error);
            
            if (error) {
              console.error('Sidebar: Error fetching profile:', error);
              console.error('Sidebar: Error details:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
              });
              
              // If error indicates user not found or account deleted, redirect to login
              if (error.code === 'PGRST116' || error.message?.toLowerCase().includes('not found') || error.message?.toLowerCase().includes('does not exist')) {
                console.log('Sidebar: User profile not found (error), redirecting to login');
                // Sign out the user
                try {
                  await signOut();
                } catch (signOutError) {
                  console.error('Sidebar: Error signing out:', signOutError);
                }
                // Clear all caches
                try {
                  localStorage.removeItem(`profile_${user.id}`);
                  localStorage.removeItem(`profile_sidebar_${user.id}`);
                  localStorage.removeItem(`profile_mobile_${user.id}`);
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
            
            // Fallback by email if user_id lookup returns null
            let profileRow = data as any;
            if (!profileRow && user.email) {
              console.log('Sidebar: Trying fallback by email:', user.email);
              const { data: byEmail, error: byEmailErr } = await supabase
                .from('user_profiles')
                .select('employee_id, updated_at, user_name, email, role, super_admin, approval_status, status, hold_end_time')
                .eq('email', user.email)
                .maybeSingle();
              console.log('Sidebar: Fallback by email result:', byEmail, byEmailErr);
              if (!byEmailErr) {
                profileRow = byEmail;
              }
            }

            if (profileRow) {
              console.log('Sidebar: Profile data received:', profileRow);
              console.log('Sidebar: Employee ID:', profileRow.employee_id);
              console.log('Sidebar: Approval Status:', profileRow.approval_status);
              console.log('Sidebar: Status:', profileRow.status);
              console.log('Sidebar: Role:', profileRow.role);
              
              // Check if hold period expired and auto-update status (only for role='user')
              if (profileRow.status === 'hold' && profileRow.role === 'user' && profileRow.hold_end_time) {
                const now = new Date().getTime();
                const endTime = new Date(profileRow.hold_end_time).getTime();
                if (endTime <= now) {
                  console.log('Sidebar: Hold period expired, auto-updating status to active');
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
                        .select('employee_id, updated_at, user_name, email, role, super_admin, approval_status, status, hold_end_time')
                        .eq('user_id', user.id)
                        .maybeSingle();
                      
                      if (updatedData) {
                        profileRow = updatedData;
                      }
                    }
                  } catch (updateErr) {
                    console.error('Sidebar: Error auto-updating expired hold status:', updateErr);
                  }
                }
              }
              
              setProfile(profileRow);
              // Cache the data
              localStorage.setItem(cacheKey, JSON.stringify(profileRow));
              
              // Check approval_status and redirect if needed (only for regular users)
              const currentPath = location.pathname;
              const isAdminOrSuperAdmin = profileRow.role === 'admin' || profileRow.role === 'super_admin' || profileRow.super_admin === true;
              
              // Only redirect regular users based on approval_status
              if (!isAdminOrSuperAdmin) {
                // If rejected, redirect to rejected page
                if (profileRow.approval_status === 'rejected' && currentPath !== '/rejected') {
                  console.log('Sidebar: User rejected, redirecting to rejected page');
                  navigate('/rejected');
                  return;
                }
                
                // If suspended, redirect to suspended page
                if (profileRow.status === 'suspend' && currentPath !== '/suspended') {
                  console.log('Sidebar: User suspended, redirecting to suspended page');
                  navigate('/suspended');
                  return;
                }
                
                // If on hold, redirect to hold page
                if (profileRow.status === 'hold' && currentPath !== '/hold') {
                  console.log('Sidebar: User on hold, redirecting to hold page');
                  navigate('/hold');
                  return;
                }
                
                // If not approved, redirect to approval pending page
                if (profileRow.approval_status !== 'approved' && currentPath !== '/approval-pending') {
                  console.log('Sidebar: User not approved, redirecting to approval pending page');
                  navigate('/approval-pending');
                  return;
                }
              }
            } else {
              console.warn('Sidebar: No profile data found for user:', user.id);
              // Profile not found - user may have been deleted
              console.log('Sidebar: User profile not found (data is null), redirecting to login');
              // Sign out the user
              try {
                await signOut();
              } catch (signOutError) {
                console.error('Sidebar: Error signing out:', signOutError);
              }
              // Clear all caches
              try {
                localStorage.removeItem(`profile_${user.id}`);
                localStorage.removeItem(`profile_sidebar_${user.id}`);
                localStorage.removeItem(`profile_mobile_${user.id}`);
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
            console.error('Sidebar: Exception fetching profile:', error);
            // If exception indicates user not found or account deleted, redirect to login
            if (error?.code === 'PGRST116' || error?.message?.toLowerCase().includes('not found') || error?.message?.toLowerCase().includes('does not exist')) {
              console.log('Sidebar: User profile not found (exception), redirecting to login');
              // Sign out the user
              try {
                await signOut();
              } catch (signOutError) {
                console.error('Sidebar: Error signing out:', signOutError);
              }
              // Clear all caches
              try {
                localStorage.removeItem(`profile_${user.id}`);
                localStorage.removeItem(`profile_sidebar_${user.id}`);
                localStorage.removeItem(`profile_mobile_${user.id}`);
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
          }
        }
      }
    };

    fetchProfile();

    // Set up real-time subscription for profile updates and deletions
    if (user?.id) {
      const channel = supabase
        .channel(`sidebar_profile_updates_${user.id}`)
        .on('postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_profiles',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const updatedProfile = payload.new as UserProfile;
            const oldProfile = payload.old as UserProfile;
            
            // Check if this is a meaningful update (not just last_seen)
            const meaningfulFields = ['role', 'super_admin', 'approval_status', 'status', 'hold_end_time', 'user_name', 'email', 'employee_id'];
            const hasMeaningfulChange = meaningfulFields.some(field => {
              const newValue = (updatedProfile as any)[field];
              const oldValue = (oldProfile as any)?.[field];
              return newValue !== oldValue;
            });
            
            // Only log and update if there's a meaningful change
            if (hasMeaningfulChange) {
              setProfile(updatedProfile);

              // Update cache
              try {
                const cacheKey = `profile_sidebar_${user.id}`;
                localStorage.setItem(cacheKey, JSON.stringify(updatedProfile));
              } catch (e) {
                console.error('Error updating cache:', e);
              }

              // Check if user should be redirected (only for non-admin users)
              const isAdminOrSuperAdmin = updatedProfile.role === 'admin' || updatedProfile.role === 'super_admin' || updatedProfile.super_admin === true;
              
              if (!isAdminOrSuperAdmin) {
                const currentPath = location.pathname;
                
                if (updatedProfile.approval_status === 'rejected' && currentPath !== '/rejected') {
                  console.log('Sidebar: Status changed to rejected, redirecting to rejected page');
                  navigate('/rejected');
                  return;
                }
                
                if (updatedProfile.status === 'suspend' && currentPath !== '/suspended') {
                  console.log('Sidebar: Status changed to suspend, redirecting to suspended page');
                  navigate('/suspended');
                  return;
                }
                
                if (updatedProfile.status === 'hold' && currentPath !== '/hold') {
                  console.log('Sidebar: Status changed to hold, redirecting to hold page');
                  navigate('/hold');
                  return;
                }
                
                if (updatedProfile.approval_status !== 'approved' && currentPath !== '/approval-pending') {
                  console.log('Sidebar: Approval status changed, redirecting to approval pending page');
                  navigate('/approval-pending');
                  return;
                }
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
            console.log('=== SIDEBAR REALTIME DELETE RECEIVED ===');
            console.log('Profile deleted:', payload.old);
            console.log('User ID:', user.id);
            
            // Profile was deleted - redirect to login immediately
            console.log('Sidebar: Profile deleted in real-time, redirecting to login');
            
            // Sign out the user
            const handleDelete = async () => {
              try {
                await signOut();
              } catch (signOutError) {
                console.error('Sidebar: Error signing out:', signOutError);
              }
              
              // Clear all caches
              try {
                localStorage.removeItem(`profile_${user.id}`);
                localStorage.removeItem(`profile_sidebar_${user.id}`);
                localStorage.removeItem(`profile_mobile_${user.id}`);
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
          console.log('Sidebar realtime subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('Sidebar: Successfully subscribed to profile updates and deletions');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Sidebar: Error subscribing to profile updates');
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id, location.pathname, navigate, signOut]);

  // Fetch pending message counts and set up real-time notifications
  useEffect(() => {
    if (!user?.id) return;

    const fetchPendingCounts = async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          // @ts-ignore - Supabase type inference issue
          .select("sender_id, message, created_at")
          .eq("receiver_id", user.id)
          .eq("is_read", false);

        if (error) throw error;

        const counts: Record<string, number> = {};
        (data as any[])?.forEach((msg: any) => {
          counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
        });
        
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
        setTotalPendingCount(total);
      } catch (error) {
        console.error("Error fetching pending counts:", error);
      }
    };

    fetchPendingCounts();

    const updateWidgetState = () => {
      if (!user?.id) return;
      const stored = localStorage.getItem(`chat_widget_${user.id}`);
      if (stored) {
        try {
          const data = JSON.parse(stored);
          if (data?.selectedUser?.user_id && data?.chatOpen) {
            setWidgetActiveUserId(data.selectedUser.user_id);
            return;
          }
        } catch (err) {
          console.error('Error reading widget state:', err);
        }
      }
      setWidgetActiveUserId(null);
    };

    updateWidgetState();
    const storageHandler = (e: StorageEvent) => {
      if (user?.id && e.key === `chat_widget_${user.id}`) {
        updateWidgetState();
      }
    };
    window.addEventListener('storage', storageHandler);

    // Real-time subscription for new messages
    const channel = supabase
      .channel(`sidebar_messages_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const newMessage = payload.new as any;
          
          // Only show notification if message is unread and not from current user
          // Also don't show if user is currently on messaging page (they'll see it there)
          if (newMessage.sender_id !== user.id && !newMessage.is_read && location.pathname !== "/messaging") {
            // Check if chat widget is open for this conversation
            let widgetOpenForSender = false;
            try {
              const widgetDataRaw = localStorage.getItem(`chat_widget_${user.id}`);
              if (widgetDataRaw) {
                const widgetData = JSON.parse(widgetDataRaw);
                if (widgetData?.selectedUser?.user_id === newMessage.sender_id) {
                  // Treat widget as open when it is not minimized
                  widgetOpenForSender = widgetData.isMinimized === false;
                }
              }
            } catch (err) {
              console.error("Error checking chat widget state:", err);
            }

            if (widgetOpenForSender) {
              // Widget already showing this conversation; skip toast but refresh counts
              fetchPendingCounts();
              return;
            }

            // Fetch sender's name for notification
            try {
              const { data: senderData } = await supabase
                .from("user_profiles")
                .select("user_name, employee_id")
                .eq("user_id", newMessage.sender_id)
                .maybeSingle();

              const senderName = (senderData as any)?.user_name || "Unknown";
              
              // Show toast notification
              toast({
                title: "New Message",
                description: `${senderName}: ${newMessage.message?.substring(0, 50)}${newMessage.message?.length > 50 ? '...' : ''}`,
                variant: "default",
              });

              // Update pending count
              fetchPendingCounts();
            } catch (err) {
              console.error("Error fetching sender info:", err);
              // Still update count even if sender fetch fails
              fetchPendingCounts();
            }
          } else {
            // Still update count even if notification not shown
            fetchPendingCounts();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          // Refetch counts on any message change (INSERT, UPDATE, DELETE)
          fetchPendingCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('storage', storageHandler);
    };
  }, [user?.id, toast, location.pathname]);

  const handleLogout = async () => {
    try {
      await signOut();
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("userEmail");
      localStorage.removeItem("rememberMe");
      localStorage.removeItem("rememberedEmail");
      localStorage.removeItem("rememberedPassword");
      // Clear profile cache
      if (user?.id) {
        localStorage.removeItem(`profile_${user.id}`);
        localStorage.removeItem(`profile_sidebar_${user.id}`);
      }
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const formatLastLogin = (dateString?: string) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const navItems = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      ),
      adminOnly: false,
    },
    {
      name: "Users",
      path: "/users",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      ),
      adminOnly: true,
    },
    {
      name: "Contract",
      path: "/contract",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      ),
      adminOnly: false,
    },
    {
      name: "Messaging",
      path: "/messaging",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      ),
      adminOnly: false,
    },
    {
      name: "Influencer",
      path: "/influencer",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
      ),
      adminOnly: false,
    },
    {
      name: "Product",
      path: "/product",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      ),
      adminOnly: false,
    },
  ];

  // Filter nav items based on user role
  const filteredNavItems = navItems.filter(item => {
    if (!item.adminOnly) return true;
    // Admin-only items are visible only when profile explicitly indicates admin or super_admin
    return Boolean(profile && (profile.role === 'admin' || profile.super_admin));
  });

  return (
    <aside className="hidden lg:flex flex-col w-56 bg-card border-r border-border/50 fixed left-0 top-0 h-screen z-40">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
            <i className="fi fi-sr-signature text-primary text-xl"></i>
          </div>
          <div>
            <h1 className="text-base font-bold bg-gradient-primary bg-clip-text text-transparent">
              Signify
            </h1>
            <p className="text-xs text-muted-foreground">Growwik Media</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1.5">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          const showBadge = item.path === "/messaging" && totalPendingCount > 0 && !widgetActiveUserId;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-300 relative",
                isActive
                  ? "bg-gradient-primary text-white shadow-md"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {item.icon}
              </svg>
              <span className="font-medium text-sm">{item.name}</span>
              {showBadge && (
                <Badge 
                  variant="destructive" 
                  className="ml-auto h-5 min-w-5 px-1.5 text-xs flex items-center justify-center"
                >
                  {totalPendingCount > 99 ? '99+' : totalPendingCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border/50 space-y-2">
        <div className="bg-card border border-border/50 rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-start gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-semibold text-sm shrink-0 shadow-md">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate mb-0.5">
                {profile?.user_name || (user as any)?.user_metadata?.full_name || user?.email?.split("@")[0] || userEmail.split("@")[0] || "User"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {profile?.email || user?.email || userEmail || "user@example.com"}
              </p>
            </div>
          </div>
          
          <div className="space-y-1.5 mb-3 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Employee ID:</span>
              <span className="font-medium text-foreground">{profile?.employee_id || "Not assigned"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Last Login:</span>
              <span className="font-medium text-foreground">{formatLastLogin((user as any)?.last_sign_in_at || profile?.updated_at)}</span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/settings")}
              className="w-8 h-8 p-0 text-xs hover:bg-primary/10 hover:text-primary hover:border-primary transition-all duration-300"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              </svg>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex-1 h-8 text-xs hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-all duration-300"
            >
              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
