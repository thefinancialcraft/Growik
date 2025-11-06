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
