import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface UserProfile {
  role?: 'user' | 'admin' | 'super_admin';
  super_admin?: boolean;
}

const MobileNav = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;

      try {
        // Check cache first
        const cacheKey = `profile_mobile_${user.id}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const cachedData = JSON.parse(cached);
          setProfile(cachedData);
        }

        // Fetch from database
        const { data: profileData, error } = await supabase
          .from('user_profiles')
          .select('role, super_admin')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileData) {
          setProfile(profileData);
          localStorage.setItem(cacheKey, JSON.stringify(profileData));
        }
      } catch (error) {
        console.error('Error fetching profile for mobile nav:', error);
      }
    };

    fetchProfile();
  }, [user?.id]);

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
      name: "Contract",
      path: "/contract",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
      name: "Campaign",
      path: "/campaign",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m4 6.341l1.553 1.552a1.414 1.414 0 002 0L21 9l-3.447-3.894a1.414 1.414 0 00-2 0L14 6.659m-1 2.682L3 18" />
      ),
      adminOnly: false,
    },
    {
      name: "Collaboration",
      path: "/collaboration",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4a8 8 0 00-8 8 8 8 0 0014.32 4.906l2.36.864-1.012-2.764A8 8 0 0012 4zm0 4a4 4 0 11-2.828 6.828l-1.414 1.414A6 6 0 1012 6zm0 2a2 2 0 100 4 2 2 0 000-4z" />
      ),
      adminOnly: false,
    },
  ];

  // Filter nav items based on user role
  const filteredNavItems = navItems.filter(item => {
    if (!item.adminOnly) return true;
    // Admin-only items are visible only when profile explicitly indicates admin or super_admin
    return Boolean(profile && (profile.role === 'admin' || profile.role === 'super_admin' || profile.super_admin));
  });

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200/60 z-50 safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="flex justify-around items-center h-18 px-1 sm:px-2 pb-2 pt-1">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path === '/dashboard' && location.pathname === '/');
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-2 sm:px-3 py-2 rounded-2xl transition-all duration-300 min-w-[64px] relative group",
                isActive
                  ? "text-primary"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <svg 
                className={cn(
                  "w-5 h-5 sm:w-6 sm:h-6 transition-all duration-300",
                  isActive && "scale-110 drop-shadow-sm"
                )} 
                fill="none" 
                stroke="currentColor" 
                strokeWidth={isActive ? 2.5 : 2}
                viewBox="0 0 24 24"
              >
                {item.icon}
              </svg>
              <span className={cn(
                "text-[10px] sm:text-xs font-medium transition-all duration-300 leading-tight text-center",
                isActive ? "font-semibold text-primary" : "text-slate-600 group-hover:text-slate-900"
              )}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
