import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";

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

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState<string>("User");
  const [profile, setProfile] = useState<UserProfile | null>(null);

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
        console.error('Dashboard: Error updating last_seen:', error);
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
        console.log('Dashboard: User inactive for 1 minute, stopping last_seen updates');
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
        console.log('Dashboard: Fetching profile for user:', user.id);
        const { data, error } = await supabase
          .from('user_profiles')
          .select('user_name, email, role, super_admin, approval_status, status, employee_id, updated_at, hold_end_time')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Dashboard: Error fetching profile:', error);
          // If error indicates user not found or account deleted, redirect to login
          if (error.code === 'PGRST116' || error.message?.toLowerCase().includes('not found') || error.message?.toLowerCase().includes('does not exist')) {
            console.log('Dashboard: User profile not found (error), redirecting to login');
            // Sign out the user
            try {
              await signOut();
            } catch (signOutError) {
              console.error('Dashboard: Error signing out:', signOutError);
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
              console.log('Dashboard: Hold period expired, auto-updating status to active');
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
                      }));
                      localStorage.setItem(`profile_${user.id}`, JSON.stringify(updatedProfile));
                      if (updatedProfile.role) localStorage.setItem('currentUserRole', updatedProfile.role);
                      if (typeof updatedProfile.super_admin === 'boolean') localStorage.setItem('isSuperAdmin', String(updatedProfile.super_admin));
                    } catch (e) {
                      console.error('Error updating cache:', e);
                    }
                    
                    // Redirect if needed
                    if (updatedProfile.status === 'active' && updatedProfile.approval_status === 'approved') {
                      // Already on dashboard, no redirect needed
                      return;
                    }
                  }
                  return;
                }
              } catch (updateErr) {
                console.error('Dashboard: Error auto-updating expired hold status:', updateErr);
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
            }));
            localStorage.setItem(`profile_${user.id}`, JSON.stringify(userProfile));
            if (userProfile.role) localStorage.setItem('currentUserRole', userProfile.role);
            if (typeof userProfile.super_admin === 'boolean') localStorage.setItem('isSuperAdmin', String(userProfile.super_admin));
          } catch (e) {
            console.error('Error updating cache:', e);
          }

          // Check if user should be redirected (only for non-admin users)
          const isAdminOrSuperAdmin = userProfile.role === 'admin' || userProfile.role === 'super_admin' || userProfile.super_admin === true;
          
          if (!isAdminOrSuperAdmin) {
            const currentPath = window.location.pathname;
            
            if (userProfile.approval_status === 'rejected' && currentPath !== '/rejected') {
              console.log('Dashboard: User rejected, redirecting to rejected page');
              navigate('/rejected');
              return;
            }
            
            if (userProfile.status === 'suspend' && currentPath !== '/suspended') {
              console.log('Dashboard: User suspended, redirecting to suspended page');
              navigate('/suspended');
              return;
            }
            
            if (userProfile.status === 'hold' && currentPath !== '/hold') {
              console.log('Dashboard: User on hold, redirecting to hold page');
              navigate('/hold');
              return;
            }
            
            if (userProfile.approval_status !== 'approved' && currentPath !== '/approval-pending') {
              console.log('Dashboard: User not approved, redirecting to approval pending page');
              navigate('/approval-pending');
              return;
            }
          }
        } else {
          // Profile not found - user may have been deleted
          console.log('Dashboard: User profile not found (data is null), redirecting to login');
          // Sign out the user
          try {
            await signOut();
          } catch (signOutError) {
            console.error('Dashboard: Error signing out:', signOutError);
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
        console.error('Dashboard: Exception fetching profile:', error);
        // If exception indicates user not found or account deleted, redirect to login
        if (error?.code === 'PGRST116' || error?.message?.toLowerCase().includes('not found') || error?.message?.toLowerCase().includes('does not exist')) {
          console.log('Dashboard: User profile not found (exception), redirecting to login');
          // Sign out the user
          try {
            await signOut();
          } catch (signOutError) {
            console.error('Dashboard: Error signing out:', signOutError);
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
    const channel = supabase
      .channel(`dashboard_profile_updates_${user.id}`)
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('=== DASHBOARD REALTIME UPDATE RECEIVED ===');
          console.log('Profile updated:', payload.new);
          console.log('Old values:', payload.old);
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
            }));
            localStorage.setItem(`profile_${user.id}`, JSON.stringify(updatedProfile));
            if (updatedProfile.role) localStorage.setItem('currentUserRole', updatedProfile.role);
            if (typeof updatedProfile.super_admin === 'boolean') localStorage.setItem('isSuperAdmin', String(updatedProfile.super_admin));
          } catch (e) {
            console.error('Error updating cache:', e);
          }

          // Check if user should be redirected (only for non-admin users)
          const isAdminOrSuperAdmin = updatedProfile.role === 'admin' || updatedProfile.role === 'super_admin' || updatedProfile.super_admin === true;
          
          if (!isAdminOrSuperAdmin) {
            const currentPath = window.location.pathname;
            
            if (updatedProfile.approval_status === 'rejected' && currentPath !== '/rejected') {
              console.log('Dashboard: Status changed to rejected, redirecting to rejected page');
              navigate('/rejected');
              return;
            }
            
            if (updatedProfile.status === 'suspend' && currentPath !== '/suspended') {
              console.log('Dashboard: Status changed to suspend, redirecting to suspended page');
              navigate('/suspended');
              return;
            }
            
            if (updatedProfile.status === 'hold' && currentPath !== '/hold') {
              console.log('Dashboard: Status changed to hold, redirecting to hold page');
              navigate('/hold');
              return;
            }
            
            if (updatedProfile.approval_status !== 'approved' && currentPath !== '/approval-pending') {
              console.log('Dashboard: Approval status changed, redirecting to approval pending page');
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
          console.log('=== DASHBOARD REALTIME DELETE RECEIVED ===');
          console.log('Profile deleted:', payload.old);
          console.log('User ID:', user.id);
          
          // Profile was deleted - redirect to login immediately
          console.log('Dashboard: Profile deleted in real-time, redirecting to login');
          
          // Sign out the user
          const handleDelete = async () => {
            try {
              await signOut();
            } catch (signOutError) {
              console.error('Dashboard: Error signing out:', signOutError);
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
        console.log('Dashboard realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Dashboard: Successfully subscribed to profile updates and deletions');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Dashboard: Error subscribing to profile updates');
        }
      });

    return () => {
      supabase.removeChannel(channel);
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
  }, [user?.id, authLoading, navigate]);

  return (
    <div className="flex min-h-screen bg-gradient-subtle">
      <Sidebar />
      
      <div className="flex-1 lg:ml-56">
        <Header />
        <main className="container mx-auto px-4 py-4 pb-24 lg:pb-6 animate-fade-in max-w-7xl">
          <div className="bg-gradient-primary rounded-xl p-4 md:p-6 text-white shadow-glow mb-6">
            <h2 className="text-xl md:text-2xl font-bold mb-1">Welcome back, {displayName}!</h2>
            <p className="text-white/80 text-sm">Dashboard</p>
          </div>

          {/* Blank content area - design later */}
          <div className="bg-card rounded-lg p-8 border border-border/50">
            <p className="text-muted-foreground text-center">Dashboard content will be designed here</p>
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
};

export default Dashboard;
