import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useIsMobile } from "@/hooks/use-mobile";
import { LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  user_name?: string;
  employee_id?: string;
}

const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const userEmail = localStorage.getItem("userEmail") || "";
  
  // Get initials from name (first letter) or email (first 2 letters) as fallback
  // This will recalculate when profile changes
  const getInitials = (profileData: UserProfile | null) => {
    if (profileData?.user_name) {
      const name = profileData.user_name.trim();
      if (name) {
        return name.charAt(0).toUpperCase();
      }
    }
    const emailSource = userEmail || user?.email || "";
    if (emailSource) {
      return emailSource.slice(0, 2).toUpperCase();
    }
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
        console.error('Header: Error updating last_seen:', error);
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
        console.log('Header: User inactive for 1 minute, stopping last_seen updates');
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
        const cacheKey = `profile_${user.id}`;
        const sidebarCacheKey = `profile_sidebar_${user.id}`;
        
        // Check cache for immediate UI update
        const cached = localStorage.getItem(cacheKey) || localStorage.getItem(sidebarCacheKey);
        if (cached) {
          try {
            const cachedData = JSON.parse(cached);
            if (cachedData.user_name) {
              setProfile(cachedData);
            }
          } catch (e) {
            // Invalid cache, ignore
          }
        }

        // Always fetch fresh data from database
        try {
          console.log('Header: Fetching profile for user:', user.id);
          console.log('Header: Query: SELECT user_name, employee_id FROM user_profiles WHERE user_id =', user.id);
          
          const { data, error } = await supabase
            .from('user_profiles')
            .select('user_name, employee_id')
            .eq('user_id', user.id)
            .maybeSingle();
          
          console.log('Header: Query response - data:', data, 'error:', error);
          
          if (error) {
            console.error('Header: Error fetching profile:', error);
            console.error('Header: Error details:', {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code
            });
            
            // If error indicates user not found or account deleted, redirect to login
            if (error.code === 'PGRST116' || error.message?.toLowerCase().includes('not found') || error.message?.toLowerCase().includes('does not exist')) {
              console.log('Header: User profile not found (error), redirecting to login');
              // Sign out the user
              try {
                await signOut();
              } catch (signOutError) {
                console.error('Header: Error signing out:', signOutError);
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
            
            // Try alternative query to debug
            console.log('Header: Trying alternative query with all fields...');
            const { data: altData, error: altError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', user.id)
              .maybeSingle();
            console.log('Header: Alternative query result:', altData, altError);
            return;
          }
          // If no data by user_id, try fallback by email
          let profileRow = data as any;
          if (!profileRow && user.email) {
            console.log('Header: Trying fallback by email:', user.email);
            const { data: byEmail, error: byEmailErr } = await supabase
              .from('user_profiles')
              .select('user_name, employee_id')
              .eq('email', user.email)
              .maybeSingle();
            console.log('Header: Fallback by email result:', byEmail, byEmailErr);
            if (!byEmailErr) {
              profileRow = byEmail;
            }
          }

          if (profileRow) {
            console.log('Header: Profile data received:', data);
            console.log('Header: Employee ID:', profileRow.employee_id);
            setProfile(profileRow);
            // Update both cache keys
            localStorage.setItem(cacheKey, JSON.stringify(profileRow));
            // Also check sidebar cache and update if exists
            const sidebarCache = localStorage.getItem(sidebarCacheKey);
            if (sidebarCache) {
              try {
                const sidebarData = JSON.parse(sidebarCache);
                sidebarData.employee_id = profileRow.employee_id;
                sidebarData.user_name = profileRow.user_name;
                localStorage.setItem(sidebarCacheKey, JSON.stringify(sidebarData));
              } catch (e) {
                // Ignore cache update errors
              }
            }
          } else {
            console.warn('Header: No profile data found for user:', user.id);
            // Profile not found - user may have been deleted
            console.log('Header: User profile not found (data is null), redirecting to login');
            // Sign out the user
            try {
              await signOut();
            } catch (signOutError) {
              console.error('Header: Error signing out:', signOutError);
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
          console.error('Header: Exception fetching profile:', error);
          // If exception indicates user not found or account deleted, redirect to login
          if (error?.code === 'PGRST116' || error?.message?.toLowerCase().includes('not found') || error?.message?.toLowerCase().includes('does not exist')) {
            console.log('Header: User profile not found (exception), redirecting to login');
            // Sign out the user
            try {
              await signOut();
            } catch (signOutError) {
              console.error('Header: Error signing out:', signOutError);
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
    };

    fetchProfile();

    // Set up real-time subscription for profile updates and deletions
    if (user?.id) {
      const channel = supabase
        .channel(`header_profile_updates_${user.id}`)
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
                const cacheKey = `profile_${user.id}`;
                const sidebarCacheKey = `profile_sidebar_${user.id}`;
                localStorage.setItem(cacheKey, JSON.stringify(updatedProfile));
                const sidebarCache = localStorage.getItem(sidebarCacheKey);
                if (sidebarCache) {
                  try {
                    const sidebarData = JSON.parse(sidebarCache);
                    sidebarData.employee_id = updatedProfile.employee_id;
                    sidebarData.user_name = updatedProfile.user_name;
                    localStorage.setItem(sidebarCacheKey, JSON.stringify(sidebarData));
                  } catch (e) {
                    // Ignore cache update errors
                  }
                }
              } catch (e) {
                console.error('Error updating cache:', e);
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
            console.log('=== HEADER REALTIME DELETE RECEIVED ===');
            console.log('Profile deleted:', payload.old);
            console.log('User ID:', user.id);
            
            // Profile was deleted - redirect to login immediately
            console.log('Header: Profile deleted in real-time, redirecting to login');
            
            // Sign out the user
            const handleDelete = async () => {
              try {
                await signOut();
              } catch (signOutError) {
                console.error('Header: Error signing out:', signOutError);
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
          console.log('Header realtime subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('Header: Successfully subscribed to profile updates and deletions');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Header: Error subscribing to profile updates');
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id, signOut]);

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
        localStorage.removeItem(`profile_mobile_${user.id}`);
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

  // Mobile header design
  if (isMobile) {
    return (
      <header className="lg:hidden bg-card border-b border-border/50 shadow-sm sticky top-0 z-50 backdrop-blur-sm bg-card/95">
        <div className="px-4 py-3 flex items-center justify-between">
          {/* Left: User Avatar (Clickable to open Settings) */}
          <button
            onClick={() => navigate("/settings")}
            className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-white font-semibold text-base shrink-0 hover:bg-slate-700 transition-colors cursor-pointer"
            aria-label="Open Settings"
          >
            {initials}
          </button>

          {/* Center: Username */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <h1 className="text-base font-bold text-gray-900 leading-tight">
              {profile?.user_name || (user as any)?.user_metadata?.full_name || user?.email?.split("@")[0] || userEmail.split("@")[0] || "User"}
            </h1>
            <p className="text-xs text-gray-500 leading-tight">
              Signify - Growwik Media
            </p>
          </div>

          {/* Right: Logout Icon */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-orange-500 hover:text-orange-600 shrink-0"
            aria-label="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>
    );
  }

  // Desktop header design (existing)
  return (
    <header className="hidden lg:block bg-card border-b border-border/50 shadow-sm sticky top-0 z-50 backdrop-blur-sm bg-card/95">
      <div className="container mx-auto px-4 py-2.5 flex items-center justify-between max-w-7xl">
        {/* Left: User Profile */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-white font-semibold text-xs shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {profile?.user_name || (user as any)?.user_metadata?.full_name || user?.email?.split("@")[0] || userEmail.split("@")[0] || "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              Employee ID: {profile?.employee_id || "Not assigned"}
            </p>
          </div>
        </div>

        {/* Right: Logo */}
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
    </header>
  );
};

export default Header;
