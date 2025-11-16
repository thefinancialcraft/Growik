import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, ArrowRight, CheckCircle, Clock, FileText, LogOut, Shield, Users as UsersIcon } from "lucide-react";

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

  const signOutRef = useRef(signOut);
  useEffect(() => {
    signOutRef.current = signOut;
  }, [signOut]);

  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    if (authLoading) return;

    const signOutFn = signOutRef.current;
    const navigateFn = navigateRef.current;

    if (!user) {
      navigateFn("/");
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
      // Use centralized utility function
      const { updateLastSeen: updateLastSeenUtil } = await import('@/lib/userProfile');
      await updateLastSeenUtil(user.id);
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
        const { getUserProfile, updateUserProfile } = await import('@/lib/userProfile');
        let userProfile = await getUserProfile(user.id);

        if (!userProfile) {
          console.log('Dashboard: User profile not found, redirecting to login');
            // Sign out the user
            try {
            await signOutFn();
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
          
        if (userProfile) {
          // Check if hold period expired and auto-update status (only for role='user')
          if (userProfile.status === 'hold' && userProfile.role === 'user' && userProfile.hold_end_time) {
            const now = new Date().getTime();
            const endTime = new Date(userProfile.hold_end_time).getTime();
            if (endTime <= now) {
              console.log('Dashboard: Hold period expired, auto-updating status to active');
              const updated = await updateUserProfile(user.id, {
                    status: 'active',
                    status_reason: 'hold expired account active by system',
                    hold_end_time: null,
                    hold_duration_days: null
              } as any);
                  
              if (updated) {
                userProfile = updated;
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
          
          // Redirect if needed
          if (userProfile.status === 'active' && userProfile.approval_status === 'approved') {
            // Already on dashboard, no redirect needed
            return;
          }

          // Check if user should be redirected (only for non-admin users)
          const isAdminOrSuperAdmin = userProfile.role === 'admin' || userProfile.role === 'super_admin' || userProfile.super_admin === true;
          
          if (!isAdminOrSuperAdmin) {
            const currentPath = window.location.pathname;
            
            if (userProfile.approval_status === 'rejected' && currentPath !== '/rejected') {
              console.log('Dashboard: User rejected, redirecting to rejected page');
              navigateFn('/rejected');
              return;
            }
            
            if (userProfile.status === 'suspend' && currentPath !== '/suspended') {
              console.log('Dashboard: User suspended, redirecting to suspended page');
              navigateFn('/suspended');
              return;
            }
            
            if (userProfile.status === 'hold' && currentPath !== '/hold') {
              console.log('Dashboard: User on hold, redirecting to hold page');
              navigateFn('/hold');
              return;
            }
            
            if (userProfile.approval_status !== 'approved' && currentPath !== '/approval-pending') {
              console.log('Dashboard: User not approved, redirecting to approval pending page');
              navigateFn('/approval-pending');
              return;
            }
          }
        } else {
          // Profile not found - user may have been deleted
          console.log('Dashboard: User profile not found (data is null), redirecting to login');
          // Sign out the user
          try {
            await signOutFn();
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
            await signOutFn();
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
  }, [user?.id, authLoading]);

  const lastUpdated = profile?.updated_at ? new Date(profile.updated_at) : null;
  const approvalStatus = profile?.approval_status ?? "pending";
  const accountStatus = profile?.status ?? "active";
  const roleLabel = profile?.super_admin ? "Super Admin" : profile?.role ?? "User";
  const employeeId = profile?.employee_id ?? "Not assigned";

  const stats = useMemo(
    () => [
      {
        id: "role",
        title: "Role",
        value: roleLabel,
        subtext: profile?.super_admin ? "Full platform authority" : "Current access level",
        accent: "from-purple-500/90 to-fuchsia-500/60",
        icon: Shield,
      },
      {
        id: "approval",
        title: "Approval",
        value: approvalStatus.charAt(0).toUpperCase() + approvalStatus.slice(1),
        subtext: approvalStatus === "approved" ? "Enjoy full workspace access" : "Awaiting admin review",
        accent: "from-indigo-500/90 to-blue-500/60",
        icon: CheckCircle,
      },
      {
        id: "status",
        title: "Account Status",
        value: accountStatus.charAt(0).toUpperCase() + accountStatus.slice(1),
        subtext: accountStatus === "active" ? "All systems operational" : "Action required",
        accent: "from-emerald-500/90 to-lime-500/60",
        icon: Activity,
      },
      {
        id: "employee-id",
        title: "Employee ID",
        value: employeeId,
        subtext: employeeId === "Not assigned" ? "Generate after approval" : "Internal reference",
        accent: "from-sky-500/90 to-cyan-500/60",
        icon: UsersIcon,
      },
    ],
    [roleLabel, profile?.super_admin, approvalStatus, accountStatus, employeeId]
  );

  const statusBadge = () => {
    if (accountStatus === "active") return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    if (accountStatus === "hold") return "bg-yellow-100 text-yellow-700 border border-yellow-200";
    if (accountStatus === "suspend") return "bg-red-100 text-red-700 border border-red-200";
    return "bg-slate-100 text-slate-600 border border-slate-200";
  };

  const approvalBadge = () => {
    if (approvalStatus === "approved") return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    if (approvalStatus === "pending") return "bg-yellow-100 text-yellow-700 border border-yellow-200";
    if (approvalStatus === "rejected") return "bg-red-100 text-red-700 border border-red-200";
    return "bg-slate-100 text-slate-600 border border-slate-200";
  };

  return (
    <div className="flex min-h-screen bg-gradient-subtle">
      <Sidebar />

      <div className="flex-1 lg:ml-56">
        <Header />
        <main className="container mx-auto px-3 sm:px-4 py-4 space-y-6 pb-24 lg:pb-8 animate-fade-in max-w-7xl">
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-3xl bg-primary text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.28),transparent_55%)]" />
              <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="relative p-6 sm:p-8 space-y-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">Overview</p>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">Welcome back, {displayName}!</h1>
                    <p className="text-sm sm:text-base text-white/80 max-w-2xl">
                      Monitor your account status, team access, and quick entry points across the Growik workspace.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={`rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-white/90 ${statusBadge()}`}>
                        Status: {accountStatus}
                      </Badge>
                      <Badge className={`rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold text-white/90 ${approvalBadge()}`}>
                        Approval: {approvalStatus}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 rounded-2xl border border-white/30 bg-white/10 p-5 backdrop-blur-lg text-sm text-white/90 max-w-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Employee ID</span>
                      <span>{employeeId}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Role</span>
                      <span>{roleLabel}</span>
                    </div>
                    {lastUpdated && (
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <span className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" /> Last updated
                        </span>
                        <span>{lastUpdated.toLocaleString()}</span>
                      </div>
                    )}
                    <Button
                      onClick={() => navigate("/users")}
                      variant="secondary"
                      className="mt-2 w-full justify-between bg-white text-indigo-600 hover:bg-white/90"
                    >
                      Manage workspace
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                  {stats.map(({ id, title, value, subtext, accent, icon: Icon }) => (
                    <Card
                      key={id}
                      className="relative overflow-hidden bg-white/90 px-4 py-4 border border-white/20 backdrop-blur transition-transform duration-200 hover:-translate-y-1"
                    >
                      <div className={`absolute inset-0 opacity-[0.08] pointer-events-none bg-gradient-to-br ${accent}`} />
                      <div className="relative flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">{title}</p>
                          <p className="text-lg font-semibold text-slate-900">{value}</p>
                          <p className="text-[11px] text-slate-500">{subtext}</p>
                        </div>
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white bg-gradient-to-br ${accent}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
              <Card className="lg:col-span-2 border-none bg-white/95 backdrop-blur">
                <div className="p-5 sm:p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Account Insights</h2>
                      <p className="text-sm text-slate-500">Quick information about your current workspace access.</p>
                    </div>
                    <Badge className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge()}`}>
                      {accountStatus.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                      <h3 className="text-sm font-semibold text-slate-800">Profile Summary</h3>
                      <div className="space-y-2 text-sm text-slate-600">
                        <div className="flex items-center justify-between">
                          <span>Name</span>
                          <span className="font-medium text-slate-900">{profile?.user_name ?? displayName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Email</span>
                          <span className="font-medium text-slate-900">{profile?.email ?? user?.email ?? "-"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Contact</span>
                          <span className="font-medium text-slate-900">{profile?.contact_no ?? "Not provided"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                      <h3 className="text-sm font-semibold text-slate-800">Status Details</h3>
                      <div className="space-y-2 text-sm text-slate-600">
                        <div className="flex items-center justify-between">
                          <span>Account Status</span>
                          <span className="font-medium text-slate-900 capitalize">{accountStatus}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Approval</span>
                          <span className="font-medium text-slate-900 capitalize">{approvalStatus}</span>
                        </div>
                        {profile?.hold_end_time && (
                          <div className="flex items-center justify-between">
                            <span>Hold ends</span>
                            <span className="font-medium text-slate-900">{new Date(profile.hold_end_time).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="border-none bg-white/95 backdrop-blur">
                <div className="p-5 sm:p-6 space-y-5">
                  <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
                  <div className="flex flex-col gap-3">
                    <Button
                      variant="outline"
                      className="justify-start gap-3 rounded-xl border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-indigo-50/90 hover:text-indigo-600"
                      onClick={() => navigate("/users")}
                    >
                      <UsersIcon className="h-4 w-4" /> Manage Users
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start gap-3 rounded-xl border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-indigo-50/90 hover:text-indigo-600"
                      onClick={() => navigate("/contract")}
                    >
                      <FileText className="h-4 w-4" /> View Contracts
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start gap-3 rounded-xl border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-indigo-50/90 hover:text-indigo-600"
                      onClick={() => navigate("/influencer")}
                    >
                      <Shield className="h-4 w-4" /> Influencer Hub
                    </Button>
                  </div>
                  <div className="rounded-2xl border border-red-100 bg-red-50/80 p-4 text-sm text-red-700 space-y-3">
                    <div className="flex items-center gap-2">
                      <LogOut className="h-4 w-4" />
                      <span className="font-semibold">Need to sign out?</span>
                    </div>
                    <p>Securely log out of your workspace when leaving the desk.</p>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={async () => {
                        try {
                          const signOutFn = signOutRef.current;
                          await signOutFn();
                          navigateRef.current?.("/login");
                        } catch (error) {
                          console.error("Error signing out:", error);
                        }
                      }}
                    >
                      Sign out
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
};

export default Dashboard;
