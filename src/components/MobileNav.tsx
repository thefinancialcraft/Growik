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
      name: "Messages",
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
    {
      name: "Companies",
      path: "/companies",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
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
  ];

  // Filter nav items based on user role
  const filteredNavItems = navItems.filter(item => {
    if (!item.adminOnly) return true;
    // Admin-only items are visible only when profile explicitly indicates admin or super_admin
    return Boolean(profile && (profile.role === 'admin' || profile.role === 'super_admin' || profile.super_admin));
  });

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border/50 z-50 safe-area-bottom shadow-lg">
      <div className="flex justify-around items-center h-16 px-2">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path === '/dashboard' && location.pathname === '/');
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all duration-300 min-w-[60px] relative",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <svg 
                className={cn(
                  "w-6 h-6 transition-all duration-300",
                  isActive && "scale-110"
                )} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                {item.icon}
              </svg>
              <span className={cn(
                "text-xs font-medium transition-all duration-300",
                isActive && "font-semibold"
              )}>
                {item.name}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-b-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
